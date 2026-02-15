import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, hasPermission } from '@/lib/auth';
import { withErrorHandling } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const BulkDeleteSchema = z.object({
  nodeIds: z.array(z.string().uuid()).min(1).max(100),
  confirm: z.boolean().refine(val => val === true, {
    message: 'Must confirm deletion',
  }),
});

/**
 * POST /api/v1/nodes/bulk-delete
 * Delete multiple nodes and all their associated data
 * Auth: Master API key or admin user
 */
async function postHandler(request: NextRequest) {
  // Auth check
  const auth = await authenticateRequest(request);
  if (!auth.valid || !hasPermission(auth, 'admin')) {
    return unauthorizedResponse('Admin access required for bulk delete');
  }

  // Validate body
  let body;
  try {
    body = await request.json();
    BulkDeleteSchema.parse(body);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Invalid request body', details: error.message },
      { status: 400 }
    );
  }

  const { nodeIds } = body;

  logger.info('Bulk delete request', { nodeIds, count: nodeIds.length });

  // Delete in transaction
  const results = await withTransaction(async (client) => {
    const deleted = [];
    const errors = [];

    for (const nodeId of nodeIds) {
      try {
        // Delete related data first (cascading)
        await client.query('DELETE FROM skynet.node_metrics WHERE node_id = $1', [nodeId]);
        await client.query('DELETE FROM skynet.peer_snapshots WHERE node_id = $1', [nodeId]);
        await client.query('DELETE FROM skynet.incidents WHERE node_id = $1', [nodeId]);
        await client.query('DELETE FROM skynet.issues WHERE node_id = $1', [nodeId]);
        await client.query('DELETE FROM skynet.command_queue WHERE node_id = $1', [nodeId]);
        
        // Delete node
        const result = await client.query(
          'DELETE FROM skynet.nodes WHERE id = $1 RETURNING name',
          [nodeId]
        );

        if (result.rows.length > 0) {
          deleted.push({ id: nodeId, name: result.rows[0].name });
        } else {
          errors.push({ id: nodeId, error: 'Node not found' });
        }
      } catch (error: any) {
        logger.error('Failed to delete node', error.message);
        errors.push({ id: nodeId, error: error.message });
      }
    }

    return { deleted, errors };
  });

  logger.info('Bulk delete completed', { 
    deletedCount: results.deleted.length,
    errorCount: results.errors.length 
  });

  return NextResponse.json({
    success: true,
    deleted: results.deleted,
    errors: results.errors,
    summary: {
      total: nodeIds.length,
      deleted: results.deleted.length,
      failed: results.errors.length,
    },
  });
}

export const POST = withErrorHandling(postHandler);
