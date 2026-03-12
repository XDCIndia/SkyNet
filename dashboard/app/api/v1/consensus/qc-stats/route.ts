import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://gateway:gateway@localhost:5433/xdc_gateway'
});

export const dynamic = 'force-dynamic';

interface QCStats {
  latestBlock: number;
  latestQCValid: boolean;
  signatureCount: number;
  thresholdRequired: number;
  thresholdPercent: number;
  timeToQC: number; // milliseconds
  averageTimeToQC: number;
  qcRate: number; // percentage of valid QCs
  recentQCs: {
    blockNumber: number;
    valid: boolean;
    signatures: number;
    timeToQC: number;
  }[];
}

/**
 * GET /api/v1/consensus/qc-stats
 * Returns Quorum Certificate statistics
 */
export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    // Get latest QC metrics
    const latestResult = await client.query(`
      SELECT 
        block_number,
        qc_valid,
        signature_count,
        threshold_required,
        time_to_qc_ms,
        collected_at
      FROM skynet.qc_metrics
      ORDER BY block_number DESC
      LIMIT 1
    `);

    // Get recent QC metrics for statistics
    const recentResult = await client.query(`
      SELECT 
        block_number,
        qc_valid,
        signature_count,
        threshold_required,
        time_to_qc_ms
      FROM skynet.qc_metrics
      ORDER BY block_number DESC
      LIMIT $1
    `, [limit]);

    // Get average time to QC
    const avgResult = await client.query(`
      SELECT 
        AVG(time_to_qc_ms) as avg_time_to_qc,
        COUNT(*) FILTER (WHERE qc_valid = true) as valid_count,
        COUNT(*) as total_count
      FROM skynet.qc_metrics
      WHERE collected_at > NOW() - INTERVAL '1 hour'
    `);

    let stats: QCStats = {
      latestBlock: 0,
      latestQCValid: false,
      signatureCount: 0,
      thresholdRequired: 0,
      thresholdPercent: 0,
      timeToQC: 0,
      averageTimeToQC: 0,
      qcRate: 0,
      recentQCs: []
    };

    if (latestResult.rows.length > 0) {
      const latest = latestResult.rows[0];
      const avgData = avgResult.rows[0];
      
      stats = {
        latestBlock: parseInt(latest.block_number),
        latestQCValid: latest.qc_valid,
        signatureCount: latest.signature_count,
        thresholdRequired: latest.threshold_required,
        thresholdPercent: latest.threshold_required > 0 
          ? Math.round((latest.signature_count / latest.threshold_required) * 100)
          : 0,
        timeToQC: latest.time_to_qc_ms || 0,
        averageTimeToQC: avgData?.avg_time_to_qc 
          ? parseFloat(parseFloat(avgData.avg_time_to_qc).toFixed(2))
          : 0,
        qcRate: avgData?.total_count > 0
          ? Math.round((parseInt(avgData.valid_count) / parseInt(avgData.total_count)) * 100)
          : 0,
        recentQCs: recentResult.rows.map(r => ({
          blockNumber: parseInt(r.block_number),
          valid: r.qc_valid,
          signatures: r.signature_count,
          timeToQC: r.time_to_qc_ms || 0
        }))
      };
    }

    // Fallback to node_metrics if no qc_metrics data
    if (stats.latestBlock === 0) {
      const fallbackResult = await client.query(`
        SELECT 
          block_height,
          qc_valid,
          qc_signatures,
          qc_threshold,
          collected_at
        FROM skynet.node_metrics
        WHERE block_height IS NOT NULL AND qc_valid IS NOT NULL
        ORDER BY collected_at DESC
        LIMIT 1
      `);

      if (fallbackResult.rows.length > 0) {
        const row = fallbackResult.rows[0];
        stats = {
          ...stats,
          latestBlock: parseInt(row.block_height),
          latestQCValid: row.qc_valid,
          signatureCount: row.qc_signatures || 0,
          thresholdRequired: row.qc_threshold || 0,
          thresholdPercent: row.qc_threshold > 0
            ? Math.round((row.qc_signatures / row.qc_threshold) * 100)
            : 0
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=5'
      }
    });
  } catch (error: any) {
    console.error('QC stats error:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  } finally {
    client.release();
  }
}
