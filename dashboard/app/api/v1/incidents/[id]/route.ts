import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://gateway:***@localhost:5433/xdc_gateway',
});

// PATCH /api/v1/incidents/[id] — update incident status (protected)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth.valid) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const incidentId = parseInt(params.id);
    if (isNaN(incidentId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid incident ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { status, resolution_notes } = body;

    // Validate status
    const validStatuses = ['open', 'active', 'resolved', 'closed', 'escalated'];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    // Update incident
    const result = await pool.query(
      `UPDATE skynet.incidents 
       SET status = $1,
           resolved_at = CASE WHEN $1 IN ('resolved', 'closed') THEN NOW() ELSE resolved_at END,
           resolution_notes = COALESCE($2, resolution_notes)
       WHERE id = $3
       RETURNING *`,
      [status, resolution_notes, incidentId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Incident not found' },
        { status: 404 }
      );
    }

    console.log(`Incident ${incidentId} status updated to: ${status}`);

    return NextResponse.json({
      success: true,
      incident: result.rows[0],
    });
  } catch (error: any) {
    console.error('Error updating incident:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/incidents/[id] — delete incident (protected, admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth.valid) {
    return unauthorizedResponse(auth.error);
  }

  // Check if user has admin or wildcard permissions
  const { hasPermission, forbiddenResponse } = await import('@/lib/auth');
  if (!hasPermission(auth, 'admin') && !hasPermission(auth, '*')) {
    return forbiddenResponse('Admin permissions required to delete incidents');
  }

  try {
    const incidentId = parseInt(params.id);
    if (isNaN(incidentId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid incident ID' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      'DELETE FROM skynet.incidents WHERE id = $1 RETURNING *',
      [incidentId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Incident not found' },
        { status: 404 }
      );
    }

    console.log(`Incident ${incidentId} deleted`);

    return NextResponse.json({
      success: true,
      message: 'Incident deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting incident:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
