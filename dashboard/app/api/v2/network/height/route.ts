/**
 * GET /api/v2/network/height
 * Unified API Gateway — just the current network block height
 * Issue #14: Unified API Gateway
 *
 * Lightweight endpoint for external tools/monitors that only need the tip height.
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
      SELECT MAX(block_height) AS height
      FROM skynet.node_metrics
      WHERE collected_at > NOW() - INTERVAL '5 minutes'
    `);

    const height = result.rows[0]?.height ?? 0;

    return NextResponse.json(
      { success: true, height, timestamp: new Date().toISOString() },
      { headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('[v2/network/height] error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    client.release();
  }
}
