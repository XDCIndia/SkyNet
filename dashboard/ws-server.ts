// Standalone WebSocket server for XDCNetOwn Dashboard
// Run with: npx tsx ws-server.ts

import WebSocket, { WebSocketServer } from 'ws';
import { Pool } from 'pg';

const WS_PORT = parseInt(process.env.WS_PORT || '3006');
const DATABASE_URL = process.env.DATABASE_URL;

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

interface BroadcastMessage {
  type: 'metrics' | 'incidents' | 'peers' | 'health' | 'error' | 'ack';
  data: unknown;
  timestamp: string;
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

function handleClientMessage(ws: WebSocket, message: string): void {
  try {
    const data = JSON.parse(message);

    switch (data.type) {
      case 'subscribe': {
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

  wss.on('connection', (ws) => {
    console.log('[WebSocket] Client connected');

    // Default subscription to all channels
    clientSubscriptions.set(ws, new Set(['metrics', 'incidents', 'peers', 'health']));

    ws.on('message', (message) => {
      handleClientMessage(ws, message.toString());
    });

    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected');
      clientSubscriptions.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Client error:', error);
      clientSubscriptions.delete(ws);
    });

    // Send initial data
    broadcastUpdates(wss).catch(console.error);
  });

  // Periodic broadcasts every 10 seconds
  setInterval(() => {
    broadcastUpdates(wss).catch(console.error);
  }, 10000);

  console.log(`[WebSocket] Server started on port ${WS_PORT}`);
  console.log(`[WebSocket] Database: ${DB_URL.replace(/:[^:@]+@/, ':***@')}`);

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
