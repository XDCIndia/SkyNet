import { NextRequest, NextResponse } from 'next/server';
import { queryAll, queryOne } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, hasPermission } from '@/lib/auth';
import { withErrorHandling, NotFoundError } from '@/lib/errors';
import { validateBody, AlertNotifySchema } from '@/lib/validation';
import { sendAlertNotification } from '@/lib/notifications';
import { logger } from '@/lib/logger';

/**
 * POST /api/v1/alerts/notify
 * Send notification for an alert
 */
async function postHandler(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth.valid) {
    return unauthorizedResponse(auth.error);
  }

  if (!hasPermission(auth, 'notifications') && !hasPermission(auth, '*')) {
    return NextResponse.json(
      { error: 'Insufficient permissions', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  const body = await validateBody(request, AlertNotifySchema);
  const { alertId, channels } = body;

  // Fetch the alert
  const alert = await queryOne(
    `SELECT i.*, n.name as node_name
     FROM netown.incidents i
     LEFT JOIN netown.nodes n ON i.node_id = n.id
     WHERE i.id = $1`,
    [alertId]
  );

  if (!alert) {
    throw new NotFoundError('Alert');
  }

  // Send notifications to requested channels
  const results: Record<string, { success: boolean; error?: string }> = {};

  for (const channel of channels) {
    try {
      await sendAlertNotification(channel, {
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        nodeName: alert.node_name,
        detectedAt: alert.detected_at,
      });
      results[channel] = { success: true };
    } catch (error) {
      logger.error(`Failed to send ${channel} notification`, error as Error);
      results[channel] = { success: false, error: (error as Error).message };
    }
  }

  return NextResponse.json({
    success: true,
    data: {
      alertId,
      channels: results,
    },
  });
}

export const POST = withErrorHandling(postHandler);
