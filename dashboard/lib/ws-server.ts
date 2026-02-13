/**
 * XDC SkyNet - Enhanced WebSocket Server
 * Provides real-time updates with authentication, heartbeat, and reconnection handling
 */

import WebSocket, { WebSocketServer } from 'ws';
import { queryAll } from './db';
import { logger } from './logger';
import { verify, sign } from 'jsonwebtoken';

const WS_PORT = parseInt(process.env.WS_PORT || '3006');
const JWT_SECRET = process.env.JWT_SECRET || process.env.API_KEYS?.split(',')[0] || 'dev-secret';
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const CLIENT_TIMEOUT = 60000; // 60 seconds without pong = disconnect

// =============================================================================
// Types
// =============================================================================

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  nodeId?: string;
  permissions?: string[];
  isAlive: boolean;
  subscriptions: Set<string>;
  lastPong: number;
}

interface ClientMessage {
  type: string;
  channels?: string[];
  action?: string;
  payload?: Record<string, unknown>;
  token?: string;
}

interface BroadcastMessage {
  type: 'metrics' | 'incidents' | 'peers' | 'health' | 'error' | 'ack' | 'pong' | 'auth_success' | 'auth_error';
  data: unknown;
  timestamp: string;
}

// =============================================================================
// Server State
// =============================================================================

let wss: WebSocketServer | null = null;
let broadcastInterval: NodeJS.Timeout | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

const clients = new Set<AuthenticatedWebSocket>();

// =============================================================================
// Data Fetchers
// =============================================================================

async function getLatestMetrics() {
  const rows = await queryAll(`
    SELECT DISTINCT ON (node_id) 
      node_id, block_height, sync_percent, peer_count, cpu_percent,
      memory_percent, disk_percent, tx_pool_pending, tx_pool_queued,
      gas_price, tps, rpc_latency_ms, is_syncing, client_version, coinbase,
      collected_at
    FROM skynet.node_metrics
    ORDER BY node_id, collected_at DESC
  `);
  return rows;
}

async function getActiveIncidents() {
  return queryAll(`
    SELECT i.*, n.name as node_name
    FROM skynet.incidents i
    JOIN skynet.nodes n ON i.node_id = n.id
    WHERE i.status = 'active'
    ORDER BY i.detected_at DESC
    LIMIT 50
  `);
}

async function getPeersOverview() {
  const rows = await queryAll(`
    WITH latest_peers AS (
      SELECT DISTINCT ON (peer_enode) 
        peer_enode, remote_ip, country, direction
      FROM skynet.peer_snapshots
      WHERE collected_at > NOW() - INTERVAL '10 minutes'
      ORDER BY peer_enode, collected_at DESC
    )
    SELECT 
      COUNT(*) as total_peers,
      COUNT(DISTINCT remote_ip) as unique_ips,
      COUNT(*) FILTER (WHERE direction = 'inbound') as inbound,
      COUNT(*) FILTER (WHERE direction = 'outbound') as outbound
    FROM latest_peers
  `);
  return rows[0] || { total_peers: 0, unique_ips: 0, inbound: 0, outbound: 0 };
}

async function getLatestHealth() {
  const rows = await queryAll(`
    SELECT * FROM skynet.network_health
    ORDER BY collected_at DESC
    LIMIT 1
  `);
  return rows[0] || null;
}

// =============================================================================
// Authentication
// =============================================================================

function authenticateClient(token: string): { valid: boolean; userId?: string; nodeId?: string; permissions?: string[] } {
  try {
    const decoded = verify(token, JWT_SECRET) as { userId?: string; nodeId?: string; permissions?: string[] };
    return { valid: true, ...decoded };
  } catch {
    return { valid: false };
  }
}

export function generateWsToken(userId: string, nodeId?: string, permissions: string[] = ['read']): string {
  return sign({ userId, nodeId, permissions }, JWT_SECRET, { expiresIn: '1h' });
}

// =============================================================================
// Broadcasting
// =============================================================================

function broadcastToChannel(channel: string, data: unknown): void {
  if (!wss) return;
  
  const message: BroadcastMessage = {
    type: channel as BroadcastMessage['type'],
    data,
    timestamp: new Date().toISOString(),
  };

  const messageStr = JSON.stringify(message);

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      if (client.subscriptions.has(channel) || client.subscriptions.has('all')) {
        client.send(messageStr);
      }
    }
  }
}

async function broadcastUpdates(): Promise<void> {
  if (!wss || clients.size === 0) return;

  try {
    const [metrics, incidents, peers, health] = await Promise.all([
      getLatestMetrics(),
      getActiveIncidents(),
      getPeersOverview(),
      getLatestHealth(),
    ]);

    broadcastToChannel('metrics', { nodes: metrics.length, data: metrics });
    broadcastToChannel('incidents', { count: incidents.length, data: incidents });
    broadcastToChannel('peers', peers);
    broadcastToChannel('health', health);
  } catch (error) {
    logger.error('[WebSocket] Broadcast error', error as Error);
  }
}

// =============================================================================
// Heartbeat
// =============================================================================

function heartbeat(ws: AuthenticatedWebSocket): void {
  ws.isAlive = true;
  ws.lastPong = Date.now();
}

function checkHeartbeats(): void {
  const now = Date.now();
  
  for (const client of clients) {
    if (!client.isAlive || (now - client.lastPong) > CLIENT_TIMEOUT) {
      logger.info('[WebSocket] Terminating inactive client');
      client.terminate();
      clients.delete(client);
      continue;
    }
    
    client.isAlive = false;
    client.ping();
  }
}

// =============================================================================
// Message Handling
// =============================================================================

function handleClientMessage(ws: AuthenticatedWebSocket, message: string): void {
  try {
    const data: ClientMessage = JSON.parse(message);
    
    switch (data.type) {
      case 'auth': {
        if (!data.token) {
          sendError(ws, 'Token required for authentication');
          return;
        }
        
        const auth = authenticateClient(data.token);
        if (!auth.valid) {
          ws.send(JSON.stringify({
            type: 'auth_error',
            data: { message: 'Invalid token' },
            timestamp: new Date().toISOString(),
          }));
          ws.close(1008, 'Invalid token');
          return;
        }
        
        ws.userId = auth.userId;
        ws.nodeId = auth.nodeId;
        ws.permissions = auth.permissions;
        
        ws.send(JSON.stringify({
          type: 'auth_success',
          data: { userId: auth.userId, permissions: auth.permissions },
          timestamp: new Date().toISOString(),
        }));
        break;
      }
      
      case 'subscribe': {
        data.channels?.forEach(ch => ws.subscriptions.add(ch));
        sendAck(ws, { subscribed: Array.from(ws.subscriptions) });
        break;
      }
      
      case 'unsubscribe': {
        data.channels?.forEach(ch => ws.subscriptions.delete(ch));
        sendAck(ws, { subscribed: Array.from(ws.subscriptions) });
        break;
      }
      
      case 'ping': {
        ws.send(JSON.stringify({
          type: 'pong',
          data: { serverTime: Date.now() },
          timestamp: new Date().toISOString(),
        }));
        break;
      }
      
      default:
        sendError(ws, 'Unknown message type');
    }
  } catch (error) {
    sendError(ws, 'Invalid message format');
  }
}

function sendAck(ws: WebSocket, data: unknown): void {
  ws.send(JSON.stringify({
    type: 'ack',
    data,
    timestamp: new Date().toISOString(),
  }));
}

function sendError(ws: WebSocket, message: string): void {
  ws.send(JSON.stringify({
    type: 'error',
    data: { message },
    timestamp: new Date().toISOString(),
  }));
}

// =============================================================================
// Server Lifecycle
// =============================================================================

export function startWebSocketServer(): WebSocketServer {
  if (wss) {
    logger.warn('[WebSocket] Server already running');
    return wss;
  }

  wss = new WebSocketServer({ port: WS_PORT });

  wss.on('connection', (ws: WebSocket) => {
    const client = ws as AuthenticatedWebSocket;
    client.isAlive = true;
    client.lastPong = Date.now();
    client.subscriptions = new Set(['metrics', 'incidents', 'peers', 'health']);
    
    clients.add(client);
    logger.info('[WebSocket] Client connected', { total: clients.size });

    client.on('pong', () => heartbeat(client));

    client.on('message', (message) => {
      handleClientMessage(client, message.toString());
    });

    client.on('close', () => {
      clients.delete(client);
      logger.info('[WebSocket] Client disconnected', { total: clients.size });
    });

    client.on('error', (error) => {
      logger.error('[WebSocket] Client error', error);
      clients.delete(client);
    });

    // Send initial data
    broadcastUpdates().catch(logger.error);
  });

  // Start periodic broadcasts
  broadcastInterval = setInterval(() => {
    broadcastUpdates().catch(console.error);
  }, 10000);

  // Start heartbeat checks
  heartbeatInterval = setInterval(checkHeartbeats, HEARTBEAT_INTERVAL);

  logger.info(`[WebSocket] Server started on port ${WS_PORT}`);
  return wss;
}

export function stopWebSocketServer(): Promise<void> {
  return new Promise((resolve) => {
    if (broadcastInterval) {
      clearInterval(broadcastInterval);
      broadcastInterval = null;
    }
    
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    
    if (wss) {
      // Close all clients
      for (const client of clients) {
        client.close(1001, 'Server shutting down');
      }
      clients.clear();
      
      wss.close(() => {
        wss = null;
        logger.info('[WebSocket] Server stopped');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

export function getWebSocketServer(): WebSocketServer | null {
  return wss;
}

export function getClientCount(): number {
  return clients.size;
}

// =============================================================================
// Standalone Execution
// =============================================================================

if (require.main === module) {
  startWebSocketServer();
  
  // Graceful shutdown
  const shutdown = async () => {
    logger.info('[WebSocket] Shutdown signal received');
    await stopWebSocketServer();
    process.exit(0);
  };
  
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
