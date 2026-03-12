import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://gateway:gateway@localhost:5433/xdc_gateway'
});

export const dynamic = 'force-dynamic';

interface GapBlock {
  blockNumber: number;
  epochNumber: number;
  roundNumber: number | null;
  expectedProducer: string;
  expectedProducerXdc: string;
  actualProducer: string | null;
  actualProducerXdc: string | null;
  gapType: 'missed_turn' | 'late_block' | 'forked';
  timeToNextBlock: number | null;
  detectedAt: string;
}

interface GapBlockStats {
  totalGapBlocks: number;
  recentGapBlocks: GapBlock[];
  gapRate: number; // percentage of blocks that are gaps
  topOffenders: {
    address: string;
    xdcAddress: string;
    missedCount: number;
  }[];
  hourlyRate: {
    hour: string;
    count: number;
  }[];
}

/**
 * GET /api/v1/consensus/gap-blocks
 * Returns gap block (missed turns) tracking data
 */
export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const hours = parseInt(searchParams.get('hours') || '24');

    // Get recent gap blocks
    const gapsResult = await client.query(`
      SELECT 
        block_number,
        epoch_number,
        round_number,
        expected_producer,
        actual_producer,
        gap_type,
        time_to_next_block_ms,
        detected_at
      FROM skynet.gap_blocks
      WHERE detected_at > NOW() - INTERVAL '${hours} hours'
      ORDER BY block_number DESC
      LIMIT $1
    `, [limit]);

    // Get total gap block count
    const countResult = await client.query(`
      SELECT COUNT(*) as total
      FROM skynet.gap_blocks
      WHERE detected_at > NOW() - INTERVAL '${hours} hours'
    `);

    // Get top offenders
    const offendersResult = await client.query(`
      SELECT 
        expected_producer,
        COUNT(*) as missed_count
      FROM skynet.gap_blocks
      WHERE detected_at > NOW() - INTERVAL '${hours} hours'
      GROUP BY expected_producer
      ORDER BY missed_count DESC
      LIMIT 10
    `);

    // Get hourly rate
    const hourlyResult = await client.query(`
      SELECT 
        DATE_TRUNC('hour', detected_at) as hour,
        COUNT(*) as count
      FROM skynet.gap_blocks
      WHERE detected_at > NOW() - INTERVAL '${hours} hours'
      GROUP BY DATE_TRUNC('hour', detected_at)
      ORDER BY hour DESC
      LIMIT 24
    `);

    // Calculate gap rate based on expected blocks
    const totalBlocksResult = await client.query(`
      SELECT COUNT(DISTINCT block_height) as total
      FROM skynet.node_metrics
      WHERE block_height IS NOT NULL
        AND collected_at > NOW() - INTERVAL '${hours} hours'
    `);

    const totalGapBlocks = parseInt(countResult.rows[0]?.total || '0');
    const totalBlocks = parseInt(totalBlocksResult.rows[0]?.total || '1');
    const gapRate = totalBlocks > 0 ? (totalGapBlocks / totalBlocks) * 100 : 0;

    // Format gap blocks
    const recentGapBlocks: GapBlock[] = gapsResult.rows.map(row => {
      const toXdc = (addr: string | null) => {
        if (!addr) return null;
        return addr.startsWith('0x') ? addr.replace('0x', 'xdc') : addr;
      };

      return {
        blockNumber: parseInt(row.block_number),
        epochNumber: row.epoch_number,
        roundNumber: row.round_number,
        expectedProducer: row.expected_producer,
        expectedProducerXdc: toXdc(row.expected_producer) || '',
        actualProducer: row.actual_producer,
        actualProducerXdc: toXdc(row.actual_producer),
        gapType: row.gap_type,
        timeToNextBlock: row.time_to_next_block_ms,
        detectedAt: row.detected_at
      };
    });

    // Fallback to node_metrics gap detection if no gap_blocks table data
    if (recentGapBlocks.length === 0) {
      const fallbackResult = await client.query(`
        SELECT 
          block_height,
          epoch_number,
          round_number,
          block_producer,
          expected_block_producer,
          gap_block_detected,
          collected_at
        FROM skynet.node_metrics
        WHERE gap_block_detected = true
          AND collected_at > NOW() - INTERVAL '${hours} hours'
        ORDER BY collected_at DESC
        LIMIT $1
      `, [limit]);

      fallbackResult.rows.forEach(row => {
        const toXdc = (addr: string | null) => {
          if (!addr) return null;
          return addr.startsWith('0x') ? addr.replace('0x', 'xdc') : addr;
        };

        recentGapBlocks.push({
          blockNumber: parseInt(row.block_height),
          epochNumber: row.epoch_number,
          roundNumber: row.round_number,
          expectedProducer: row.expected_block_producer || 'unknown',
          expectedProducerXdc: toXdc(row.expected_block_producer) || 'unknown',
          actualProducer: row.block_producer,
          actualProducerXdc: toXdc(row.block_producer),
          gapType: 'missed_turn',
          timeToNextBlock: null,
          detectedAt: row.collected_at
        });
      });
    }

    const stats: GapBlockStats = {
      totalGapBlocks,
      recentGapBlocks,
      gapRate: parseFloat(gapRate.toFixed(2)),
      topOffenders: offendersResult.rows.map(row => ({
        address: row.expected_producer,
        xdcAddress: row.expected_producer.startsWith('0x') 
          ? row.expected_producer.replace('0x', 'xdc')
          : row.expected_producer,
        missedCount: parseInt(row.missed_count)
      })),
      hourlyRate: hourlyResult.rows.map(row => ({
        hour: row.hour,
        count: parseInt(row.count)
      }))
    };

    return NextResponse.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30'
      }
    });
  } catch (error: any) {
    console.error('Gap blocks error:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  } finally {
    client.release();
  }
}
