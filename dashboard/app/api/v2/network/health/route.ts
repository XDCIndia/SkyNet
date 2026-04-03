/**
 * GET /api/v2/network/health
 * Unified API Gateway — fleet health summary
 * Issue #14: Unified API Gateway
 *
 * Returns: max block, avg sync, total peers, online/offline/syncing counts
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

export async function GET(_request: NextRequest) {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      WITH latest AS (
        SELECT DISTINCT ON (m.node_id)
          m.node_id,
          m.block_height,
          m.peer_count,
          m.sync_percent,
          m.is_syncing,
          m.collected_at,
          n.last_heartbeat
        FROM skynet.node_metrics m
        JOIN skynet.nodes n ON n.id = m.node_id AND n.is_active = true
        ORDER BY m.node_id, m.collected_at DESC
      )
      SELECT
        COUNT(*)::int                                         AS total_nodes,
        COUNT(*) FILTER (
          WHERE last_heartbeat >= NOW() - INTERVAL '5 minutes'
          AND NOT is_syncing
        )::int                                                AS online_nodes,
        COUNT(*) FILTER (
          WHERE last_heartbeat < NOW() - INTERVAL '5 minutes'
          OR last_heartbeat IS NULL
        )::int                                                AS offline_nodes,
        COUNT(*) FILTER (WHERE is_syncing)::int              AS syncing_nodes,
        MAX(block_height)                                     AS max_block_height,
        ROUND(AVG(block_height))::bigint                     AS avg_block_height,
        ROUND(AVG(sync_percent)::numeric, 2)                 AS avg_sync_percent,
        SUM(peer_count)::int                                  AS total_peers,
        ROUND(AVG(peer_count)::numeric, 1)                   AS avg_peers
      FROM latest
    `);

    const row = result.rows[0] ?? {};

    return NextResponse.json(
      {
        success: true,
        health: {
          totalNodes:      row.total_nodes    ?? 0,
          onlineNodes:     row.online_nodes   ?? 0,
          offlineNodes:    row.offline_nodes  ?? 0,
          syncingNodes:    row.syncing_nodes  ?? 0,
          maxBlockHeight:  row.max_block_height  ?? 0,
          avgBlockHeight:  row.avg_block_height  ?? 0,
          avgSyncPercent:  row.avg_sync_percent  ?? 0,
          totalPeers:      row.total_peers    ?? 0,
          avgPeers:        row.avg_peers      ?? 0,
          timestamp:       new Date().toISOString(),
        },
      },
      { headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('[v2/network/health] error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    client.release();
  }
}
