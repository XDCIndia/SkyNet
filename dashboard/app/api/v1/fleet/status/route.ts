import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
import { withErrorHandling } from '@/lib/errors';
import { withCache, CACHE_TTLS, generateCacheKey } from '@/lib/cache';
import { z } from 'zod';

// Query params schema
const FleetStatusQuerySchema = z.object({
  includeMetrics: z.coerce.boolean().default(true),
});

/**
 * GET /api/v1/fleet/status
 * Get overall fleet health and status summary
 */
async function getHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const params = FleetStatusQuerySchema.parse({
    includeMetrics: searchParams.get('includeMetrics'),
  });

  const cacheKey = generateCacheKey('fleet', 'status', params);
  
  const data = await withCache(cacheKey, async () => {
    // Get latest health snapshot
    const healthRows = await queryAll(`
      SELECT * FROM skynet.network_health
      ORDER BY collected_at DESC
      LIMIT 1
    `);
    const health = healthRows[0];

    // Get node counts by status
    const nodeStatusRows = await queryAll(`
      WITH latest_metrics AS (
        SELECT DISTINCT ON (node_id)
          node_id,
          block_height,
          sync_percent,
          peer_count,
          is_syncing,
          cpu_percent,
          memory_percent,
          disk_percent,
          chain_data_size,
          database_size,
          storage_type,
          iops_estimate,
          client_version,
          stall_hours,
          stalled_at_block,
          collected_at
        FROM skynet.node_metrics
        WHERE collected_at > NOW() - INTERVAL '5 minutes'
        ORDER BY node_id, collected_at DESC
      ),
      prev_metrics AS (
        SELECT DISTINCT ON (node_id)
          node_id,
          block_height as prev_block_height,
          collected_at as prev_collected_at
        FROM skynet.node_metrics
        WHERE collected_at > NOW() - INTERVAL '10 minutes'
          AND collected_at < NOW() - INTERVAL '5 minutes'
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
        n.network,
        n.chain_id,
        n.sync_mode,
        n.ipv4,
        n.ipv6,
        m.block_height,
        m.sync_percent,
        m.peer_count,
        m.is_syncing,
        m.cpu_percent,
        m.memory_percent,
        m.disk_percent,
        m.chain_data_size,
        m.database_size,
        m.storage_type,
        m.iops_estimate,
        m.client_version,
        m.stall_hours,
        m.stalled_at_block,
        m.collected_at,
        pm.prev_block_height,
        CASE WHEN pm.prev_block_height IS NOT NULL AND m.block_height IS NOT NULL
          THEN m.block_height - pm.prev_block_height
          ELSE 0
        END as block_diff,
        CASE
          WHEN m.collected_at IS NULL OR m.collected_at < NOW() - INTERVAL '2 minutes' THEN 'offline'
          WHEN m.is_syncing = true OR m.sync_percent < 100 THEN 'syncing'
          WHEN m.peer_count < 3 OR m.cpu_percent > 90 OR m.disk_percent > 90 THEN 'degraded'
          ELSE 'healthy'
        END as status
      FROM skynet.nodes n
      LEFT JOIN latest_metrics m ON n.id = m.node_id
      LEFT JOIN prev_metrics pm ON n.id = pm.node_id
      WHERE n.is_active = true
    `);

    // Count by status
    const statusCounts = {
      healthy: 0,
      degraded: 0,
      syncing: 0,
      offline: 0,
    };

    for (const node of nodeStatusRows) {
      statusCounts[node.status as keyof typeof statusCounts]++;
    }

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

    // Mask sensitive values: show first 2 and last 2 chars
    const mask = (val: string | null) => {
      if (!val) return null;
      if (val.length <= 4) return '*'.repeat(val.length);
      return val.slice(0, 2) + '*'.repeat(val.length - 4) + val.slice(-2);
    };

    // Get network height for accurate sync percent
    const maxBlock = Math.max(...nodeStatusRows.map((n: any) => Number(n.block_height) || 0), 1);

    // Build node list for frontend
    const nodeList = nodeStatusRows.map((n: any) => {
      const nodeBlock = Number(n.block_height) || 0;
      const accurateSync = maxBlock > 0
        ? Math.min(100, Math.round((nodeBlock / maxBlock) * 10000) / 100)
        : n.sync_percent ?? 0;
      return {
      id: n.id,
      name: n.name,
      host: n.host,
      role: n.role,
      isActive: n.is_active,
      createdAt: n.created_at,
      status: n.status,
      blockHeight: nodeBlock,
      networkHeight: maxBlock,
      syncPercent: accurateSync,
      peerCount: n.peer_count ?? 0,
      cpuPercent: n.cpu_percent ?? 0,
      memoryPercent: n.memory_percent ?? 0,
      diskPercent: n.disk_percent ?? 0,
      lastSeen: n.collected_at || n.created_at,
      email: mask(n.email),
      telegram: mask(n.telegram),
      // Network info
      ipv4: n.ipv4 || null,
      ipv6: n.ipv6 || null,
      // New fields
      clientType: n.client_type || 'unknown',
      nodeType: n.node_type || 'fullnode',
      network: n.network || 'mainnet',
      chainId: n.chain_id || null,
      syncMode: n.sync_mode || 'full',
      chainDataSize: Number(n.chain_data_size) || 0,
      databaseSize: Number(n.database_size) || 0,
      storageType: n.storage_type || null,
      iopsEstimate: Number(n.iops_estimate) || 0,
      clientVersion: n.client_version || 'Unknown',
      stallHours: Number(n.stall_hours) || 0,
      stalledAtBlock: Number(n.stalled_at_block) || 0,
      // Block diff tracking
      prevBlock: Number(n.prev_block_height) || 0,
      blockDiff: Number(n.block_diff) || 0,
    };});

    return {
      healthScore,
      totalNodes,
      nodes: nodeList,
      nodeCounts: statusCounts,
      incidents,
      avgBlockHeight: health?.avg_block_height || 0,
      maxBlockHeight: health?.max_block_height || 0,
      nakamotoCoefficient: health?.nakamoto_coefficient || 0,
      avgSyncPercent: health?.avg_sync_percent || 0,
      avgRpcLatencyMs: health?.avg_rpc_latency_ms || 0,
      lastUpdated: health?.collected_at || new Date().toISOString(),
    };
  }, CACHE_TTLS.health);

  return NextResponse.json({
    success: true,
    data,
  });
}

export const GET = withErrorHandling(getHandler);
