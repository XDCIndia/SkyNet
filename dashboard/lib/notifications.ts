/**
 * Notification system for XDC NetOwn
 * Supports: Telegram, Webhook, Email (via nodemailer)
 */

import { Incident } from '@/lib/db';
import nodemailer from 'nodemailer';

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
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  const chat = chatId || process.env.TELEGRAM_CHAT_ID;

  if (!token || !chat) {
    throw new Error('Missing Telegram configuration (botToken/chatId)');
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chat,
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
      'User-Agent': 'XDC-NetOwn-Alert/1.0',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Webhook error: ${error}`);
  }
}

/**
 * Send a notification via Email using nodemailer
 */
export async function sendEmailAlert(
  email: string,
  subject: string,
  message: string
): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || 'XDC NetOwn <alerts@xdc.network>';

  if (!host || !user || !pass) {
    console.warn(`Email alert skipped (SMTP not configured): ${subject} → ${email}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to: email,
    subject,
    text: message.replace(/<[^>]+>/g, ''), // strip HTML for plain text
    html: message.replace(/\n/g, '<br>'),
  });
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
        case 'telegram': {
          const token = channel.botToken || process.env.TELEGRAM_BOT_TOKEN || '';
          const chat = channel.chatId || process.env.TELEGRAM_CHAT_ID || '';
          if (!token || !chat) {
            throw new Error('Missing Telegram configuration');
          }
          await sendTelegramAlert(token, chat, message);
          results.push({ channel: 'telegram', success: true });
          break;
        }

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

        case 'email': {
          const emailAddr = channel.email || process.env.ALERT_EMAIL;
          if (!emailAddr) {
            throw new Error('Missing email address');
          }
          await sendEmailAlert(
            emailAddr,
            `XDC NetOwn Alert: ${incident.title}`,
            message
          );
          results.push({ channel: 'email', success: true });
          break;
        }

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
