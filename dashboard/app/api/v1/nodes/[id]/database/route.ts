import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { isDashboardReadRequest, authenticateRequest, unauthorizedResponse } from '@/lib/auth';

/**
 * GET /api/v1/nodes/:id/database
 * Returns current DB size + last 24h growth history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isDashboardReadRequest(request)) {
      const auth = await authenticateRequest(request);
      if (!auth.valid) return unauthorizedResponse(auth.error);
    }

    const { id } = await params;

    // Current DB metrics from latest heartbeat
    const currentResult = await query(
      `SELECT
         db_engine,
         db_total_size,
         db_chaindata_size,
         db_ancient_size,
         db_state_size,
         disk_total_gb,
         disk_used_gb,
         collected_at
       FROM skynet.node_metrics
       WHERE node_id = $1
         AND db_total_size IS NOT NULL
       ORDER BY collected_at DESC
       LIMIT 1`,
      [id]
    );

    // 24h history for growth chart
    const historyResult = await query(
      `SELECT
         recorded_at,
         total_size,
         chaindata_size,
         ancient_size
       FROM skynet.db_size_history
       WHERE node_id = $1
         AND recorded_at > NOW() - INTERVAL '7 days'
       ORDER BY recorded_at ASC`,
      [id]
    );

    const current = currentResult.rows[0] || null;
    const history = historyResult.rows;

    // Calculate growth rate (bytes/day) from last 2 data points
    let growthRatePerDay: number | null = null;
    let estDaysToFill: number | null = null;

    if (history.length >= 2) {
      const oldest = history[0];
      const newest = history[history.length - 1];
      const diffMs = new Date(newest.recorded_at).getTime() - new Date(oldest.recorded_at).getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays > 0 && newest.total_size && oldest.total_size) {
        growthRatePerDay = (newest.total_size - oldest.total_size) / diffDays;
      }
    }

    if (current && growthRatePerDay && growthRatePerDay > 0) {
      const diskTotalBytes = (current.disk_total_gb || 0) * 1024 * 1024 * 1024;
      const diskUsedBytes = (current.disk_used_gb || 0) * 1024 * 1024 * 1024;
      const diskFreeBytes = diskTotalBytes - diskUsedBytes;
      if (diskFreeBytes > 0) {
        estDaysToFill = Math.round(diskFreeBytes / growthRatePerDay);
      }
    }

    return NextResponse.json({
      current: current
        ? {
            dbEngine: current.db_engine,
            totalSize: current.db_total_size,
            chaindataSize: current.db_chaindata_size,
            ancientSize: current.db_ancient_size,
            stateSize: current.db_state_size,
            diskTotalGb: current.disk_total_gb,
            diskUsedGb: current.disk_used_gb,
            collectedAt: current.collected_at,
          }
        : null,
      history: history.map((h) => ({
        recordedAt: h.recorded_at,
        totalSize: h.total_size,
        chaindataSize: h.chaindata_size,
        ancientSize: h.ancient_size,
      })),
      growthRatePerDay,
      estDaysToFill,
    });
  } catch (error: any) {
    console.error('Database endpoint error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
