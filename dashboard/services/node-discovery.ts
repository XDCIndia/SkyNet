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
