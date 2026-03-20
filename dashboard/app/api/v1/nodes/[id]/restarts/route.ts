import { NextRequest, NextResponse } from 'next/server';
import { queryWithResilience, queryAll, queryOne } from '@/lib/db';

/**
 * GET /api/v1/nodes/[id]/restarts
 * Returns the last 20 restart events for a node.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const nodeId = params.id;

  try {
    const rows = await queryAll(
      `SELECT
         id,
         node_id,
         restarted_at,
         reason,
         restart_type,
         result,
         blocks_before,
         blocks_after,
         client_type
       FROM skynet.restart_history
       WHERE node_id = $1
       ORDER BY restarted_at DESC
       LIMIT 20`,
      [nodeId]
    );

    // Also fetch auto_heal_enabled setting for the node
    const nodeRow = await queryOne(
      `SELECT auto_heal_enabled, restart_count, last_restart_at
       FROM skynet.nodes WHERE id = $1`,
      [nodeId]
    );

    return NextResponse.json({
      success: true,
      restarts: rows,
      autoHealEnabled: nodeRow?.auto_heal_enabled ?? true,
      restartCount: nodeRow?.restart_count ?? 0,
      lastRestartAt: nodeRow?.last_restart_at ?? null,
    });
  } catch (err) {
    console.error('[restarts GET] error:', err);
    return NextResponse.json({ success: false, error: 'Failed to fetch restart history' }, { status: 500 });
  }
}

/**
 * POST /api/v1/nodes/[id]/restarts
 * Records a new restart event. Called by SkyOne agent after auto-heal.
 *
 * Body: { reason, restart_type, blocks_before, client_type }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const nodeId = params.id;

  try {
    const body = await req.json();
    const {
      reason = 'unknown',
      restart_type = 'soft',
      blocks_before = null,
      client_type = null,
    } = body;

    // Insert restart record
    const inserted = await queryOne(
      `INSERT INTO skynet.restart_history
         (node_id, reason, restart_type, result, blocks_before, client_type)
       VALUES ($1, $2, $3, 'pending', $4, $5)
       RETURNING id, restarted_at`,
      [nodeId, reason, restart_type, blocks_before, client_type]
    );

    // Bump restart counter and update last_restart_at on the node
    await queryWithResilience(
      `UPDATE skynet.nodes
       SET restart_count  = COALESCE(restart_count, 0) + 1,
           last_restart_at = NOW()
       WHERE id = $1`,
      [nodeId]
    );

    return NextResponse.json({
      success: true,
      restart: inserted,
    });
  } catch (err) {
    console.error('[restarts POST] error:', err);
    return NextResponse.json({ success: false, error: 'Failed to record restart' }, { status: 500 });
  }
}

/**
 * PATCH /api/v1/nodes/[id]/restarts
 * Update result of a restart (success/failed) once blocks_after is known.
 * Also toggles auto_heal_enabled on the node.
 *
 * Body: { id?, result?, blocks_after?, autoHealEnabled? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const nodeId = params.id;

  try {
    const body = await req.json();
    const { id: restartId, result, blocks_after, autoHealEnabled } = body;

    if (restartId !== undefined && result) {
      await queryWithResilience(
        `UPDATE skynet.restart_history
         SET result = $1, blocks_after = $2
         WHERE id = $3 AND node_id = $4`,
        [result, blocks_after ?? null, restartId, nodeId]
      );
    }

    if (autoHealEnabled !== undefined) {
      await queryWithResilience(
        `UPDATE skynet.nodes SET auto_heal_enabled = $1 WHERE id = $2`,
        [autoHealEnabled, nodeId]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[restarts PATCH] error:', err);
    return NextResponse.json({ success: false, error: 'Failed to update restart' }, { status: 500 });
  }
}
