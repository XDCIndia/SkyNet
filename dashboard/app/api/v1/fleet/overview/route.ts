import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
import { withErrorHandling } from '@/lib/errors';
import { withCache, CACHE_TTLS, generateCacheKey } from '@/lib/cache';
import { z } from 'zod';

// Client type colors for diversity chart
const CLIENT_COLORS: Record<string, string> = {
  geth: '#2563EB',      // Blue
  erigon: '#EA580C',    // Orange
  nethermind: '#7C3AED', // Purple
  'geth-pr5': '#2563EB', // Blue (same as geth)
  xdc: '#1E90FF',       // XDC Network official blue
  unknown: '#6B7280',   // Gray
};

// Client display names
const CLIENT_DISPLAY_NAMES: Record<string, string> = {
  geth: 'geth',
  erigon: 'Erigon',
  nethermind: 'NM',
  'geth-pr5': 'geth',
  xdc: 'XDC',           // XDC Binary v2.6.8+
  unknown: 'Unknown',
};

// Client icons
const CLIENT_ICONS: Record<string, string> = {
  geth: '🔷',
  erigon: '🔶',
  nethermind: '🟣',
  'geth-pr5': '🔷',
  xdc: '⚡',             // XDC Network lightning bolt
  unknown: '⚪',
};

// Query params schema
const FleetOverviewQuerySchema = z.object({
  network: z.enum(['all', 'mainnet', 'apothem', 'devnet', 'testnet']).default('all'),
});

/**
 * GET /api/v1/fleet/overview
 * Get fleet overview with client diversity stats and network breakdown
 */
async function getHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const params = FleetOverviewQuerySchema.parse({
    network: searchParams.get('network') || 'all',
  });

  const cacheKey = generateCacheKey('fleet', 'overview', params);
  
  const data = await withCache(cacheKey, async () => {
    // Base query for nodes with latest metrics
    let networkFilter = '';
    const queryParams: any[] = [];
    
    if (params.network !== 'all') {
      networkFilter = "AND n.network = $1";
      queryParams.push(params.network);
    }

    // Get latest metrics for all active nodes
    const nodeStatusRows = await queryAll(
      `WITH latest_metrics AS (
        SELECT DISTINCT ON (node_id)
          node_id,
          block_height,
          sync_percent,
          peer_count,
          is_syncing,
          cpu_percent,
          memory_percent,
          disk_percent,
          client_version,
          collected_at
        FROM skynet.node_metrics
        WHERE collected_at > NOW() - INTERVAL '5 minutes'
        ORDER BY node_id, collected_at DESC
      )
      SELECT
        n.id,
        n.name,
        n.host,
        n.role,
        n.is_active,
        n.created_at,
        n.email,
        n.telegram,
        n.client_type,
        n.node_type,
        n.sync_mode,
        n.network,
        n.chain_id,
        n.stalled,
        m.block_height,
        m.sync_percent,
        m.peer_count,
        m.is_syncing,
        m.cpu_percent,
        m.memory_percent,
        m.disk_percent,
        m.client_version as last_client_version,
        m.collected_at,
        CASE
          WHEN m.collected_at IS NULL OR m.collected_at < NOW() - INTERVAL '2 minutes' THEN 'offline'
          WHEN m.is_syncing = true OR m.sync_percent < 100 THEN 'syncing'
          WHEN m.peer_count < 3 OR m.cpu_percent > 90 OR m.disk_percent > 90 THEN 'degraded'
          ELSE 'healthy'
        END as status
      FROM skynet.nodes n
      LEFT JOIN latest_metrics m ON n.id = m.node_id
      WHERE n.is_active = true ${networkFilter}
      ORDER BY n.created_at DESC`,
      queryParams
    );

    // Get fleet max block height for sync % calculation
    const fleetMaxResult = await queryAll(
      `SELECT COALESCE(MAX(block_height), 0) as max_height
       FROM skynet.node_metrics
       WHERE collected_at > NOW() - INTERVAL '5 minutes'`
    );
    const fleetMaxBlock = parseInt(fleetMaxResult[0]?.max_height || '0');

    // Calculate client diversity stats
    const clientCounts: Record<string, number> = {};
    const networkCounts: Record<string, number> = {};
    const statusCounts = {
      healthy: 0,
      degraded: 0,
      syncing: 0,
      offline: 0,
    };

    for (const node of nodeStatusRows) {
      // Client type count
      const clientType = (node.client_type || 'unknown').toLowerCase();
      clientCounts[clientType] = (clientCounts[clientType] || 0) + 1;
      
      // Network count
      const network = node.network || 'mainnet';
      networkCounts[network] = (networkCounts[network] || 0) + 1;
      
      // Status count
      statusCounts[node.status as keyof typeof statusCounts]++;
    }

    // Build client distribution with colors
    const clientDistribution = Object.entries(clientCounts)
      .map(([type, count]) => ({
        type: CLIENT_DISPLAY_NAMES[type] || type,
        count,
        color: CLIENT_COLORS[type] || CLIENT_COLORS.unknown,
        icon: CLIENT_ICONS[type] || CLIENT_ICONS.unknown,
        percentage: Math.round((count / nodeStatusRows.length) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count);

    // Build network distribution
    const networkDistribution = Object.entries(networkCounts)
      .map(([network, count]) => ({
        network,
        count,
        percentage: Math.round((count / nodeStatusRows.length) * 1000) / 10,
      }))
      .sort((a, b) => b.count - a.count);

    // Get active incidents count
    const incidentRows = await queryAll(`
      SELECT severity, COUNT(*) as count
      FROM skynet.incidents
      WHERE status = 'active'
      GROUP BY severity
    `);

    const incidents = {
      critical: 0,
      warning: 0,
      info: 0,
      total: 0,
    };

    for (const row of incidentRows) {
      incidents[row.severity as keyof typeof incidents] = parseInt(row.count);
      incidents.total += parseInt(row.count);
    }

    // Calculate health score
    const totalNodes = nodeStatusRows.length || 1;
    const healthScore = Math.round(
      ((statusCounts.healthy * 100) +
       (statusCounts.syncing * 70) +
       (statusCounts.degraded * 40) +
       (statusCounts.offline * 0)) / totalNodes
    );

    // Mask sensitive values
    const mask = (val: string | null) => {
      if (!val) return null;
      if (val.length <= 4) return '*'.repeat(val.length);
      return val.slice(0, 2) + '*'.repeat(val.length - 4) + val.slice(-2);
    };

    // Build node list for frontend with sync progress
    const nodeList = nodeStatusRows.map((n: any) => {
      const nodeBlock = Number(n.block_height) || 0;
      const syncPercent = fleetMaxBlock > 0 && nodeBlock > 0
        ? Math.min(100, Math.round((nodeBlock / fleetMaxBlock) * 10000) / 100)
        : n.sync_percent ?? 0;
      
      // Determine sync color based on percentage
      let syncColor = 'red';
      if (syncPercent > 99) syncColor = 'green';
      else if (syncPercent >= 90) syncColor = 'yellow';
      
      return {
        id: n.id,
        name: n.name,
        host: n.host,
        role: n.role,
        isActive: n.is_active,
        createdAt: n.created_at,
        status: n.status,
        blockHeight: nodeBlock,
        fleetMaxBlock: fleetMaxBlock,
        syncPercent,
        syncColor,
        peerCount: n.peer_count ?? 0,
        cpuPercent: n.cpu_percent ?? 0,
        memoryPercent: n.memory_percent ?? 0,
        diskPercent: n.disk_percent ?? 0,
        lastSeen: n.collected_at || n.created_at,
        email: mask(n.email),
        telegram: mask(n.telegram),
        // Client info
        clientType: n.client_type || 'unknown',
        clientIcon: CLIENT_ICONS[(n.client_type || 'unknown').toLowerCase()] || CLIENT_ICONS.unknown,
        clientColor: CLIENT_COLORS[(n.client_type || 'unknown').toLowerCase()] || CLIENT_COLORS.unknown,
        nodeType: n.node_type || 'fullnode',
        syncMode: n.sync_mode || 'full',
        clientVersion: n.last_client_version || n.client_version || 'Unknown',
        // Network info
        network: n.network || 'mainnet',
        chainId: n.chain_id,
        // SkyOne stall detection
        stalled: n.stalled === true,
      };
    });

    return {
      healthScore,
      totalNodes,
      nodes: nodeList,
      nodeCounts: statusCounts,
      incidents,
      fleetMaxBlock,
      clientDistribution,
      networkDistribution,
      lastUpdated: new Date().toISOString(),
    };
  }, CACHE_TTLS.health);

  return NextResponse.json({
    success: true,
    data,
  });
}

export const GET = withErrorHandling(getHandler);
