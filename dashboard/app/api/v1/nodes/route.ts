import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://gateway:gateway@localhost:5433/xdc_gateway'
});

export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500);
    const network = searchParams.get('network');
    
    let sql = `
      SELECT 
        n.id, 
        n.name, 
        n.network, 
        n.role, 
        n.status,
        n.ipv4, 
        n.client_type, 
        n.created_at, 
        n.last_heartbeat,
        COALESCE((
          SELECT m.block_height 
          FROM skynet.node_metrics m 
          WHERE m.node_id = n.id 
          ORDER BY m.collected_at DESC 
          LIMIT 1
        ), 0) as latest_block,
        COALESCE((
          SELECT m.peer_count 
          FROM skynet.node_metrics m 
          WHERE m.node_id = n.id 
          ORDER BY m.collected_at DESC 
          LIMIT 1
        ), 0) as peer_count
      FROM skynet.nodes n
      WHERE n.is_active = true
    `;
    const params: any[] = [];
    
    if (network) {
      sql += ' AND n.network = $1';
      params.push(network);
    }
    
    sql += ' ORDER BY n.last_heartbeat DESC NULLS LAST LIMIT $' + (params.length + 1);
    params.push(limit);
    
    const result = await client.query(sql, params);
    
    return NextResponse.json({
      success: true,
      nodes: result.rows
    });
  } catch (error: any) {
    console.error('Error fetching nodes:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
