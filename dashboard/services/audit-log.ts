/**
 * Audit Log — Issue #49
 *
 * Logs every admin action (restart, config change, peer inject, …) with a
 * timestamp, actor identity, action name, and target resource.
 *
 * Routes (registered in app/api/v2/audit/):
 *   GET  /api/v2/audit          → paginated log with filters
 *
 * Usage:
 *   import { auditLog } from '@/services/audit-log';
 *   await auditLog({ actor: req.user, action: 'node.restart', target: nodeId });
 */

import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AuditAction =
  | 'node.restart'
  | 'node.stop'
  | 'node.start'
  | 'node.delete'
  | 'node.create'
  | 'node.config.update'
  | 'peer.inject'
  | 'peer.ban'
  | 'peer.unban'
  | 'alert.acknowledge'
  | 'alert.resolve'
  | 'alert.create'
  | 'incident.create'
  | 'incident.resolve'
  | 'retention.update'
  | 'user.login'
  | 'user.logout'
  | string; // allow arbitrary actions

export interface AuditEntry {
  id: number;
  actor: string;
  action: AuditAction;
  targetType: string | null;
  targetId: string | null;
  targetName: string | null;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuditLogFilter {
  actor?: string;
  action?: AuditAction;
  targetType?: string;
  targetId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Write — append a new audit entry
// ─────────────────────────────────────────────────────────────────────────────

export async function auditLog(opts: {
  actor: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await query(
      `INSERT INTO skynet.audit_log
         (actor, action, target_type, target_id, target_name, metadata, ip_address, user_agent, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
      [
        opts.actor,
        opts.action,
        opts.targetType ?? null,
        opts.targetId ?? null,
        opts.targetName ?? null,
        opts.metadata ? JSON.stringify(opts.metadata) : null,
        opts.ipAddress ?? null,
        opts.userAgent ?? null,
      ]
    );
  } catch (err: any) {
    // Table may not exist yet — log to console but don't crash the caller
    if (err.message?.includes('does not exist')) {
      logger.warn('[AuditLog] audit_log table does not exist; skipping', {
        actor: opts.actor,
        action: opts.action,
      });
    } else {
      logger.error('[AuditLog] Failed to write audit entry', { err, opts });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Read — paginated query with filters
// ─────────────────────────────────────────────────────────────────────────────

export async function getAuditLog(filter: AuditLogFilter = {}): Promise<{
  entries: AuditEntry[];
  total: number;
}> {
  const {
    actor,
    action,
    targetType,
    targetId,
    from,
    to,
    limit = 50,
    offset = 0,
  } = filter;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (actor) {
    conditions.push(`actor ILIKE $${idx++}`);
    params.push(`%${actor}%`);
  }
  if (action) {
    conditions.push(`action = $${idx++}`);
    params.push(action);
  }
  if (targetType) {
    conditions.push(`target_type = $${idx++}`);
    params.push(targetType);
  }
  if (targetId) {
    conditions.push(`target_id = $${idx++}`);
    params.push(targetId);
  }
  if (from) {
    conditions.push(`created_at >= $${idx++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`created_at <= $${idx++}`);
    params.push(to);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [dataResult, countResult] = await Promise.all([
      query(
        `SELECT id, actor, action, target_type, target_id, target_name,
                metadata, ip_address, user_agent, created_at
           FROM skynet.audit_log
         ${whereClause}
          ORDER BY created_at DESC
          LIMIT $${idx} OFFSET $${idx + 1}`,
        [...params, limit, offset]
      ),
      query(
        `SELECT COUNT(*) AS total FROM skynet.audit_log ${whereClause}`,
        params
      ),
    ]);

    const entries: AuditEntry[] = dataResult.rows.map((row: any) => ({
      id: Number(row.id),
      actor: String(row.actor),
      action: String(row.action) as AuditAction,
      targetType: row.target_type ?? null,
      targetId: row.target_id ?? null,
      targetName: row.target_name ?? null,
      metadata: row.metadata ?? null,
      ipAddress: row.ip_address ?? null,
      userAgent: row.user_agent ?? null,
      createdAt: new Date(row.created_at),
    }));

    return {
      entries,
      total: Number(countResult.rows[0]?.total ?? 0),
    };
  } catch (err: any) {
    if (err.message?.includes('does not exist')) {
      return { entries: [], total: 0 };
    }
    logger.error('[AuditLog] getAuditLog error', { err });
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Middleware helper — extract actor / IP from a Next.js Request
// ─────────────────────────────────────────────────────────────────────────────

export function extractRequestMeta(req: Request): {
  actor: string;
  ipAddress: string | null;
  userAgent: string | null;
} {
  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null;

  const userAgent = req.headers.get('user-agent') ?? null;

  // Try to get actor from API key header or auth header
  const apiKey = req.headers.get('x-api-key');
  const auth = req.headers.get('authorization');
  const actor =
    apiKey
      ? `api-key:${apiKey.slice(0, 8)}…`
      : auth
      ? `bearer:${auth.slice(0, 16)}…`
      : 'anonymous';

  return { actor, ipAddress, userAgent };
}
