import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, hasPermission } from '@/lib/auth';
import { withErrorHandling, NotFoundError, ValidationError as ApiValidationError } from '@/lib/errors';
import { validateBody, AlertSchema, AlertNotifySchema } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { invalidateByTag, withCache, CACHE_TTLS, generateCacheKey } from '@/lib/cache';
import { z } from 'zod';

// Query params schema
const AlertQuerySchema = z.object({
  status: z.enum(['active', 'acknowledged', 'resolved']).optional(),
  severity: z.enum(['critical', 'warning', 'info']).optional(),
  nodeId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

/**
 * GET /api/v1/alerts
 * List alerts/incidents with optional filters
 */
async function getHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const params = AlertQuerySchema.parse({
    status: searchParams.get('status'),
    severity: searchParams.get('severity'),
    nodeId: searchParams.get('nodeId'),
    limit: searchParams.get('limit'),
    cursor: searchParams.get('cursor'),
  });

  const cacheKey = generateCacheKey('alerts', 'list', params);
  
  const data = await withCache(cacheKey, async () => {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (params.status) {
      conditions.push(`i.status = $${paramIndex++}`);
      values.push(params.status);
    }

    if (params.severity) {
      conditions.push(`i.severity = $${paramIndex++}`);
      values.push(params.severity);
    }

    if (params.nodeId) {
      conditions.push(`i.node_id = $${paramIndex++}`);
      values.push(params.nodeId);
    }

    if (params.cursor) {
      conditions.push(`i.id < $${paramIndex++}`);
      values.push(parseInt(params.cursor, 10));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const incidents = await queryAll(`
      SELECT i.*, n.name as node_name
      FROM skynet.incidents i
      LEFT JOIN skynet.nodes n ON i.node_id = n.id
      ${whereClause}
      ORDER BY i.detected_at DESC
      LIMIT $${paramIndex}
    `, [...values, params.limit + 1]);

    const hasMore = incidents.length > params.limit;
    const data = hasMore ? incidents.slice(0, -1) : incidents;
    const nextCursor = hasMore && data.length > 0 ? String(data[data.length - 1].id) : null;

    return { incidents: data, hasMore, nextCursor };
  }, CACHE_TTLS.incidents);

  return NextResponse.json({
    success: true,
    data: data.incidents,
    meta: {
      hasMore: data.hasMore,
      cursor: data.nextCursor,
    },
  });
}

/**
 * POST /api/v1/alerts
 * Create a new alert/incident
 */
async function postHandler(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.valid) {
    return unauthorizedResponse(auth.error);
  }

  const body = await validateBody(request, AlertSchema);
  const { nodeId, type, severity, title, description, suggestedFix } = body;

  const result = await queryAll(
    `INSERT INTO skynet.incidents 
     (node_id, type, severity, title, description, suggested_fix, auto_detected)
     VALUES ($1, $2, $3, $4, $5, $6, false)
     RETURNING *`,
    [nodeId || null, type, severity, title, description || null, suggestedFix || null]
  );

  logger.info('Alert created', { alertId: result[0]?.id, type, severity });
  await invalidateByTag('incidents');

  return NextResponse.json({
    success: true,
    data: result[0],
  }, { status: 201 });
}

export const GET = withErrorHandling(getHandler);
export const POST = withErrorHandling(postHandler);
