/**
 * Unified Telemetry Protocol — Issue #63
 *
 * Single push endpoint that accepts heartbeat/telemetry data from ANY XDC
 * client type (GP5/geth-xdc ethstats format, Erigon, Nethermind, Reth) and
 * normalises everything into a single canonical schema before persisting.
 *
 * This DEPRECATES the dual-path approach:
 *   • ethstats WebSocket push  → replaced by POST /api/v2/telemetry/push
 *   • rpc-poller background job → replaced by POST /api/v2/telemetry/push
 *
 * Clients should send a JSON body matching one of the raw formats below.
 * The normaliser detects the format automatically and converts it.
 */

import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Canonical schema (what we store / emit downstream)
// ─────────────────────────────────────────────────────────────────────────────

export interface TelemetryPayload {
  /** Node identifier (UUID or name) */
  nodeId: string;
  clientType: 'gp5' | 'erigon' | 'nethermind' | 'reth' | 'unknown';
  timestamp: Date;

  // Chain state
  blockHeight: number;
  blockHash: string | null;
  networkHeight: number | null;
  isSyncing: boolean;
  syncPercent: number | null;

  // Peers
  peerCount: number;

  // System
  cpuPercent: number | null;
  memoryPercent: number | null;
  diskPercent: number | null;

  // Client
  clientVersion: string | null;

  // Raw payload preserved for debugging
  rawPayload: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw format typings (partial – only fields we care about)
// ─────────────────────────────────────────────────────────────────────────────

interface GP5EthstatsPayload {
  id?: string;
  secret?: string;
  stats?: {
    block?: { number?: number; hash?: string };
    syncing?: boolean | { currentBlock?: number; highestBlock?: number };
    peers?: number;
    uptime?: number;
  };
  info?: { node?: string };
}

interface ErigonHeartbeat {
  node_id?: string;
  client?: string;
  block_number?: number;
  block_hash?: string;
  peer_count?: number;
  syncing?: boolean;
  highest_block?: number;
  cpu_usage?: number;
  memory_usage?: number;
  disk_usage?: number;
}

interface NethermindHeartbeat {
  nodeId?: string;
  clientVersion?: string;
  blockNumber?: number;
  blockHash?: string;
  peers?: number;
  isSyncing?: boolean;
  highestBlock?: number;
  cpuPercent?: number;
  memoryPercent?: number;
  diskPercent?: number;
}

interface RethHeartbeat {
  node_id?: string;
  version?: string;
  latest_block?: number;
  latest_hash?: string;
  peer_count?: number;
  sync_stage?: string;
  highest_block?: number;
  cpu?: number;
  mem?: number;
  disk?: number;
}

type RawPayload = GP5EthstatsPayload | ErigonHeartbeat | NethermindHeartbeat | RethHeartbeat;

// ─────────────────────────────────────────────────────────────────────────────
// Format detection
// ─────────────────────────────────────────────────────────────────────────────

function detectFormat(raw: Record<string, unknown>): TelemetryPayload['clientType'] {
  if ('stats' in raw && 'id' in raw) return 'gp5';
  if ('sync_stage' in raw || ('node_id' in raw && 'latest_block' in raw)) return 'reth';
  if ('XdcStateRootCache' in raw || ('nodeId' in raw && 'isSyncing' in raw)) return 'nethermind';
  if ('block_number' in raw && 'peer_count' in raw) return 'erigon';
  return 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalisers (one per format)
// ─────────────────────────────────────────────────────────────────────────────

function normaliseGP5(raw: GP5EthstatsPayload, overrideNodeId?: string): Partial<TelemetryPayload> {
  const stats = raw.stats ?? {};
  const block = stats.block ?? {};

  let blockHeight = Number(block.number ?? 0);
  let isSyncing = false;
  let networkHeight: number | null = null;

  if (typeof stats.syncing === 'object' && stats.syncing !== null) {
    isSyncing = true;
    blockHeight = Number(stats.syncing.currentBlock ?? blockHeight);
    networkHeight = Number(stats.syncing.highestBlock ?? null) || null;
  } else {
    isSyncing = Boolean(stats.syncing);
  }

  const syncPercent =
    networkHeight && networkHeight > 0
      ? Math.min(100, (blockHeight / networkHeight) * 100)
      : isSyncing
      ? null
      : 100;

  return {
    nodeId: overrideNodeId ?? String(raw.id ?? 'unknown'),
    clientType: 'gp5',
    blockHeight,
    blockHash: String(block.hash ?? ''),
    networkHeight,
    isSyncing,
    syncPercent,
    peerCount: Number(stats.peers ?? 0),
    clientVersion: raw.info?.node ?? null,
  };
}

function normaliseErigon(raw: ErigonHeartbeat, overrideNodeId?: string): Partial<TelemetryPayload> {
  const blockHeight = Number(raw.block_number ?? 0);
  const networkHeight = raw.highest_block ? Number(raw.highest_block) : null;
  const syncPercent =
    networkHeight && networkHeight > 0
      ? Math.min(100, (blockHeight / networkHeight) * 100)
      : raw.syncing
      ? null
      : 100;

  return {
    nodeId: overrideNodeId ?? String(raw.node_id ?? 'unknown'),
    clientType: 'erigon',
    blockHeight,
    blockHash: raw.block_hash ?? null,
    networkHeight,
    isSyncing: Boolean(raw.syncing),
    syncPercent,
    peerCount: Number(raw.peer_count ?? 0),
    cpuPercent: raw.cpu_usage != null ? Number(raw.cpu_usage) : null,
    memoryPercent: raw.memory_usage != null ? Number(raw.memory_usage) : null,
    diskPercent: raw.disk_usage != null ? Number(raw.disk_usage) : null,
    clientVersion: raw.client ?? null,
  };
}

function normaliseNethermind(raw: NethermindHeartbeat, overrideNodeId?: string): Partial<TelemetryPayload> {
  const blockHeight = Number(raw.blockNumber ?? 0);
  const networkHeight = raw.highestBlock ? Number(raw.highestBlock) : null;
  const syncPercent =
    networkHeight && networkHeight > 0
      ? Math.min(100, (blockHeight / networkHeight) * 100)
      : raw.isSyncing
      ? null
      : 100;

  return {
    nodeId: overrideNodeId ?? String(raw.nodeId ?? 'unknown'),
    clientType: 'nethermind',
    blockHeight,
    blockHash: raw.blockHash ?? null,
    networkHeight,
    isSyncing: Boolean(raw.isSyncing),
    syncPercent,
    peerCount: Number(raw.peers ?? 0),
    cpuPercent: raw.cpuPercent != null ? Number(raw.cpuPercent) : null,
    memoryPercent: raw.memoryPercent != null ? Number(raw.memoryPercent) : null,
    diskPercent: raw.diskPercent != null ? Number(raw.diskPercent) : null,
    clientVersion: raw.clientVersion ?? null,
  };
}

function normaliseReth(raw: RethHeartbeat, overrideNodeId?: string): Partial<TelemetryPayload> {
  const blockHeight = Number(raw.latest_block ?? 0);
  const networkHeight = raw.highest_block ? Number(raw.highest_block) : null;
  const syncPercent =
    networkHeight && networkHeight > 0
      ? Math.min(100, (blockHeight / networkHeight) * 100)
      : raw.sync_stage && raw.sync_stage !== 'finish'
      ? null
      : 100;

  return {
    nodeId: overrideNodeId ?? String(raw.node_id ?? 'unknown'),
    clientType: 'reth',
    blockHeight,
    blockHash: raw.latest_hash ?? null,
    networkHeight,
    isSyncing: Boolean(raw.sync_stage && raw.sync_stage !== 'finish'),
    syncPercent,
    peerCount: Number(raw.peer_count ?? 0),
    cpuPercent: raw.cpu != null ? Number(raw.cpu) : null,
    memoryPercent: raw.mem != null ? Number(raw.mem) : null,
    diskPercent: raw.disk != null ? Number(raw.disk) : null,
    clientVersion: raw.version ?? null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main normaliser
// ─────────────────────────────────────────────────────────────────────────────

export function normaliseTelemetry(
  raw: Record<string, unknown>,
  overrideNodeId?: string
): TelemetryPayload {
  const clientType = detectFormat(raw);
  let partial: Partial<TelemetryPayload> = {};

  switch (clientType) {
    case 'gp5':
      partial = normaliseGP5(raw as GP5EthstatsPayload, overrideNodeId);
      break;
    case 'erigon':
      partial = normaliseErigon(raw as ErigonHeartbeat, overrideNodeId);
      break;
    case 'nethermind':
      partial = normaliseNethermind(raw as NethermindHeartbeat, overrideNodeId);
      break;
    case 'reth':
      partial = normaliseReth(raw as RethHeartbeat, overrideNodeId);
      break;
    default:
      // Attempt best-effort extraction for unknown formats
      partial = {
        nodeId: overrideNodeId ?? String((raw as any).node_id ?? (raw as any).nodeId ?? 'unknown'),
        clientType: 'unknown',
        blockHeight: Number((raw as any).blockNumber ?? (raw as any).block_number ?? 0),
        blockHash: String((raw as any).blockHash ?? (raw as any).block_hash ?? ''),
        peerCount: Number((raw as any).peers ?? (raw as any).peer_count ?? 0),
      };
  }

  return {
    timestamp: new Date(),
    clientType,
    blockHeight: 0,
    blockHash: null,
    networkHeight: null,
    isSyncing: false,
    syncPercent: null,
    peerCount: 0,
    cpuPercent: null,
    memoryPercent: null,
    diskPercent: null,
    clientVersion: null,
    rawPayload: raw,
    ...partial,
    nodeId: partial.nodeId ?? overrideNodeId ?? 'unknown',
  } as TelemetryPayload;
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────────────────

export async function persistTelemetry(payload: TelemetryPayload): Promise<void> {
  try {
    // Update nodes table (upsert by node name/id)
    await query(
      `UPDATE skynet.nodes
          SET block_height    = $2,
              block_hash      = $3,
              peer_count      = $4,
              is_syncing      = $5,
              sync_percent    = $6,
              client_version  = COALESCE($7, client_version),
              last_heartbeat  = $8
        WHERE id::text = $1 OR name = $1`,
      [
        payload.nodeId,
        payload.blockHeight,
        payload.blockHash,
        payload.peerCount,
        payload.isSyncing,
        payload.syncPercent,
        payload.clientVersion,
        payload.timestamp,
      ]
    );

    // Append to metrics_history for time-series data
    await query(
      `INSERT INTO skynet.metrics_history
         (node_id, block_height, peer_count, sync_percent, cpu_percent, memory_percent, disk_percent, timestamp)
       SELECT id, $2, $3, $4, $5, $6, $7, $8
         FROM skynet.nodes
        WHERE id::text = $1 OR name = $1
        LIMIT 1`,
      [
        payload.nodeId,
        payload.blockHeight,
        payload.peerCount,
        payload.syncPercent,
        payload.cpuPercent,
        payload.memoryPercent,
        payload.diskPercent,
        payload.timestamp,
      ]
    );
  } catch (err) {
    logger.error('[UnifiedTelemetry] Failed to persist telemetry', { err, nodeId: payload.nodeId });
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Full pipeline: receive raw → normalise → persist
// ─────────────────────────────────────────────────────────────────────────────

export async function processTelemetryPush(
  raw: Record<string, unknown>,
  overrideNodeId?: string
): Promise<TelemetryPayload> {
  const payload = normaliseTelemetry(raw, overrideNodeId);
  logger.debug('[UnifiedTelemetry] Processing push', {
    nodeId: payload.nodeId,
    clientType: payload.clientType,
    blockHeight: payload.blockHeight,
  });
  await persistTelemetry(payload);
  return payload;
}
