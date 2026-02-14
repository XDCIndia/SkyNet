import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
import { withErrorHandling } from '@/lib/errors';
import { z } from 'zod';

const QuerySchema = z.object({
  status: z.enum(['open', 'resolved', 'all']).optional().default('all'),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
  nodeId: z.string().uuid().optional(),
  limit: z.coerce.number().min(1).max(1000).optional().default(100),
});

async function getHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const validationResult = QuerySchema.safeParse({
    status: searchParams.get('status') || 'all',
    severity: searchParams.get('severity') || undefined,
    nodeId: searchParams.get('nodeId') || undefined,
    limit: searchParams.get('limit') || '100',
  });

  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: validationResult.error.errors },
      { status: 400 }
    );
  }

  const { status, severity, nodeId, limit } = validationResult.data;

  // Build query conditions
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;

  if (status !== 'all') {
    conditions.push(`i.status = $${paramIndex++}`);
    params.push(status);
  }

  if (severity) {
    conditions.push(`i.severity = $${paramIndex++}`);
    params.push(severity);
  }

  if (nodeId) {
    conditions.push(`i.node_id = $${paramIndex++}`);
    params.push(nodeId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Add limit as last parameter
  params.push(limit);

  const query = `
    SELECT 
      i.id,
      i.node_id,
      i.node_name,
      i.type,
      i.severity,
      i.title,
      i.description,
      i.diagnostics,
      i.status,
      i.github_issue_url,
      i.github_pr_url,
      i.solution_code,
      i.solution_description,
      i.duplicate_of,
      i.occurrence_count,
      i.first_seen,
      i.last_seen,
      i.resolved_at,
      i.created_at,
      n.ipv4 as node_ip,
      n.client_type,
      n.client_version,
      n.role as node_role,
      (SELECT name FROM skynet.nodes WHERE id = i.duplicate_of) as duplicate_of_node_name
    FROM skynet.issues i
    LEFT JOIN skynet.nodes n ON i.node_id = n.id
    ${whereClause}
    ORDER BY i.last_seen DESC
    LIMIT $${paramIndex}
  `;

  const issues = await queryAll(query, params);

  // Get summary counts
  const summaryQuery = `
    SELECT 
      COUNT(*) FILTER (WHERE status = 'open') as open_count,
      COUNT(*) FILTER (WHERE status = 'open' AND severity = 'critical') as critical_count,
      COUNT(*) FILTER (WHERE status = 'open' AND severity = 'high') as high_count,
      COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count
    FROM skynet.issues
  `;
  
  const summary = await queryAll(summaryQuery);

  return NextResponse.json({
    success: true,
    data: issues.map(issue => ({
      ...issue,
      diagnostics: issue.diagnostics || {},
    })),
    summary: {
      open: parseInt(summary[0]?.open_count || '0'),
      critical: parseInt(summary[0]?.critical_count || '0'),
      high: parseInt(summary[0]?.high_count || '0'),
      resolved: parseInt(summary[0]?.resolved_count || '0'),
      total: parseInt(summary[0]?.open_count || '0') + parseInt(summary[0]?.resolved_count || '0'),
    },
  });
}

export const GET = withErrorHandling(getHandler);
