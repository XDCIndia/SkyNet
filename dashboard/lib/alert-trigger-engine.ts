/**
 * XDC SkyNet — Alert Trigger Engine
 * Issue #16: Alert Trigger Engine
 * Issue #35: Sync stall threshold configurable (default 10 min)
 *
 * Rules:
 *   1. Sync stall      — node block unchanged for SYNC_STALL_MINUTES (default 10)
 *   2. Peer drop       — node peers < PEER_DROP_THRESHOLD (default 2)
 *   3. Node offline    — no heartbeat for OFFLINE_MINUTES (default 5)
 *   4. Block divergence — nodes disagree on block hash at same height
 *
 * Alerts are stored in skynet.alerts and broadcast via WebSocket.
 */

import { Pool } from 'pg';
import { broadcastAlert } from './websocket';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://gateway:gateway@localhost:5433/xdc_gateway',
});

// ─────────────────────────────────────────────────────────────
// Thresholds (Issue #35 — make configurable, default 10 min)
// ─────────────────────────────────────────────────────────────
const SYNC_STALL_MINUTES   = parseInt(process.env.ALERT_SYNC_STALL_MINUTES    || '10', 10);
const PEER_DROP_THRESHOLD  = parseInt(process.env.ALERT_PEER_DROP_THRESHOLD   || '2',  10);
const OFFLINE_MINUTES      = parseInt(process.env.ALERT_OFFLINE_MINUTES       || '5',  10);
// Cooldown prevents duplicate alerts for the same condition
const ALERT_COOLDOWN_MINUTES = parseInt(process.env.ALERT_COOLDOWN_MINUTES    || '30', 10);

// ─────────────────────────────────────────────────────────────
// Main evaluation function — call periodically or per heartbeat
// ─────────────────────────────────────────────────────────────

export async function runAlertEngine(): Promise<void> {
  const client = await pool.connect();
  try {
    await Promise.all([
      checkSyncStalls(client),
      checkPeerDrop(client),
      checkNodeOffline(client),
      checkBlockDivergence(client),
    ]);
  } catch (err) {
    console.error('[AlertEngine] run error:', err);
  } finally {
    client.release();
  }
}

// ─────────────────────────────────────────────────────────────
// Rule 1 — Sync Stall
// ─────────────────────────────────────────────────────────────

async function checkSyncStalls(client: any): Promise<void> {
  // Find nodes whose block_height hasn't changed in SYNC_STALL_MINUTES
  const result = await client.query(`
    WITH metric_window AS (
      SELECT
        node_id,
        MIN(block_height) AS min_bh,
        MAX(block_height) AS max_bh,
        MAX(collected_at) AS last_seen
      FROM skynet.node_metrics
      WHERE collected_at > NOW() - INTERVAL '${SYNC_STALL_MINUTES} minutes'
      GROUP BY node_id
    )
    SELECT w.node_id, n.name AS node_name, w.max_bh AS block_height, w.last_seen
    FROM metric_window w
    JOIN skynet.nodes n ON n.id = w.node_id AND n.is_active = true
    WHERE w.min_bh = w.max_bh      -- block did not advance
      AND w.last_seen > NOW() - INTERVAL '${OFFLINE_MINUTES} minutes'  -- node is online
  `);

  for (const row of result.rows) {
    await fireAlert(client, {
      ruleType:  'sync_stall',
      nodeId:    row.node_id,
      nodeName:  row.node_name,
      severity:  'warning',
      title:     `Sync stall on ${row.node_name}`,
      message:   `Block height stuck at ${row.block_height} for ${SYNC_STALL_MINUTES}+ minutes`,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Rule 2 — Peer Drop
// ─────────────────────────────────────────────────────────────

async function checkPeerDrop(client: any): Promise<void> {
  const result = await client.query(`
    SELECT DISTINCT ON (m.node_id)
      m.node_id, n.name AS node_name, m.peer_count
    FROM skynet.node_metrics m
    JOIN skynet.nodes n ON n.id = m.node_id AND n.is_active = true
    WHERE m.collected_at > NOW() - INTERVAL '${OFFLINE_MINUTES} minutes'
    ORDER BY m.node_id, m.collected_at DESC
  `);

  for (const row of result.rows) {
    if (row.peer_count < PEER_DROP_THRESHOLD) {
      await fireAlert(client, {
        ruleType:  'peer_drop',
        nodeId:    row.node_id,
        nodeName:  row.node_name,
        severity:  'warning',
        title:     `Low peer count on ${row.node_name}`,
        message:   `Peer count dropped to ${row.peer_count} (threshold: ${PEER_DROP_THRESHOLD})`,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Rule 3 — Node Offline
// ─────────────────────────────────────────────────────────────

async function checkNodeOffline(client: any): Promise<void> {
  const result = await client.query(`
    SELECT n.id AS node_id, n.name AS node_name, n.last_heartbeat
    FROM skynet.nodes n
    WHERE n.is_active = true
      AND (
        n.last_heartbeat IS NULL
        OR n.last_heartbeat < NOW() - INTERVAL '${OFFLINE_MINUTES} minutes'
      )
  `);

  for (const row of result.rows) {
    await fireAlert(client, {
      ruleType:  'node_offline',
      nodeId:    row.node_id,
      nodeName:  row.node_name,
      severity:  'critical',
      title:     `Node offline: ${row.node_name}`,
      message:   `No heartbeat received for ${OFFLINE_MINUTES}+ minutes`,
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Rule 4 — Block Divergence
// ─────────────────────────────────────────────────────────────

async function checkBlockDivergence(client: any): Promise<void> {
  // Look for nodes that report different hashes at the same block height
  // Requires block_hash column in node_metrics; skip gracefully if absent
  try {
    const result = await client.query(`
      SELECT
        block_height,
        COUNT(DISTINCT block_hash) AS hash_count,
        array_agg(DISTINCT block_hash) AS hashes,
        array_agg(DISTINCT node_id)    AS node_ids
      FROM (
        SELECT DISTINCT ON (node_id)
          node_id, block_height, block_hash
        FROM skynet.node_metrics
        WHERE collected_at > NOW() - INTERVAL '5 minutes'
          AND block_hash IS NOT NULL
        ORDER BY node_id, collected_at DESC
      ) latest
      GROUP BY block_height
      HAVING COUNT(DISTINCT block_hash) > 1
    `);

    for (const row of result.rows) {
      // Fire one alert per divergence event (use height+hash as pseudo node_id)
      const pseudoNodeId = `divergence:${row.block_height}`;
      await fireAlert(client, {
        ruleType:  'block_divergence',
        nodeId:    row.node_ids[0], // attribute to first disagreeing node
        nodeName:  `Fleet (height ${row.block_height})`,
        severity:  'critical',
        title:     `Block hash divergence at height ${row.block_height}`,
        message:   `Nodes disagree: ${row.hashes.join(' vs ')} — nodes: ${row.node_ids.join(', ')}`,
        extraKey:  pseudoNodeId,
      });
    }
  } catch (err: any) {
    // block_hash column may not exist yet — log but don't crash
    if (!err.message?.includes('column') && !err.message?.includes('block_hash')) {
      console.error('[AlertEngine] block divergence check error:', err.message);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Shared: insert alert with cooldown + WS broadcast
// ─────────────────────────────────────────────────────────────

interface AlertPayload {
  ruleType:  string;
  nodeId:    string;
  nodeName:  string;
  severity:  'critical' | 'warning' | 'info';
  title:     string;
  message:   string;
  extraKey?: string; // used as dedup key when nodeId isn't unique enough
}

async function fireAlert(client: any, payload: AlertPayload): Promise<void> {
  const dedupKey = payload.extraKey ?? payload.nodeId;

  // Cooldown: don't re-fire the same rule+node within ALERT_COOLDOWN_MINUTES
  const existing = await client.query(`
    SELECT id FROM skynet.alerts
    WHERE rule_type = $1
      AND (node_id = $2 OR $3 = node_id)
      AND status != 'resolved'
      AND triggered_at > NOW() - INTERVAL '${ALERT_COOLDOWN_MINUTES} minutes'
    LIMIT 1
  `, [payload.ruleType, payload.nodeId, dedupKey]);

  if (existing.rows.length > 0) return; // still within cooldown

  // Insert into skynet.alerts
  let alertId: number;
  try {
    const ins = await client.query(`
      INSERT INTO skynet.alerts
        (node_id, node_name, rule_type, severity, title, message, status, triggered_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW())
      RETURNING id
    `, [payload.nodeId, payload.nodeName, payload.ruleType, payload.severity, payload.title, payload.message]);
    alertId = ins.rows[0].id;
  } catch (insertErr: any) {
    // Fallback: try without rule_type column (older schema)
    try {
      const ins2 = await client.query(`
        INSERT INTO skynet.alerts
          (node_id, node_name, severity, title, message, status, triggered_at)
        VALUES ($1, $2, $3, $4, $5, 'active', NOW())
        RETURNING id
      `, [payload.nodeId, payload.nodeName, payload.severity, payload.title, payload.message]);
      alertId = ins2.rows[0].id;
    } catch (fallbackErr: any) {
      console.error('[AlertEngine] alert insert failed:', fallbackErr.message);
      return;
    }
  }

  // Broadcast via WebSocket (fire-and-forget)
  try {
    broadcastAlert({
      alertId,
      nodeId:   payload.nodeId,
      nodeName: payload.nodeName,
      severity: payload.severity,
      title:    payload.title,
      message:  payload.message,
    });
  } catch (_e) {
    // WS not running — that's OK
  }

  console.log(`[AlertEngine] fired ${payload.ruleType} on ${payload.nodeName}: ${payload.title}`);
}

// ─────────────────────────────────────────────────────────────
// Scheduler — run engine on an interval
// ─────────────────────────────────────────────────────────────

let _engineInterval: NodeJS.Timeout | null = null;

export function startAlertEngine(intervalMs = 60_000): void {
  if (_engineInterval) return; // already running
  _engineInterval = setInterval(() => {
    runAlertEngine().catch(err => console.error('[AlertEngine] error:', err));
  }, intervalMs);
  // Run immediately on start
  runAlertEngine().catch(err => console.error('[AlertEngine] initial run error:', err));
  console.log(`[AlertEngine] started, interval=${intervalMs}ms, stall=${SYNC_STALL_MINUTES}min, offline=${OFFLINE_MINUTES}min, peers<${PEER_DROP_THRESHOLD}`);
}

export function stopAlertEngine(): void {
  if (_engineInterval) {
    clearInterval(_engineInterval);
    _engineInterval = null;
  }
}
