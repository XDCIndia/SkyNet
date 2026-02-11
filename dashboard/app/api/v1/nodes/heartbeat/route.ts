import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, badRequestResponse, hasPermission } from '@/lib/auth';

/**
 * POST /api/v1/nodes/heartbeat
 * Node heartbeat + metrics push
 * Called every 30-60s by node-health-check.sh
 * Auth: Bearer API key
 * Response: { ok: true, commands?: [...] }
 * 
 * Also performs auto-incident detection:
 * - sync_stall: block height unchanged for 3+ heartbeats
 * - peer_drop: peers < 3
 * - disk_pressure: disk > 85%
 * - block_drift: node > 100 blocks behind fleet leader
 */
export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
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
      isMasternode,
      nodeType,
      ipv4,
      ipv6,
      os,
      masternodeStatus,
      system,
      rpcLatencyMs,
      timestamp,
    } = body;

    // Validation
    if (!nodeId) {
      return badRequestResponse('Missing required field: nodeId');
    }

    // Verify node ownership (if using node-specific key)
    if (auth.nodeId && auth.nodeId !== nodeId) {
      return NextResponse.json(
        { error: 'API key does not match nodeId', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Get previous metrics for comparison (for incident detection)
    const prevMetricsResult = await query(
      `SELECT block_height, peer_count, disk_percent, collected_at
       FROM netown.node_metrics 
       WHERE node_id = $1 
       ORDER BY collected_at DESC 
       LIMIT 3`,
      [nodeId]
    );
    const prevMetrics = prevMetricsResult.rows;

    // Get fleet max block height for drift detection
    const fleetMaxResult = await query(
      `SELECT COALESCE(MAX(block_height), 0) as max_height
       FROM netown.node_metrics
       WHERE collected_at > NOW() - INTERVAL '5 minutes'`
    );
    const fleetMaxHeight = parseInt(fleetMaxResult.rows[0]?.max_height || '0');

    // Store metrics and peers in transaction
    await withTransaction(async (client) => {
      // Insert node metrics with new fields
      await client.query(
        `INSERT INTO netown.node_metrics 
         (node_id, block_height, sync_percent, peer_count, 
          cpu_percent, memory_percent, disk_percent, disk_used_gb, disk_total_gb,
          tx_pool_pending, tx_pool_queued, gas_price, rpc_latency_ms,
          is_syncing, client_version, client_type, node_type, coinbase, 
          ipv4, ipv6, os_type, os_release, os_arch, kernel_version, collected_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)`,
        [
          nodeId,
          blockHeight ?? null,
          syncProgress ?? null,
          peerCount ?? null,
          system?.cpuPercent ?? null,
          system?.memoryPercent ?? null,
          system?.diskPercent ?? null,
          system?.diskUsedGb ?? null,
          system?.diskTotalGb ?? null,
          txPool?.pending ?? null,
          txPool?.queued ?? null,
          gasPrice ? BigInt(gasPrice) : null,
          rpcLatencyMs ?? null,
          syncing ?? false,
          clientVersion ?? null,
          clientType ?? null,
          nodeType ?? null,
          coinbase ?? null,
          ipv4 ?? null,
          ipv6 ?? null,
          os?.type ?? null,
          os?.release ?? null,
          os?.arch ?? null,
          os?.kernel ?? null,
          timestamp ? new Date(timestamp) : new Date(),
        ]
      );

      // Insert peer snapshots if provided
      if (peers && Array.isArray(peers) && peers.length > 0) {
        for (const peer of peers) {
          // Parse enode to extract IP
          const enodeMatch = peer.enode?.match(/@([^:]+):(\d+)/);
          const remoteIp = enodeMatch?.[1] || null;
          const remotePort = enodeMatch?.[2] ? parseInt(enodeMatch[2]) : null;

          await client.query(
            `INSERT INTO netown.peer_snapshots 
             (node_id, peer_enode, peer_name, remote_ip, remote_port, 
              client_version, protocols, direction, collected_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              nodeId,
              peer.enode || '',
              peer.name || null,
              remoteIp,
              remotePort,
              peer.name || null, // Using name as client_version fallback
              peer.protocols || [],
              peer.direction || null,
              new Date(),
            ]
          );
        }
      }

      // Update nodes table with latest info
      await client.query(
        `UPDATE netown.nodes 
         SET updated_at = NOW(),
             ipv4 = COALESCE($2, ipv4),
             ipv6 = COALESCE($3, ipv6),
             os_info = COALESCE($4, os_info),
             client_type = COALESCE($5, client_type),
             node_type = COALESCE($6, node_type),
             role = COALESCE($7, role)
         WHERE id = $1`,
        [
          nodeId,
          ipv4 ?? null,
          ipv6 ?? null,
          os ? JSON.stringify(os) : null,
          clientType ?? null,
          nodeType ?? null,
          nodeType === 'masternode' ? 'masternode' : nodeType === 'standby' ? 'standby' : null,
        ]
      );
    });

    // === AUTO-INCIDENT DETECTION ===
    const detectedIncidents: Array<{ type: string; severity: 'critical' | 'warning' | 'info'; title: string; description: string }> = [];

    // 1. Sync Stall Detection: block height unchanged for 3+ heartbeats
    if (blockHeight !== undefined && blockHeight !== null && prevMetrics.length >= 2) {
      const allSameHeight = prevMetrics.every(m => m.block_height === blockHeight);
      if (allSameHeight && blockHeight > 0) {
        // Check if we already have an active sync_stall incident
        const existingIncident = await query(
          `SELECT id FROM netown.incidents 
           WHERE node_id = $1 AND type = 'sync_stall' AND status = 'active'`,
          [nodeId]
        );
        if (existingIncident.rowCount === 0) {
          detectedIncidents.push({
            type: 'sync_stall',
            severity: 'warning',
            title: 'Block sync stalled',
            description: `Block height (${blockHeight}) unchanged for 3+ heartbeats`,
          });
        }
      }
    }

    // 2. Peer Drop Detection: peers < 3
    if (peerCount !== undefined && peerCount < 3) {
      const existingIncident = await query(
        `SELECT id FROM netown.incidents 
         WHERE node_id = $1 AND type = 'peer_drop' AND status = 'active'`,
        [nodeId]
      );
      if (existingIncident.rowCount === 0) {
        detectedIncidents.push({
          type: 'peer_drop',
          severity: peerCount === 0 ? 'critical' : 'warning',
          title: 'Low peer count',
          description: `Only ${peerCount} peer${peerCount !== 1 ? 's' : ''} connected (minimum: 3)`,
        });
      }
    }

    // 3. Disk Pressure Detection: disk > 85%
    if (system?.diskPercent !== undefined && system.diskPercent > 85) {
      const existingIncident = await query(
        `SELECT id FROM netown.incidents 
         WHERE node_id = $1 AND type = 'disk_pressure' AND status = 'active'`,
        [nodeId]
      );
      if (existingIncident.rowCount === 0) {
        detectedIncidents.push({
          type: 'disk_pressure',
          severity: system.diskPercent > 95 ? 'critical' : 'warning',
          title: 'High disk usage',
          description: `Disk usage at ${system.diskPercent.toFixed(1)}% (${system.diskUsedGb?.toFixed(1) || '?'}GB / ${system.diskTotalGb?.toFixed(1) || '?'}GB)`,
        });
      }
    }

    // 4. Block Drift Detection: node > 100 blocks behind fleet leader
    if (blockHeight !== undefined && fleetMaxHeight > 0 && blockHeight > 0) {
      const drift = fleetMaxHeight - blockHeight;
      if (drift > 100) {
        const existingIncident = await query(
          `SELECT id FROM netown.incidents 
           WHERE node_id = $1 AND type = 'block_drift' AND status = 'active'`,
          [nodeId]
        );
        if (existingIncident.rowCount === 0) {
          detectedIncidents.push({
            type: 'block_drift',
            severity: drift > 1000 ? 'critical' : 'warning',
            title: 'Block height drift detected',
            description: `Node is ${drift} blocks behind fleet leader (${blockHeight} vs ${fleetMaxHeight})`,
          });
        }
      }
    }

    // 5. Auto-resolve incidents when conditions improve
    // Resolve sync_stall if block height increased
    if (blockHeight !== undefined && prevMetrics.length > 0) {
      const prevHeight = prevMetrics[0]?.block_height;
      if (prevHeight && blockHeight > prevHeight) {
        await query(
          `UPDATE netown.incidents 
           SET status = 'resolved', resolved_at = NOW(), 
               description = description || E'\n\nAuto-resolved: block height increased to ' || $2
           WHERE node_id = $1 AND type = 'sync_stall' AND status = 'active'`,
          [nodeId, blockHeight]
        );
      }
    }

    // Resolve peer_drop if peers >= 3
    if (peerCount !== undefined && peerCount >= 3) {
      await query(
        `UPDATE netown.incidents 
         SET status = 'resolved', resolved_at = NOW(),
             description = description || E'\n\nAuto-resolved: peer count recovered to ' || $2
         WHERE node_id = $1 AND type = 'peer_drop' AND status = 'active'`,
        [nodeId, peerCount]
      );
    }

    // Resolve disk_pressure if disk < 80%
    if (system?.diskPercent !== undefined && system.diskPercent < 80) {
      await query(
        `UPDATE netown.incidents 
         SET status = 'resolved', resolved_at = NOW(),
             description = description || E'\n\nAuto-resolved: disk usage dropped to ' || $2 || '%'
         WHERE node_id = $1 AND type = 'disk_pressure' AND status = 'active'`,
        [nodeId, system.diskPercent.toFixed(1)]
      );
    }

    // Resolve block_drift if drift < 50
    if (blockHeight !== undefined && fleetMaxHeight > 0) {
      const drift = fleetMaxHeight - blockHeight;
      if (drift < 50) {
        await query(
          `UPDATE netown.incidents 
           SET status = 'resolved', resolved_at = NOW(),
               description = description || E'\n\nAuto-resolved: block drift reduced to ' || $2
           WHERE node_id = $1 AND type = 'block_drift' AND status = 'active'`,
          [nodeId, drift]
        );
      }
    }

    // Create detected incidents
    for (const incident of detectedIncidents) {
      await query(
        `INSERT INTO netown.incidents 
         (node_id, type, severity, title, description, auto_detected)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [nodeId, incident.type, incident.severity, incident.title, incident.description]
      );
      
      // TODO: Trigger alert notifications here
      // const alertRules = await query(
      //   `SELECT * FROM netown.alert_rules 
      //    WHERE type = $1 AND is_active = true 
      //    AND (node_id IS NULL OR node_id = $2)`,
      //   [incident.type, nodeId]
      // );
      // ... send notifications
    }

    // Check for pending commands
    const commandsResult = await query(
      `SELECT id, command, params, created_at 
       FROM netown.command_queue 
       WHERE node_id = $1 AND status = 'pending'
       ORDER BY created_at ASC`,
      [nodeId]
    );

    // Mark commands as sent
    const commandIds = commandsResult.rows.map(r => r.id);
    if (commandIds.length > 0) {
      await query(
        `UPDATE netown.command_queue 
         SET status = 'sent', sent_at = NOW() 
         WHERE id = ANY($1)`,
        [commandIds]
      );
    }

    return NextResponse.json({
      ok: true,
      commands: commandsResult.rows.map(r => ({
        id: r.id,
        command: r.command,
        params: r.params,
      })),
      incidentsDetected: detectedIncidents.length,
    });
  } catch (error: any) {
    console.error('Error processing heartbeat:', error);
    
    return NextResponse.json(
      { error: 'Failed to process heartbeat', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
