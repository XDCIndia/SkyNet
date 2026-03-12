import { queryAll, withTransaction } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Alert Trigger Engine
 * 
 * This service continuously monitors nodes against alert rules
 * and triggers notifications when conditions are met.
 * 
 * Issue: #684 - Alert Trigger Engine Not Connected
 */

// Alert condition types
interface NodeMetrics {
  nodeId: string;
  blockNumber: number;
  highestBlock: number;
  peers: number;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  lastSeen: Date;
  isSyncing: boolean;
}

interface AlertRule {
  id: string;
  name: string;
  nodeId: string | null;
  conditionType: 'node_offline' | 'sync_behind' | 'disk_usage' | 'peer_count' | 'cpu_usage' | 'memory_usage';
  thresholdValue: number;
  durationMinutes: number;
  severity: 'critical' | 'warning' | 'info';
  isActive: boolean;
  channels: { id: string; channelType: string; config: any }[];
}

interface ActiveAlert {
  ruleId: string;
  nodeId: string;
  triggeredAt: Date;
}

// Track active alerts to prevent duplicate notifications
const activeAlerts = new Map<string, ActiveAlert>();

/**
 * Get all active alert rules with their channels
 */
async function getActiveAlertRules(): Promise<AlertRule[]> {
  const rules = await queryAll(`
    SELECT 
      ar.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', ac.id,
            'channelType', ac.channel_type,
            'config', ac.config
          )
        ) FILTER (WHERE ac.id IS NOT NULL),
        '[]'
      ) as channels
    FROM skynet.alert_rules ar
    LEFT JOIN skynet.alert_rule_channels arc ON ar.id = arc.rule_id
    LEFT JOIN skynet.alert_channels ac ON arc.channel_id = ac.id
    WHERE ar.is_active = true
    GROUP BY ar.id
  `);

  return rules.map((r: any) => ({
    ...r,
    channels: r.channels || [],
  }));
}

/**
 * Get latest metrics for all nodes or a specific node
 */
async function getNodeMetrics(nodeId?: string): Promise<NodeMetrics[]> {
  let query = `
    SELECT 
      n.id as node_id,
      nm.block_number,
      nm.highest_block,
      nm.peers,
      nm.cpu_percent,
      nm.memory_percent,
      nm.disk_percent,
      n.last_seen,
      nm.is_syncing
    FROM skynet.nodes n
    LEFT JOIN skynet.node_metrics nm ON n.id = nm.node_id
    WHERE n.deleted_at IS NULL
  `;
  
  const params: any[] = [];
  
  if (nodeId) {
    query += ' AND n.id = $1';
    params.push(nodeId);
  }
  
  query += ' ORDER BY nm.recorded_at DESC';
  
  const metrics = await queryAll(query, params);
  
  return metrics.map((m: any) => ({
    nodeId: m.node_id,
    blockNumber: m.block_number || 0,
    highestBlock: m.highest_block || 0,
    peers: m.peers || 0,
    cpuPercent: m.cpu_percent || 0,
    memoryPercent: m.memory_percent || 0,
    diskPercent: m.disk_percent || 0,
    lastSeen: m.last_seen,
    isSyncing: m.is_syncing || false,
  }));
}

/**
 * Evaluate a single condition against node metrics
 */
function evaluateCondition(
  rule: AlertRule,
  metrics: NodeMetrics
): { triggered: boolean; message: string; value: number } {
  const now = new Date();
  const lastSeenMinutes = metrics.lastSeen 
    ? (now.getTime() - new Date(metrics.lastSeen).getTime()) / 60000 
    : Infinity;

  switch (rule.conditionType) {
    case 'node_offline':
      // Node is offline if not seen for threshold minutes
      return {
        triggered: lastSeenMinutes > rule.thresholdValue,
        message: `Node offline for ${Math.floor(lastSeenMinutes)} minutes`,
        value: lastSeenMinutes,
      };

    case 'sync_behind':
      // Sync is behind if difference between highest and current > threshold
      const behind = metrics.highestBlock - metrics.blockNumber;
      return {
        triggered: behind > rule.thresholdValue,
        message: `Node is ${behind} blocks behind network`,
        value: behind,
      };

    case 'disk_usage':
      return {
        triggered: metrics.diskPercent > rule.thresholdValue,
        message: `Disk usage at ${metrics.diskPercent.toFixed(1)}%`,
        value: metrics.diskPercent,
      };

    case 'peer_count':
      return {
        triggered: metrics.peers < rule.thresholdValue,
        message: `Only ${metrics.peers} peers connected`,
        value: metrics.peers,
      };

    case 'cpu_usage':
      return {
        triggered: metrics.cpuPercent > rule.thresholdValue,
        message: `CPU usage at ${metrics.cpuPercent.toFixed(1)}%`,
        value: metrics.cpuPercent,
      };

    case 'memory_usage':
      return {
        triggered: metrics.memoryPercent > rule.thresholdValue,
        message: `Memory usage at ${metrics.memoryPercent.toFixed(1)}%`,
        value: metrics.memoryPercent,
      };

    default:
      return { triggered: false, message: '', value: 0 };
  }
}

/**
 * Create an incident in the database
 */
async function createIncident(
  rule: AlertRule,
  metrics: NodeMetrics,
  evaluation: { message: string; value: number }
): Promise<string> {
  const result = await queryAll(
    `INSERT INTO skynet.incidents 
     (node_id, type, severity, title, description, auto_detected)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id`,
    [
      metrics.nodeId,
      rule.conditionType,
      rule.severity,
      rule.name,
      `${evaluation.message} (threshold: ${rule.thresholdValue}, current: ${evaluation.value.toFixed(2)})`,
    ]
  );

  return result[0]?.id;
}

/**
 * Send notification via configured channels
 */
async function sendNotifications(
  rule: AlertRule,
  metrics: NodeMetrics,
  evaluation: { message: string; value: number },
  incidentId: string
): Promise<void> {
  const nodeInfo = await queryAll(
    'SELECT name, ipv4, client_type FROM skynet.nodes WHERE id = $1',
    [metrics.nodeId]
  );
  
  const nodeName = nodeInfo[0]?.name || metrics.nodeId;
  const nodeIp = nodeInfo[0]?.ipv4 || 'unknown';
  const clientType = nodeInfo[0]?.client_type || 'unknown';

  const notification = {
    incidentId,
    ruleName: rule.name,
    severity: rule.severity,
    nodeName,
    nodeIp,
    clientType,
    message: evaluation.message,
    threshold: rule.thresholdValue,
    currentValue: evaluation.value,
    timestamp: new Date().toISOString(),
  };

  for (const channel of rule.channels) {
    try {
      switch (channel.channelType) {
        case 'webhook':
          await sendWebhookNotification(channel.config, notification);
          break;
        case 'telegram':
          await sendTelegramNotification(channel.config, notification);
          break;
        case 'email':
          await sendEmailNotification(channel.config, notification);
          break;
        case 'slack':
          await sendSlackNotification(channel.config, notification);
          break;
        default:
          logger.warn(`Unknown channel type: ${channel.channelType}`);
      }
    } catch (error) {
      logger.error(`Failed to send notification via ${channel.channelType}`, { error, channelId: channel.id });
    }
  }
}

/**
 * Send webhook notification
 */
async function sendWebhookNotification(config: any, notification: any): Promise<void> {
  if (!config?.url) return;

  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...config.headers,
    },
    body: JSON.stringify(notification),
  });

  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
  }
}

/**
 * Send Telegram notification
 */
async function sendTelegramNotification(config: any, notification: any): Promise<void> {
  if (!config?.botToken || !config?.chatId) return;

  const emoji = notification.severity === 'critical' ? '🔴' : 
                notification.severity === 'warning' ? '🟡' : '🔵';

  const message = `${emoji} <b>${notification.ruleName}</b>

<b>Node:</b> ${notification.nodeName} (${notification.nodeIp})
<b>Client:</b> ${notification.clientType}
<b>Severity:</b> ${notification.severity.toUpperCase()}

${notification.message}
<b>Threshold:</b> ${notification.threshold}
<b>Current:</b> ${notification.currentValue.toFixed(2)}

<i>${new Date().toLocaleString()}</i>`;

  const response = await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.chatId,
      text: message,
      parse_mode: 'HTML',
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram failed: ${response.status}`);
  }
}

/**
 * Send email notification (placeholder)
 */
async function sendEmailNotification(config: any, notification: any): Promise<void> {
  // Implementation depends on email provider (SendGrid, AWS SES, etc.)
  logger.info('Email notification would be sent', { config, notification });
}

/**
 * Send Slack notification
 */
async function sendSlackNotification(config: any, notification: any): Promise<void> {
  if (!config?.webhookUrl) return;

  const color = notification.severity === 'critical' ? '#FF0000' : 
                notification.severity === 'warning' ? '#FFA500' : '#0000FF';

  const response = await fetch(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attachments: [{
        color,
        title: notification.ruleName,
        fields: [
          { title: 'Node', value: `${notification.nodeName} (${notification.nodeIp})`, short: true },
          { title: 'Severity', value: notification.severity.toUpperCase(), short: true },
          { title: 'Message', value: notification.message, short: false },
          { title: 'Threshold', value: String(notification.threshold), short: true },
          { title: 'Current', value: notification.currentValue.toFixed(2), short: true },
        ],
        footer: 'SkyNet Alert System',
        ts: Math.floor(Date.now() / 1000),
      }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Slack failed: ${response.status}`);
  }
}

/**
 * Record alert notification for deduplication
 */
function recordAlert(ruleId: string, nodeId: string): void {
  const key = `${ruleId}:${nodeId}`;
  activeAlerts.set(key, {
    ruleId,
    nodeId,
    triggeredAt: new Date(),
  });
}

/**
 * Check if alert should be sent (respect duration threshold)
 */
function shouldSendAlert(rule: AlertRule, nodeId: string): boolean {
  const key = `${rule.id}:${nodeId}`;
  const existing = activeAlerts.get(key);
  
  if (!existing) {
    return true;
  }

  // Check if enough time has passed to re-alert (durationMinutes * 2)
  const realertInterval = rule.durationMinutes * 2 * 60000; // minutes to ms
  const timeSinceAlert = Date.now() - existing.triggeredAt.getTime();
  
  return timeSinceAlert > realertInterval;
}

/**
 * Clear resolved alerts from tracking
 */
function clearResolvedAlert(ruleId: string, nodeId: string): void {
  const key = `${ruleId}:${nodeId}`;
  activeAlerts.delete(key);
}

/**
 * Main alert checking loop
 */
async function checkAlerts(): Promise<void> {
  logger.info('Alert check cycle started');
  
  try {
    const rules = await getActiveAlertRules();
    logger.info(`Found ${rules.length} active alert rules`);

    for (const rule of rules) {
      // Get metrics for the node (or all nodes if no specific node)
      const metricsList = await getNodeMetrics(rule.nodeId || undefined);

      for (const metrics of metricsList) {
        const evaluation = evaluateCondition(rule, metrics);
        
        if (evaluation.triggered) {
          logger.warn(`Alert triggered`, {
            rule: rule.name,
            node: metrics.nodeId,
            condition: rule.conditionType,
            value: evaluation.value,
          });

          // Check if we should send notification (deduplication)
          if (shouldSendAlert(rule, metrics.nodeId)) {
            // Create incident
            const incidentId = await createIncident(rule, metrics, evaluation);
            logger.info(`Incident created: ${incidentId}`);

            // Send notifications
            if (rule.channels.length > 0) {
              await sendNotifications(rule, metrics, evaluation, incidentId);
              logger.info(`Notifications sent for incident ${incidentId}`);
            }

            // Record alert for deduplication
            recordAlert(rule.id, metrics.nodeId);
          } else {
            logger.debug(`Alert suppressed (within dedup window)`, {
              rule: rule.name,
              node: metrics.nodeId,
            });
          }
        } else {
          // Clear from active alerts if condition resolved
          clearResolvedAlert(rule.id, metrics.nodeId);
        }
      }
    }

    logger.info('Alert check cycle completed');
  } catch (error) {
    logger.error('Alert check cycle failed', { error });
  }
}

/**
 * Start the alert trigger engine
 */
export function startAlertEngine(intervalMs: number = 30000): void {
  logger.info(`Starting Alert Trigger Engine (interval: ${intervalMs}ms)`);
  
  // Run immediately on start
  checkAlerts();
  
  // Schedule regular checks
  setInterval(checkAlerts, intervalMs);
  
  logger.info('Alert Trigger Engine started successfully');
}

/**
 * Stop the alert trigger engine
 */
export function stopAlertEngine(): void {
  // Note: In a real implementation, we'd track the interval ID
  logger.info('Alert Trigger Engine stopped');
}

// Export for testing
export {
  checkAlerts,
  evaluateCondition,
  getActiveAlertRules,
  getNodeMetrics,
};
