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
        tags, ipv4, ipv6, os_info, client_type, node_type
       FROM netown.nodes 
       WHERE id = $1`,
      [id]
    );

    if (nodeResult.rows.length === 0) {
      return notFoundResponse('Node');
    }

    const node = nodeResult.rows[0];

    // Get latest metrics with new fields
    const metricsResult = await query(
      `SELECT 
        block_height, is_syncing, sync_percent, peer_count,
        tx_pool_pending, tx_pool_queued, gas_price, client_version,
        coinbase, cpu_percent, memory_percent, disk_percent,
        disk_used_gb, disk_total_gb, rpc_latency_ms, collected_at,
        ipv4, ipv6, os_type, os_release, os_arch, kernel_version,
        client_type, node_type, security_score, security_issues
       FROM netown.node_metrics 
       WHERE node_id = $1 
       ORDER BY collected_at DESC 
       LIMIT 1`,
      [id]
    );

    // Get recent incidents
    const incidentsResult = await query(
      `SELECT id, type, severity, title, status, detected_at, resolved_at
       FROM netown.incidents 
       WHERE node_id = $1 AND status != 'resolved'
       ORDER BY detected_at DESC
       LIMIT 5`,
      [id]
    );

    // Get active peers count
    const peersResult = await query(
      `SELECT COUNT(*) as active_peers
       FROM netown.peer_snapshots 
       WHERE node_id = $1 
       AND collected_at > NOW() - INTERVAL '5 minutes'`,
      [id]
    );

    // Get pending commands count
    const commandsResult = await query(
      `SELECT COUNT(*) as pending_commands
       FROM netown.command_queue 
       WHERE node_id = $1 AND status = 'pending'`,
      [id]
    );

    const latestMetrics = metricsResult.rows[0] || null;

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
      },
      status: {
        blockHeight: latestMetrics?.block_height,
        isSyncing: latestMetrics?.is_syncing,
        syncPercent: latestMetrics?.sync_percent,
        peerCount: latestMetrics?.peer_count,
        activePeers: parseInt(peersResult.rows[0]?.active_peers || '0'),
        txPoolPending: latestMetrics?.tx_pool_pending,
        txPoolQueued: latestMetrics?.tx_pool_queued,
        gasPrice: latestMetrics?.gas_price?.toString(),
        clientVersion: latestMetrics?.client_version,
        clientType: latestMetrics?.client_type,
        nodeType: latestMetrics?.node_type,
        coinbase: latestMetrics?.coinbase,
        system: latestMetrics ? {
          cpuPercent: latestMetrics.cpu_percent,
          memoryPercent: latestMetrics.memory_percent,
          diskPercent: latestMetrics.disk_percent,
          diskUsedGb: latestMetrics.disk_used_gb,
          diskTotalGb: latestMetrics.disk_total_gb,
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
