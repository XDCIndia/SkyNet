import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { queryWithResilience } from '@/lib/db/resilient-client';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://gateway:gateway@localhost:5433/xdc_gateway'
});

export const dynamic = 'force-dynamic';

const EPOCH_LENGTH = 900; // XDC epoch = 900 blocks
const GAP_START = 450;
const GAP_END = 454;

interface EpochStatus {
  currentEpoch: number;
  currentBlock: number;
  blocksInEpoch: number;
  blocksRemaining: number;
  epochProgressPercent: number;
  epochStartBlock: number;
  epochEndBlock: number;
  estimatedTimeToNextEpoch: number; // seconds
  averageBlockTime: number; // seconds
  nextEpochStartTime: string; // ISO timestamp
}

/**
 * GET /api/v1/consensus/epoch-status
 * Returns current epoch information and progress
 * Merged: Enhanced epoch boundary monitoring (#690) + XDPoS 2.0 Consensus Dashboard (#693)
 */
export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    // Get the latest block from node_metrics (from #693)
    const blockResult = await client.query(`
      SELECT block_height, collected_at, 
        LAG(block_height) OVER (ORDER BY collected_at) as prev_height,
        LAG(collected_at) OVER (ORDER BY collected_at) as prev_time
      FROM skynet.node_metrics
      WHERE block_height IS NOT NULL
      ORDER BY collected_at DESC
      LIMIT 10
    `);

    if (blockResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No block data available'
      }, { status: 404 });
    }

    const latest = blockResult.rows[0];
    const currentBlock = parseInt(latest.block_height);
    const currentEpoch = Math.floor(currentBlock / EPOCH_LENGTH);
    const epochStartBlock = currentEpoch * EPOCH_LENGTH;
    const epochEndBlock = epochStartBlock + EPOCH_LENGTH - 1;
    const blocksInEpoch = currentBlock - epochStartBlock;
    const blocksRemaining = EPOCH_LENGTH - blocksInEpoch;
    const blocksToNextEpoch = blocksRemaining;
    const epochProgressPercent = (blocksInEpoch / EPOCH_LENGTH) * 100;
    const nextEpoch = currentEpoch + 1;
    const nextEpochBlock = nextEpoch * EPOCH_LENGTH;

    // Calculate average block time from recent samples (from #693)
    let totalBlockTime = 0;
    let sampleCount = 0;
    for (let i = 0; i < blockResult.rows.length - 1; i++) {
      const row = blockResult.rows[i];
      const prev = blockResult.rows[i + 1];
      if (row.prev_height && row.prev_time) {
        const blocksDiff = parseInt(row.block_height) - parseInt(row.prev_height);
        const timeDiff = new Date(row.collected_at).getTime() - new Date(row.prev_time).getTime();
        if (blocksDiff > 0 && timeDiff > 0) {
          totalBlockTime += timeDiff / blocksDiff / 1000;
          sampleCount++;
        }
      }
    }
    const averageBlockTime = sampleCount > 0 ? totalBlockTime / sampleCount : 2.0; // Default to 2s

    // Estimate time to next epoch
    const estimatedTimeToNextEpoch = blocksRemaining * averageBlockTime;
    const estimatedSecondsToEpoch = estimatedTimeToNextEpoch;
    const estimatedEpochTime = new Date(Date.now() + estimatedSecondsToEpoch * 1000);
    const nextEpochStartTime = estimatedEpochTime.toISOString();

    // Check if in gap period (from #690)
    const isGapPeriod = blocksInEpoch >= GAP_START && blocksInEpoch <= GAP_END;
    const isApproachingEpoch = blocksToNextEpoch <= 50;

    // Get masternode data (from #690)
    const masternodeResult = await query(`
      SELECT 
        COUNT(*) as total_masternodes,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_masternodes
      FROM skynet.masternodes
      WHERE epoch = $1
    `, [currentEpoch]);

    const totalMasternodes = parseInt(masternodeResult.rows[0]?.total_masternodes) || 108;
    const activeMasternodes = parseInt(masternodeResult.rows[0]?.active_masternodes) || 108;

    // Calculate alert status (from #690)
    const alerts = [];
    
    if (isGapPeriod) {
      alerts.push({
        type: 'gap_period',
        severity: 'info',
        message: 'Currently in gap period - no block production',
        blocks_remaining: GAP_END - blocksInEpoch + 1,
      });
    }

    if (isApproachingEpoch && activeMasternodes < totalMasternodes * 0.9) {
      alerts.push({
        type: 'low_masternode_readiness',
        severity: 'warning',
        message: `Only ${activeMasternodes}/${totalMasternodes} masternodes ready for next epoch`,
      });
    }

    const status: EpochStatus = {
      currentEpoch,
      currentBlock,
      blocksInEpoch,
      blocksRemaining,
      epochProgressPercent: parseFloat(epochProgressPercent.toFixed(2)),
      epochStartBlock,
      epochEndBlock,
      estimatedTimeToNextEpoch: Math.round(estimatedTimeToNextEpoch),
      averageBlockTime: parseFloat(averageBlockTime.toFixed(3)),
      nextEpochStartTime
    };

    return NextResponse.json({
      success: true,
      data: {
        ...status,
        current: {
          block: currentBlock,
          epoch: currentEpoch,
          blocks_in_epoch: blocksInEpoch,
          epoch_progress_percent: parseFloat(epochProgressPercent.toFixed(2)),
        },
        next: {
          epoch: nextEpoch,
          block: nextEpochBlock,
          blocks_remaining: blocksToNextEpoch,
          estimated_time: nextEpochStartTime,
          estimated_seconds: estimatedSecondsToEpoch,
        },
        gap: {
          is_gap_period: isGapPeriod,
          gap_start_block: currentEpoch * EPOCH_LENGTH + GAP_START,
          gap_end_block: currentEpoch * EPOCH_LENGTH + GAP_END,
        },
        masternodes: {
          total: totalMasternodes,
          active: activeMasternodes,
          readiness_percent: Math.round((activeMasternodes / totalMasternodes) * 100),
        },
        alerts,
      },
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=5'
      }
    });
  } catch (error: any) {
    console.error('Epoch status error:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  } finally {
    client.release();
  }
}

/**
 * Monitor script for epoch boundaries
 * This would be run as a background job (from #690)
 */
export async function monitorEpochBoundaries() {
  try {
    const response = await fetch('http://localhost:3000/api/v1/consensus/epoch-status');
    const data = await response.json();

    // Alert if approaching epoch boundary
    if (data.data?.next?.blocks_remaining <= 10) {
      console.log(`⚠️ Approaching epoch ${data.data.next.epoch} in ${data.data.next.blocks_remaining} blocks`);
      
      // Check masternode readiness
      if (data.data.masternodes?.readiness_percent < 90) {
        console.error(`🚨 Low masternode readiness: ${data.data.masternodes.readiness_percent}%`);
        // TODO: Send alert notification
      }
    }

    // Alert during gap period
    if (data.data?.gap?.is_gap_period) {
      console.log(`📍 In gap period. Next block production in ${data.data.gap.gap_end_block - data.data.current.block} blocks`);
    }

  } catch (error) {
    console.error('Epoch monitoring error:', error);
  }
}
