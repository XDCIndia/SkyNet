import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, notFoundResponse } from '@/lib/auth';

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
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }

    const { id } = await params;

    // Verify node ownership (if using node-specific key)
    if (auth.nodeId && auth.nodeId !== id) {
      return NextResponse.json(
        { error: 'API key does not have access to this node', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Get node info
    const nodeResult = await query(
      `SELECT * FROM netown.nodes WHERE id = $1`,
      [id]
    );

    if (nodeResult.rows.length === 0) {
      return notFoundResponse('Node');
    }

    const node = nodeResult.rows[0];

    // Get latest metrics
    const metricsResult = await query(
      `SELECT * FROM netown.node_metrics 
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
        coinbase: latestMetrics?.coinbase,
        system: latestMetrics ? {
          cpuPercent: latestMetrics.cpu_percent,
          memoryPercent: latestMetrics.memory_percent,
          diskPercent: latestMetrics.disk_percent,
          diskUsedGb: latestMetrics.disk_used_gb,
          diskTotalGb: latestMetrics.disk_total_gb,
        } : null,
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
