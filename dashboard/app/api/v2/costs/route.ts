import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v2/costs
 *
 * Issue #72 — Cost Tracking
 *
 * Estimates running costs for the fleet:
 * - Storage cost: disk used (GB) × $0.05/month
 * - Bandwidth cost: estimated from peer count + block traffic
 * - Server count contribution
 *
 * Returns: per-node breakdown + fleet totals
 */

const STORAGE_COST_PER_GB_MONTH = 0.05;
const BANDWIDTH_COST_PER_GB_MONTH = 0.09; // typical cloud egress ~$0.09/GB
const ESTIMATED_BANDWIDTH_PER_PEER_GB_DAY = 0.5; // rough estimate

export async function GET(_req: NextRequest) {
  try {
    const nodesResult = await query(`
      SELECT
        n.id,
        n.name,
        n.client_type,
        n.network,
        nm.disk_used_gb,
        nm.disk_total_gb,
        nm.peer_count,
        nm.block_height,
        nm.collected_at
      FROM skynet.nodes n
      LEFT JOIN LATERAL (
        SELECT disk_used_gb, disk_total_gb, peer_count, block_height, collected_at
        FROM skynet.node_metrics
        WHERE node_id = n.id
        ORDER BY collected_at DESC
        LIMIT 1
      ) nm ON true
      WHERE n.is_active = true
      ORDER BY n.name
    `);

    const nodes = nodesResult.rows;
    const serverCount = nodes.length;

    let totalStorageGb = 0;
    let totalBandwidthGbMonth = 0;
    let totalStorageCost = 0;
    let totalBandwidthCost = 0;

    const perNode = nodes.map((node: Record<string, any>) => {
      const diskGb = Number(node.disk_used_gb ?? 0);
      const peers = Number(node.peer_count ?? 0);

      // Storage cost
      const storageCost = diskGb * STORAGE_COST_PER_GB_MONTH;

      // Bandwidth cost: peers × daily_bandwidth × 30 days
      const bandwidthGbMonth = peers * ESTIMATED_BANDWIDTH_PER_PEER_GB_DAY * 30;
      const bandwidthCost = bandwidthGbMonth * BANDWIDTH_COST_PER_GB_MONTH;

      const totalCost = storageCost + bandwidthCost;

      totalStorageGb += diskGb;
      totalBandwidthGbMonth += bandwidthGbMonth;
      totalStorageCost += storageCost;
      totalBandwidthCost += bandwidthCost;

      return {
        nodeId: node.id,
        name: node.name,
        clientType: node.client_type,
        network: node.network,
        diskUsedGb: diskGb,
        diskTotalGb: Number(node.disk_total_gb ?? 0),
        peerCount: peers,
        storageCostUsd: parseFloat(storageCost.toFixed(2)),
        bandwidthGbMonth: parseFloat(bandwidthGbMonth.toFixed(1)),
        bandwidthCostUsd: parseFloat(bandwidthCost.toFixed(2)),
        totalCostUsd: parseFloat(totalCost.toFixed(2)),
        lastUpdated: node.collected_at,
      };
    });

    const totalCost = totalStorageCost + totalBandwidthCost;

    // Cost breakdown by client type
    const byClient: Record<string, { nodes: number; storageCost: number; bandwidthCost: number; total: number }> = {};
    for (const n of perNode) {
      const ct = n.clientType ?? 'unknown';
      if (!byClient[ct]) byClient[ct] = { nodes: 0, storageCost: 0, bandwidthCost: 0, total: 0 };
      byClient[ct].nodes++;
      byClient[ct].storageCost += n.storageCostUsd;
      byClient[ct].bandwidthCost += n.bandwidthCostUsd;
      byClient[ct].total += n.totalCostUsd;
    }

    return NextResponse.json({
      success: true,
      summary: {
        serverCount,
        totalStorageGb: parseFloat(totalStorageGb.toFixed(1)),
        totalBandwidthGbMonth: parseFloat(totalBandwidthGbMonth.toFixed(1)),
        totalStorageCostUsd: parseFloat(totalStorageCost.toFixed(2)),
        totalBandwidthCostUsd: parseFloat(totalBandwidthCost.toFixed(2)),
        totalCostUsd: parseFloat(totalCost.toFixed(2)),
        monthlyEstimateUsd: parseFloat(totalCost.toFixed(2)),
        annualEstimateUsd: parseFloat((totalCost * 12).toFixed(2)),
        assumptions: {
          storagePerGb: STORAGE_COST_PER_GB_MONTH,
          bandwidthPerGb: BANDWIDTH_COST_PER_GB_MONTH,
          bandwidthPerPeerPerDay: ESTIMATED_BANDWIDTH_PER_PEER_GB_DAY,
        },
      },
      byClientType: Object.entries(byClient).map(([clientType, c]) => ({
        clientType,
        ...c,
        storageCost: parseFloat(c.storageCost.toFixed(2)),
        bandwidthCost: parseFloat(c.bandwidthCost.toFixed(2)),
        total: parseFloat(c.total.toFixed(2)),
      })),
      nodes: perNode,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
