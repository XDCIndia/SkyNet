import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, isDashboardReadRequest } from '@/lib/auth';

/**
 * GET /api/v1/network/health
 * Get aggregated network health metrics
 * Computes:
 * 1. Average block height across fleet
 * 2. Max block height
 * 3. Average sync percent
 * 4. Average RPC latency
 * 5. Nakamoto coefficient (simplified)
 * 6. Total network peers
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    if (!isDashboardReadRequest(request)) {
      const auth = await authenticateRequest(request);
      if (!auth.valid) {
        return unauthorizedResponse(auth.error);
      }
    }

    // Query latest metrics for all active nodes
    const metrics = await queryAll(`
      WITH latest AS (
        SELECT DISTINCT ON (node_id)
          node_id,
          block_height,
          peer_count,
          sync_percent,
          rpc_latency_ms,
          cpu_percent,
          is_syncing
        FROM skynet.node_metrics
        WHERE collected_at > NOW() - INTERVAL '5 minutes'
        ORDER BY node_id, collected_at DESC
      )
      SELECT * FROM latest
    `);

    if (metrics.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          totalNodes: 0,
          healthyNodes: 0,
          avgBlockHeight: 0,
          maxBlockHeight: 0,
          avgSyncPercent: 0,
          avgRpcLatencyMs: 0,
          totalPeers: 0,
          nakamotoCoefficient: 0,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Helper functions for calculations
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const max = (arr: number[]) => arr.length > 0 ? Math.max(...arr) : 0;
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

    // Compute aggregates
    const blockHeights = metrics.map(m => Number(m.block_height)).filter(Boolean);
    const syncPercents = metrics.map(m => m.sync_percent ?? 100).filter(Boolean);
    const rpcLatencies = metrics.map(m => m.rpc_latency_ms).filter(Boolean);
    const peerCounts = metrics.map(m => m.peer_count ?? 0);

    const avgBlock = Math.round(avg(blockHeights));
    const maxBlock = max(blockHeights);
    const avgSync = avg(syncPercents);
    const avgLatency = avg(rpcLatencies);
    const totalPeers = sum(peerCounts);

    // Count healthy nodes (synced, with peers, recently active)
    // Nodes that are actively syncing (is_syncing=true with block height > 0)
    // are not penalized — they are catching up and considered healthy
    const healthyNodes = metrics.filter(m => {
      const synced = (m.sync_percent ?? 100) >= 99;
      const hasPeers = (m.peer_count ?? 0) >= 1;
      const isActivelySyncing = m.is_syncing && (Number(m.block_height) > 0);
      return hasPeers && (synced || isActivelySyncing);
    }).length;

    // Nakamoto coefficient (simplified):
    // Sort nodes by peer_count desc, find minimum nodes needed for >50% of total peers
    const sorted = [...metrics].sort((a, b) => (b.peer_count ?? 0) - (a.peer_count ?? 0));
    let cumulative = 0;
    let nakamoto = 0;
    for (const m of sorted) {
      cumulative += (m.peer_count ?? 0);
      nakamoto++;
      if (cumulative > totalPeers / 2) break;
    }

    // Store results in network_health table
    await queryAll(`
      INSERT INTO skynet.network_health (
        health_score,
        total_nodes,
        healthy_nodes,
        degraded_nodes,
        offline_nodes,
        total_peers,
        avg_block_height,
        max_block_height,
        nakamoto_coefficient,
        avg_sync_percent,
        avg_rpc_latency_ms,
        collected_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    `, [
      Math.round((healthyNodes / metrics.length) * 100), // health_score
      metrics.length, // total_nodes
      healthyNodes, // healthy_nodes
      metrics.filter(m => (m.sync_percent ?? 100) < 99 && !(m.is_syncing && Number(m.block_height) > 0)).length, // degraded_nodes
      0, // offline_nodes (we only query recent metrics)
      totalPeers, // total_peers
      avgBlock, // avg_block_height
      maxBlock, // max_block_height
      nakamoto, // nakamoto_coefficient
      avgSync, // avg_sync_percent
      avgLatency, // avg_rpc_latency_ms
    ]);

    return NextResponse.json({
      success: true,
      data: {
        totalNodes: metrics.length,
        healthyNodes,
        avgBlockHeight: avgBlock,
        maxBlockHeight: maxBlock,
        avgSyncPercent: Number(avgSync.toFixed(2)),
        avgRpcLatencyMs: Number(avgLatency.toFixed(2)),
        totalPeers,
        nakamotoCoefficient: nakamoto,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error fetching network health:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch network health', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
