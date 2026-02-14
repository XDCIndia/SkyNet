import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
import { withErrorHandling } from '@/lib/errors';

/**
 * GET /api/v1/issues/resolution-stats
 * Returns resolution statistics
 */
async function getHandler(request: NextRequest) {
  // Get average resolution time
  const avgTimeQuery = `
    SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600) as avg_hours
    FROM skynet.issues 
    WHERE status = 'resolved' 
    AND resolved_at IS NOT NULL
    AND created_at > NOW() - INTERVAL '30 days'
  `;
  
  const avgTimeResult = await queryAll(avgTimeQuery);
  const avgHours = parseFloat(avgTimeResult[0]?.avg_hours || '0');
  
  // Format avg time
  let avgResolutionTime: string;
  if (avgHours >= 24) {
    avgResolutionTime = `${Math.round(avgHours / 24)}d ${Math.round(avgHours % 24)}h`;
  } else if (avgHours >= 1) {
    avgResolutionTime = `${Math.round(avgHours)}h`;
  } else {
    avgResolutionTime = `${Math.round(avgHours * 60)}m`;
  }

  // Get counts by status
  const countsQuery = `
    SELECT 
      COUNT(*) FILTER (WHERE status = 'open') as open_count,
      COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count
    FROM skynet.issues
  `;
  
  const countsResult = await queryAll(countsQuery);

  // Get breakdown by severity
  const severityQuery = `
    SELECT 
      severity,
      COUNT(*) FILTER (WHERE status = 'open') as open_count,
      COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count
    FROM skynet.issues
    GROUP BY severity
  `;
  
  const severityResult = await queryAll(severityQuery);
  
  const bySeverity: Record<string, { open: number; resolved: number }> = {};
  for (const row of severityResult) {
    bySeverity[row.severity] = {
      open: parseInt(row.open_count || '0'),
      resolved: parseInt(row.resolved_count || '0'),
    };
  }

  return NextResponse.json({
    success: true,
    data: {
      avgResolutionTime,
      openCount: parseInt(countsResult[0]?.open_count || '0'),
      resolvedCount: parseInt(countsResult[0]?.resolved_count || '0'),
      bySeverity,
    },
  });
}

export const GET = withErrorHandling(getHandler);
