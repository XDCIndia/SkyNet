/**
 * GET /api/v2/nodes/:id
 * Unified API Gateway — single node detail with full metrics history
 * Issue #14: Unified API Gateway
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const client = await pool.connect();
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const historyLimit = Math.min(parseInt(searchParams.get('history') || '20'), 100);

    // Node record
    const nodeResult = await client.query(
      `SELECT
         n.*,
         CASE
           WHEN n.last_heartbeat IS NULL                         THEN 'unknown'
           WHEN n.last_heartbeat < NOW() - INTERVAL '5 minutes' THEN 'offline'
           WHEN m.is_syncing                                     THEN 'syncing'
           ELSE 'online'
         END AS status,
         COALESCE(m.block_height, n.block_height) AS latest_block,
         m.peer_count, m.is_syncing, m.sync_percent,
         m.cpu_percent, m.memory_percent, m.disk_percent,
         m.rpc_latency_ms, m.client_version, m.collected_at AS metrics_at
       FROM skynet.nodes n
       LEFT JOIN LATERAL (
         SELECT * FROM skynet.node_metrics
         WHERE node_id = n.id
         ORDER BY collected_at DESC LIMIT 1
       ) m ON true
       WHERE n.id = $1`,
      [id]
    );

    if (nodeResult.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Node not found' },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    // Recent metrics history
    const historyResult = await client.query(
      `SELECT block_height, peer_count, cpu_percent, memory_percent,
              disk_percent, rpc_latency_ms, is_syncing, collected_at
       FROM skynet.node_metrics
       WHERE node_id = $1
       ORDER BY collected_at DESC
       LIMIT $2`,
      [id, historyLimit]
    );

    // Active alerts for this node
    const alertsResult = await client.query(
      `SELECT id, severity, title, message, triggered_at, status
       FROM skynet.alerts
       WHERE node_id = $1 AND status != 'resolved'
       ORDER BY triggered_at DESC
       LIMIT 10`,
      [id]
    );

    return NextResponse.json(
      {
        success: true,
        node: nodeResult.rows[0],
        metricsHistory: historyResult.rows,
        activeAlerts: alertsResult.rows,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('[v2/nodes/:id] error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    client.release();
  }
}
