import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/fleet - Get fleet overview
export async function GET() {
  try {
    // Get fleet status with latest metrics
    const nodesResult = await query(`
      SELECT 
        n.id,
        n.name,
        n.host,
        n.role,
        n.location_city,
        n.location_country,
        n.is_active,
        m.block_height,
        m.sync_percent,
        m.peer_count,
        m.cpu_percent,
        m.memory_percent,
        m.disk_percent,
        m.rpc_latency_ms,
        m.is_syncing,
        m.collected_at as last_seen,
        CASE 
          WHEN m.peer_count = 0 OR m.rpc_latency_ms > 5000 THEN 'offline'
          WHEN m.sync_percent >= 99 AND m.peer_count >= 3 THEN 'online'
          ELSE 'degraded'
        END as status
      FROM skynet.nodes n
      LEFT JOIN LATERAL (
        SELECT * FROM skynet.node_metrics
        WHERE node_id = n.id
        ORDER BY collected_at DESC
        LIMIT 1
      ) m ON true
      WHERE n.is_active = true
      ORDER BY n.role, n.name
    `);

    // Get fleet-wide stats
    const statsResult = await query(`
      WITH latest_metrics AS (
        SELECT DISTINCT ON (node_id) 
          node_id, block_height, sync_percent, peer_count, rpc_latency_ms
        FROM skynet.node_metrics
        WHERE collected_at > NOW() - INTERVAL '5 minutes'
        ORDER BY node_id, collected_at DESC
      )
      SELECT 
        COUNT(*) as total_nodes,
        COUNT(*) FILTER (WHERE sync_percent >= 99 AND peer_count >= 3) as healthy_nodes,
        COUNT(*) FILTER (WHERE peer_count > 0 AND peer_count < 3 OR sync_percent < 99) as degraded_nodes,
        COUNT(*) FILTER (WHERE peer_count = 0 OR rpc_latency_ms > 5000) as offline_nodes,
        COALESCE(MAX(block_height), 0)::bigint as max_block_height,
        COALESCE(AVG(peer_count), 0)::int as avg_peers,
        COALESCE(AVG(sync_percent), 0)::numeric(5,2) as avg_sync
      FROM latest_metrics
    `);

    // Get active incidents count
    const incidentsResult = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'active') as active_count,
        COUNT(*) FILTER (WHERE status = 'active' AND severity = 'critical') as critical_count,
        COUNT(*) FILTER (WHERE status = 'active' AND severity = 'warning') as warning_count
      FROM skynet.incidents
    `);

    const stats = statsResult.rows[0];
    const incidents = incidentsResult.rows[0];

    // Calculate health score
    const healthScore = stats.total_nodes > 0 
      ? Math.round((parseInt(stats.healthy_nodes) / parseInt(stats.total_nodes)) * 100)
      : 0;

    return NextResponse.json({
      nodes: nodesResult.rows,
      stats: {
        totalNodes: parseInt(stats.total_nodes),
        healthyNodes: parseInt(stats.healthy_nodes),
        degradedNodes: parseInt(stats.degraded_nodes),
        offlineNodes: parseInt(stats.offline_nodes),
        maxBlockHeight: parseInt(stats.max_block_height),
        avgPeers: parseInt(stats.avg_peers),
        avgSync: parseFloat(stats.avg_sync),
        healthScore,
      },
      incidents: {
        active: parseInt(incidents.active_count),
        critical: parseInt(incidents.critical_count),
        warning: parseInt(incidents.warning_count),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching fleet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fleet data' },
      { status: 500 }
    );
  }
}
