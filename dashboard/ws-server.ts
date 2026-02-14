// Standalone WebSocket server for XDCNetOwn Dashboard
// Run with: npx tsx ws-server.ts

import WebSocket, { WebSocketServer } from 'ws';
import { Pool } from 'pg';
import { verify } from 'jsonwebtoken';

const WS_PORT = parseInt(process.env.WS_PORT || '3006');
const DATABASE_URL = process.env.DATABASE_URL;
const JWT_SECRET = process.env.JWT_SECRET || process.env.API_KEYS?.split(',')[0] || 'dev-secret-change-in-production';
const WS_AUTH_REQUIRED = process.env.WS_AUTH_REQUIRED !== 'false'; // Default to true

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is required');
  process.exit(1);
}

// Type assertion since we checked above
const DB_URL: string = DATABASE_URL;

// Database pool
const pool = new Pool({
  connectionString: DB_URL,
  max: 5,
  idleTimeoutMillis: 30000,
});

// Track subscribed channels per client
const clientSubscriptions = new Map<WebSocket, Set<string>>();
const authenticatedClients = new WeakSet<WebSocket>();

interface BroadcastMessage {
  type: 'metrics' | 'incidents' | 'peers' | 'health' | 'error' | 'ack' | 'auth_required' | 'auth_success';
  data: unknown;
  timestamp: string;
}

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  nodeId?: string;
  isAuthenticated: boolean;
}

async function query(text: string, params?: any[]): Promise<any> {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}

async function getLatestMetrics(): Promise<any[]> {
  try {
    const result = await query(`
      SELECT DISTINCT ON (node_id) 
        node_id, block_height, sync_percent, peer_count, cpu_percent,
        memory_percent, disk_percent, tx_pool_pending, tx_pool_queued,
        gas_price, tps, rpc_latency_ms, is_syncing, client_version, coinbase,
        collected_at
      FROM netown.node_metrics
      ORDER BY node_id, collected_at DESC
    `);
    return result.rows;
  } catch {
    return [];
  }
}

async function getActiveIncidents(): Promise<any[]> {
  try {
    const result = await query(`
      SELECT i.*, n.name as node_name
      FROM netown.incidents i
      JOIN netown.nodes n ON i.node_id = n.id
      WHERE i.status = 'active'
      ORDER BY i.detected_at DESC
      LIMIT 50
    `);
    return result.rows;
  } catch {
    return [];
  }
}

async function getPeersOverview(): Promise<{
  totalPeers: number;
  byCountry: Record<string, number>;
  byDirection: { inbound: number; outbound: number };
}> {
  try {
    const result = await query(`
      WITH latest_peers AS (
        SELECT DISTINCT ON (peer_enode) 
          peer_enode, remote_ip, country, direction
        FROM netown.peer_snapshots
        WHERE collected_at > NOW() - INTERVAL '10 minutes'
        ORDER BY peer_enode, collected_at DESC
      )
      SELECT 
        COUNT(*) as total_peers,
        COUNT(*) FILTER (WHERE direction = 'inbound') as inbound,
        COUNT(*) FILTER (WHERE direction = 'outbound') as outbound
      FROM latest_peers
    `);

    const row = result.rows[0] || {};
    return {
      totalPeers: parseInt(row.total_peers || '0'),
      byCountry: {},
      byDirection: {
        inbound: parseInt(row.inbound || '0'),
        outbound: parseInt(row.outbound || '0'),
      },
    };
  } catch {
    return { totalPeers: 0, byCountry: {}, byDirection: { inbound: 0, outbound: 0 } };
  }
}

async function getLatestHealth(): Promise<any | null> {
  try {
    const result = await query(`
      SELECT * FROM netown.network_health
      ORDER BY collected_at DESC
      LIMIT 1
    `);
    return result.rows[0] || null;
  } catch {
    return null;
  }
}

function broadcastToChannel(wss: WebSocketServer, channel: string, data: unknown): void {
  const message: BroadcastMessage = {
    type: channel as BroadcastMessage['type'],
    data,
    timestamp: new Date().toISOString(),
  };

  const messageStr = JSON.stringify(message);

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      const subs = clientSubscriptions.get(client);
      if (subs?.has(channel) || subs?.has('all')) {
        client.send(messageStr);
      }
    }
  });
}

async function broadcastUpdates(wss: WebSocketServer): Promise<void> {
  try {
    const [metrics, incidents, peers, health] = await Promise.all([
      getLatestMetrics(),
      getActiveIncidents(),
      getPeersOverview(),
      getLatestHealth(),
    ]);

    broadcastToChannel(wss, 'metrics', { nodes: metrics.length, data: metrics });
    broadcastToChannel(wss, 'incidents', { count: incidents.length, data: incidents });
    broadcastToChannel(wss, 'peers', peers);
    broadcastToChannel(wss, 'health', health);
  } catch (error) {
    console.error('[WebSocket] Broadcast error:', error);
  }
}

function authenticateClient(token: string): { valid: boolean; userId?: string; nodeId?: string } {
  try {
    // Check if token matches API key (simple auth)
    const apiKeys = process.env.API_KEYS?.split(',') || [];
    if (apiKeys.includes(token)) {
      return { valid: true, userId: 'api-key-user' };
    }
    
    // Try JWT verification
    const decoded = verify(token, JWT_SECRET) as { userId?: string; nodeId?: string };
    return { valid: true, ...decoded };
  } catch {
    return { valid: false };
  }
}

function handleClientMessage(ws: AuthenticatedWebSocket, message: string): void {
  try {
    const data = JSON.parse(message);

    switch (data.type) {
      case 'auth': {
        if (!data.token) {
          ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Token required' },
            timestamp: new Date().toISOString(),
          }));
          return;
        }
        
        const auth = authenticateClient(data.token);
        if (!auth.valid) {
          ws.send(JSON.stringify({
            type: 'error',
            data: { message: 'Invalid token' },
            timestamp: new Date().toISOString(),
          }));
          ws.close(1008, 'Invalid token');
          return;
        }
        
        ws.isAuthenticated = true;
        ws.userId = auth.userId;
        ws.nodeId = auth.nodeId;
        authenticatedClients.add(ws);
        
        ws.send(JSON.stringify({
          type: 'auth_success',
          data: { userId: auth.userId },
          timestamp: new Date().toISOString(),
        }));
        break;
      }

      case 'subscribe': {
        // Check authentication if required
        if (WS_AUTH_REQUIRED && !ws.isAuthenticated) {
          ws.send(JSON.stringify({
            type: 'auth_required',
            data: { message: 'Authentication required' },
            timestamp: new Date().toISOString(),
          }));
          return;
        }
        
        const subs = clientSubscriptions.get(ws) || new Set();
        data.channels?.forEach((ch: string) => subs.add(ch));
        clientSubscriptions.set(ws, subs);
        ws.send(JSON.stringify({
          type: 'ack',
          data: { subscribed: Array.from(subs) },
          timestamp: new Date().toISOString(),
        }));
        break;
      }

      case 'unsubscribe': {
        const subs = clientSubscriptions.get(ws);
        data.channels?.forEach((ch: string) => subs?.delete(ch));
        break;
      }

      case 'action': {
        // Actions require authentication
        if (WS_AUTH_REQUIRED && !ws.isAuthenticated) {
          ws.send(JSON.stringify({
            type: 'auth_required',
            data: { message: 'Authentication required for actions' },
            timestamp: new Date().toISOString(),
          }));
          return;
        }
        
        console.log('[WebSocket] Action received:', data.action, data.payload);
        ws.send(JSON.stringify({
          type: 'ack',
          data: { action: data.action, status: 'queued' },
          timestamp: new Date().toISOString(),
        }));
        break;
      }

      default:
        ws.send(JSON.stringify({
          type: 'error',
          data: { message: 'Unknown message type' },
          timestamp: new Date().toISOString(),
        }));
    }
  } catch {
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'Invalid message format' },
      timestamp: new Date().toISOString(),
    }));
  }
}

function main(): void {
  const wss = new WebSocketServer({ port: WS_PORT });

  wss.on('connection', (ws: AuthenticatedWebSocket) => {
    console.log('[WebSocket] Client connected');
    
    ws.isAuthenticated = false;

    // Default subscription to all channels
    clientSubscriptions.set(ws, new Set(['metrics', 'incidents', 'peers', 'health']));

    // If auth is required, send auth_required message
    if (WS_AUTH_REQUIRED) {
      ws.send(JSON.stringify({
        type: 'auth_required',
        data: { message: 'Please authenticate with { type: "auth", token: "your-token" }' },
        timestamp: new Date().toISOString(),
      }));
    }

    ws.on('message', (message) => {
      handleClientMessage(ws, message.toString());
    });

    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected');
      clientSubscriptions.delete(ws);
      authenticatedClients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Client error:', error);
      clientSubscriptions.delete(ws);
      authenticatedClients.delete(ws);
    });

    // Send initial data only if auth is not required
    if (!WS_AUTH_REQUIRED) {
      broadcastUpdates(wss).catch(console.error);
    }
  });

  // Periodic broadcasts every 10 seconds
  setInterval(() => {
    broadcastUpdates(wss).catch(console.error);
  }, 10000);

  console.log(`[WebSocket] Server started on port ${WS_PORT}`);
  console.log(`[WebSocket] Database: ${DB_URL.replace(/:[^:@]+@/, ':***@')}`);
  console.log(`[WebSocket] Auth required: ${WS_AUTH_REQUIRED}`);

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[WebSocket] SIGTERM received, shutting down...');
    wss.close();
    pool.end();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('[WebSocket] SIGINT received, shutting down...');
    wss.close();
    pool.end();
    process.exit(0);
  });
}

main();
