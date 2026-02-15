/**
 * Telegram Bot Alert Service for XDC SkyNet
 * 
 * Provides Telegram notification delivery for the alert system.
 * Configure via environment variables:
 *   TELEGRAM_BOT_TOKEN - Bot token from @BotFather
 *   TELEGRAM_CHAT_ID   - Chat/group/channel ID for alerts
 * 
 * Usage:
 *   import { TelegramBot } from '@/lib/telegram';
 *   const bot = new TelegramBot();
 *   await bot.sendAlert({ severity: 'critical', title: '...', ... });
 * 
 * Closes #43
 */

import { logger } from '@/lib/logger';

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface AlertPayload {
  severity: 'critical' | 'warning' | 'info';
  type: string;
  title: string;
  description?: string;
  nodeName?: string;
  nodeId?: string;
  metrics?: {
    blockHeight?: number;
    peerCount?: number;
    cpuPercent?: number;
    diskPercent?: number;
    fleetMaxHeight?: number;
  };
  dashboardUrl?: string;
}

const SEVERITY_EMOJI: Record<string, string> = {
  critical: '🔴',
  warning: '🟡',
  info: '🔵',
};

const TYPE_LABELS: Record<string, string> = {
  sync_stall: 'Sync Stall',
  peer_drop: 'Peer Drop',
  disk_pressure: 'Disk Pressure',
  block_drift: 'Block Drift',
  node_down: 'Node Down',
  heartbeat_gap: 'Heartbeat Gap',
};

/**
 * Telegram Bot client for sending alert notifications.
 * Reads TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID from environment.
 */
export class TelegramBot {
  private config: TelegramConfig;

  constructor(config?: Partial<TelegramConfig>) {
    this.config = {
      botToken: config?.botToken || process.env.TELEGRAM_BOT_TOKEN || '',
      chatId: config?.chatId || process.env.TELEGRAM_CHAT_ID || '',
    };
  }

  /** Check if Telegram is configured */
  isConfigured(): boolean {
    return !!(this.config.botToken && this.config.chatId);
  }

  /** Send a raw text message */
  async sendMessage(text: string, parseMode: 'HTML' | 'Markdown' = 'HTML'): Promise<boolean> {
    if (!this.isConfigured()) {
      logger.warn('Telegram not configured — skipping message');
      return false;
    }

    try {
      const res = await fetch(
        `https://api.telegram.org/bot${this.config.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: this.config.chatId,
            text,
            parse_mode: parseMode,
            disable_web_page_preview: true,
          }),
          signal: AbortSignal.timeout(10_000),
        }
      );

      if (!res.ok) {
        const body = await res.text();
        logger.error(`Telegram API error: ${res.status} ${body}`);
        return false;
      }

      return true;
    } catch (err) {
      logger.error(`Telegram send failed: ${err}`);
      return false;
    }
  }

  /** Send a formatted alert notification */
  async sendAlert(alert: AlertPayload): Promise<boolean> {
    const message = formatAlertMessage(alert);
    return this.sendMessage(message);
  }

  /** Send a resolution notification */
  async sendResolution(alert: AlertPayload, details?: string): Promise<boolean> {
    let msg = `✅ <b>RESOLVED: ${TYPE_LABELS[alert.type] || alert.type}</b>\n\n`;
    msg += `<b>Node:</b> ${alert.nodeName || alert.nodeId || 'unknown'}\n`;
    if (details) msg += `\n${details}\n`;
    msg += `\n<em>Auto-resolved at ${new Date().toLocaleString()}</em>`;
    return this.sendMessage(msg);
  }
}

/** Format an alert payload into an HTML message */
function formatAlertMessage(alert: AlertPayload): string {
  const emoji = SEVERITY_EMOJI[alert.severity] || '⚪';
  const label = TYPE_LABELS[alert.type] || alert.type;

  let msg = `${emoji} <b>${alert.severity.toUpperCase()}: ${label}</b>\n\n`;
  msg += `<b>Node:</b> ${alert.nodeName || alert.nodeId || 'unknown'}\n`;

  if (alert.metrics?.blockHeight !== undefined) {
    msg += `<b>Block:</b> ${alert.metrics.blockHeight.toLocaleString()}\n`;
  }
  if (alert.metrics?.fleetMaxHeight !== undefined && alert.metrics?.blockHeight !== undefined) {
    const drift = alert.metrics.fleetMaxHeight - alert.metrics.blockHeight;
    if (drift > 0) {
      msg += `<b>Fleet Max:</b> ${alert.metrics.fleetMaxHeight.toLocaleString()} (${drift} behind)\n`;
    }
  }
  if (alert.metrics?.peerCount !== undefined) {
    msg += `<b>Peers:</b> ${alert.metrics.peerCount}\n`;
  }
  if (alert.metrics?.diskPercent !== undefined) {
    msg += `<b>Disk:</b> ${alert.metrics.diskPercent}%\n`;
  }
  if (alert.description) {
    msg += `\n${alert.description}\n`;
  }

  const dashUrl = alert.dashboardUrl || process.env.DASHBOARD_URL || 'https://net.xdc.network';
  if (alert.nodeId) {
    msg += `\n<a href="${dashUrl}/nodes/${alert.nodeId}">View Dashboard</a>`;
  }

  return msg;
}

/** Singleton default bot instance */
let _defaultBot: TelegramBot | null = null;

export function getDefaultTelegramBot(): TelegramBot {
  if (!_defaultBot) {
    _defaultBot = new TelegramBot();
  }
  return _defaultBot;
}
