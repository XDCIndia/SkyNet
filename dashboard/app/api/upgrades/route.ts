import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth';

// GET /api/upgrades - List upgrade plans
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    let whereClause = '';
    const params: string[] = [];
    
    if (status) {
      whereClause = 'WHERE status = $1';
      params.push(status);
    }

    const result = await query(`
      SELECT 
        u.*,
        ARRAY(
          SELECT json_build_object('id', n.id, 'name', n.name, 'role', n.role)
          FROM skynet.nodes n
          WHERE n.id = ANY(u.node_ids)
        ) as node_details
      FROM skynet.upgrade_plans u
      ${whereClause}
      ORDER BY u.created_at DESC
    `, params);

    return NextResponse.json({
      plans: result.rows,
      total: result.rowCount,
    });
  } catch (error) {
    console.error('Error fetching upgrade plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch upgrade plans' },
      { status: 500 }
    );
  }
}

// POST /api/upgrades - Create upgrade plan (protected)
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json();
    const {
      name,
      targetVersion,
      strategy,
      nodeIds,
      scheduledAt,
      notes,
    } = body;

    if (!name || !targetVersion || !strategy || !nodeIds) {
      return NextResponse.json(
        { error: 'Missing required fields: name, targetVersion, strategy, nodeIds' },
        { status: 400 }
      );
    }

    const validStrategies = ['rolling', 'canary', 'blue-green'];
    if (!validStrategies.includes(strategy)) {
      return NextResponse.json(
        { error: `Invalid strategy. Must be one of: ${validStrategies.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate nodeIds
    const nodeCheck = await query(
      'SELECT id FROM skynet.nodes WHERE id = ANY($1)',
      [nodeIds]
    );
    
    if (nodeCheck.rowCount !== nodeIds.length) {
      return NextResponse.json(
        { error: 'Some node IDs are invalid' },
        { status: 400 }
      );
    }

    const result = await query(`
      INSERT INTO skynet.upgrade_plans 
        (name, target_version, strategy, node_ids, scheduled_at, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, targetVersion, strategy, nodeIds, scheduledAt || null, notes || null]);

    return NextResponse.json({
      plan: result.rows[0],
      message: 'Upgrade plan created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating upgrade plan:', error);
    return NextResponse.json(
      { error: 'Failed to create upgrade plan' },
      { status: 500 }
    );
  }
}

// PATCH /api/upgrades - Update upgrade plan status (protected)
export async function PATCH(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json();
    const { id, status, startedAt, completedAt, notes } = body;

    if (!id || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: id, status' },
        { status: 400 }
      );
    }

    const validStatuses = ['planned', 'in_progress', 'completed', 'failed'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    let updateFields = ['status = $2'];
    let params: (string | null)[] = [id, status];

    if (startedAt !== undefined) {
      params.push(startedAt);
      updateFields.push(`started_at = $${params.length}`);
    }

    if (completedAt !== undefined) {
      params.push(completedAt);
      updateFields.push(`completed_at = $${params.length}`);
    }

    if (notes !== undefined) {
      params.push(notes);
      updateFields.push(`notes = COALESCE(notes, '') || E'\n\n' || $${params.length}`);
    }

    const result = await query(
      `UPDATE skynet.upgrade_plans SET ${updateFields.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Upgrade plan not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      plan: result.rows[0],
      message: 'Upgrade plan updated successfully',
    });
  } catch (error) {
    console.error('Error updating upgrade plan:', error);
    return NextResponse.json(
      { error: 'Failed to update upgrade plan' },
      { status: 500 }
    );
  }
}
