/**
 * GET /api/v2/nodes
 * Unified API Gateway — list all nodes with latest metrics
 * Issue #14: Unified API Gateway
 *
 * Changes vs v1:
 * - Always includes CORS headers for dashboard consumption
 * - Unified response envelope
 * - Computed `status` field (online/offline/syncing) derived from metrics recency
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://gateway:gateway@localhost:5433/xdc_gateway',
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const limit   = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const network = searchParams.get('network');
    const status  = searchParams.get('status'); // online|offline|syncing

    const params: any[] = [];
    let where = 'WHERE n.is_active = true';
    if (network) {
      params.push(network);
      where += ` AND n.network = $${params.length}`;
    }
    params.push(limit);

    const sql = `
      SELECT
        n.id,
        n.name,
        n.network,
        n.role,
        COALESCE(n.ipv4,
          NULLIF(split_part(split_part(n.fingerprint, '@', 2), ':', 1), 'null'),
          n.host) AS ip,
        n.client_type,
        n.coinbase,
        n.created_at,
        n.last_heartbeat,
        n.last_seen,
        -- Derive status from heartbeat recency
        CASE
          WHEN n.last_heartbeat IS NULL                          THEN 'unknown'
          WHEN n.last_heartbeat < NOW() - INTERVAL '5 minutes'  THEN 'offline'
          WHEN m.is_syncing                                      THEN 'syncing'
          ELSE 'online'
        END AS status,
        COALESCE(m.block_height, n.block_height) AS block_height,
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
        m.collected_at AS metrics_at
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
    let nodes = result.rows;

    // Filter by status if requested
    if (status) {
      nodes = nodes.filter(n => n.status === status);
    }

    return NextResponse.json(
      { success: true, count: nodes.length, nodes },
      { headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('[v2/nodes] error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    client.release();
  }
}
