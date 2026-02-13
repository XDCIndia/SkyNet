import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/masternodes/[address]/node
 * Check if this masternode address matches any registered node's coinbase
 * Returns node health data if matched
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    
    // Normalize address: xdc → 0x
    let addr = address.toLowerCase();
    if (addr.startsWith('xdc')) {
      addr = '0x' + addr.slice(3);
    }

    // Find node with matching coinbase from latest metrics including new fields
    const result = await query(`
      SELECT DISTINCT ON (n.id)
        n.id,
        n.name,
        n.host,
        n.role,
        n.is_active,
        n.ipv4,
        n.ipv6,
        n.os_info,
        n.client_type,
        n.node_type,
        n.updated_at as last_seen,
        m.block_height,
        m.sync_percent,
        m.peer_count,
        m.cpu_percent,
        m.memory_percent,
        m.disk_percent,
        m.disk_used_gb,
        m.disk_total_gb,
        m.tx_pool_pending,
        m.tx_pool_queued,
        m.gas_price,
        m.rpc_latency_ms,
        m.is_syncing,
        m.client_version,
        m.coinbase,
        m.collected_at
      FROM skynet.nodes n
      JOIN skynet.node_metrics m ON m.node_id = n.id
      WHERE LOWER(m.coinbase) = $1
      ORDER BY n.id, m.collected_at DESC
    `, [addr]);

    if (result.rows.length === 0) {
      return NextResponse.json({ matched: false });
    }

    const node = result.rows[0];
    const lastSeen = new Date(node.last_seen);
    const now = new Date();
    const diffMs = now.getTime() - lastSeen.getTime();
    const diffMin = diffMs / 60000;

    let status = 'offline';
    if (diffMin < 2) status = 'healthy';
    else if (diffMin < 5) status = 'degraded';

    // Get recent incidents
    const incidents = await query(`
      SELECT type, severity, title, detected_at, status
      FROM skynet.incidents
      WHERE node_id = $1
      ORDER BY detected_at DESC
      LIMIT 5
    `, [node.id]);

    return NextResponse.json({
      matched: true,
      node: {
        id: node.id,
        name: node.name,
        host: node.host,
        role: node.role,
        status,
        lastSeen: node.last_seen,
        // New fields
        ipv4: node.ipv4,
        ipv6: node.ipv6,
        os_info: node.os_info,
        client_type: node.client_type,
        node_type: node.node_type,
        metrics: {
          blockHeight: node.block_height,
          syncPercent: node.sync_percent,
          peerCount: node.peer_count,
          cpuPercent: node.cpu_percent,
          memoryPercent: node.memory_percent,
          diskPercent: node.disk_percent,
          diskUsedGb: node.disk_used_gb,
          diskTotalGb: node.disk_total_gb,
          txPoolPending: node.tx_pool_pending,
          txPoolQueued: node.tx_pool_queued,
          gasPrice: node.gas_price,
          rpcLatencyMs: node.rpc_latency_ms,
          isSyncing: node.is_syncing,
          clientVersion: node.client_version,
        },
        incidents: incidents.rows,
      },
    });
  } catch (err) {
    console.error('Error matching masternode to node:', err);
    return NextResponse.json({ matched: false, error: 'Internal error' }, { status: 500 });
  }
}
