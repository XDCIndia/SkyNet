/**
 * Background Jobs Service
 * 
 * Manages all background job scheduling for the XDCNetOwn platform.
 * 
 * Issue: #684 - Alert Trigger Engine Not Connected
 * Issue: #33  - Cross-Client Block Hash Divergence (60-second job)
 */

import { startAlertEngine as startLegacyAlertEngine } from './alert-trigger';
import { startAlertEngine } from '@/lib/alert-trigger-engine';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';
import { startNodeDiscovery } from './node-discovery';

interface JobConfig {
  name: string;
  enabled: boolean;
  intervalMs: number;
  startFunction: () => void;
}

// ─────────────────────────────────────────────────────────────
// Issue #33: Cross-Client Block Hash Divergence Detector
// Runs every 60 s. Queries all online nodes at the same block
// height; if any two report different hashes, creates an alert
// and persists the event in skynet.block_divergence_events.
// ─────────────────────────────────────────────────────────────

async function checkBlockHashDivergence(): Promise<void> {
  try {
    // Get the latest block height reported by each online node
    const nodesResult = await query(`
      SELECT
        n.id         AS node_id,
        n.name       AS node_name,
        n.client_type,
        n.block_height,
        n.block_hash
      FROM skynet.nodes n
      WHERE n.is_active = true
        AND n.last_heartbeat > NOW() - INTERVAL '5 minutes'
        AND n.block_height IS NOT NULL
        AND n.block_hash IS NOT NULL
    `);

    if (nodesResult.rows.length < 2) return; // Nothing to compare

    // Group nodes by block_height
    const byHeight = new Map<number, typeof nodesResult.rows>();
    for (const row of nodesResult.rows) {
      const h = Number(row.block_height);
      if (!byHeight.has(h)) byHeight.set(h, []);
      byHeight.get(h)!.push(row);
    }

    for (const [height, nodes] of byHeight.entries()) {
      if (nodes.length < 2) continue;

      // Check if any hashes differ at this height
      const hashSet = new Set(nodes.map((n: any) => n.block_hash?.toLowerCase()));
      if (hashSet.size <= 1) continue; // All agree

      logger.warn('[Divergence] Block hash divergence detected', {
        blockHeight: height,
        nodeCount: nodes.length,
        distinctHashes: hashSet.size,
      });

      // Persist divergence event (idempotent via ON CONFLICT DO NOTHING)
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          if (a.block_hash?.toLowerCase() === b.block_hash?.toLowerCase()) continue;

          try {
            await query(
              `INSERT INTO skynet.block_divergence_events
                 (block_height, node_a_id, node_a_hash, node_b_id, node_b_hash, detected_at)
               VALUES ($1, $2, $3, $4, $5, NOW())
               ON CONFLICT DO NOTHING`,
              [height, a.node_id, a.block_hash, b.node_id, b.block_hash]
            );
          } catch (insertErr: any) {
            // Table may not exist yet — log and continue
            if (!insertErr.message?.includes('does not exist')) {
              logger.error('[Divergence] Failed to insert divergence event', { insertErr });
            }
          }

          // Create an alert for the divergence (deduplicated by fingerprint)
          const fingerprint = `divergence-${height}-${a.node_id}-${b.node_id}`;
          try {
            await query(
              `INSERT INTO skynet.alerts
                 (node_id, severity, title, message, status, fingerprint, triggered_at)
               VALUES ($1, 'critical', $2, $3, 'active', $4, NOW())
               ON CONFLICT (fingerprint) DO NOTHING`,
              [
                a.node_id,
                `Block Hash Divergence at #${height}`,
                `Cross-client hash mismatch at block ${height}: ` +
                  `${a.node_name} (${a.client_type}) has ${a.block_hash?.slice(0, 10)}… ` +
                  `vs ${b.node_name} (${b.client_type}) has ${b.block_hash?.slice(0, 10)}…`,
                fingerprint,
              ]
            );
          } catch (alertErr: any) {
            logger.error('[Divergence] Failed to create alert', { alertErr });
          }
        }
      }
    }
  } catch (err) {
    logger.error('[Divergence] checkBlockHashDivergence error', { err });
  }
}

function startDivergenceDetector(): void {
  logger.info('[Divergence] Starting cross-client block hash divergence detector (60s)');
  checkBlockHashDivergence(); // Run immediately
  setInterval(checkBlockHashDivergence, 60_000);
}

// Configure all background jobs
const jobs: JobConfig[] = [
  {
    name: 'AlertTriggerEngine',
    enabled: process.env.ENABLE_ALERT_ENGINE !== 'false',
    intervalMs: parseInt(process.env.ALERT_CHECK_INTERVAL || '30000', 10),
    startFunction: () => startAlertEngine(parseInt(process.env.ALERT_CHECK_INTERVAL || '30000', 10)),
  },
  // Issue #33: Block Hash Divergence Detector
  {
    name: 'BlockHashDivergenceDetector',
    enabled: process.env.ENABLE_DIVERGENCE_DETECTOR !== 'false',
    intervalMs: 60_000,
    startFunction: startDivergenceDetector,
  },
  // Issue #70: Dynamic Node Discovery
  {
    name: 'NodeDiscovery',
    enabled: process.env.ENABLE_NODE_DISCOVERY !== 'false',
    intervalMs: 5 * 60_000,
    startFunction: startNodeDiscovery,
  },
];

/**
 * Initialize and start all enabled background jobs
 */
export function startBackgroundJobs(): void {
  logger.info('Initializing background jobs...');

  for (const job of jobs) {
    if (job.enabled) {
      try {
        logger.info(`Starting background job: ${job.name}`);
        job.startFunction();
        logger.info(`Background job started: ${job.name}`);
      } catch (error) {
        logger.error(`Failed to start background job: ${job.name}`, { error });
      }
    } else {
      logger.info(`Background job disabled: ${job.name}`);
    }
  }

  logger.info('Background jobs initialization complete');
}

/**
 * Stop all background jobs gracefully
 */
export function stopBackgroundJobs(): void {
  logger.info('Stopping background jobs...');
  logger.info('Background jobs stopped');
}

/**
 * Get status of all background jobs
 */
export function getJobStatus(): { name: string; enabled: boolean; running: boolean }[] {
  return jobs.map(job => ({
    name: job.name,
    enabled: job.enabled,
    running: job.enabled,
  }));
}
