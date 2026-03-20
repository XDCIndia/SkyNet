import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, isDashboardReadRequest, notFoundResponse } from '@/lib/auth';

/**
 * GET /api/v1/nodes/[id]/status
 * Node status for CLI tools
 * Called by `xdc status` command
 * Returns full node status from DB
 * Auth: Bearer API key
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate request (optional for dashboard GET)
    let auth: { valid: boolean; nodeId?: string; permissions?: string[]; error?: string } = { valid: true };
    if (!isDashboardReadRequest(request)) {
      auth = await authenticateRequest(request);
      if (!auth.valid) {
        return unauthorizedResponse(auth.error);
      }
    }

    const { id } = await params;

    // Verify node ownership (if using node-specific key)
    if (auth.nodeId && auth.nodeId !== id) {
      return NextResponse.json(
        { error: 'API key does not have access to this node', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Get node info with new fields
    const nodeResult = await query(
      `SELECT 
        id, name, host, role, is_active, created_at, updated_at,
        location_city, location_country, location_lat, location_lng,
        tags, ipv4, ipv6, os_info, client_type, node_type, sync_mode, network,
        docker_image, startup_params, state_scheme,
        db_engine, db_total_size, db_chaindata_size, db_ancient_size
       FROM skynet.nodes 
       WHERE id = $1`,
      [id]
    );

    if (nodeResult.rows.length === 0) {
      return notFoundResponse('Node');
    }

    const node = nodeResult.rows[0];

    // Get latest metrics with new fields (including sentries for Issue #14)
    const metricsResult = await query(
      `SELECT 
        block_height, is_syncing, sync_percent, peer_count,
        tx_pool_pending, tx_pool_queued, gas_price, client_version,
        coinbase, cpu_percent, memory_percent, disk_percent,
        disk_used_gb, disk_total_gb, rpc_latency_ms, collected_at,
        ipv4, ipv6, os_type, os_release, os_arch, kernel_version,
        client_type, node_type, security_score, security_issues,
        chain_data_size, database_size, storage_type, storage_model, iops_estimate, mount_point, mount_percent, sentries,
        consensus_epoch, consensus_round, consensus_v2, epoch_progress, chain_id
       FROM skynet.node_metrics 
       WHERE node_id = $1 
       ORDER BY collected_at DESC 
       LIMIT 1`,
      [id]
    );

    // Get recent incidents
    const incidentsResult = await query(
      `SELECT id, type, severity, title, status, detected_at, resolved_at
       FROM skynet.incidents 
       WHERE node_id = $1 AND status != 'resolved'
       ORDER BY detected_at DESC
       LIMIT 5`,
      [id]
    );

    // Get active peers count
    const peersResult = await query(
      `SELECT COUNT(*) as active_peers
       FROM skynet.peer_snapshots 
       WHERE node_id = $1 
       AND collected_at > NOW() - INTERVAL '5 minutes'`,
      [id]
    );

    // Get pending commands count
    const commandsResult = await query(
      `SELECT COUNT(*) as pending_commands
       FROM skynet.command_queue 
       WHERE node_id = $1 AND status = 'pending'`,
      [id]
    );

    const latestMetrics = metricsResult.rows[0] || null;

    // Get network height from public RPCs (OpenScan primary, XinFin fallback)
    // Then fall back to fleet max if RPCs fail
    const nodeNetwork = (node.network || 'mainnet').toLowerCase();
    let networkHeight = 0;
    
    const rpcEndpoints: Record<string, string[]> = {
      mainnet: ['https://rpc.openscan.ai/50', 'https://rpc.xinfin.network'],
      apothem: ['https://rpc.openscan.ai/51', 'https://rpc.apothem.network'],
    };
    
    const rpcs = rpcEndpoints[nodeNetwork] || rpcEndpoints['mainnet'];
    for (const rpc of rpcs) {
      try {
        const resp = await fetch(rpc, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', id: 1 }),
          signal: AbortSignal.timeout(3000),
        });
        const json = await resp.json();
        if (json.result) {
          networkHeight = parseInt(json.result, 16);
          break;
        }
      } catch { /* try next RPC */ }
    }
    
    // Fallback to fleet max if all RPCs failed
    if (networkHeight === 0) {
      const networkHeightResult = await query(
        `SELECT COALESCE(MAX(block_height), 0) as network_height
         FROM skynet.node_metrics
         WHERE collected_at > NOW() - INTERVAL '5 minutes'`
      );
      networkHeight = parseInt(networkHeightResult.rows[0]?.network_height || '0');
    }

    // Recalculate accurate sync percent
    const nodeBlock = parseInt(latestMetrics?.block_height || '0', 10);
    const accurateSyncPercent = networkHeight > 0
      ? Math.min(100, Math.round((nodeBlock / networkHeight) * 10000) / 100)
      : latestMetrics?.sync_percent ?? 0;

    return NextResponse.json({
      node: {
        id: node.id,
        name: node.name,
        host: node.host,
        role: node.role,
        isActive: node.is_active,
        createdAt: node.created_at,
        updatedAt: node.updated_at,
        location: node.location_city ? {
          city: node.location_city,
          country: node.location_country,
          lat: node.location_lat,
          lng: node.location_lng,
        } : null,
        tags: node.tags,
        // New fields
        ipv4: node.ipv4,
        ipv6: node.ipv6,
        os_info: node.os_info,
        client_type: node.client_type,
        node_type: node.node_type,
        sync_mode: node.sync_mode,
        security_score: node.security_score,
        security_issues: node.security_issues,
        docker_image: node.docker_image,
        startup_params: node.startup_params,
        state_scheme: node.state_scheme,
      },
      status: {
        blockHeight: parseInt(latestMetrics?.block_height || '0', 10),
        networkHeight,
        isSyncing: accurateSyncPercent < 99.9,
        syncPercent: accurateSyncPercent,
        peerCount: latestMetrics?.peer_count,
        activePeers: parseInt(peersResult.rows[0]?.active_peers || '0'),
        txPoolPending: latestMetrics?.tx_pool_pending,
        txPoolQueued: latestMetrics?.tx_pool_queued,
        gasPrice: latestMetrics?.gas_price?.toString(),
        clientVersion: latestMetrics?.client_version,
        clientType: latestMetrics?.client_type,
        nodeType: latestMetrics?.node_type,
        syncMode: node.sync_mode,
        coinbase: latestMetrics?.coinbase,
        system: latestMetrics ? {
          cpuPercent: latestMetrics.cpu_percent,
          memoryPercent: latestMetrics.memory_percent,
          diskPercent: latestMetrics.disk_percent,
          diskUsedGb: latestMetrics.disk_used_gb,
          diskTotalGb: latestMetrics.disk_total_gb,
        } : null,
        storage: latestMetrics ? {
          chainDataSize: latestMetrics.chain_data_size,
          databaseSize: latestMetrics.database_size,
          storageType: latestMetrics.storage_type,
          storageModel: latestMetrics.storage_model,
          iopsEstimate: latestMetrics.iops_estimate,
          mountPoint: latestMetrics.mount_point,
          mountPercent: latestMetrics.mount_percent,
        } : null,
        os: latestMetrics ? {
          type: latestMetrics.os_type,
          release: latestMetrics.os_release,
          arch: latestMetrics.os_arch,
          kernel: latestMetrics.kernel_version,
        } : null,
        ipv4: latestMetrics?.ipv4,
        ipv6: latestMetrics?.ipv6,
        security: {
          score: latestMetrics?.security_score,
          issues: latestMetrics?.security_issues,
        },
        rpcLatencyMs: latestMetrics?.rpc_latency_ms,
        lastSeen: latestMetrics?.collected_at,
        // Erigon dual sentry monitoring (Issue #14)
        sentries: latestMetrics?.sentries,
        // Docker image from nodes table
        dockerImage: node.docker_image,
        // Database deep-dive metrics (from nodes table, updated every ~5 min)
        database: (node.db_total_size) ? {
          engine: node.db_engine,
          totalSize: node.db_total_size,
          chaindata: node.db_chaindata_size,
          ancient: node.db_ancient_size,
        } : null,
        // XDPoS consensus data
        consensus: latestMetrics ? {
          epoch: latestMetrics.consensus_epoch,
          epochProgress: latestMetrics.epoch_progress,
          v2Active: latestMetrics.consensus_v2,
          round: latestMetrics.consensus_round,
          chainId: latestMetrics.chain_id,
        } : null,
      },
      incidents: {
        active: incidentsResult.rows,
        count: incidentsResult.rows.length,
      },
      commands: {
        pending: parseInt(commandsResult.rows[0]?.pending_commands || '0'),
      },
    });
  } catch (error: any) {
    console.error('Error fetching node status:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch node status', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
