import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
import { withErrorHandling } from '@/lib/errors';
import { z } from 'zod';

// Query params schema
const AlertHistoryQuerySchema = z.object({
  status: z.enum(['firing', 'acknowledged', 'resolved']).optional(),
  severity: z.enum(['critical', 'warning', 'info']).optional(),
  nodeId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

/**
 * GET /api/v1/alerts/history
 * Get alert history with filters
 */
async function getHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const params = AlertHistoryQuerySchema.parse({
    status: searchParams.get('status') || undefined,
    severity: searchParams.get('severity') || undefined,
    nodeId: searchParams.get('nodeId') || undefined,
    limit: searchParams.get('limit'),
    offset: searchParams.get('offset'),
  });

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (params.status) {
    conditions.push(`ah.status = $${paramIndex++}`);
    values.push(params.status);
  }

  if (params.severity) {
    conditions.push(`ah.severity = $${paramIndex++}`);
    values.push(params.severity);
  }

  if (params.nodeId) {
    conditions.push(`ah.node_id = $${paramIndex++}`);
    values.push(params.nodeId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [alerts, countResult] = await Promise.all([
    queryAll(`
      SELECT 
        ah.id,
        ah.rule_id as "ruleId",
        ah.node_id as "nodeId",
        ah.channel_id as "channelId",
        ah.severity,
        ah.title,
        ah.message,
        ah.status,
        ah.fired_at as "firedAt",
        ah.acknowledged_at as "acknowledgedAt",
        ah.resolved_at as "resolvedAt",
        ah.acknowledged_by as "acknowledgedBy",
        ah.metadata,
        n.name as "nodeName",
        ac.name as "channelName",
        ac.channel_type as "channelType"
      FROM netown.alert_history ah
      LEFT JOIN netown.nodes n ON ah.node_id = n.id
      LEFT JOIN netown.alert_channels ac ON ah.channel_id = ac.id
      ${whereClause}
      ORDER BY ah.fired_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...values, params.limit, params.offset]),
    queryAll(`
      SELECT COUNT(*) as total
      FROM netown.alert_history ah
      ${whereClause}
    `, values),
  ]);

  const total = parseInt(countResult[0]?.total || '0');

  return NextResponse.json({
    success: true,
    data: alerts,
    meta: {
      total,
      limit: params.limit,
      offset: params.offset,
      hasMore: params.offset + alerts.length < total,
    },
  });
}

export const GET = withErrorHandling(getHandler);
