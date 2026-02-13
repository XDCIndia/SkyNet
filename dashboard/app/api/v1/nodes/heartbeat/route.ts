import { NextRequest, NextResponse } from 'next/server';
import { withTransaction, queryAll } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, hasPermission } from '@/lib/auth';
import { evaluateAndNotify, checkFleetNodeDown } from '@/lib/alert-engine';
import { HeartbeatSchema, validateBody, UUIDSchema } from '@/lib/validation';
import { withErrorHandling, ValidationError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { invalidateByTag } from '@/lib/cache';
import { z } from 'zod';

// Extended schema for heartbeat with additional fields
const ExtendedHeartbeatSchema = HeartbeatSchema.extend({
  syncProgress: z.number().min(0).max(100).optional(),
  peers: z.array(z.object({
    enode: z.string(),
    name: z.string().optional(),
    protocols: z.array(z.string()).optional(),
    direction: z.enum(['inbound', 'outbound']).optional(),
  })).optional(),
  txPool: z.object({
    pending: z.number().int().min(0).optional(),
    queued: z.number().int().min(0).optional(),
  }).optional(),
  coinbase: z.string().optional(),
  clientVersion: z.string().max(200).optional(),
  clientType: z.string().max(50).optional(),
  isMasternode: z.boolean().optional(),
  nodeType: z.enum(['masternode', 'standby', 'fullnode']).optional(),
  ipv4: z.string().ip({ version: 'v4' }).optional(),
  ipv6: z.string().ip({ version: 'v6' }).optional(),
  os: z.object({
    type: z.string().optional(),
    release: z.string().optional(),
    arch: z.string().optional(),
    kernel: z.string().optional(),
  }).optional(),
  masternodeStatus: z.string().optional(),
  security: z.object({
    score: z.number().int().min(0).max(100).optional(),
    issues: z.array(z.string()).optional(),
  }).optional(),
  rpcLatencyMs: z.number().int().min(0).optional(),
  timestamp: z.coerce.date().optional(),
});

/**
 * POST /api/v1/nodes/heartbeat
 * Node heartbeat + metrics push
 * Called every 30-60s by node-health-check.sh
 * Auth: Bearer API key
 * Response: { ok: true, commands?: [...] }
 */
async function postHandler(request: NextRequest) {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth.valid) {
    return unauthorizedResponse(auth.error);
  }

  // Check permission
  if (!hasPermission(auth, 'heartbeat')) {
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
    ipv4,
    ipv6,
    os,
    security,
    rpcLatencyMs,
    timestamp,
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
    // Insert node metrics with new fields
    await client.query(
      `INSERT INTO skynet.node_metrics 
       (node_id, block_height, sync_percent, peer_count, 
        cpu_percent, memory_percent, disk_percent, disk_used_gb, disk_total_gb,
        tx_pool_pending, tx_pool_queued, gas_price, rpc_latency_ms,
        is_syncing, client_version, client_type, node_type, coinbase, 
        collected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        nodeId,
        blockHeight ?? null,
        syncProgress ?? null,
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
           security_score = COALESCE($3, security_score)
       WHERE id = $1`,
      [nodeId, nodeType || null, security?.score ?? null]
    );
  });

  // === AUTO-INCIDENT DETECTION ===
  const detectedIncidents: Array<{ type: string; severity: 'critical' | 'warning' | 'info'; title: string; description: string }> = [];

  // 1. Sync Stall Detection
  if (blockHeight !== undefined && blockHeight !== null && prevMetrics.length >= 2) {
    const allSameHeight = prevMetrics.every(m => m.block_height === blockHeight);
    if (allSameHeight && blockHeight > 0) {
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
          description: `Block height (${blockHeight}) unchanged for 3+ heartbeats`,
        });
      }
    }
  }

  // 2. Peer Drop Detection
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

  // 3. Disk Pressure Detection
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
        description: `Disk usage at ${body.system.diskPercent.toFixed(1)}%`,
      });
    }
  }

  // 4. Block Drift Detection
  if (blockHeight !== undefined && fleetMaxHeight > 0 && blockHeight > 0) {
    const drift = fleetMaxHeight - blockHeight;
    if (drift > 100) {
      const existing = await queryAll(
        `SELECT id FROM skynet.incidents 
         WHERE node_id = $1 AND type = 'block_drift' AND status = 'active'`,
        [nodeId]
      );
      if (existing.length === 0) {
        detectedIncidents.push({
          type: 'block_drift',
          severity: drift > 1000 ? 'critical' : 'warning',
          title: 'Block height drift detected',
          description: `Node is ${drift} blocks behind fleet leader`,
        });
      }
    }
  }

  // Auto-resolve incidents when conditions improve
  // Resolve sync_stall if block height increased
  if (blockHeight !== undefined && prevMetrics.length > 0) {
    const prevHeight = prevMetrics[0]?.block_height;
    if (prevHeight && blockHeight > prevHeight) {
      await queryAll(
        `UPDATE skynet.incidents 
         SET status = 'resolved', resolved_at = NOW(), 
             description = description || E'\n\nAuto-resolved: block height increased to ' || $2
         WHERE node_id = $1 AND type = 'sync_stall' AND status = 'active'`,
        [nodeId, blockHeight]
      );
    }
  }

  // Resolve peer_drop if peers >= 3
  if (peerCount !== undefined && peerCount >= 3) {
    await queryAll(
      `UPDATE skynet.incidents 
       SET status = 'resolved', resolved_at = NOW(),
           description = description || E'\n\nAuto-resolved: peer count recovered to ' || $2
       WHERE node_id = $1 AND type = 'peer_drop' AND status = 'active'`,
      [nodeId, peerCount]
    );
  }

  // Resolve disk_pressure if disk < 80%
  if (body.system?.diskPercent !== undefined && body.system.diskPercent < 80) {
    await queryAll(
      `UPDATE skynet.incidents 
       SET status = 'resolved', resolved_at = NOW(),
           description = description || E'\n\nAuto-resolved: disk usage dropped to ' || $2 || '%'
       WHERE node_id = $1 AND type = 'disk_pressure' AND status = 'active'`,
      [nodeId, body.system.diskPercent.toFixed(1)]
    );
  }

  // Create detected incidents
  for (const incident of detectedIncidents) {
    const incidentResult = await queryAll(
      `INSERT INTO skynet.incidents 
       (node_id, type, severity, title, description, auto_detected)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id`,
      [nodeId, incident.type, incident.severity, incident.title, incident.description]
    );

    const incidentId = incidentResult[0]?.id;

    // Fire alert notifications (non-blocking)
    if (incidentId) {
      evaluateAndNotify(
        incidentId,
        nodeId,
        incident.type,
        incident.severity,
        incident.title,
        incident.description
      ).catch(err => logger.error('Alert notification failed', err));
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
