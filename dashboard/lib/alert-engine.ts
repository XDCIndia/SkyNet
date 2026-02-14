/**
 * Alert Engine for XDC NetOwn
 * Evaluates alert rules against incidents and fires notifications.
 * Also performs fleet-wide node_down detection.
 */

import { query } from '@/lib/db';
import { sendAlert, shouldTriggerAlert, AlertChannel } from '@/lib/notifications';

/**
 * Evaluate alert rules for a newly detected incident and send notifications.
 * Called from the heartbeat endpoint after an incident is created.
 */
export async function evaluateAndNotify(
  incidentId: number,
  nodeId: string,
  incidentType: string,
  severity: string,
  title: string,
  description: string
): Promise<void> {
  try {
    // Find matching active alert rules
    const rulesResult = await query(
      `SELECT id, channels, cooldown_minutes, last_triggered_at
       FROM skynet.alert_rules
       WHERE type = $1 AND is_active = true
       AND (node_id IS NULL OR node_id = $2)`,
      [incidentType, nodeId]
    );

    for (const rule of rulesResult.rows) {
      const channels: AlertChannel[] = rule.channels || [];
      if (channels.length === 0) continue;

      // Check cooldown
      if (!shouldTriggerAlert(rule.last_triggered_at, rule.cooldown_minutes)) {
        continue;
      }

      // Build a pseudo-incident object for sendAlert
      const incident = {
        id: incidentId,
        node_id: nodeId,
        type: incidentType,
        severity: severity as 'critical' | 'warning' | 'info',
        title,
        description,
        detected_at: new Date().toISOString(),
        status: 'active',
      };

      const results = await sendAlert(incident as any, channels);

      const successChannels = results.filter(r => r.success).map(r => r.channel);
      const errors = results.filter(r => !r.success);

      if (errors.length > 0) {
        console.error(`Alert notification errors for rule ${rule.id}:`, errors);
      }

      if (successChannels.length > 0) {
        // Update last_triggered_at
        await query(
          `UPDATE skynet.alert_rules SET last_triggered_at = NOW() WHERE id = $1`,
          [rule.id]
        );

        // Log to alert_history
        await query(
          `INSERT INTO skynet.alert_history (rule_id, node_id, incident_id, channels_notified, message, sent_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [rule.id, nodeId, incidentId, successChannels, title]
        );
      }
    }
  } catch (err) {
    console.error('Alert engine error:', err);
  }
}

/**
 * Fleet-wide check for nodes that haven't sent a heartbeat in 5+ minutes.
 * Called opportunistically from the heartbeat endpoint.
 */
export async function checkFleetNodeDown(): Promise<void> {
  try {
    // Find nodes that haven't reported and aren't already marked offline
    // Status is computed from metrics, not stored in nodes table
    const staleNodes = await query(
      `SELECT n.id, n.name
       FROM skynet.nodes n
       LEFT JOIN skynet.node_metrics m ON m.node_id = n.id
       WHERE n.is_active = true
       GROUP BY n.id, n.name
       HAVING MAX(m.collected_at) < NOW() - INTERVAL '5 minutes'
          OR MAX(m.collected_at) IS NULL`
    );

    for (const node of staleNodes.rows) {
      // Check if there's already an active node_down incident
      const existing = await query(
        `SELECT id FROM skynet.incidents
         WHERE node_id = $1 AND type = 'node_down' AND status = 'active'`,
        [node.id]
      );

      if (existing.rowCount === 0) {
        // Create incident
        const incidentResult = await query(
          `INSERT INTO skynet.incidents (node_id, type, severity, title, description, auto_detected)
           VALUES ($1, 'node_down', 'critical', $2, $3, true)
           RETURNING id`,
          [
            node.id,
            `Node ${node.name || node.id} is down`,
            `No heartbeat received for 5+ minutes`,
          ]
        );

        const incidentId = incidentResult.rows[0].id;

        // Fire notifications
        await evaluateAndNotify(
          incidentId,
          node.id,
          'node_down',
          'critical',
          `Node ${node.name || node.id} is down`,
          `No heartbeat received for 5+ minutes`
        );
      }
    }
  } catch (err) {
    console.error('Fleet node_down check error:', err);
  }
}
