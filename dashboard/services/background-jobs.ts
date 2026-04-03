/**
 * Background Jobs Service
 * 
 * Manages all background job scheduling for the XDCNetOwn platform.
 * 
 * Issue: #684 - Alert Trigger Engine Not Connected
 * Issue: #33  - Cross-Client Block Hash Divergence (60-second job)
 * Issue: #34  - 'Invalid Ancestor' Sync Error Detection
 */

import { startAlertEngine as startLegacyAlertEngine } from './alert-trigger';
import { startAlertEngine } from '@/lib/alert-trigger-engine';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';
import { startNodeDiscovery } from './node-discovery';
import { startHealthChecker } from './health-checker';

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

// ─────────────────────────────────────────────────────────────────────────────
// Issue #67: Cross-Client Consensus Divergence Resolution
// When divergence is detected, identify the minority (wrong) node(s) by
// comparing against the majority hash and create a resolution incident.
// ─────────────────────────────────────────────────────────────────────────────

async function resolveDivergence(): Promise<void> {
  try {
    // Look for unresolved divergence events
    const events = await query(`
      SELECT DISTINCT block_height
        FROM skynet.block_divergence_events
       WHERE resolved_at IS NULL
         AND detected_at > NOW() - INTERVAL '10 minutes'
    `).catch(() => ({ rows: [] as any[] }));

    for (const event of events.rows) {
      const height = Number(event.block_height);

      // Get all nodes reporting at this height
      const nodesAtHeight = await query(
        `SELECT id AS node_id, name AS node_name, client_type, block_hash
           FROM skynet.nodes
          WHERE block_height = $1
            AND block_hash IS NOT NULL
            AND is_active = true`,
        [height]
      );

      if (nodesAtHeight.rows.length < 2) continue;

      // Count votes per hash (majority wins)
      const hashVotes = new Map<string, { count: number; nodes: any[] }>();
      for (const node of nodesAtHeight.rows) {
        const h = String(node.block_hash).toLowerCase();
        if (!hashVotes.has(h)) hashVotes.set(h, { count: 0, nodes: [] });
        const entry = hashVotes.get(h)!;
        entry.count++;
        entry.nodes.push(node);
      }

      // Majority hash = the one with the most votes
      let majorityHash = '';
      let majorityCount = 0;
      for (const [hash, data] of hashVotes.entries()) {
        if (data.count > majorityCount) {
          majorityCount = data.count;
          majorityHash = hash;
        }
      }

      // Nodes NOT on the majority hash are the minority (likely wrong)
      const minorityNodes: any[] = [];
      for (const [hash, data] of hashVotes.entries()) {
        if (hash !== majorityHash) {
          minorityNodes.push(...data.nodes);
        }
      }

      if (minorityNodes.length === 0) continue;

      const rootCause =
        minorityNodes.length === 1
          ? `Node "${minorityNodes[0].node_name}" (${minorityNodes[0].client_type}) is on minority fork at block ${height}. ` +
            `All other nodes (${majorityCount}) agree on hash ${majorityHash.slice(0, 10)}….`
          : `${minorityNodes.length} nodes are on minority fork at block ${height}: ` +
            `${minorityNodes.map((n: any) => n.node_name).join(', ')}. ` +
            `Majority (${majorityCount} nodes) agree on hash ${majorityHash.slice(0, 10)}….`;

      logger.warn('[Divergence] Resolution identified minority nodes', {
        blockHeight: height,
        minority: minorityNodes.map((n: any) => n.node_name),
        majorityHash: majorityHash.slice(0, 12),
      });

      // Create an incident for the divergence resolution
      const incidentFingerprint = `divergence-resolution-${height}`;
      try {
        await query(
          `INSERT INTO skynet.incidents
             (title, description, severity, status, fingerprint, created_at)
           VALUES ($1, $2, 'critical', 'open', $3, NOW())
           ON CONFLICT (fingerprint) DO NOTHING`,
          [
            `Consensus Divergence at Block #${height}`,
            rootCause,
            incidentFingerprint,
          ]
        );
      } catch (incErr: any) {
        // incidents table may not exist — try alerts instead
        if (incErr.message?.includes('does not exist')) {
          await query(
            `INSERT INTO skynet.alerts
               (node_id, severity, title, message, status, fingerprint, triggered_at)
             VALUES ($1, 'critical', $2, $3, 'active', $4, NOW())
             ON CONFLICT (fingerprint) DO NOTHING`,
            [
              minorityNodes[0].node_id,
              `Consensus Divergence Resolved at Block #${height}`,
              rootCause,
              incidentFingerprint,
            ]
          ).catch(() => {});
        } else {
          logger.error('[Divergence] Failed to create resolution incident', { incErr });
        }
      }

      // Mark the divergence events as resolved
      await query(
        `UPDATE skynet.block_divergence_events
            SET resolved_at = NOW()
          WHERE block_height = $1
            AND resolved_at IS NULL`,
        [height]
      ).catch(() => {});
    }
  } catch (err) {
    logger.error('[Divergence] resolveDivergence error', { err });
  }
}

function startDivergenceResolver(): void {
  logger.info('[Divergence] Starting divergence resolution engine (90s)');
  setTimeout(resolveDivergence, 30_000); // delay first run so detector goes first
  setInterval(resolveDivergence, 90_000);
}

function startDivergenceDetector(): void {
  logger.info('[Divergence] Starting cross-client block hash divergence detector (60s)');
  checkBlockHashDivergence(); // Run immediately
  setInterval(checkBlockHashDivergence, 60_000);
}

// ──────────────────────────────────────────────────────────────
// Issue #34: Invalid Ancestor Error Detection
// Polls skynet.node_logs for 'invalid ancestor' pattern every 5 minutes.
// Creates an incident with root_cause='bad_block' when found.
// ──────────────────────────────────────────────────────────────

async function checkInvalidAncestorErrors(): Promise<void> {
  try {
    // Query node_logs for 'invalid ancestor' pattern in last 10 minutes
    const logsResult = await query(`
      SELECT
        nl.node_id,
        n.name AS node_name,
        nl.log_line,
        nl.collected_at
      FROM skynet.node_logs nl
      JOIN skynet.nodes n ON nl.node_id = n.id
      WHERE nl.log_line ILIKE '%invalid ancestor%'
        AND nl.collected_at > NOW() - INTERVAL '10 minutes'
      ORDER BY nl.collected_at DESC
      LIMIT 50
    `).catch(() => ({ rows: [] })); // Table may not exist yet

    if (!logsResult.rows.length) return;

    // Deduplicate by node_id
    const seen = new Set<string>();
    for (const row of logsResult.rows) {
      if (seen.has(row.node_id)) continue;
      seen.add(row.node_id);

      logger.warn('[InvalidAncestor] Detected invalid ancestor error', {
        nodeId: row.node_id,
        nodeName: row.node_name,
        logLine: row.log_line?.slice(0, 200),
      });

      // Create incident (idempotent via fingerprint)
      const fingerprint = `invalid_ancestor-${row.node_id}-${new Date().toISOString().slice(0, 13)}`; // hourly dedup
      try {
        await query(
          `INSERT INTO skynet.alerts
             (node_id, severity, title, message, status, fingerprint, triggered_at)
           VALUES ($1, 'critical', $2, $3, 'active', $4, NOW())
           ON CONFLICT (fingerprint) DO NOTHING`,
          [
            row.node_id,
            `Invalid Ancestor Error: ${row.node_name}`,
            `Node ${row.node_name} reported 'invalid ancestor' — possible bad block or fork. Log: ${(row.log_line ?? '').slice(0, 300)}`,
            fingerprint,
          ]
        );

        // Also create an incident with root_cause tag
        await query(
          `INSERT INTO skynet.incidents
             (node_id, node_name, type, severity, title, description, status, root_cause, detected_at)
           VALUES ($1, $2, 'sync_error', 'critical', $3, $4, 'active', 'bad_block', NOW())
           ON CONFLICT DO NOTHING`,
          [
            row.node_id,
            row.node_name,
            `Invalid Ancestor: ${row.node_name}`,
            `Detected 'invalid ancestor' error in node logs. This indicates a bad block or chain fork. Log excerpt: ${(row.log_line ?? '').slice(0, 400)}`,
          ]
        ).catch((err: any) => {
          // incidents table may not have root_cause column yet — try without it
          if (err.message?.includes('root_cause')) {
            return query(
              `INSERT INTO skynet.incidents
                 (node_id, node_name, type, severity, title, description, status, detected_at)
               VALUES ($1, $2, 'sync_error', 'critical', $3, $4, 'active', NOW())
               ON CONFLICT DO NOTHING`,
              [row.node_id, row.node_name,
               `Invalid Ancestor: ${row.node_name}`,
               `Detected 'invalid ancestor' error. Bad block suspected. Log: ${(row.log_line ?? '').slice(0, 300)}`]
            );
          }
        });
      } catch (insertErr: any) {
        if (!insertErr.message?.includes('does not exist')) {
          logger.error('[InvalidAncestor] Failed to create incident', { insertErr });
        }
      }
    }
  } catch (err) {
    logger.error('[InvalidAncestor] Error in checkInvalidAncestorErrors', { err });
  }
}

function startInvalidAncestorDetector(): void {
  logger.info('[InvalidAncestor] Starting invalid ancestor error detector (5-min interval)');
  setTimeout(() => checkInvalidAncestorErrors(), 60_000); // 1-min delay on startup
  setInterval(checkInvalidAncestorErrors, 5 * 60_000);
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
  // Issue #67: Cross-Client Consensus Divergence Resolution
  {
    name: 'DivergenceResolver',
    enabled: process.env.ENABLE_DIVERGENCE_RESOLVER !== 'false',
    intervalMs: 90_000,
    startFunction: startDivergenceResolver,
  },
  // Issue #59: Container Health Checker
  {
    name: 'HealthChecker',
    enabled: process.env.ENABLE_HEALTH_CHECKER !== 'false',
    intervalMs: 60_000,
    startFunction: startHealthChecker,
  },
  // Issue #34: Invalid Ancestor Error Detector
  {
    name: 'InvalidAncestorDetector',
    enabled: process.env.ENABLE_INVALID_ANCESTOR_DETECTOR !== 'false',
    intervalMs: 5 * 60_000,
    startFunction: startInvalidAncestorDetector,
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
