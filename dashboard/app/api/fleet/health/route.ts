import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { query } from '@/lib/db';

// GET /api/fleet/health - Get network health history
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24');
    
    // Limit to reasonable range
    const validHours = Math.min(Math.max(hours, 1), 168); // 1 hour to 7 days

    const result = await query(`
      SELECT 
        health_score,
        total_nodes,
        healthy_nodes,
        degraded_nodes,
        offline_nodes,
        total_peers,
        avg_block_height,
        max_block_height,
        nakamoto_coefficient,
        avg_sync_percent,
        avg_rpc_latency_ms,
        collected_at
      FROM skynet.network_health
      WHERE collected_at > NOW() - INTERVAL '${validHours} hours'
      ORDER BY collected_at ASC
    `);

    return NextResponse.json({
      hours: validHours,
      dataPoints: result.rowCount,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching health history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch health history' },
      { status: 500 }
    );
  }
}
