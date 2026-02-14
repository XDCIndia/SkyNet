import { NextRequest, NextResponse } from 'next/server';
import { withTransaction, queryAll } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, hasPermission } from '@/lib/auth';
import { checkFleetNodeDown } from '@/lib/alert-engine';
import { deliverAlert, deliverResolution } from '@/lib/alert-delivery';
import { HeartbeatSchema, validateBody, UUIDSchema } from '@/lib/validation';
import { withErrorHandling, ValidationError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { invalidateByTag } from '@/lib/cache';
import { z } from 'zod';

// Sentry info for Erigon dual sentry monitoring
const SentrySchema = z.object({
  port: z.number().int().min(1).max(65535),
  protocol: z.string(),
  peers: z.number().int().min(0),
});

// Extended schema for heartbeat with additional fields
const ExtendedHeartbeatSchema = HeartbeatSchema.extend({
  syncProgress: z.number().min(0).max(100).optional(),
  peers: z.array(z.object({
    enode: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    protocols: z.array(z.string()).optional(),
    direction: z.enum(['inbound', 'outbound']).optional(),
  })).optional(),
  txPool: z.object({
    pending: z.number().int().min(0).optional(),
    queued: z.number().int().min(0).optional(),
  }).optional(),
  coinbase: z.string().optional(),
  clientVersion: z.string().max(200).optional(),
  clientType: z.enum(['geth', 'erigon', 'geth-pr5', 'XDC', 'unknown']).optional().default('unknown'),
  isMasternode: z.boolean().optional(),
  nodeType: z.enum(['masternode', 'standby', 'fullnode', 'full', 'archive', 'fast', 'snap']).optional(),
  syncMode: z.enum(['full', 'fast', 'snap', 'archive']).optional().default('full'),
  ipv4: z.string().ip({ version: 'v4' }).optional(),
  ipv6: z.string().ip({ version: 'v6' }).nullable().optional().or(z.literal('')),
  os: z.object({
    type: z.string().optional(),
    release: z.string().optional(),
    arch: z.string().optional(),
    kernel: z.string().optional(),
  }).optional(),
  masternodeStatus: z.string().optional(),
  security: z.object({
    score: z.number().int().min(0).max(100).optional(),
    issues: z.union([z.array(z.string()), z.string()]).optional().transform(v =>
      typeof v === 'string' ? v.split(',').filter(Boolean) : v
    ),
  }).optional(),
  rpcLatencyMs: z.number().int().min(0).optional(),
  timestamp: z.coerce.date().optional(),
  // Storage metrics
  chainDataSize: z.number().min(0).optional(),
  databaseSize: z.number().min(0).optional(),
  // Erigon dual sentry monitoring (Issue #14)
  sentries: z.array(SentrySchema).optional(),
});

/**
 * POST /api/v1/nodes/heartbeat
 * Node heartbeat + metrics push
 * Called every 30-60s by node-health-check.sh
 * Auth: Bearer API key
 * Response: { ok: true, commands?: [...] }
 */
async function postHandler(request: NextRequest) {
  // Authenticate request — allow unauthenticated if nodeId matches a registered node
  const auth = await authenticateRequest(request);
  if (!auth.valid) {
    // Try to extract nodeId from body for keyless heartbeat
    let bodyPeek;
    try {
      bodyPeek = await request.clone().json();
    } catch { bodyPeek = null; }
    if (bodyPeek?.nodeId) {
      const nodeCheck = await queryAll(
        'SELECT id FROM skynet.nodes WHERE id = $1 AND is_active = true',
        [bodyPeek.nodeId]
      );
      if (nodeCheck.length === 0) {
        return unauthorizedResponse('Invalid nodeId or node not registered');
      }
      // Allow keyless heartbeat for registered nodes
      logger.info('Keyless heartbeat accepted', { nodeId: bodyPeek.nodeId });
    } else {
      return unauthorizedResponse(auth.error);
    }
  } else if (!hasPermission(auth, 'heartbeat')) {
    return NextResponse.json(
      { error: 'Insufficient permissions for heartbeat', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  // Validate request body
  const body = await validateBody(request, ExtendedHeartbeatSchema);
  const {
    nodeId,
    blockHeight,
    syncing,
    syncProgress,
    peerCount,
    peers,
    txPool,
    gasPrice,
    coinbase,
    clientVersion,
    clientType,
    nodeType,
    syncMode,
    ipv4,
    ipv6,
    os,
    security,
    rpcLatencyMs,
    timestamp,
    chainDataSize,
    databaseSize,
    sentries,
  } = body;

  // Verify node ownership (if using node-specific key)
  if (auth.nodeId && auth.nodeId !== nodeId) {
    return NextResponse.json(
      { error: 'API key does not match nodeId', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  // Get previous metrics for comparison (for incident detection)
  const prevMetrics = await queryAll(
    `SELECT block_height, peer_count, disk_percent, collected_at
     FROM skynet.node_metrics 
     WHERE node_id = $1 
     ORDER BY collected_at DESC 
     LIMIT 3`,
    [nodeId]
  );

  // Get fleet max block height for drift detection
  const fleetMaxResult = await queryAll(
    `SELECT COALESCE(MAX(block_height), 0) as max_height
     FROM skynet.node_metrics
     WHERE collected_at > NOW() - INTERVAL '5 minutes'`
  );
  const fleetMaxHeight = parseInt(fleetMaxResult[0]?.max_height || '0');

  // Store metrics and peers in transaction
  await withTransaction(async (client) => {
    // Insert node metrics with new fields (including sentries for Issue #14)
    await client.query(
      `INSERT INTO skynet.node_metrics 
       (node_id, block_height, sync_percent, peer_count, 
        cpu_percent, memory_percent, disk_percent, disk_used_gb, disk_total_gb,
        tx_pool_pending, tx_pool_queued, gas_price, rpc_latency_ms,
        is_syncing, client_version, client_type, node_type, coinbase, 
        chain_data_size, database_size, 
        os_type, os_release, os_arch, kernel_version,
        ipv4, ipv6, security_score, security_issues,
        sentries, collected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)`,
      [
        nodeId,
        blockHeight ?? null,
        // Recalculate sync percent using fleet max height for accuracy
        // Node-reported syncProgress is unreliable when syncing from scratch
        (fleetMaxHeight > 0 && blockHeight != null)
          ? Math.min(100, Math.round((blockHeight / fleetMaxHeight) * 10000) / 100)
          : syncProgress ?? null,
        peerCount ?? null,
        body.system?.cpuPercent ?? null,
        body.system?.memoryPercent ?? null,
        body.system?.diskPercent ?? null,
        body.system?.diskUsedGb ?? null,
        body.system?.diskTotalGb ?? null,
        txPool?.pending ?? null,
        txPool?.queued ?? null,
        gasPrice ? BigInt(gasPrice as any) : null,
        rpcLatencyMs ?? null,
        syncing ?? false,
        clientVersion ?? null,
        clientType ?? null,
        nodeType ?? null,
        coinbase ?? null,
        chainDataSize ?? null,
        databaseSize ?? null,
        os?.type ?? null,
        os?.release ?? null,
        os?.arch ?? null,
        os?.kernel ?? null,
        ipv4 ?? null,
        ipv6 ?? null,
        security?.score ?? null,
        security?.issues?.join(',') ?? null,
        sentries ? JSON.stringify(sentries) : null,
        timestamp ? new Date(timestamp) : new Date(),
      ]
    );

    // Insert peer snapshots if provided
    if (peers && Array.isArray(peers) && peers.length > 0) {
      for (const peer of peers.slice(0, 100)) { // Limit to 100 peers
        const enodeMatch = peer.enode?.match(/@([^:]+):(\d+)/);
        const remoteIp = enodeMatch?.[1] || null;
        const remotePort = enodeMatch?.[2] ? parseInt(enodeMatch[2]) : null;

        await client.query(
          `INSERT INTO skynet.peer_snapshots 
           (node_id, peer_enode, peer_name, remote_ip, remote_port, 
            client_version, protocols, direction, collected_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            nodeId,
            peer.enode || '',
            peer.name || null,
            remoteIp,
            remotePort,
            peer.name || null,
            peer.protocols || [],
            peer.direction || null,
            new Date(),
          ]
        );
      }
    }

    // Update nodes table with latest info
    await client.query(
      `UPDATE skynet.nodes 
       SET updated_at = NOW(),
           role = COALESCE($2, role),
           security_score = COALESCE($3, security_score),
           ipv4 = COALESCE($4, ipv4),
           client_version = COALESCE($5, client_version),
           client_type = COALESCE($6, client_type),
           node_type = COALESCE($7, node_type),
           sync_mode = COALESCE($8, sync_mode),
           os_info = COALESCE($9, os_info)
       WHERE id = $1`,
      [nodeId, nodeType || null, security?.score ?? null, ipv4 || null, clientVersion || null, clientType || null, nodeType || null, syncMode || null, os ? JSON.stringify(os) : null]
    );
  });

  // === AUTO-INCIDENT DETECTION (Issue #10) ===
  const detectedIncidents: Array<{
    type: string;
    severity: 'critical' | 'warning' | 'info';
    title: string;
    description: string;
  }> = [];

  // Get previous metrics from 4+ minutes ago for sync stall detection (5 min window)
  const prevMetrics5mResult = await queryAll(
    `SELECT block_height, peer_count, disk_percent, collected_at
     FROM skynet.node_metrics 
     WHERE node_id = $1 AND collected_at < NOW() - INTERVAL '4 minutes'
     ORDER BY collected_at DESC 
     LIMIT 1`,
    [nodeId]
  );
  const prevMetrics5m = prevMetrics5mResult[0];

  // Use existing fleetMaxHeight from earlier query (2 min window for drift detection)

  // 1. Sync Stall Detection - same block_height as 5 min ago
  if (blockHeight !== undefined && blockHeight !== null && prevMetrics5m) {
    if (prevMetrics5m.block_height === blockHeight && blockHeight > 0) {
      const existing = await queryAll(
        `SELECT id FROM skynet.incidents 
         WHERE node_id = $1 AND type = 'sync_stall' AND status = 'active'`,
        [nodeId]
      );
      if (existing.length === 0) {
        detectedIncidents.push({
          type: 'sync_stall',
          severity: 'warning',
          title: 'Block sync stalled',
          description: `Block height (${blockHeight.toLocaleString()}) unchanged for 5+ minutes`,
        });
      }
    }
  }

  // 2. Peer Drop Detection - peer_count < 3
  if (peerCount !== undefined && peerCount < 3) {
    const existing = await queryAll(
      `SELECT id FROM skynet.incidents 
       WHERE node_id = $1 AND type = 'peer_drop' AND status = 'active'`,
      [nodeId]
    );
    if (existing.length === 0) {
      detectedIncidents.push({
        type: 'peer_drop',
        severity: peerCount === 0 ? 'critical' : 'warning',
        title: 'Low peer count',
        description: `Only ${peerCount} peer${peerCount !== 1 ? 's' : ''} connected (minimum: 3)`,
      });
    }
  }

  // 3. Disk Pressure Detection - disk_percent > 85%
  if (body.system?.diskPercent !== undefined && body.system.diskPercent > 85) {
    const existing = await queryAll(
      `SELECT id FROM skynet.incidents 
       WHERE node_id = $1 AND type = 'disk_pressure' AND status = 'active'`,
      [nodeId]
    );
    if (existing.length === 0) {
      detectedIncidents.push({
        type: 'disk_pressure',
        severity: body.system.diskPercent > 95 ? 'critical' : 'warning',
        title: 'High disk usage',
        description: `Disk usage at ${body.system.diskPercent.toFixed(1)}% (threshold: 85%)`,
      });
    }
  }

  // 4. Block Drift Detection - > 1000 blocks behind fleet max
  if (blockHeight !== undefined && fleetMaxHeight > 0 && blockHeight > 0) {
    const drift = fleetMaxHeight - blockHeight;
    if (drift > 1000) {
      const existing = await queryAll(
        `SELECT id FROM skynet.incidents 
         WHERE node_id = $1 AND type = 'block_drift' AND status = 'active'`,
        [nodeId]
      );
      if (existing.length === 0) {
        detectedIncidents.push({
          type: 'block_drift',
          severity: drift > 5000 ? 'critical' : 'warning',
          title: 'Block height drift detected',
          description: `Node is ${drift} blocks behind fleet leader (${fleetMaxHeight.toLocaleString()})`,
        });
      }
    }
  }

  // === AUTO-RESOLVE INCIDENTS (Issue #11) ===
  const resolvedIncidents: Array<{ type: string; details: string }> = [];

  // Resolve sync_stall if block height increased from 5min ago
  if (blockHeight !== undefined && prevMetrics5m?.block_height) {
    if (blockHeight > prevMetrics5m.block_height) {
      const activeSyncStall = await queryAll(
        `SELECT id FROM skynet.incidents 
         WHERE node_id = $1 AND type = 'sync_stall' AND status = 'active'`,
        [nodeId]
      );
      if (activeSyncStall.length > 0) {
        await queryAll(
          `UPDATE skynet.incidents 
           SET status = 'resolved', resolved_at = NOW(), 
               description = description || E'\n\nAuto-resolved: block height increased from ' || $2 || ' to ' || $3
           WHERE node_id = $1 AND type = 'sync_stall' AND status = 'active'`,
          [nodeId, prevMetrics5m.block_height, blockHeight]
        );
        resolvedIncidents.push({
          type: 'sync_stall',
          details: `Block height recovered: ${prevMetrics5m.block_height} → ${blockHeight}`,
        });
      }
      // Also auto-resolve any open issues of type sync_stall (Issue #11)
      await queryAll(
        `UPDATE skynet.issues 
         SET status = 'resolved', resolved_at = NOW() 
         WHERE node_id = $1 AND type = 'sync_stall' AND status = 'open'`,
        [nodeId]
      );
    }
  }

  // Resolve peer_drop if peers >= 3
  if (peerCount !== undefined && peerCount >= 3) {
    const activePeerDrop = await queryAll(
      `SELECT id FROM skynet.incidents 
       WHERE node_id = $1 AND type = 'peer_drop' AND status = 'active'`,
      [nodeId]
    );
    if (activePeerDrop.length > 0) {
      await queryAll(
        `UPDATE skynet.incidents 
         SET status = 'resolved', resolved_at = NOW(),
             description = description || E'\n\nAuto-resolved: peer count recovered to ' || $2
         WHERE node_id = $1 AND type = 'peer_drop' AND status = 'active'`,
        [nodeId, peerCount]
      );
      resolvedIncidents.push({
        type: 'peer_drop',
        details: `Peer count recovered to ${peerCount}`,
      });
    }
    // Also auto-resolve any open issues of type peer_drop (Issue #11)
    await queryAll(
      `UPDATE skynet.issues 
       SET status = 'resolved', resolved_at = NOW() 
       WHERE node_id = $1 AND type = 'peer_drop' AND status = 'open'`,
      [nodeId]
    );
  }

  // Resolve disk_pressure if disk < 80%
  if (body.system?.diskPercent !== undefined && body.system.diskPercent < 80) {
    const activeDiskPressure = await queryAll(
      `SELECT id FROM skynet.incidents 
       WHERE node_id = $1 AND type = 'disk_pressure' AND status = 'active'`,
      [nodeId]
    );
    if (activeDiskPressure.length > 0) {
      await queryAll(
        `UPDATE skynet.incidents 
         SET status = 'resolved', resolved_at = NOW(),
             description = description || E'\n\nAuto-resolved: disk usage dropped to ' || $2 || '%'
         WHERE node_id = $1 AND type = 'disk_pressure' AND status = 'active'`,
        [nodeId, body.system.diskPercent.toFixed(1)]
      );
      resolvedIncidents.push({
        type: 'disk_pressure',
        details: `Disk usage dropped to ${body.system.diskPercent.toFixed(1)}%`,
      });
    }
    // Also auto-resolve any open issues of type disk_critical (Issue #11)
    await queryAll(
      `UPDATE skynet.issues 
       SET status = 'resolved', resolved_at = NOW() 
       WHERE node_id = $1 AND type = 'disk_critical' AND status = 'open'`,
      [nodeId]
    );
  }

  // Resolve block_drift if caught up (< 100 blocks behind)
  if (blockHeight !== undefined && fleetMaxHeight > 0) {
    const drift = fleetMaxHeight - blockHeight;
    if (drift <= 100) {
      const activeDrift = await queryAll(
        `SELECT id FROM skynet.incidents 
         WHERE node_id = $1 AND type = 'block_drift' AND status = 'active'`,
        [nodeId]
      );
      if (activeDrift.length > 0) {
        await queryAll(
          `UPDATE skynet.incidents 
           SET status = 'resolved', resolved_at = NOW(),
               description = description || E'\n\nAuto-resolved: node caught up, drift now ' || $2 || ' blocks'
           WHERE node_id = $1 AND type = 'block_drift' AND status = 'active'`,
          [nodeId, drift]
        );
        resolvedIncidents.push({
          type: 'block_drift',
          details: `Node caught up, drift now ${drift} blocks`,
        });
      }
      // Also auto-resolve any open issues related to sync (Issue #11)
      await queryAll(
        `UPDATE skynet.issues 
         SET status = 'resolved', resolved_at = NOW() 
         WHERE node_id = $1 AND type IN ('sync_stall', 'bad_block') AND status = 'open'`,
        [nodeId]
      );
    }
  }

  // Get node info for alerts
  const nodeInfoResult = await queryAll(
    `SELECT id, name, ipv4, role FROM skynet.nodes WHERE id = $1`,
    [nodeId]
  );
  const nodeInfo = nodeInfoResult[0] || { id: nodeId, name: nodeId };

  // Create detected incidents and send alerts
  for (const incident of detectedIncidents) {
    // Check again if active incident exists (race condition protection)
    const existing = await queryAll(
      `SELECT id FROM skynet.incidents 
       WHERE node_id = $1 AND type = $2 AND status = 'active'`,
      [nodeId, incident.type]
    );
    
    if (existing.length > 0) {
      continue; // Skip if incident already exists
    }

    // Insert incident
    const incidentResult = await queryAll(
      `INSERT INTO skynet.incidents 
       (node_id, type, severity, title, description, auto_detected)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id`,
      [nodeId, incident.type, incident.severity, incident.title, incident.description]
    );

    const incidentId = incidentResult[0]?.id;

    // Send alert for critical/warning severity
    if (incidentId && (incident.severity === 'critical' || incident.severity === 'warning')) {
      deliverAlert(
        {
          id: incidentId,
          node_id: nodeId,
          type: incident.type,
          severity: incident.severity,
          title: incident.title,
          description: incident.description,
          detected_at: new Date().toISOString(),
          status: 'active',
        },
        nodeInfo,
        {
          blockHeight,
          peerCount,
          cpuPercent: body.system?.cpuPercent,
          diskPercent: body.system?.diskPercent,
          fleetMaxHeight,
        }
      ).catch(err => logger.error('Alert delivery failed', err));
    }
  }

  // Send resolution notifications for resolved incidents
  for (const resolved of resolvedIncidents) {
    // Get the resolved incident details
    const resolvedResult = await queryAll(
      `SELECT id, type, severity, title, description, detected_at
       FROM skynet.incidents 
       WHERE node_id = $1 AND type = $2 AND status = 'resolved'
       ORDER BY resolved_at DESC
       LIMIT 1`,
      [nodeId, resolved.type]
    );
    
    if (resolvedResult.length > 0) {
      const incident = resolvedResult[0];
      deliverResolution(
        {
          id: incident.id,
          node_id: nodeId,
          type: incident.type,
          severity: incident.severity,
          title: incident.title,
          description: incident.description,
          detected_at: incident.detected_at,
          status: 'resolved',
        },
        nodeInfo,
        resolved.details
      ).catch(err => logger.error('Resolution notification failed', err));
    }
  }

  // Invalidate relevant caches
  await invalidateByTag('metrics');
  if (detectedIncidents.length > 0) {
    await invalidateByTag('incidents');
  }

  // Fleet-wide node_down check (non-blocking)
  checkFleetNodeDown().catch(err => logger.error('Fleet node_down check failed', err));

  // Check for pending commands
  const commandsResult = await queryAll(
    `SELECT id, command, params, created_at 
     FROM skynet.command_queue 
     WHERE node_id = $1 AND status = 'pending'
     ORDER BY created_at ASC`,
    [nodeId]
  );

  // Mark commands as sent
  const commandIds = commandsResult.map(r => r.id);
  if (commandIds.length > 0) {
    await queryAll(
      `UPDATE skynet.command_queue 
       SET status = 'sent', sent_at = NOW() 
       WHERE id = ANY($1)`,
      [commandIds]
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      ok: true,
      commands: commandsResult.map(r => ({
        id: r.id,
        command: r.command,
        params: r.params,
      })),
    },
    incidentsDetected: detectedIncidents.length,
  });
}

export const POST = withErrorHandling(postHandler);
