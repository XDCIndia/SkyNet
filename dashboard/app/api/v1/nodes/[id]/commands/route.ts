import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, badRequestResponse, notFoundResponse } from '@/lib/auth';

const VALID_COMMANDS = ['restart', 'update', 'add_peers', 'remove_peers', 'run_diagnostic'];

/**
 * GET /api/v1/nodes/[id]/commands
 * Check if there are pending commands for this node
 * Node picks up commands on next heartbeat
 * Auth: Bearer API key
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }

    const { id } = await params;

    // Verify node ownership (if using node-specific key)
    if (auth.nodeId && auth.nodeId !== id) {
      return NextResponse.json(
        { error: 'API key does not have access to this node', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Get pending commands
    const result = await query(
      `SELECT id, command, params, status, created_at
       FROM skynet.command_queue
       WHERE node_id = $1 AND status = 'pending'
       ORDER BY created_at ASC`,
      [id]
    );

    return NextResponse.json({
      nodeId: id,
      pendingCount: result.rowCount,
      commands: result.rows,
    });
  } catch (error: any) {
    console.error('Error fetching commands:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch commands', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/nodes/[id]/commands
 * Queue a command (from dashboard UI or external tools)
 * Commands: restart, update, add_peers, remove_peers, run_diagnostic
 * Auth: Bearer API key
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }

    const { id } = await params;

    // Verify node exists
    const nodeResult = await query(
      `SELECT id FROM skynet.nodes WHERE id = $1`,
      [id]
    );

    if (nodeResult.rows.length === 0) {
      return notFoundResponse('Node');
    }

    const body = await request.json();
    const { command, params: commandParams } = body;

    // Validation
    if (!command) {
      return badRequestResponse('Missing required field: command');
    }

    if (!VALID_COMMANDS.includes(command)) {
      return badRequestResponse(`Invalid command. Must be one of: ${VALID_COMMANDS.join(', ')}`);
    }

    // Queue the command
    const result = await query(
      `INSERT INTO skynet.command_queue 
       (node_id, command, params, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [id, command, commandParams || {}]
    );

    return NextResponse.json({
      ok: true,
      command: {
        id: result.rows[0].id,
        command: result.rows[0].command,
        params: result.rows[0].params,
        status: result.rows[0].status,
        createdAt: result.rows[0].created_at,
      },
      message: `Command '${command}' queued for node`,
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error queuing command:', error);
    
    return NextResponse.json(
      { error: 'Failed to queue command', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
