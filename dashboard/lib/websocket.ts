/**
 * XDC SkyNet WebSocket / Socket.IO layer
 *
 * Issue #15: WebSocket for Live Updates
 *
 * Emits:
 *   block:new       – when any node reports a new block
 *   node:status     – when node status changes (online/offline/syncing)
 *   alert:new       – when an alert is triggered
 *
 * These helpers are called from the heartbeat pipeline and alert engine.
 */

import { Server as NetServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { query } from '@/lib/db';

// Socket.io server instance (singleton)
let io: SocketIOServer | null = null;

// Track last known status per node to detect changes
const nodeStatusCache = new Map<string, string>(); // nodeId → 'online'|'offline'|'syncing'
// Track last known block per node to detect new blocks
const nodeBlockCache  = new Map<string, number>();  // nodeId → blockHeight

// ─────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────

/**
 * Initialize (or return existing) Socket.IO server attached to an HTTP server.
 */
export function initWebSocketServer(server: NetServer): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(server, {
    path: '/api/v1/ws',
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket: Socket) => {
    console.log('[WS] client connected:', socket.id);

    // Room subscriptions
    socket.on('subscribe:blocks',       () => { socket.join('blocks');       });
    socket.on('subscribe:nodes',        () => { socket.join('nodes');        });
    socket.on('subscribe:alerts',       () => { socket.join('alerts');       });
    socket.on('subscribe:transactions', () => { socket.join('transactions'); });

    socket.on('subscribe:address', (address: string) => {
      socket.join(`address:${address.toLowerCase()}`);
    });

    // Unsubscribe
    socket.on('unsubscribe:blocks',       () => socket.leave('blocks'));
    socket.on('unsubscribe:nodes',        () => socket.leave('nodes'));
    socket.on('unsubscribe:alerts',       () => socket.leave('alerts'));
    socket.on('unsubscribe:transactions', () => socket.leave('transactions'));
    socket.on('unsubscribe:address', (address: string) => {
      socket.leave(`address:${address.toLowerCase()}`);
    });

    socket.on('disconnect', () => {
      console.log('[WS] client disconnected:', socket.id);
    });
  });

  // Polling loop — checks DB every 2 s for new blocks / status changes
  startPollingLoop();

  return io;
}

// ─────────────────────────────────────────────────────────────
// Broadcast helpers (called externally)
// ─────────────────────────────────────────────────────────────

/**
 * Broadcast block:new when a node reports a new block.
 * Safe to call from the heartbeat route.
 */
export function broadcastNewBlock(payload: {
  nodeId: string;
  blockHeight: number;
  timestamp?: string;
}): void {
  if (!io) return;
  io.to('blocks').emit('block:new', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

/**
 * Broadcast node:status when a node changes online/offline/syncing state.
 * Safe to call from the heartbeat route.
 */
export function broadcastNodeStatus(payload: {
  nodeId: string;
  nodeName?: string;
  status: 'online' | 'offline' | 'syncing';
  blockHeight?: number;
  peerCount?: number;
  timestamp?: string;
}): void {
  if (!io) return;
  io.to('nodes').emit('node:status', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

/**
 * Broadcast alert:new when an alert is triggered.
 * Called from the alert trigger engine.
 */
export function broadcastAlert(payload: {
  alertId: number | string;
  nodeId: string;
  nodeName?: string;
  severity: string;
  title: string;
  message: string;
  timestamp?: string;
}): void {
  if (!io) return;
  io.to('alerts').emit('alert:new', {
    ...payload,
    timestamp: payload.timestamp ?? new Date().toISOString(),
  });
}

/** Broadcast a raw transaction (legacy) */
export function broadcastTransaction(txData: any): void {
  if (!io) return;
  io.to('transactions').emit('transaction:new', {
    type: 'transaction',
    data: txData,
    timestamp: new Date().toISOString(),
  });
  if (txData.from) io.to(`address:${txData.from.toLowerCase()}`).emit('transaction:from', txData);
  if (txData.to)   io.to(`address:${txData.to.toLowerCase()}`).emit('transaction:to',   txData);
}

export function getIO(): SocketIOServer | null {
  return io;
}

// ─────────────────────────────────────────────────────────────
// Polling loop (DB-driven, runs inside the WS server process)
// ─────────────────────────────────────────────────────────────

function startPollingLoop(): void {
  setInterval(async () => {
    try {
      await pollBlocksAndStatus();
    } catch (err) {
      console.error('[WS] polling error:', err);
    }
  }, 2000); // every 2 s — matches XDC block time
}

async function pollBlocksAndStatus(): Promise<void> {
  if (!io) return;

  // Fetch latest metrics per node (active in last 10 min)
  const result = await query(`
    SELECT DISTINCT ON (m.node_id)
      m.node_id,
      n.name   AS node_name,
      m.block_height,
      m.peer_count,
      m.is_syncing,
      m.collected_at,
      n.last_heartbeat
    FROM skynet.node_metrics m
    JOIN skynet.nodes n ON n.id = m.node_id AND n.is_active = true
    WHERE m.collected_at > NOW() - INTERVAL '10 minutes'
    ORDER BY m.node_id, m.collected_at DESC
  `);

  const now = Date.now();

  for (const row of result.rows) {
    const { node_id, node_name, block_height, peer_count, is_syncing, last_heartbeat } = row;

    // ── block:new ──────────────────────────────────────────
    const prevBlock = nodeBlockCache.get(node_id) ?? 0;
    if (block_height > prevBlock) {
      broadcastNewBlock({ nodeId: node_id, blockHeight: block_height });
      nodeBlockCache.set(node_id, block_height);
    }

    // ── node:status ────────────────────────────────────────
    const hbMs = last_heartbeat ? new Date(last_heartbeat).getTime() : 0;
    const computedStatus =
      !hbMs || now - hbMs > 5 * 60 * 1000
        ? 'offline'
        : is_syncing
        ? 'syncing'
        : 'online';

    const prevStatus = nodeStatusCache.get(node_id);
    if (prevStatus !== computedStatus) {
      broadcastNodeStatus({
        nodeId: node_id,
        nodeName: node_name,
        status: computedStatus as any,
        blockHeight: block_height,
        peerCount: peer_count,
      });
      nodeStatusCache.set(node_id, computedStatus);
    }
  }

  // Nodes that have gone fully silent (no recent metrics at all)
  for (const [nodeId, prevStatus] of nodeStatusCache.entries()) {
    if (prevStatus !== 'offline') {
      const inCurrentSet = result.rows.some((r: any) => r.node_id === nodeId);
      if (!inCurrentSet) {
        broadcastNodeStatus({ nodeId, status: 'offline' });
        nodeStatusCache.set(nodeId, 'offline');
      }
    }
  }
}
