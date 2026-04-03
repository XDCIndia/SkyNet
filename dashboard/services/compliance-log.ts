/**
 * Compliance Log Service — Issue #73
 *
 * Append-only action log for admin actions with actor, timestamp, action type.
 * Designed for institutional validator audit trails.
 *
 * Writes to skynet.compliance_log table (created on first use via DDL below).
 * Falls back to logger if DB unavailable.
 */

import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

export type ComplianceAction =
  | 'node_registered'
  | 'node_deleted'
  | 'node_updated'
  | 'peer_injected'
  | 'alert_rule_created'
  | 'alert_rule_updated'
  | 'alert_rule_deleted'
  | 'alert_acknowledged'
  | 'alert_resolved'
  | 'incident_created'
  | 'incident_resolved'
  | 'retention_policy_changed'
  | 'config_changed'
  | 'bulk_delete'
  | 'export_triggered'
  | 'admin_login'
  | 'admin_logout'
  | string; // Allow arbitrary action strings for extensibility

export interface ComplianceEntry {
  actor: string;
  action: ComplianceAction;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

let tableEnsured = false;

/**
 * Ensure the compliance_log table exists (idempotent DDL).
 */
async function ensureTable(): Promise<void> {
  if (tableEnsured) return;
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS skynet.compliance_log (
        id            BIGSERIAL PRIMARY KEY,
        actor         TEXT NOT NULL,
        action        TEXT NOT NULL,
        resource_type TEXT,
        resource_id   TEXT,
        details       JSONB,
        ip_address    TEXT,
        user_agent    TEXT,
        logged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    // Index for fast actor + time queries
    await query(`
      CREATE INDEX IF NOT EXISTS idx_compliance_log_actor_time
        ON skynet.compliance_log (actor, logged_at DESC)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_compliance_log_action_time
        ON skynet.compliance_log (action, logged_at DESC)
    `);
    tableEnsured = true;
  } catch (err: any) {
    // Already exists or schema not ready — non-fatal
    if (!err.message?.includes('already exists')) {
      logger.warn('[ComplianceLog] Could not ensure table', { err: err.message });
    }
    tableEnsured = true; // Don't retry on every call
  }
}

/**
 * Append an entry to the compliance log.
 * This is a fire-and-forget operation from the caller's perspective — errors are swallowed to
 * prevent compliance logging from breaking normal request flow.
 *
 * @example
 * await logAction({
 *   actor: 'admin@example.com',
 *   action: 'peer_injected',
 *   resourceType: 'node',
 *   resourceId: nodeId,
 *   details: { injected: 12, source: 'manual' },
 * });
 */
export async function logAction(entry: ComplianceEntry): Promise<void> {
  try {
    await ensureTable();
    await query(
      `INSERT INTO skynet.compliance_log
         (actor, action, resource_type, resource_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        entry.actor,
        entry.action,
        entry.resourceType ?? null,
        entry.resourceId ?? null,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.ipAddress ?? null,
        entry.userAgent ?? null,
      ]
    );
    logger.debug('[ComplianceLog] Logged', {
      actor: entry.actor,
      action: entry.action,
      resourceId: entry.resourceId,
    });
  } catch (err: any) {
    // Never throw — compliance log failures must not break request handling
    logger.error('[ComplianceLog] Failed to log action', { err: err.message, entry });
  }
}

/**
 * Retrieve compliance log entries (most recent first).
 * Options:
 *   actor — filter by actor
 *   action — filter by action type
 *   resourceId — filter by resource
 *   limit — max rows (default 100)
 *   since — ISO timestamp lower bound
 */
export async function getLog(options: {
  actor?: string;
  action?: string;
  resourceId?: string;
  limit?: number;
  since?: string;
} = {}): Promise<{
  id: number;
  actor: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  loggedAt: string;
}[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (options.actor) {
    conditions.push(`actor = $${paramIdx++}`);
    params.push(options.actor);
  }
  if (options.action) {
    conditions.push(`action = $${paramIdx++}`);
    params.push(options.action);
  }
  if (options.resourceId) {
    conditions.push(`resource_id = $${paramIdx++}`);
    params.push(options.resourceId);
  }
  if (options.since) {
    conditions.push(`logged_at >= $${paramIdx++}`);
    params.push(options.since);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options.limit ?? 100;

  try {
    await ensureTable();
    const result = await query(
      `SELECT id, actor, action, resource_type, resource_id, details, ip_address, logged_at
       FROM skynet.compliance_log
       ${where}
       ORDER BY logged_at DESC
       LIMIT ${limit}`,
      params
    );
    return result.rows.map((r: any) => ({
      id: r.id,
      actor: r.actor,
      action: r.action,
      resourceType: r.resource_type,
      resourceId: r.resource_id,
      details: r.details,
      ipAddress: r.ip_address,
      loggedAt: r.logged_at,
    }));
  } catch (err: any) {
    logger.error('[ComplianceLog] Failed to query log', { err: err.message });
    return [];
  }
}
