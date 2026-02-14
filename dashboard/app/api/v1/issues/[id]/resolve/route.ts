import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
import { withErrorHandling } from '@/lib/errors';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

async function postHandler(request: NextRequest, { params }: { params: { id: string } }) {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth.valid) {
    return unauthorizedResponse(auth.error);
  }

  // Validate issue ID
  const validationResult = ParamsSchema.safeParse({ id: params.id });
  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid issue ID' },
      { status: 400 }
    );
  }

  const { id } = validationResult.data;

  // Check if issue exists
  const issueResult = await queryAll(
    `SELECT id, status, title, node_name FROM skynet.issues WHERE id = $1`,
    [id]
  );

  if (issueResult.length === 0) {
    return NextResponse.json(
      { error: 'Issue not found' },
      { status: 404 }
    );
  }

  const issue = issueResult[0];

  if (issue.status === 'resolved') {
    return NextResponse.json(
      { error: 'Issue is already resolved' },
      { status: 409 }
    );
  }

  // Mark issue as resolved
  const updateResult = await queryAll(
    `UPDATE skynet.issues 
     SET status = 'resolved', 
         resolved_at = NOW(),
         last_seen = NOW()
     WHERE id = $1
     RETURNING id, status, resolved_at, last_seen`,
    [id]
  );

  logger.info(`Issue resolved: ${id} - ${issue.title} (${issue.node_name})`);

  return NextResponse.json({
    success: true,
    data: {
      id: updateResult[0].id,
      status: updateResult[0].status,
      resolvedAt: updateResult[0].resolved_at,
      lastSeen: updateResult[0].last_seen,
    },
  });
}

export const POST = withErrorHandling(postHandler);
