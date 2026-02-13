import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
import { withErrorHandling } from '@/lib/errors';
import { z } from 'zod';

// Query params schema
const AnalyticsQuerySchema = z.object({
  nodeId: z.string().uuid().optional(),
  range: z.enum(['24h', '7d', '30d', '90d']).default('24h'),
  metric: z.enum(['uptime', 'peers', 'blocks', 'latency', 'cpu', 'memory', 'disk']).default('uptime'),
});

/**
 * GET /api/v1/analytics
 * Get historical metrics data for time-series charts
 */
async function getHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const params = AnalyticsQuerySchema.parse({
    nodeId: searchParams.get('nodeId') || undefined,
    range: searchParams.get('range') || '24h',
    metric: searchParams.get('metric') || 'uptime',
  });

  // Determine time interval based on range
  const rangeConfig: Record<string, { interval: string; bucket: string }> = {
    '24h': { interval: '24 hours', bucket: '1 hour' },
    '7d': { interval: '7 days', bucket: '6 hours' },
    '30d': { interval: '30 days', bucket: '1 day' },
    '90d': { interval: '90 days', bucket: '3 days' },
  };

  const { interval, bucket } = rangeConfig[params.range];

  // Build query based on metric type
  let query: string;
  let queryParams: unknown[] = [interval];

  switch (params.metric) {
    case 'uptime':
      query = `
        SELECT 
          time_bucket($2, collected_at) as time,
          node_id as "nodeId",
          COUNT(*) FILTER (WHERE is_syncing = false AND collected_at > NOW() - INTERVAL '2 minutes')::float / NULLIF(COUNT(*), 0) * 100 as uptime_pct
        FROM skynet.node_metrics
        WHERE collected_at > NOW() - $1::interval
        ${params.nodeId ? 'AND node_id = $3' : ''}
        GROUP BY time_bucket($2, collected_at), node_id
        ORDER BY time
      `;
      queryParams.push(bucket);
      if (params.nodeId) queryParams.push(params.nodeId);
      break;

    case 'peers':
      query = `
        SELECT 
          time_bucket($2, collected_at) as time,
          node_id as "nodeId",
          ROUND(AVG(peer_count)::numeric, 2) as avg_peers,
          MIN(peer_count) as min_peers,
          MAX(peer_count) as max_peers
        FROM skynet.node_metrics
        WHERE collected_at > NOW() - $1::interval
        ${params.nodeId ? 'AND node_id = $3' : ''}
        GROUP BY time_bucket($2, collected_at), node_id
        ORDER BY time
      `;
      queryParams.push(bucket);
      if (params.nodeId) queryParams.push(params.nodeId);
      break;

    case 'blocks':
      query = `
        SELECT 
          time_bucket($2, collected_at) as time,
          node_id as "nodeId",
          MIN(block_height) as min_block,
          MAX(block_height) as max_block,
          MAX(block_height) - MIN(block_height) as blocks_synced
        FROM skynet.node_metrics
        WHERE collected_at > NOW() - $1::interval
        ${params.nodeId ? 'AND node_id = $3' : ''}
        GROUP BY time_bucket($2, collected_at), node_id
        ORDER BY time
      `;
      queryParams.push(bucket);
      if (params.nodeId) queryParams.push(params.nodeId);
      break;

    case 'latency':
      query = `
        SELECT 
          time_bucket($2, collected_at) as time,
          node_id as "nodeId",
          ROUND(AVG(rpc_latency_ms)::numeric, 2) as avg_latency,
          MIN(rpc_latency_ms) as min_latency,
          MAX(rpc_latency_ms) as max_latency
        FROM skynet.node_metrics
        WHERE collected_at > NOW() - $1::interval
        ${params.nodeId ? 'AND node_id = $3' : ''}
        GROUP BY time_bucket($2, collected_at), node_id
        ORDER BY time
      `;
      queryParams.push(bucket);
      if (params.nodeId) queryParams.push(params.nodeId);
      break;

    case 'cpu':
      query = `
        SELECT 
          time_bucket($2, collected_at) as time,
          node_id as "nodeId",
          ROUND(AVG(cpu_percent)::numeric, 2) as avg_cpu,
          MIN(cpu_percent) as min_cpu,
          MAX(cpu_percent) as max_cpu
        FROM skynet.node_metrics
        WHERE collected_at > NOW() - $1::interval AND cpu_percent IS NOT NULL
        ${params.nodeId ? 'AND node_id = $3' : ''}
        GROUP BY time_bucket($2, collected_at), node_id
        ORDER BY time
      `;
      queryParams.push(bucket);
      if (params.nodeId) queryParams.push(params.nodeId);
      break;

    case 'memory':
      query = `
        SELECT 
          time_bucket($2, collected_at) as time,
          node_id as "nodeId",
          ROUND(AVG(memory_percent)::numeric, 2) as avg_memory,
          MIN(memory_percent) as min_memory,
          MAX(memory_percent) as max_memory
        FROM skynet.node_metrics
        WHERE collected_at > NOW() - $1::interval AND memory_percent IS NOT NULL
        ${params.nodeId ? 'AND node_id = $3' : ''}
        GROUP BY time_bucket($2, collected_at), node_id
        ORDER BY time
      `;
      queryParams.push(bucket);
      if (params.nodeId) queryParams.push(params.nodeId);
      break;

    case 'disk':
      query = `
        SELECT 
          time_bucket($2, collected_at) as time,
          node_id as "nodeId",
          ROUND(AVG(disk_percent)::numeric, 2) as avg_disk,
          MIN(disk_percent) as min_disk,
          MAX(disk_percent) as max_disk
        FROM skynet.node_metrics
        WHERE collected_at > NOW() - $1::interval AND disk_percent IS NOT NULL
        ${params.nodeId ? 'AND node_id = $3' : ''}
        GROUP BY time_bucket($2, collected_at), node_id
        ORDER BY time
      `;
      queryParams.push(bucket);
      if (params.nodeId) queryParams.push(params.nodeId);
      break;

    default:
      return NextResponse.json(
        { success: false, error: 'Invalid metric type' },
        { status: 400 }
      );
  }

  const data = await queryAll(query, queryParams);

  // Also get summary statistics
  const summaryQuery = `
    SELECT 
      COUNT(DISTINCT node_id) as node_count,
      MIN(collected_at) as earliest,
      MAX(collected_at) as latest,
      COUNT(*) as total_metrics
    FROM skynet.node_metrics
    WHERE collected_at > NOW() - $1::interval
    ${params.nodeId ? 'AND node_id = $2' : ''}
  `;
  const summaryParams: unknown[] = [interval];
  if (params.nodeId) summaryParams.push(params.nodeId);
  
  const [summary] = await queryAll(summaryQuery, summaryParams);

  return NextResponse.json({
    success: true,
    data: {
      metric: params.metric,
      range: params.range,
      interval: bucket,
      timeseries: data,
      summary: {
        nodeCount: parseInt(summary.node_count || '0'),
        earliest: summary.earliest,
        latest: summary.latest,
        totalMetrics: parseInt(summary.total_metrics || '0'),
      },
    },
  });
}

export const GET = withErrorHandling(getHandler);
