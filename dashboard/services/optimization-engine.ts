/**
 * Closed-Loop Optimization Engine (autoresearch pattern)
 * Issue: https://github.com/XDCIndia/SkyNet/issues/64
 *
 * Receives benchmark scores from xdc-node-setup agents,
 * compares current vs previous config scores, tracks history.
 */
import { query } from '@/lib/db';

export interface OptimizationScore {
  nodeId: string;
  configHash: string;
  syncSpeed: number;    // blocks/sec
  peerHealth: number;   // 0-1
  resourceUse: number;  // 0-1 (lower = better)
  composite: number;    // weighted average
  metadata?: Record<string, unknown>;
}

export async function recordScore(score: OptimizationScore): Promise<{ improved: boolean; delta: number }> {
  const prev = await query(
    `SELECT composite FROM optimization_history WHERE node_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [score.nodeId]
  );
  const prevScore = prev.rows?.[0]?.composite ?? 0;
  const delta = score.composite - prevScore;

  await query(
    `INSERT INTO optimization_history (node_id, config_hash, sync_speed, peer_health, resource_use, composite, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [score.nodeId, score.configHash, score.syncSpeed, score.peerHealth, score.resourceUse, score.composite, JSON.stringify(score.metadata ?? {})]
  );

  return { improved: delta > 0, delta };
}

export async function getHistory(nodeId: string, limit = 50) {
  const result = await query(
    `SELECT * FROM optimization_history WHERE node_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [nodeId, limit]
  );
  return result.rows;
}
