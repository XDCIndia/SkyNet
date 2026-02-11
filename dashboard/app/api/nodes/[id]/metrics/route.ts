import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/nodes/[id]/metrics - Get historical metrics for charts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const interval = searchParams.get('interval') || '5m'; // 1m, 5m, 15m, 1h

    // Validate node exists
    const nodeCheck = await query(
      'SELECT id FROM netown.nodes WHERE id = $1',
      [id]
    );
    
    if (nodeCheck.rowCount === 0) {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
    }

    // Build time range
    let timeFilter = '';
    const queryParams: (string | Date)[] = [id];

    if (from && to) {
      timeFilter = 'AND collected_at BETWEEN $2 AND $3';
      queryParams.push(new Date(from), new Date(to));
    } else if (from) {
      timeFilter = 'AND collected_at >= $2';
      queryParams.push(new Date(from));
    } else {
      // Default to last 24 hours
      timeFilter = 'AND collected_at > NOW() - INTERVAL \'24 hours\'';
    }

    // Determine bucketing based on interval
    let bucketExpr: string;
    switch (interval) {
      case '1m':
        bucketExpr = "date_trunc('minute', collected_at)";
        break;
      case '15m':
        bucketExpr = "date_trunc('hour', collected_at) + INTERVAL '15 min' * (EXTRACT(minute FROM collected_at)::int / 15)";
        break;
      case '1h':
        bucketExpr = "date_trunc('hour', collected_at)";
        break;
      case '5m':
      default:
        bucketExpr = "date_trunc('hour', collected_at) + INTERVAL '5 min' * (EXTRACT(minute FROM collected_at)::int / 5)";
        break;
    }

    const result = await query(`
      WITH bucketed AS (
        SELECT 
          ${bucketExpr} as time_bucket,
          AVG(block_height)::bigint as block_height,
          AVG(sync_percent)::numeric(5,2) as sync_percent,
          AVG(peer_count)::int as peer_count,
          AVG(cpu_percent)::numeric(5,2) as cpu_percent,
          AVG(memory_percent)::numeric(5,2) as memory_percent,
          AVG(disk_percent)::numeric(5,2) as disk_percent,
          AVG(rpc_latency_ms)::int as rpc_latency_ms,
          BOOL_OR(is_syncing) as is_syncing,
          COUNT(*) as sample_count
        FROM netown.node_metrics
        WHERE node_id = $1 ${timeFilter}
        GROUP BY time_bucket
        ORDER BY time_bucket ASC
      )
      SELECT * FROM bucketed
    `, queryParams);

    return NextResponse.json({
      nodeId: id,
      interval,
      data: result.rows,
      dataPoints: result.rowCount,
    });
  } catch (error) {
    console.error('Error fetching node metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
