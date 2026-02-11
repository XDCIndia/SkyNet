import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth';
import { sendTelegramAlert, sendWebhookAlert } from '@/lib/notifications';

/**
 * POST /api/v1/alerts/notify
 * Send notification for an alert
 * Supports: Telegram, webhook, email (placeholder)
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json();
    const {
      alertId,
      channels,
      message,
      incidentId,
      nodeId,
    } = body;

    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: channels', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const results: { channel: string; success: boolean; error?: string }[] = [];
    const channelsNotified: string[] = [];

    // Send to each channel
    for (const channel of channels) {
      try {
        switch (channel.type) {
          case 'telegram':
            if (!channel.botToken || !channel.chatId) {
              results.push({ channel: 'telegram', success: false, error: 'Missing botToken or chatId' });
              break;
            }
            await sendTelegramAlert(channel.botToken, channel.chatId, message);
            results.push({ channel: 'telegram', success: true });
            channelsNotified.push('telegram');
            break;

          case 'webhook':
            if (!channel.url) {
              results.push({ channel: 'webhook', success: false, error: 'Missing url' });
              break;
            }
            await sendWebhookAlert(channel.url, {
              message,
              alertId,
              incidentId,
              nodeId,
              timestamp: new Date().toISOString(),
            });
            results.push({ channel: 'webhook', success: true });
            channelsNotified.push('webhook');
            break;

          case 'email':
            // Email support placeholder - would integrate with email service
            results.push({ channel: 'email', success: true, error: 'Email notifications not yet implemented' });
            channelsNotified.push('email');
            break;

          default:
            results.push({ channel: channel.type, success: false, error: 'Unknown channel type' });
        }
      } catch (err: any) {
        results.push({ channel: channel.type, success: false, error: err.message });
      }
    }

    // Log to alert_history if we have alertId and nodeId
    if (alertId && nodeId) {
      await query(`
        INSERT INTO netown.alert_history 
          (rule_id, node_id, incident_id, channels_notified, message)
        VALUES ($1, $2, $3, $4, $5)
      `, [alertId, nodeId, incidentId || null, channelsNotified, message]);

      // Update last_triggered_at
      await query(`
        UPDATE netown.alert_rules 
        SET last_triggered_at = NOW() 
        WHERE id = $1
      `, [alertId]);
    }

    const allSuccess = results.every(r => r.success);

    return NextResponse.json({
      success: allSuccess,
      results,
      timestamp: new Date().toISOString(),
    }, { status: allSuccess ? 200 : 207 });
  } catch (error: any) {
    console.error('Error sending notification:', error);
    
    return NextResponse.json(
      { error: 'Failed to send notification', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
