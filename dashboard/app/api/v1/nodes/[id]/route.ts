import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth';

// DELETE /api/v1/nodes/[id] - Remove a node (deactivate/delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }

    const { id } = params;

    // Check if node exists
    const nodeResult = await query(
      'SELECT id, name, is_active FROM skynet.nodes WHERE id = $1',
      [id]
    );

    if (nodeResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
    }

    const node = nodeResult.rows[0];

    // Check if node has recent metrics (active in last 5 minutes)
    const metricsResult = await query(
      `SELECT collected_at FROM skynet.node_metrics 
       WHERE node_id = $1 AND collected_at > NOW() - INTERVAL '5 minutes'
       ORDER BY collected_at DESC
       LIMIT 1`,
      [id]
    );

    const isActive = metricsResult.rowCount !== null && metricsResult.rowCount > 0;

    // Soft delete - mark as inactive instead of hard delete
    // This preserves historical data while removing the node from active fleet
    const result = await withTransaction(async (client) => {
      // 1. Deactivate the node
      const updateResult = await client.query(
        `UPDATE skynet.nodes 
         SET is_active = false, 
             updated_at = NOW(),
             tags = array_append(COALESCE(tags, ARRAY[]::text[]), 'deactivated:' || NOW()::text)
         WHERE id = $1 
         RETURNING id, name, is_active, updated_at`,
        [id]
      );

      // 2. Deactivate API keys
      await client.query(
        `UPDATE skynet.api_keys 
         SET is_active = false 
         WHERE node_id = $1`,
        [id]
      );

      // 3. Resolve any active incidents for this node
      await client.query(
        `UPDATE skynet.incidents 
         SET status = 'resolved', 
             resolved_at = NOW() 
         WHERE node_id = $1 AND status = 'active'`,
        [id]
      );

      return updateResult.rows[0];
    });

    return NextResponse.json({
      success: true,
      message: `Node "${result.name}" has been deactivated`,
      node: {
        id: result.id,
        name: result.name,
        isActive: result.is_active,
        wasActiveBeforeRemoval: isActive,
        updatedAt: result.updated_at,
      },
    });
  } catch (error) {
    console.error('Error removing node:', error);
    return NextResponse.json(
      { error: 'Failed to remove node' },
      { status: 500 }
    );
  }
}
