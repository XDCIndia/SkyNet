import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { query } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, isDashboardReadRequest } from '@/lib/auth';

/**
 * GET /api/v1/fleet/status
 * Fleet overview for CLI tools
 * Returns all nodes, health score, active incidents
 * Auth: Bearer API key
 */
export async function GET(request: NextRequest) {
  try {
    // Auth optional for same-origin dashboard calls, required for external
    const referer = request.headers.get('referer') || '';
    const isSameOrigin = referer.includes('net.xdc.network') || !request.headers.get('authorization');
    if (request.headers.get('authorization')) {
      const auth = await authenticateRequest(request);
      if (!auth.valid) {
        return unauthorizedResponse(auth.error);
      }
    }

    // Get all nodes with latest metrics including new fields
    const nodesResult = await query(
      `SELECT 
        n.id,
        n.name,
        n.host,
        n.role,
        n.is_active,
        n.tags,
        n.ipv4,
        n.ipv6,
        n.os_info,
        n.client_type,
        n.node_type,
        m.block_height,
        m.sync_percent,
        m.peer_count,
        m.cpu_percent,
        m.memory_percent,
        m.disk_percent,
        m.rpc_latency_ms,
        m.is_syncing,
        m.client_version,
        m.collected_at as last_seen
      FROM netown.nodes n
      LEFT JOIN LATERAL (
        SELECT * FROM netown.node_metrics
        WHERE node_id = n.id
        ORDER BY collected_at DESC
        LIMIT 1
      ) m ON true
      ORDER BY n.created_at DESC`
    );

    // Get active incidents count
    const incidentsResult = await query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'active' AND severity = 'critical') as critical,
        COUNT(*) FILTER (WHERE status = 'active' AND severity = 'warning') as warning,
        COUNT(*) FILTER (WHERE status = 'active' AND severity = 'info') as info,
        COUNT(*) as total_active
      FROM netown.incidents
      WHERE status = 'active'`
    );

    // Get latest network health
    const healthResult = await query(
      `SELECT * FROM netown.network_health
       ORDER BY collected_at DESC
       LIMIT 1`
    );

    // Calculate fleet stats
    const nodes = nodesResult.rows;
    const totalNodes = nodes.length;
    
    // Calculate mainnet head (max block height across healthy nodes)
    const healthyNodesList = nodes.filter(n => 
      n.is_active && 
      n.last_seen && 
      new Date(n.last_seen) > new Date(Date.now() - 2 * 60 * 1000)
    );
    const mainnetHead = Math.max(...healthyNodesList.map(n => n.block_height || 0).filter(Boolean), 0);
    
    const healthyNodes = healthyNodesList.length;
    const syncingNodes = nodes.filter(n => n.is_syncing).length;
    
    // Degraded = last seen 2-5 min ago
    const degradedNodes = nodes.filter(n => {
      if (!n.last_seen) return false;
      const diff = Date.now() - new Date(n.last_seen).getTime();
      return diff >= 2 * 60 * 1000 && diff < 5 * 60 * 1000;
    }).length;
    
    const offlineNodes = nodes.filter(n => {
      if (!n.last_seen) return true;
      const diff = Date.now() - new Date(n.last_seen).getTime();
      return diff >= 5 * 60 * 1000;
    }).length;

    // Calculate overall health score
    const healthScore = totalNodes > 0 
      ? Math.round((healthyNodes / totalNodes) * 100) 
      : 0;
    
    // Calculate total peers across all nodes
    const totalPeers = nodes.reduce((sum, n) => sum + (n.peer_count || 0), 0);

    return NextResponse.json({
      fleet: {
        totalNodes,
        healthyNodes,
        degradedNodes,
        offlineNodes,
        syncingNodes,
        healthScore,
        totalPeers,
        mainnetHead,
      },
      nodes: nodes.map(n => {
        const nodeStatus = n.last_seen 
          ? (new Date(n.last_seen) > new Date(Date.now() - 2 * 60 * 1000)
              ? (n.is_syncing ? 'syncing' : 'healthy')
              : new Date(n.last_seen) > new Date(Date.now() - 5 * 60 * 1000)
                ? 'degraded'
                : 'offline')
          : 'offline';
        const blocksBehind = n.block_height && mainnetHead > 0 ? mainnetHead - n.block_height : 0;
        
        return {
          id: n.id,
          name: n.name,
          host: n.host,
          role: n.role,
          isActive: n.is_active,
          status: nodeStatus,
          blockHeight: n.block_height,
          blocksBehind: blocksBehind > 0 ? blocksBehind : 0,
          syncPercent: n.sync_percent,
          peerCount: n.peer_count,
          cpuPercent: n.cpu_percent,
          memoryPercent: n.memory_percent,
          diskPercent: n.disk_percent,
          clientVersion: n.client_version,
          lastSeen: n.last_seen,
          // New fields
          ipv4: n.ipv4,
          ipv6: n.ipv6,
          os_info: n.os_info,
          client_type: n.client_type,
          node_type: n.node_type,
        };
      }),
      syncingNodes: nodes.filter(n => {
        const blocksBehind = n.block_height && mainnetHead > 0 ? mainnetHead - n.block_height : 0;
        return blocksBehind > 10;
      }).map(n => n.id),
      incidents: {
        critical: parseInt(incidentsResult.rows[0]?.critical || '0'),
        warning: parseInt(incidentsResult.rows[0]?.warning || '0'),
        info: parseInt(incidentsResult.rows[0]?.info || '0'),
        totalActive: parseInt(incidentsResult.rows[0]?.total_active || '0'),
      },
      networkHealth: healthResult.rows[0] || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching fleet status:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch fleet status', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
