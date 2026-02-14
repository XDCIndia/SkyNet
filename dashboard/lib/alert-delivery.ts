/**
 * Alert Delivery Module for XDC SkyNet
 * Handles Telegram and Webhook alert delivery with fallback to env vars
 */

import { query } from '@/lib/db';

export interface AlertTarget {
  type: 'telegram' | 'webhook';
  config: {
    // Telegram
    botToken?: string;
    chatId?: string;
    // Webhook
    url?: string;
    secret?: string;
  };
}

export interface Incident {
  id: number;
  node_id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description?: string;
  detected_at: string;
  status: string;
}

export interface NodeInfo {
  id: string;
  name?: string;
  ipv4?: string;
  role?: string;
}

/**
 * Send a Telegram alert message
 */
export async function sendTelegramAlert(
  botToken: string,
  chatId: string,
  message: string
): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Send a webhook alert
 */
export async function sendWebhookAlert(
  url: string,
  payload: unknown,
  secret?: string
): Promise<boolean> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'XDC-SkyNet-Alert/1.0',
    };
    if (secret) headers['X-Webhook-Secret'] = secret;
    
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Format incident as HTML message for Telegram
 */
function formatTelegramMessage(
  incident: Incident,
  node: NodeInfo,
  metrics?: {
    blockHeight?: number;
    peerCount?: number;
    cpuPercent?: number;
    diskPercent?: number;
    fleetMaxHeight?: number;
  }
): string {
  const severityEmoji = {
    critical: '🔴',
    warning: '🟡',
    info: '🔵',
  };

  const typeLabels: Record<string, string> = {
    sync_stall: 'Sync Stall',
    peer_drop: 'Peer Drop',
    disk_pressure: 'Disk Pressure',
    block_drift: 'Block Drift',
    node_down: 'Node Down',
    heartbeat_gap: 'Heartbeat Gap',
  };

  let message = `${severityEmoji[incident.severity]} <b>${incident.severity.toUpperCase()}: ${typeLabels[incident.type] || incident.type}</b>\n\n`;
  message += `<b>Node:</b> ${node.name || node.id}\n`;
  
  if (metrics?.blockHeight !== undefined) {
    const stuckDuration = incident.type === 'sync_stall' ? ' (stuck 5m+)' : '';
    message += `<b>Block:</b> ${metrics.blockHeight.toLocaleString()}${stuckDuration}\n`;
  }
  
  if (metrics?.fleetMaxHeight !== undefined && metrics?.blockHeight !== undefined) {
    const drift = metrics.fleetMaxHeight - metrics.blockHeight;
    if (drift > 0) {
      message += `<b>Fleet Max:</b> ${metrics.fleetMaxHeight.toLocaleString()} (${drift} behind)\n`;
    }
  }
  
  if (metrics?.peerCount !== undefined) {
    message += `<b>Peers:</b> ${metrics.peerCount}`;
    if (metrics.cpuPercent !== undefined) {
      message += ` | <b>CPU:</b> ${metrics.cpuPercent}%`;
    }
    message += '\n';
  }
  
  if (metrics?.diskPercent !== undefined) {
    message += `<b>Disk:</b> ${metrics.diskPercent}% used\n`;
  }

  if (incident.description) {
    message += `\n${incident.description}\n`;
  }

  // Add dashboard link if node id is available
  if (node.id) {
    const dashboardUrl = process.env.DASHBOARD_URL || 'https://net.xdc.network';
    message += `\n<a href="${dashboardUrl}/nodes/${node.id}">View Dashboard</a>`;
  }

  return message;
}

/**
 * Load alert channels from database or fallback to environment variables
 */
async function loadAlertChannels(): Promise<AlertTarget[]> {
  const channels: AlertTarget[] = [];

  try {
    // Try to load from database first
    const result = await query(
      `SELECT channel_type, config FROM skynet.alert_channels WHERE is_active = true`
    );

    for (const row of result.rows) {
      const config = row.config || {};
      
      if (row.channel_type === 'telegram') {
        channels.push({
          type: 'telegram',
          config: {
            botToken: config.botToken || config.bot_token,
            chatId: config.chatId || config.chat_id,
          },
        });
      } else if (row.channel_type === 'webhook') {
        channels.push({
          type: 'webhook',
          config: {
            url: config.url,
            secret: config.secret,
          },
        });
      }
    }
  } catch {
    // Table might not exist or other error, fallback to env vars
  }

  // Fallback to environment variables if no channels loaded
  if (channels.length === 0) {
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    
    if (telegramToken && telegramChatId) {
      channels.push({
        type: 'telegram',
        config: {
          botToken: telegramToken,
          chatId: telegramChatId,
        },
      });
    }

    const webhookUrl = process.env.WEBHOOK_URL;
    if (webhookUrl) {
      channels.push({
        type: 'webhook',
        config: {
          url: webhookUrl,
          secret: process.env.WEBHOOK_SECRET,
        },
      });
    }
  }

  return channels;
}

/**
 * Get node information by ID
 */
async function getNodeInfo(nodeId: string): Promise<NodeInfo | null> {
  try {
    const result = await query(
      `SELECT id, name, ipv4, role FROM skynet.nodes WHERE id = $1`,
      [nodeId]
    );
    
    if (result.rows.length === 0) {
      return { id: nodeId };
    }
    
    return result.rows[0];
  } catch {
    return { id: nodeId };
  }
}

/**
 * Log alert to alert_history table
 */
async function logAlertHistory(
  incidentId: number,
  nodeId: string,
  channelType: string,
  success: boolean,
  message?: string
): Promise<void> {
  try {
    // The table schema uses channels_notified as text[] and message as text
    await query(
      `INSERT INTO skynet.alert_history 
       (incident_id, node_id, channels_notified, message, sent_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [incidentId, nodeId, [channelType], message || null]
    );
  } catch (err) {
    console.error('Failed to log alert history:', err);
  }
}

/**
 * Deliver alert to all configured channels
 * Main entry point for alert delivery
 */
export async function deliverAlert(
  incident: Incident,
  node?: NodeInfo | string,
  metrics?: {
    blockHeight?: number;
    peerCount?: number;
    cpuPercent?: number;
    diskPercent?: number;
    fleetMaxHeight?: number;
  }
): Promise<{ success: boolean; channelsAttempted: number; channelsSucceeded: number }> {
  let nodeInfo: NodeInfo;
  
  if (typeof node === 'string') {
    const info = await getNodeInfo(node);
    nodeInfo = info || { id: node };
  } else {
    nodeInfo = node || { id: incident.node_id };
  }

  const channels = await loadAlertChannels();
  let succeeded = 0;

  if (channels.length === 0) {
    console.warn('No alert channels configured');
    return { success: false, channelsAttempted: 0, channelsSucceeded: 0 };
  }

  for (const channel of channels) {
    let delivered = false;

    try {
      if (channel.type === 'telegram') {
        const token = channel.config.botToken || process.env.TELEGRAM_BOT_TOKEN;
        const chatId = channel.config.chatId || process.env.TELEGRAM_CHAT_ID;
        
        if (token && chatId) {
          const message = formatTelegramMessage(incident, nodeInfo, metrics);
          delivered = await sendTelegramAlert(token, chatId, message);
        }
      } else if (channel.type === 'webhook') {
        const url = channel.config.url || process.env.WEBHOOK_URL;
        
        if (url) {
          const payload = {
            incident: {
              id: incident.id,
              type: incident.type,
              severity: incident.severity,
              title: incident.title,
              description: incident.description,
              status: incident.status,
              detected_at: incident.detected_at,
            },
            node: nodeInfo,
            metrics,
            timestamp: new Date().toISOString(),
          };
          delivered = await sendWebhookAlert(url, payload, channel.config.secret);
        }
      }

      if (delivered) {
        succeeded++;
      }
    } catch (err) {
      console.error(`Failed to deliver alert via ${channel.type}:`, err);
    }

    // Log to alert history
    await logAlertHistory(
      incident.id,
      incident.node_id,
      channel.type,
      delivered,
      delivered ? undefined : 'Delivery failed'
    );
  }

  return {
    success: succeeded > 0,
    channelsAttempted: channels.length,
    channelsSucceeded: succeeded,
  };
}

/**
 * Deliver resolution notification
 */
export async function deliverResolution(
  incident: Incident,
  node?: NodeInfo | string,
  resolutionDetails?: string
): Promise<{ success: boolean; channelsAttempted: number; channelsSucceeded: number }> {
  let nodeInfo: NodeInfo;
  
  if (typeof node === 'string') {
    const info = await getNodeInfo(node);
    nodeInfo = info || { id: node };
  } else {
    nodeInfo = node || { id: incident.node_id };
  }

  const channels = await loadAlertChannels();
  let succeeded = 0;

  for (const channel of channels) {
    let delivered = false;

    try {
      if (channel.type === 'telegram') {
        const token = channel.config.botToken || process.env.TELEGRAM_BOT_TOKEN;
        const chatId = channel.config.chatId || process.env.TELEGRAM_CHAT_ID;
        
        if (token && chatId) {
          const typeLabels: Record<string, string> = {
            sync_stall: 'Sync Stall',
            peer_drop: 'Peer Drop',
            disk_pressure: 'Disk Pressure',
            block_drift: 'Block Drift',
            node_down: 'Node Down',
            heartbeat_gap: 'Heartbeat Gap',
          };

          let message = `✅ <b>RESOLVED: ${typeLabels[incident.type] || incident.type}</b>\n\n`;
          message += `<b>Node:</b> ${nodeInfo.name || nodeInfo.id}\n`;
          message += `<b>Severity:</b> ${incident.severity}\n`;
          if (resolutionDetails) {
            message += `\n${resolutionDetails}\n`;
          }
          message += `\n<em>Incident auto-resolved at ${new Date().toLocaleString()}</em>`;

          delivered = await sendTelegramAlert(token, chatId, message);
        }
      } else if (channel.type === 'webhook') {
        const url = channel.config.url || process.env.WEBHOOK_URL;
        
        if (url) {
          const payload = {
            event: 'incident_resolved',
            incident: {
              id: incident.id,
              type: incident.type,
              severity: incident.severity,
              title: incident.title,
              status: 'resolved',
              resolved_at: new Date().toISOString(),
            },
            node: nodeInfo,
            resolution_details: resolutionDetails,
            timestamp: new Date().toISOString(),
          };
          delivered = await sendWebhookAlert(url, payload, channel.config.secret);
        }
      }

      if (delivered) {
        succeeded++;
      }
    } catch (err) {
      console.error(`Failed to deliver resolution via ${channel.type}:`, err);
    }
  }

  return {
    success: succeeded > 0,
    channelsAttempted: channels.length,
    channelsSucceeded: succeeded,
  };
}
