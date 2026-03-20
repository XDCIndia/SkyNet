import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://gateway:xdc_news_2025_secure@127.0.0.1:5433/xdc_gateway',
});

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/alerts/active
 * Get active (non-resolved) alerts with optional filters
 * Used by the dashboard bell icon and alerts page
 */
export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const nodeId = searchParams.get('nodeId');

    const conditions: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (status !== 'all') {
      conditions.push(`a.status = $${idx++}`);
      values.push(status);
    }

    if (nodeId) {
      conditions.push(`a.node_id = $${idx++}`);
      values.push(nodeId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await client.query(`
      SELECT 
        a.*,
        ar.name as rule_name,
        ar.rule_type
      FROM skynet.alerts a
      LEFT JOIN skynet.alert_rules ar ON a.rule_id = ar.id
      ${where}
      ORDER BY a.triggered_at DESC
      LIMIT $${idx}
    `, [...values, limit]);

    // Count active alerts
    const countResult = await client.query(`
      SELECT COUNT(*) as total FROM skynet.alerts WHERE status = 'active'
    `);

    return NextResponse.json({
      success: true,
      data: result.rows,
      meta: {
        activeCount: parseInt(countResult.rows[0]?.total || '0'),
        returned: result.rows.length,
      },
    });
  } catch (error: any) {
    console.error('Active alerts fetch error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}

/**
 * PATCH /api/v1/alerts/active
 * Acknowledge or resolve an alert
 * Body: { id: number, action: 'acknowledge' | 'resolve' }
 */
export async function PATCH(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const { id, action } = body;

    if (!id || !action) {
      return NextResponse.json({ success: false, error: 'id and action required' }, { status: 400 });
    }

    if (!['acknowledge', 'resolve'].includes(action)) {
      return NextResponse.json({ success: false, error: 'action must be acknowledge or resolve' }, { status: 400 });
    }

    let updateQuery: string;
    if (action === 'acknowledge') {
      updateQuery = `
        UPDATE skynet.alerts 
        SET status = 'acknowledged', acknowledged_at = NOW()
        WHERE id = $1 AND status = 'active'
        RETURNING *
      `;
    } else {
      updateQuery = `
        UPDATE skynet.alerts 
        SET status = 'resolved', resolved_at = NOW()
        WHERE id = $1 AND status != 'resolved'
        RETURNING *
      `;
    }

    const result = await client.query(updateQuery, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Alert not found or already in target state' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Alert update error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
