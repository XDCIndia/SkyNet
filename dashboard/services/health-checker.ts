/**
 * Container Health Checker — Issue #59
 *
 * Runs periodic container health checks via SkyOne agents.
 * Tracks healthy/unhealthy transitions and fires alerts.
 */

import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ContainerHealthStatus = 'healthy' | 'unhealthy' | 'starting' | 'unknown';

export interface ContainerHealth {
  nodeId: string;
  nodeName: string;
  containerName: string;
  status: ContainerHealthStatus;
  lastCheckedAt: Date;
  /** Number of consecutive failed health checks */
  failStreak: number;
  /** Last status before the current one */
  previousStatus: ContainerHealthStatus | null;
  /** True if status changed on this check */
  transitioned: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// SkyOne API helper (calls agent on each fleet node)
// ─────────────────────────name──────────────────────────────────────────────

async function fetchAgentHealth(
  agentUrl: string,
  apiKey: string
): Promise<{
  status: ContainerHealthStatus;
  containerName: string;
  details?: Record<string, unknown>;
} | null> {
  try {
    const res = await fetch(`${agentUrl}/api/health`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return null;

    const data: any = await res.json();
    return {
      status: (data.status ?? 'unknown') as ContainerHealthStatus,
      containerName: String(data.containerName ?? data.container ?? 'xdc-node'),
      details: data,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core health check loop
// ─────────────────────────────────────────────────────────────────────────────

async function checkAllContainers(): Promise<void> {
  let nodes: any[] = [];
  try {
    const result = await query(`
      SELECT id, name, agent_url, agent_key
        FROM skynet.nodes
       WHERE is_active = true
         AND agent_url IS NOT NULL
       ORDER BY name
    `);
    nodes = result.rows;
  } catch (err) {
    logger.error('[HealthChecker] Failed to fetch nodes', { err });
    return;
  }

  for (const node of nodes) {
    let health = await fetchAgentHealth(node.agent_url, node.agent_key ?? '');

    const status: ContainerHealthStatus = health?.status ?? 'unknown';
    const containerName = health?.containerName ?? 'xdc-node';

    // Fetch previous state
    let previousStatus: ContainerHealthStatus | null = null;
    let failStreak = 0;
    try {
      const prev = await query(
        `SELECT health_status, fail_streak
           FROM skynet.container_health
          WHERE node_id = $1
          LIMIT 1`,
        [node.id]
      );
      if (prev.rows.length > 0) {
        previousStatus = prev.rows[0].health_status as ContainerHealthStatus;
        failStreak =
          status === 'unhealthy' || status === 'unknown'
            ? Number(prev.rows[0].fail_streak ?? 0) + 1
            : 0;
      }
    } catch {
      // table may not exist
    }

    const transitioned = previousStatus !== null && previousStatus !== status;

    // Upsert health record
    try {
      await query(
        `INSERT INTO skynet.container_health
           (node_id, container_name, health_status, fail_streak, checked_at, previous_status)
         VALUES ($1, $2, $3, $4, NOW(), $5)
         ON CONFLICT (node_id)
         DO UPDATE SET
           container_name  = EXCLUDED.container_name,
           health_status   = EXCLUDED.health_status,
           fail_streak     = EXCLUDED.fail_streak,
           checked_at      = NOW(),
           previous_status = skynet.container_health.health_status`,
        [node.id, containerName, status, failStreak, previousStatus]
      );
    } catch {
      // table may not exist yet
    }

    // Fire alert if transition to unhealthy or prolonged unhealthy
    if (transitioned && status === 'unhealthy') {
      await fireHealthAlert(node.id, node.name, containerName, 'unhealthy', failStreak);
    } else if (!transitioned && status === 'unhealthy' && failStreak % 5 === 0 && failStreak > 0) {
      // Re-alert every 5 consecutive failures
      await fireHealthAlert(node.id, node.name, containerName, 'unhealthy', failStreak);
    }

    // Log recovery
    if (transitioned && status === 'healthy' && previousStatus === 'unhealthy') {
      logger.info('[HealthChecker] Container recovered', { nodeId: node.id, nodeName: node.name });
      await fireHealthAlert(node.id, node.name, containerName, 'recovered', failStreak);
    }
  }
}

async function fireHealthAlert(
  nodeId: string,
  nodeName: string,
  containerName: string,
  event: 'unhealthy' | 'recovered',
  failStreak: number
): Promise<void> {
  const severity = event === 'unhealthy' ? 'critical' : 'info';
  const title =
    event === 'unhealthy'
      ? `Container unhealthy: ${nodeName}`
      : `Container recovered: ${nodeName}`;
  const message =
    event === 'unhealthy'
      ? `Container ${containerName} on ${nodeName} is unhealthy (streak: ${failStreak}).`
      : `Container ${containerName} on ${nodeName} has recovered.`;

  const fingerprint = `container-health-${nodeId}-${event}`;

  try {
    await query(
      `INSERT INTO skynet.alerts
         (node_id, severity, title, message, status, fingerprint, triggered_at)
       VALUES ($1, $2, $3, $4, 'active', $5, NOW())
       ON CONFLICT (fingerprint) DO UPDATE SET
         triggered_at = NOW(),
         status = 'active'`,
      [nodeId, severity, title, message, fingerprint]
    );
  } catch (err: any) {
    if (!err.message?.includes('does not exist')) {
      logger.error('[HealthChecker] Failed to create alert', { err });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Docker image tag drift detection — Issue #57
// ─────────────────────────────────────────────────────────────────────────────

async function checkImageTagDrift(): Promise<void> {
  let nodes: any[] = [];
  try {
    const result = await query(`
      SELECT id, name, docker_image, agent_url, agent_key
        FROM skynet.nodes
       WHERE is_active = true
         AND docker_image IS NOT NULL
         AND agent_url IS NOT NULL
    `);
    nodes = result.rows;
  } catch {
    return;
  }

  for (const node of nodes) {
    try {
      const res = await fetch(`${node.agent_url}/api/container/image`, {
        headers: { Authorization: `Bearer ${node.agent_key ?? ''}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;

      const data: any = await res.json();
      const runningTag: string = data.tag ?? data.image ?? '';
      const configuredTag: string = node.docker_image ?? '';

      if (runningTag && configuredTag && runningTag !== configuredTag) {
        const fingerprint = `image-drift-${node.id}`;
        await query(
          `INSERT INTO skynet.alerts
             (node_id, severity, title, message, status, fingerprint, triggered_at)
           VALUES ($1, 'warning', $2, $3, 'active', $4, NOW())
           ON CONFLICT (fingerprint) DO UPDATE SET triggered_at = NOW(), status = 'active'`,
          [
            node.id,
            `Image tag drift: ${node.name}`,
            `Running image "${runningTag}" differs from configured "${configuredTag}".`,
            fingerprint,
          ]
        ).catch(() => {});
      }
    } catch {
      // ignore per-node errors
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: start health checker
// ─────────────────────────────────────────────────────────────────────────────

const HEALTH_CHECK_INTERVAL_MS = 60_000; // every 60 seconds
const IMAGE_DRIFT_INTERVAL_MS = 5 * 60_000; // every 5 minutes

export function startHealthChecker(): void {
  logger.info('[HealthChecker] Starting container health checker');
  checkAllContainers();
  checkImageTagDrift();
  setInterval(checkAllContainers, HEALTH_CHECK_INTERVAL_MS);
  setInterval(checkImageTagDrift, IMAGE_DRIFT_INTERVAL_MS);
}
