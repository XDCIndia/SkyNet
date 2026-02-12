import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth';

// GET /api/incidents - Get incidents with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const severity = searchParams.get('severity');
    const nodeId = searchParams.get('nodeId');
    const limit = parseInt(searchParams.get('limit') || '50');

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (status) {
      params.push(status);
      whereClause += ` AND i.status = $${params.length}`;
    }
    
    if (severity) {
      params.push(severity);
      whereClause += ` AND i.severity = $${params.length}`;
    }
    
    if (nodeId) {
      params.push(nodeId);
      whereClause += ` AND i.node_id = $${params.length}`;
    }

    params.push(limit);
    const limitClause = `LIMIT $${params.length}`;

    const result = await query(`
      SELECT 
        i.*,
        n.name as node_name,
        n.host as node_host
      FROM netown.incidents i
      JOIN netown.nodes n ON i.node_id = n.id
      ${whereClause}
      ORDER BY i.detected_at DESC
      ${limitClause}
    `, params);

    return NextResponse.json({
      incidents: result.rows,
      total: result.rowCount,
      filters: { status, severity, nodeId },
    });
  } catch (error) {
    console.error('Error fetching incidents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch incidents' },
      { status: 500 }
    );
  }
}

// POST /api/incidents - Create manual incident (protected)
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
      severity,
      title,
      description,
      suggestedFix,
    } = body;

    // Validation
    if (!nodeId || !type || !severity || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: nodeId, type, severity, title' },
        { status: 400 }
      );
    }

    const validSeverities = ['critical', 'warning', 'info'];
    if (!validSeverities.includes(severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
        { status: 400 }
      );
    }

    // Check node exists
    const nodeCheck = await query(
      'SELECT id FROM netown.nodes WHERE id = $1',
      [nodeId]
    );
    
    if (nodeCheck.rowCount === 0) {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
    }

    const result = await query(`
      INSERT INTO netown.incidents 
        (node_id, type, severity, title, description, suggested_fix, auto_detected)
      VALUES ($1, $2, $3, $4, $5, $6, false)
      RETURNING *
    `, [nodeId, type, severity, title, description, suggestedFix]);

    return NextResponse.json({
      incident: result.rows[0],
      message: 'Incident created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating incident:', error);
    return NextResponse.json(
      { error: 'Failed to create incident' },
      { status: 500 }
    );
  }
}

// PATCH /api/incidents - Update incident status (bulk update supported via query params) (protected)
export async function PATCH(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json();
    const { id, status, resolution } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: id, status' },
        { status: 400 }
      );
    }

    const validStatuses = ['active', 'acknowledged', 'resolved'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    let updateClause = 'status = $2';
    let params: (string | null)[] = [id, status];

    if (status === 'resolved') {
      updateClause += ', resolved_at = NOW()';
    }

    if (resolution) {
      params.push(resolution);
      updateClause += `, description = COALESCE(description, '') || E'\n\nResolution: ' || $${params.length}`;
    }

    const result = await query(
      `UPDATE netown.incidents SET ${updateClause} WHERE id = $1 RETURNING *`,
      params
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Incident not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      incident: result.rows[0],
      message: 'Incident updated successfully',
    });
  } catch (error) {
    console.error('Error updating incident:', error);
    return NextResponse.json(
      { error: 'Failed to update incident' },
      { status: 500 }
    );
  }
}
