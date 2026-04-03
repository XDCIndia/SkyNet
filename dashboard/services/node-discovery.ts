/**
 * Node Discovery Service
 *
 * Issue #70 — Dynamic Node Discovery
 *
 * Replaces the hardcoded node list in the rpc-poller.
 * Queries the SkyNet DB for all registered, active nodes and refreshes
 * the poller targets every 5 minutes.
 *
 * Usage:
 *   import { getPollerTargets, startNodeDiscovery } from '@/services/node-discovery';
 *
 *   startNodeDiscovery();  // call once at app start
 *   const targets = getPollerTargets(); // call wherever polling targets are needed
 */

import { execSync } from 'child_process';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface PollerTarget {
  nodeId: string;
  name: string;
  rpcUrl: string;
  clientType: string | null;
  network: string | null;
}

// In-memory store of current poller targets
let pollerTargets: PollerTarget[] = [];
let discoveryTimer: ReturnType<typeof setInterval> | null = null;

/** Return the current list of dynamic poller targets */
export function getPollerTargets(): PollerTarget[] {
  return pollerTargets;
}

/** Refresh poller targets from DB */
async function refreshTargets(): Promise<void> {
  try {
    const result = await query(`
      SELECT
        id           AS "nodeId",
        name,
        rpc_url      AS "rpcUrl",
        client_type  AS "clientType",
        network
      FROM skynet.nodes
      WHERE is_active = true
        AND rpc_url IS NOT NULL
        AND rpc_url != ''
      ORDER BY name
    `);

    const fresh: PollerTarget[] = result.rows.filter(
      (r: any) => r.rpcUrl && r.rpcUrl.startsWith('http')
    );

    const added   = fresh.filter(f => !pollerTargets.find(p => p.nodeId === f.nodeId)).length;
    const removed = pollerTargets.filter(p => !fresh.find(f => f.nodeId === p.nodeId)).length;

    pollerTargets = fresh;

    if (added || removed) {
      logger.info('[NodeDiscovery] Poller targets updated', {
        total: fresh.length,
        added,
        removed,
      });
    }
  } catch (err) {
    logger.error('[NodeDiscovery] Failed to refresh targets', { err });
    // Keep stale targets so polling doesn't stop on DB hiccup
  }
}

/**
 * Start the node discovery service.
 * Performs an immediate refresh, then repeats every 5 minutes.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function startNodeDiscovery(): void {
  if (discoveryTimer) return; // already running

  logger.info('[NodeDiscovery] Starting dynamic node discovery (5-min interval)');

  // Immediate refresh
  refreshTargets().catch(err =>
    logger.error('[NodeDiscovery] Initial refresh failed', { err })
  );

  // Refresh every 5 minutes
  discoveryTimer = setInterval(() => {
    refreshTargets().catch(err =>
      logger.error('[NodeDiscovery] Periodic refresh failed', { err })
    );
  }, 5 * 60 * 1000);
}

/** Stop the discovery service (e.g., during graceful shutdown) */
export function stopNodeDiscovery(): void {
  if (discoveryTimer) {
    clearInterval(discoveryTimer);
    discoveryTimer = null;
    logger.info('[NodeDiscovery] Stopped');
  }
}

/** Force an immediate refresh (useful for tests or after node registration) */
export async function forceRefresh(): Promise<void> {
  await refreshTargets();
}

/**
 * Issue #5 — Stale Docker IP Fix
 *
 * When an RPC call fails (likely due to stale container IP after restart),
 * re-resolve the container's current IP via `docker inspect` and retry once.
 *
 * @param target   The PollerTarget that failed
 * @returns        Updated rpcUrl with fresh IP, or null if resolution failed
 */
export async function resolveContainerIp(target: PollerTarget): Promise<string | null> {
  // Extract container name / ID from rpcUrl hostname
  // Expected format: http://172.x.x.x:PORT or http://container-name:PORT
  const urlMatch = target.rpcUrl.match(/^(https?:\/\/)([^:]+)(:\d+.*)$/);
  if (!urlMatch) return null;

  const [, scheme, host, portPath] = urlMatch;

  // Try docker inspect with the node ID as container name (common convention)
  const candidates = [target.nodeId, target.name, host].filter(Boolean);

  for (const name of candidates) {
    try {
      const output = execSync(
        `docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "${name}" 2>/dev/null`,
        { timeout: 5000, encoding: 'utf8' }
      ).trim();

      if (output && /^\d{1,3}\./.test(output)) {
        const freshUrl = `${scheme}${output}${portPath}`;
        logger.info('[NodeDiscovery] Re-resolved stale container IP via docker inspect', {
          nodeId: target.nodeId,
          oldHost: host,
          newHost: output,
          freshUrl,
        });

        // Persist fresh IP back to DB so poller uses it next round
        try {
          await query(
            `UPDATE skynet.nodes SET rpc_url = $1, updated_at = NOW() WHERE id = $2`,
            [freshUrl, target.nodeId]
          );
        } catch (dbErr) {
          logger.warn('[NodeDiscovery] Could not persist fresh rpc_url', { dbErr });
        }

        return freshUrl;
      }
    } catch {
      // docker inspect failed for this candidate — try next
    }
  }

  logger.warn('[NodeDiscovery] Could not re-resolve container IP for node', { nodeId: target.nodeId });
  return null;
}

/**
 * Wrap an RPC fetch with automatic IP re-resolution on failure (Issue #5).
 * Performs one retry with a fresh container IP before giving up.
 */
export async function fetchWithIpRetry(
  target: PollerTarget,
  fetchFn: (url: string) => Promise<Response>
): Promise<Response> {
  try {
    return await fetchFn(target.rpcUrl);
  } catch (firstErr) {
    logger.warn('[NodeDiscovery] RPC call failed, attempting IP re-resolution', {
      nodeId: target.nodeId,
      rpcUrl: target.rpcUrl,
      err: (firstErr as Error).message,
    });

    const freshUrl = await resolveContainerIp(target);
    if (!freshUrl) throw firstErr; // No fresh IP — propagate original error

    // Retry once with the fresh URL
    return await fetchFn(freshUrl);
  }
}
