/**
 * Alerting module for multi-channel notifications
 * Supports Telegram, Email (nodemailer), and Webhook
 */

import nodemailer from 'nodemailer';
import { queryAll, queryOne } from '@/lib/db';

export interface AlertPayload {
  ruleId?: string;
  nodeId?: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

interface TelegramConfig {
  botToken: string;
  chatId: string;
}

interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
  fromAddress: string;
  toAddresses: string[];
  useTls?: boolean;
}

interface WebhookConfig {
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  secret?: string;
}

type ChannelConfig = TelegramConfig | EmailConfig | WebhookConfig;

interface AlertChannel {
  id: string;
  name: string;
  channelType: 'telegram' | 'email' | 'webhook';
  config: ChannelConfig;
}

/**
 * Send alert through all configured channels for a rule
 */
export async function sendAlert(alert: AlertPayload): Promise<void> {
  // Get channels for this rule
  const channels = await getChannelsForRule(alert.ruleId);
  
  if (channels.length === 0) {
    console.log('No channels configured for rule:', alert.ruleId);
    return;
  }

  // Send to each channel in parallel
  const results = await Promise.allSettled(
    channels.map(channel => sendToChannel(channel, alert))
  );

  // Log results
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Failed to send alert to channel ${channels[index].name}:`, result.reason);
    }
  });
}

/**
 * Get all active channels for a given rule
 */
async function getChannelsForRule(ruleId?: string): Promise<AlertChannel[]> {
  if (!ruleId) {
    // Return all active channels if no rule specified
    const channels = await queryAll(`
      SELECT id, name, channel_type as "channelType", config
      FROM netown.alert_channels
      WHERE is_active = true
    `);
    return channels;
  }

  const channels = await queryAll(`
    SELECT ac.id, ac.name, ac.channel_type as "channelType", ac.config
    FROM netown.alert_channels ac
    JOIN netown.alert_rule_channels arc ON ac.id = arc.channel_id
    WHERE arc.rule_id = $1 AND ac.is_active = true
  `, [ruleId]);

  return channels;
}

/**
 * Send alert to a specific channel
 */
async function sendToChannel(channel: AlertChannel, alert: AlertPayload): Promise<void> {
  switch (channel.channelType) {
    case 'telegram':
      await sendTelegramAlert(channel.config as TelegramConfig, alert);
      break;
    case 'email':
      await sendEmailAlert(channel.config as EmailConfig, alert);
      break;
    case 'webhook':
      await sendWebhookAlert(channel.config as WebhookConfig, alert);
      break;
    default:
      throw new Error(`Unknown channel type: ${channel.channelType}`);
  }
}

/**
 * Send alert via Telegram Bot API
 */
async function sendTelegramAlert(config: TelegramConfig, alert: AlertPayload): Promise<void> {
  const emojiMap = {
    critical: '🚨',
    warning: '⚠️',
    info: 'ℹ️',
  };

  const message = `${emojiMap[alert.severity]} *${alert.title}*

${alert.message}

${alert.metadata ? '```json\n' + JSON.stringify(alert.metadata, null, 2) + '\n```' : ''}

_Sent by XDC SkyNet_`;

  const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.chatId,
      text: message,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }
}

/**
 * Send alert via Email using Nodemailer
 */
async function sendEmailAlert(config: EmailConfig, alert: AlertPayload): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.useTls,
    auth: {
      user: config.username,
      pass: config.password,
    },
  });

  const severityColors = {
    critical: '#EF4444',
    warning: '#F59E0B',
    info: '#1E90FF',
  };

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: ${severityColors[alert.severity]}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0;">${alert.title}</h2>
        <span style="text-transform: uppercase; font-size: 12px; opacity: 0.9;">${alert.severity} Alert</span>
      </div>
      <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
        <p style="white-space: pre-wrap;">${alert.message}</p>
        ${alert.metadata ? `
        <div style="margin-top: 20px; padding: 15px; background: #f3f4f6; border-radius: 6px;">
          <pre style="margin: 0; font-size: 12px; overflow-x: auto;">${JSON.stringify(alert.metadata, null, 2)}</pre>
        </div>
        ` : ''}
      </div>
      <div style="padding: 15px; text-align: center; color: #6b7280; font-size: 12px;">
        Sent by XDC SkyNet Alerting System
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: config.fromAddress,
    to: config.toAddresses.join(', '),
    subject: `[${alert.severity.toUpperCase()}] ${alert.title}`,
    text: alert.message,
    html: htmlContent,
  });
}

/**
 * Send alert via Webhook (HTTP POST/PUT)
 */
async function sendWebhookAlert(config: WebhookConfig, alert: AlertPayload): Promise<void> {
  const payload = {
    alert: {
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      metadata: alert.metadata,
      timestamp: new Date().toISOString(),
    },
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...config.headers,
  };

  // Add HMAC signature if secret is configured
  if (config.secret) {
    const signature = await createHmacSignature(payload, config.secret);
    headers['X-Signature'] = signature;
  }

  const response = await fetch(config.url, {
    method: config.method || 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status}: ${await response.text()}`);
  }
}

/**
 * Create HMAC signature for webhook verification
 */
async function createHmacSignature(payload: any, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, data);
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Record alert in history
 */
export async function recordAlertHistory(
  alert: AlertPayload,
  channelId?: string
): Promise<void> {
  await queryOne(
    `INSERT INTO netown.alert_history 
     (rule_id, node_id, channel_id, severity, title, message, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      alert.ruleId || null,
      alert.nodeId || null,
      channelId || null,
      alert.severity,
      alert.title,
      alert.message,
      alert.metadata ? JSON.stringify(alert.metadata) : null,
    ]
  );
}

/**
 * Evaluate alert rules and trigger alerts
 * This should be called by a scheduled job
 */
export async function evaluateAlertRules(): Promise<void> {
  const rules = await queryAll(`
    SELECT ar.*, n.name as node_name
    FROM netown.alert_rules ar
    LEFT JOIN netown.nodes n ON ar.node_id = n.id
    WHERE ar.is_active = true
  `);

  for (const rule of rules) {
    try {
      await evaluateRule(rule);
    } catch (err) {
      console.error(`Failed to evaluate rule ${rule.id}:`, err);
    }
  }
}

async function evaluateRule(rule: any): Promise<void> {
  // Get latest metrics for the node(s)
  const metricsQuery = rule.node_id
    ? `SELECT * FROM netown.node_metrics 
       WHERE node_id = $1 
       ORDER BY collected_at DESC LIMIT 1`
    : `SELECT DISTINCT ON (node_id) *
       FROM netown.node_metrics
       ORDER BY node_id, collected_at DESC`;

  const metrics = await queryAll(metricsQuery, rule.node_id ? [rule.node_id] : []);

  for (const m of metrics) {
    let triggered = false;
    let message = '';

    switch (rule.condition_type) {
      case 'node_offline':
        const lastSeen = new Date(m.collected_at);
        const offlineMinutes = (Date.now() - lastSeen.getTime()) / 60000;
        if (offlineMinutes > rule.threshold_value) {
          triggered = true;
          message = `Node ${m.node_id} has been offline for ${Math.round(offlineMinutes)} minutes`;
        }
        break;

      case 'sync_behind':
        if (m.sync_percent < 100) {
          const blocksBehind = Math.round((100 - m.sync_percent) * 1000); // Approximate
          if (blocksBehind > rule.threshold_value) {
            triggered = true;
            message = `Node is ${blocksBehind} blocks behind (sync: ${m.sync_percent.toFixed(2)}%)`;
          }
        }
        break;

      case 'disk_usage':
        if (m.disk_percent > rule.threshold_value) {
          triggered = true;
          message = `Disk usage is at ${m.disk_percent}%`;
        }
        break;

      case 'peer_count':
        if (m.peer_count < rule.threshold_value) {
          triggered = true;
          message = `Peer count dropped to ${m.peer_count} (threshold: ${rule.threshold_value})`;
        }
        break;

      case 'cpu_usage':
        if (m.cpu_percent > rule.threshold_value) {
          triggered = true;
          message = `CPU usage is at ${m.cpu_percent}%`;
        }
        break;

      case 'memory_usage':
        if (m.memory_percent > rule.threshold_value) {
          triggered = true;
          message = `Memory usage is at ${m.memory_percent}%`;
        }
        break;
    }

    if (triggered) {
      const alert: AlertPayload = {
        ruleId: rule.id,
        nodeId: m.node_id,
        severity: rule.severity,
        title: `${rule.name} triggered`,
        message,
        metadata: { rule, metric: m },
      };

      await sendAlert(alert);
      await recordAlertHistory(alert);
    }
  }
}
