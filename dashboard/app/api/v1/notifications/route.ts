import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, badRequestResponse, hasPermission } from '@/lib/auth';

/**
 * POST /api/v1/notifications
 * Alert/notification receiver
 * Called by notify.sh from xdc-node-setup
 * Auth: Bearer API key
 * Creates an incident in the DB
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }

    // Check permission
    if (!hasPermission(auth, 'notifications')) {
      return NextResponse.json(
        { error: 'Insufficient permissions for notifications', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      nodeId,
      level,
      title,
      message,
      type,
      metadata,
    } = body;

    // Validation
    if (!level || !title) {
      return badRequestResponse('Missing required fields: level, title');
    }

    const validLevels = ['critical', 'warning', 'info'];
    if (!validLevels.includes(level)) {
      return badRequestResponse(`Invalid level. Must be one of: ${validLevels.join(', ')}`);
    }

    // Use auth nodeId if not provided in body
    const targetNodeId = nodeId || auth.nodeId;

    // Verify node ownership (if using node-specific key)
    if (auth.nodeId && targetNodeId && auth.nodeId !== targetNodeId) {
      return NextResponse.json(
        { error: 'API key does not have access to this node', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Map level to severity
    const severity = level; // Already validated

    // Map type to incident type
    const incidentType = type || 'unknown';

    // Create incident
    const result = await query(
      `INSERT INTO skynet.incidents 
       (node_id, type, severity, title, description, status, auto_detected)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        targetNodeId || null,
        incidentType,
        severity,
        title,
        message || null,
        'active',
        true, // auto-detected from node
      ]
    );

    // Log the notification with metadata
    console.log('Notification received:', {
      incidentId: result.rows[0].id,
      nodeId: targetNodeId,
      level,
      title,
      type,
      metadata,
    });

    return NextResponse.json({
      ok: true,
      incidentId: result.rows[0].id,
      message: 'Notification recorded',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error processing notification:', error);
    
    return NextResponse.json(
      { error: 'Failed to process notification', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
