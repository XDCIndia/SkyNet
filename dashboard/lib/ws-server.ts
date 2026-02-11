import WebSocket, { WebSocketServer } from 'ws';
import { query, NodeMetric, Incident, NetworkHealth, PeerSnapshot } from './db';

const WS_PORT = parseInt(process.env.WS_PORT || '3006');

interface ClientMessage {
  type: string;
  channels?: string[];
  action?: string;
  payload?: Record<string, unknown>;
}

interface BroadcastMessage {
  type: 'metrics' | 'incidents' | 'peers' | 'health' | 'error' | 'ack';
  data: unknown;
  timestamp: string;
}

// Track subscribed channels per client
const clientSubscriptions = new Map<WebSocket, Set<string>>();

let wss: WebSocketServer | null = null;
let broadcastInterval: NodeJS.Timeout | null = null;

async function getLatestMetrics(): Promise<Partial<NodeMetric>[]> {
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
}

async function getActiveIncidents(): Promise<Incident[]> {
  const result = await query(`
    SELECT i.*, n.name as node_name
    FROM netown.incidents i
    JOIN netown.nodes n ON i.node_id = n.id
    WHERE i.status = 'active'
    ORDER BY i.detected_at DESC
    LIMIT 50
  `);
  return result.rows;
}

async function getPeersOverview(): Promise<{
  totalPeers: number;
  byCountry: Record<string, number>;
  byDirection: { inbound: number; outbound: number };
  uniqueIPs: number;
}> {
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
      COUNT(DISTINCT remote_ip) as unique_ips,
      COUNT(*) FILTER (WHERE direction = 'inbound') as inbound,
      COUNT(*) FILTER (WHERE direction = 'outbound') as outbound,
      country
    FROM latest_peers
    GROUP BY country
  `);

  const byCountry: Record<string, number> = {};
  let totalPeers = 0;
  let inbound = 0;
  let outbound = 0;
  let uniqueIPs = 0;

  for (const row of result.rows) {
    if (row.country) {
      byCountry[row.country] = parseInt(row.count);
    }
    totalPeers = Math.max(totalPeers, parseInt(row.total_peers));
    inbound = Math.max(inbound, parseInt(row.inbound));
    outbound = Math.max(outbound, parseInt(row.outbound));
    uniqueIPs = Math.max(uniqueIPs, parseInt(row.unique_ips));
  }

  return {
    totalPeers,
    byCountry,
    byDirection: { inbound, outbound },
    uniqueIPs,
  };
}

async function getLatestHealth(): Promise<Partial<NetworkHealth> | null> {
  const result = await query(`
    SELECT * FROM netown.network_health
    ORDER BY collected_at DESC
    LIMIT 1
  `);
  return result.rows[0] || null;
}

function broadcastToChannel(channel: string, data: unknown): void {
  if (!wss) return;
  
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

async function broadcastUpdates(): Promise<void> {
  if (!wss) return;

  try {
    // Get all data in parallel
    const [metrics, incidents, peers, health] = await Promise.all([
      getLatestMetrics(),
      getActiveIncidents(),
      getPeersOverview(),
      getLatestHealth(),
    ]);

    // Broadcast to respective channels
    broadcastToChannel('metrics', { nodes: metrics.length, data: metrics });
    broadcastToChannel('incidents', { count: incidents.length, data: incidents });
    broadcastToChannel('peers', peers);
    broadcastToChannel('health', health);
  } catch (error) {
    console.error('[WebSocket] Broadcast error:', error);
  }
}

function handleClientMessage(ws: WebSocket, message: string): void {
  try {
    const data: ClientMessage = JSON.parse(message);
    
    switch (data.type) {
      case 'subscribe': {
        const subs = clientSubscriptions.get(ws) || new Set();
        data.channels?.forEach(ch => subs.add(ch));
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
        data.channels?.forEach(ch => subs?.delete(ch));
        break;
      }
      
      case 'action': {
        // Handle actions like ban_peer, add_node
        console.log('[WebSocket] Action received:', data.action, data.payload);
        // Actions are handled by REST API, acknowledge here
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
  } catch (error) {
    ws.send(JSON.stringify({
      type: 'error',
      data: { message: 'Invalid message format' },
      timestamp: new Date().toISOString(),
    }));
  }
}

export function startWebSocketServer(): WebSocketServer {
  if (wss) {
    console.log('[WebSocket] Server already running');
    return wss;
  }

  wss = new WebSocketServer({ port: WS_PORT });

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
    broadcastUpdates().catch(console.error);
  });

  // Start periodic broadcasts
  broadcastInterval = setInterval(() => {
    broadcastUpdates().catch(console.error);
  }, 10000); // Every 10 seconds

  console.log(`[WebSocket] Server started on port ${WS_PORT}`);
  return wss;
}

export function stopWebSocketServer(): void {
  if (broadcastInterval) {
    clearInterval(broadcastInterval);
    broadcastInterval = null;
  }
  
  if (wss) {
    wss.close();
    wss = null;
    clientSubscriptions.clear();
    console.log('[WebSocket] Server stopped');
  }
}

export function getWebSocketServer(): WebSocketServer | null {
  return wss;
}

// For standalone execution
if (require.main === module) {
  startWebSocketServer();
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[WebSocket] SIGTERM received, shutting down...');
    stopWebSocketServer();
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    console.log('[WebSocket] SIGINT received, shutting down...');
    stopWebSocketServer();
    process.exit(0);
  });
}
