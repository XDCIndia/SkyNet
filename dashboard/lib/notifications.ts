/**
 * Notification system for XDC NetOwn
 * Supports: Telegram, Webhook, Email (placeholder)
 */

import { Incident } from '@/lib/db';

export interface AlertChannel {
  type: 'telegram' | 'webhook' | 'email';
  botToken?: string;
  chatId?: string;
  url?: string;
  email?: string;
}

/**
 * Send a notification via Telegram Bot API
 */
export async function sendTelegramAlert(
  botToken: string, 
  chatId: string, 
  message: string
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }
}

/**
 * Send a notification via Webhook
 */
export async function sendWebhookAlert(
  url: string, 
  payload: object
): Promise<void> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'User-Agent': 'XDC-NetOwn-Alert/1.0'
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Webhook error: ${error}`);
  }
}

/**
 * Send a notification via Email (placeholder)
 * In production, integrate with SendGrid, AWS SES, etc.
 */
export async function sendEmailAlert(
  email: string,
  subject: string,
  message: string
): Promise<void> {
  // Placeholder - would integrate with email service
  console.log(`Email notification would be sent to ${email}: ${subject}`);
  // throw new Error('Email notifications not yet implemented');
}

/**
 * Send alert to multiple channels
 */
export async function sendAlert(
  incident: Incident,
  channels: AlertChannel[]
): Promise<{ channel: string; success: boolean; error?: string }[]> {
  const message = formatAlertMessage(incident);
  const results: { channel: string; success: boolean; error?: string }[] = [];

  for (const channel of channels) {
    try {
      switch (channel.type) {
        case 'telegram':
          if (!channel.botToken || !channel.chatId) {
            throw new Error('Missing Telegram configuration');
          }
          await sendTelegramAlert(channel.botToken, channel.chatId, message);
          results.push({ channel: 'telegram', success: true });
          break;

        case 'webhook':
          if (!channel.url) {
            throw new Error('Missing webhook URL');
          }
          await sendWebhookAlert(channel.url, {
            incident,
            message,
            timestamp: new Date().toISOString(),
          });
          results.push({ channel: 'webhook', success: true });
          break;

        case 'email':
          if (!channel.email) {
            throw new Error('Missing email address');
          }
          await sendEmailAlert(
            channel.email,
            `XDC NetOwn Alert: ${incident.title}`,
            message
          );
          results.push({ channel: 'email', success: true });
          break;

        default:
          throw new Error(`Unknown channel type: ${channel.type}`);
      }
    } catch (err: any) {
      results.push({ channel: channel.type, success: false, error: err.message });
    }
  }

  return results;
}

/**
 * Format incident as alert message
 */
function formatAlertMessage(incident: Incident): string {
  const severityEmoji = {
    critical: '🚨',
    warning: '⚠️',
    info: 'ℹ️',
  };

  return `
${severityEmoji[incident.severity]} <b>XDC NetOwn Alert</b>

<b>Type:</b> ${incident.type}
<b>Severity:</b> ${incident.severity.toUpperCase()}
<b>Node:</b> ${incident.node_id}
<b>Title:</b> ${incident.title}

${incident.description || ''}

Detected: ${new Date(incident.detected_at).toLocaleString()}
  `.trim();
}

/**
 * Check if alert should be triggered based on cooldown
 */
export function shouldTriggerAlert(
  lastTriggeredAt: Date | null,
  cooldownMinutes: number
): boolean {
  if (!lastTriggeredAt) return true;
  
  const cooldownMs = cooldownMinutes * 60 * 1000;
  const timeSinceLastTrigger = Date.now() - new Date(lastTriggeredAt).getTime();
  
  return timeSinceLastTrigger >= cooldownMs;
}
