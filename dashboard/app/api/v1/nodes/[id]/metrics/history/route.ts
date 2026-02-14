import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, isDashboardReadRequest } from '@/lib/auth';

/**
 * GET /api/v1/nodes/[id]/metrics/history
 * Get time-series metrics history for a node
 * Query params: ?hours=24&interval=5m
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate request
    if (!isDashboardReadRequest(request)) {
      const auth = await authenticateRequest(request);
      if (!auth.valid) {
        return unauthorizedResponse(auth.error);
      }
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    const hours = parseInt(searchParams.get('hours') || '24');
    const interval = searchParams.get('interval') || '5m';
    
    // Parse interval
    const intervalMinutes = parseInterval(interval);
    
    // Get metrics history
    const result = await query(`
      SELECT 
        date_trunc('hour', collected_at) + 
          interval '${intervalMinutes} min' * 
          (extract(minute from collected_at)::int / ${intervalMinutes}) as timestamp,
        avg(block_height)::bigint as block_height,
        avg(peer_count)::int as peer_count,
        avg(cpu_percent)::numeric(5,2) as cpu_percent,
        avg(memory_percent)::numeric(5,2) as memory_percent,
        avg(disk_percent)::numeric(5,2) as disk_percent,
        avg(chain_data_size)::bigint as chain_data_size,
        avg(database_size)::bigint as database_size
      FROM skynet.node_metrics
      WHERE node_id = $1
        AND collected_at > NOW() - INTERVAL '${hours} hours'
      GROUP BY 1
      ORDER BY 1 ASC
    `, [id]);

    return NextResponse.json({
      nodeId: id,
      hours,
      interval,
      history: result.rows.map(row => ({
        timestamp: row.timestamp,
        block_height: parseInt(row.block_height) || 0,
        peer_count: parseInt(row.peer_count) || 0,
        cpu_percent: parseFloat(row.cpu_percent) || 0,
        memory_percent: parseFloat(row.memory_percent) || 0,
        disk_percent: parseFloat(row.disk_percent) || 0,
        chain_data_size: parseInt(row.chain_data_size) || 0,
        database_size: parseInt(row.database_size) || 0,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching metrics history:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch metrics history', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

function parseInterval(interval: string): number {
  const match = interval.match(/^(\d+)([mhd])$/);
  if (!match) return 5;
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 'm': return value;
    case 'h': return value * 60;
    case 'd': return value * 60 * 24;
    default: return 5;
  }
}
