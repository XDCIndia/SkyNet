import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { query } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth';

/**
 * GET /api/v1/fleet/status
 * Fleet overview for CLI tools
 * Returns all nodes, health score, active incidents
 * Auth: Bearer API key
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }

    // Get all nodes with latest metrics
    const nodesResult = await query(
      `SELECT 
        n.id,
        n.name,
        n.host,
        n.role,
        n.is_active,
        n.tags,
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
    const healthyNodes = nodes.filter(n => 
      n.is_active && 
      n.last_seen && 
      new Date(n.last_seen) > new Date(Date.now() - 5 * 60 * 1000)
    ).length;
    const syncingNodes = nodes.filter(n => n.is_syncing).length;
    const offlineNodes = totalNodes - healthyNodes;

    // Calculate overall health score
    const healthScore = totalNodes > 0 
      ? Math.round((healthyNodes / totalNodes) * 100) 
      : 0;

    return NextResponse.json({
      fleet: {
        totalNodes,
        healthyNodes,
        offlineNodes,
        syncingNodes,
        healthScore,
      },
      nodes: nodes.map(n => ({
        id: n.id,
        name: n.name,
        host: n.host,
        role: n.role,
        isActive: n.is_active,
        status: n.last_seen && new Date(n.last_seen) > new Date(Date.now() - 5 * 60 * 1000)
          ? (n.is_syncing ? 'syncing' : 'healthy')
          : 'offline',
        blockHeight: n.block_height,
        syncPercent: n.sync_percent,
        peerCount: n.peer_count,
        clientVersion: n.client_version,
        lastSeen: n.last_seen,
      })),
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
