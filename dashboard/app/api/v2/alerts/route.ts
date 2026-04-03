/**
 * GET  /api/v2/alerts        — list alerts (default: active)
 * POST /api/v2/alerts/run    — manually trigger alert engine evaluation
 * Issue #16: Alert Trigger Engine
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { runAlertEngine } from '@/lib/alert-trigger-engine';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://gateway:gateway@localhost:5433/xdc_gateway',
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const status   = searchParams.get('status') ?? 'active';
    const nodeId   = searchParams.get('nodeId');
    const ruleType = searchParams.get('ruleType');
    const limit    = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

    const conditions: string[] = [];
    const params: any[]        = [];
    let idx = 1;

    if (status !== 'all') {
      conditions.push(`status = $${idx++}`);
      params.push(status);
    }
    if (nodeId) {
      conditions.push(`node_id = $${idx++}`);
      params.push(nodeId);
    }
    if (ruleType) {
      conditions.push(`rule_type = $${idx++}`);
      params.push(ruleType);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    const result = await client.query(
      `SELECT * FROM skynet.alerts
       ${where}
       ORDER BY triggered_at DESC
       LIMIT $${idx}`,
      params
    );

    return NextResponse.json(
      { success: true, count: result.rows.length, alerts: result.rows },
      { headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('[v2/alerts GET]', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    client.release();
  }
}

/** POST /api/v2/alerts — manually trigger the alert engine */
export async function POST(request: NextRequest) {
  try {
    await runAlertEngine();
    return NextResponse.json(
      { success: true, message: 'Alert engine evaluation triggered' },
      { headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
