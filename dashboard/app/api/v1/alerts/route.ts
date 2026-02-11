import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, isDashboardReadRequest } from '@/lib/auth';

/**
 * GET /api/v1/alerts
 * List all active alerts across fleet
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    if (!isDashboardReadRequest(request)) {
      const auth = await authenticateRequest(request);
      if (!auth.valid) {
        return unauthorizedResponse(auth.error);
      }
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') !== 'false';

    const result = await query(`
      SELECT 
        ar.*,
        n.name as node_name,
        CASE 
          WHEN ar.last_triggered_at IS NULL THEN 'never'
          WHEN ar.last_triggered_at > NOW() - INTERVAL '1 hour' THEN 'recently'
          ELSE 'ok'
        END as trigger_status
      FROM netown.alert_rules ar
      LEFT JOIN netown.nodes n ON ar.node_id = n.id
      ${activeOnly ? 'WHERE ar.is_active = true' : ''}
      ORDER BY 
        CASE ar.type 
          WHEN 'node_down' THEN 1
          WHEN 'sync_stall' THEN 2
          WHEN 'disk_full' THEN 3
          WHEN 'peer_drop' THEN 4
          ELSE 5
        END,
        ar.created_at DESC
    `);

    return NextResponse.json({
      alerts: result.rows,
      total: result.rowCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching alerts:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch alerts', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/alerts
 * Create a new alert rule
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json();
    const {
      nodeId,
      type,
      condition,
      channels,
      cooldownMinutes = 30,
    } = body;

    // Validation
    if (!type || !condition || !channels) {
      return NextResponse.json(
        { error: 'Missing required fields: type, condition, channels', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    // Validate alert type
    const validTypes = ['node_down', 'sync_stall', 'peer_drop', 'disk_full', 'block_drift', 'custom'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}`, code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    // If nodeId provided, verify node exists
    if (nodeId) {
      const nodeCheck = await query(
        'SELECT id FROM netown.nodes WHERE id = $1',
        [nodeId]
      );
      if (nodeCheck.rowCount === 0) {
        return NextResponse.json(
          { error: 'Node not found', code: 'NOT_FOUND' },
          { status: 404 }
        );
      }
    }

    const result = await query(`
      INSERT INTO netown.alert_rules 
        (node_id, type, condition, channels, cooldown_minutes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [nodeId || null, type, JSON.stringify(condition), JSON.stringify(channels), cooldownMinutes]);

    return NextResponse.json({
      alert: result.rows[0],
      message: 'Alert rule created successfully',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating alert:', error);
    
    return NextResponse.json(
      { error: 'Failed to create alert', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
