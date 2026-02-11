import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, badRequestResponse, hasPermission } from '@/lib/auth';

/**
 * POST /api/v1/nodes/heartbeat
 * Node heartbeat + metrics push
 * Called every 30-60s by node-health-check.sh
 * Auth: Bearer API key
 * Response: { ok: true, commands?: [...] }
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
      isMasternode,
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

    // Store metrics and peers in transaction
    await withTransaction(async (client) => {
      // Insert node metrics
      await client.query(
        `INSERT INTO netown.node_metrics 
         (node_id, block_height, sync_percent, peer_count, 
          cpu_percent, memory_percent, disk_percent, disk_used_gb, disk_total_gb,
          tx_pool_pending, tx_pool_queued, gas_price, rpc_latency_ms,
          is_syncing, client_version, coinbase, collected_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
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
          coinbase ?? null,
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

      // Update node last seen
      await client.query(
        `UPDATE netown.nodes SET updated_at = NOW() WHERE id = $1`,
        [nodeId]
      );
    });

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
    });
  } catch (error: any) {
    console.error('Error processing heartbeat:', error);
    
    return NextResponse.json(
      { error: 'Failed to process heartbeat', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
