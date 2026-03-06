import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const network = searchParams.get('network');
    
    let sql = `
      SELECT n.id, n.name, n.network, n.role, n.status,
             n.ipv4, n.client_type, n.created_at,
             COALESCE(m.block_height, 0) as latest_block,
             COALESCE(m.peer_count, 0) as peer_count,
             COALESCE(m.is_syncing, true) as syncing
      FROM skynet.nodes n
      LEFT JOIN LATERAL (
        SELECT block_height, peer_count, is_syncing
        FROM skynet.node_metrics
        WHERE node_id = n.id
        ORDER BY collected_at DESC
        LIMIT 1
      ) m ON true
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (network) {
      sql += ' AND n.network = $1';
      params.push(network);
    }
    
    sql += ' ORDER BY n.last_heartbeat DESC NULLS LAST LIMIT $' + (params.length + 1);
    params.push(limit);
    
    const result = await query(sql, params);
    
    return NextResponse.json({
      success: true,
      nodes: result.rows
    });
  } catch (error) {
    console.error('Error fetching nodes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch nodes' },
      { status: 500 }
    );
  }
}
