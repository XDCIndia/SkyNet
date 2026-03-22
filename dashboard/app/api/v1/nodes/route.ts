import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://gateway:gateway@localhost:5433/xdc_gateway'
});

export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const limit   = Math.min(parseInt(searchParams.get('limit') || '50'), 500);
    const network = searchParams.get('network');

    const params: any[] = [];
    let where = 'WHERE n.is_active = true';
    if (network) {
      params.push(network);
      where += ` AND n.network = $${params.length}`;
    }
    params.push(limit);

    const sql = `
      SELECT
        n.id, n.name, n.network, n.role, n.status,
        -- IP: prefer explicit ipv4, fall back to fingerprint parsing
        COALESCE(n.ipv4, NULLIF(split_part(split_part(n.fingerprint, '@', 2), ':', 1), 'null'), n.host) AS ipv4,
        n.client_type, n.coinbase,
        n.created_at, n.last_heartbeat,
        n.last_seen,
        n.fingerprint,
        n.state_scheme,
        n.docker_image,
        n.startup_params,
        m.block_height   AS latest_block,
        m.peer_count,
        m.is_syncing,
        m.sync_percent,
        m.cpu_percent,
        m.memory_percent,
        m.disk_percent,
        m.disk_used_gb,
        m.disk_total_gb,
        m.tx_pool_pending,
        m.tx_pool_queued,
        m.rpc_latency_ms,
        m.client_version,
        m.node_type,
        m.os_type,
        m.os_release,
        m.os_arch,
        m.kernel_version,
        m.collected_at   AS metrics_at
      FROM skynet.nodes n
      LEFT JOIN LATERAL (
        SELECT * FROM skynet.node_metrics
        WHERE node_id = n.id
        ORDER BY collected_at DESC
        LIMIT 1
      ) m ON true
      ${where}
      ORDER BY n.last_heartbeat DESC NULLS LAST
      LIMIT $${params.length}
    `;

    const result = await client.query(sql, params);
    return NextResponse.json({ success: true, nodes: result.rows });
  } catch (error: any) {
    console.error('Nodes error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
