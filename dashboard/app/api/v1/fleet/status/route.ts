import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
import { withErrorHandling } from '@/lib/errors';
import { withCache, CACHE_TTLS, generateCacheKey } from '@/lib/cache';
import { z } from 'zod';

// Parse OS info from client_version string
function parseOsFromVersion(clientVersion: string | null): string {
  if (!clientVersion) return 'unknown';
  const match = clientVersion.match(/\/(linux|darwin|windows)-/i);
  return match ? match[1].toLowerCase() : 'unknown';
}

function parseArchFromVersion(clientVersion: string | null): string {
  if (!clientVersion) return '';
  const match = clientVersion.match(/\/(?:linux|darwin|windows)-(amd64|arm64|x64|x86|386|armv7)/i);
  return match ? match[1].toLowerCase() : '';
}

// Build os_info from DB fields or parse from client_version
function parseOsInfo(n: any): { type: string; release: string; arch: string; kernel: string } {
  const cv = n.client_version || '';
  return {
    type: n.os_type || parseOsFromVersion(cv) || 'unknown',
    release: n.os_release || '',
    arch: n.os_arch || parseArchFromVersion(cv) || '',
    kernel: n.kernel_version || '',
  };
}

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
          os_type,
          os_release,
          os_arch,
          kernel_version,
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
      ),
      peak_metrics AS (
        SELECT
          node_id,
          MAX(block_height) as peak_block_height
        FROM skynet.node_metrics
        GROUP BY node_id
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
        n.docker_image,
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
        m.os_type,
        m.os_release,
        m.os_arch,
        m.kernel_version,
        m.stall_hours,
        m.stalled_at_block,
        m.collected_at,
        pm.prev_block_height,
        pk.peak_block_height,
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
      LEFT JOIN peak_metrics pk ON n.id = pk.node_id
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
       (statusCounts.syncing * 90) +
       (statusCounts.degraded * 40) +
       (statusCounts.offline * 0)) / totalNodes
    );

    // Mask sensitive values: show first 2 and last 2 chars
    const mask = (val: string | null) => {
      if (!val) return null;
      if (val.length <= 4) return '*'.repeat(val.length);
      return val.slice(0, 2) + '*'.repeat(val.length - 4) + val.slice(-2);
    };

    // Fetch actual chain tip from public RPCs for each network
    // OpenScan RPCs are primary (faster/more reliable), XinFin RPCs are fallback
    const networkHeights: Record<string, number> = {};
    const rpcEndpoints: Record<string, string[]> = {
      mainnet: [
        'https://rpc.xdc.network',        // XDC Official - Primary
        'https://rpc.openscan.ai/50',      // OpenScan - Fallback
        'https://erpc.xinfin.network'      // XinFin Extended - Fallback
      ],
      apothem: [
        'https://rpc.apothem.network',     // XDC Apothem - Primary
        'https://rpc.openscan.ai/51',      // OpenScan - Fallback
        'https://erpc.apothem.network'     // XinFin Extended - Fallback
      ],
    };

    for (const [network, rpcs] of Object.entries(rpcEndpoints)) {
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
            networkHeights[network] = parseInt(json.result, 16);
            break; // Got it, skip fallback RPC
          }
        } catch { /* try next RPC */ }
      }
    }

    // Fallback: use fleet max per network if RPC failed
    const fleetMaxByNetwork: Record<string, number> = {};
    for (const n of nodeStatusRows) {
      const net = (n.network || 'mainnet').toLowerCase();
      const block = Number(n.block_height) || 0;
      fleetMaxByNetwork[net] = Math.max(fleetMaxByNetwork[net] || 0, block);
    }

    // Use RPC height if available, otherwise fleet max
    const getNetworkHeight = (network: string): number => {
      const net = network.toLowerCase();
      return networkHeights[net] || fleetMaxByNetwork[net] || 1;
    };

    // Legacy: fleet-wide max for backward compat
    const maxBlock = Math.max(...nodeStatusRows.map((n: any) => Number(n.block_height) || 0), 1);

    // Build node list for frontend
    const nodeList = nodeStatusRows.map((n: any) => {
      const nodeBlock = Number(n.block_height) || 0;
      const nodeNetwork = (n.network || 'mainnet').toLowerCase();
      const netHeight = getNetworkHeight(nodeNetwork);
      const accurateSync = netHeight > 0
        ? Math.min(100, Math.round((nodeBlock / netHeight) * 10000) / 100)
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
      peakBlock: Number(n.peak_block_height) || 0,
      networkHeight: netHeight,
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
      dockerImage: n.docker_image || null,
      os_info: parseOsInfo(n),
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
      networkHeights: {
        mainnet: networkHeights['mainnet'] || fleetMaxByNetwork['mainnet'] || 0,
        apothem: networkHeights['apothem'] || fleetMaxByNetwork['apothem'] || 0,
      },
      lastUpdated: health?.collected_at || new Date().toISOString(),
    };
  }, CACHE_TTLS.health);

  return NextResponse.json({
    success: true,
    data,
  });
}

export const GET = withErrorHandling(getHandler);
