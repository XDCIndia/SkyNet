import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * Epoch Boundary Monitoring API
 * 
 * Provides monitoring around XDPoS 2.0 epoch boundaries (every 900 blocks)
 * Issue #690
 * 
 * GET /api/v1/consensus/epoch-status
 */
export async function GET(request: NextRequest) {
  try {
    const EPOCH_LENGTH = 900;
    const GAP_START = 450;
    const GAP_END = 454;

    // Get latest block from metrics
    const blockResult = await query(`
      SELECT 
        (metrics->>'blockHeight')::bigint as block_height,
        (metrics->>'epoch')::int as epoch,
        collected_at
      FROM skynet.node_metrics
      WHERE collected_at > NOW() - INTERVAL '1 minute'
      ORDER BY (metrics->>'blockHeight')::bigint DESC
      LIMIT 1
    `);

    if (blockResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'No recent block data available' },
        { status: 404 }
      );
    }

    const currentBlock = parseInt(blockResult.rows[0].block_height);
    const currentEpoch = Math.floor(currentBlock / EPOCH_LENGTH);
    const nextEpoch = currentEpoch + 1;
    const blocksInEpoch = currentBlock % EPOCH_LENGTH;
    const blocksToNextEpoch = EPOCH_LENGTH - blocksInEpoch;
    const nextEpochBlock = nextEpoch * EPOCH_LENGTH;

    // Check if in gap period (blocks 450-454)
    const isGapPeriod = blocksInEpoch >= GAP_START && blocksInEpoch <= GAP_END;
    const isApproachingEpoch = blocksToNextEpoch <= 50;

    // Get masternode data
    const masternodeResult = await query(`
      SELECT 
        COUNT(*) as total_masternodes,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_masternodes
      FROM skynet.masternodes
      WHERE epoch = $1
    `, [currentEpoch]);

    const totalMasternodes = parseInt(masternodeResult.rows[0]?.total_masternodes) || 108;
    const activeMasternodes = parseInt(masternodeResult.rows[0]?.active_masternodes) || 108;

    // Calculate alert status
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

    // Calculate epoch progress
    const epochProgress = ((blocksInEpoch / EPOCH_LENGTH) * 100).toFixed(2);

    // Estimate time to next epoch (assuming 2-second block time)
    const estimatedSecondsToEpoch = blocksToNextEpoch * 2;
    const estimatedEpochTime = new Date(Date.now() + estimatedSecondsToEpoch * 1000);

    return NextResponse.json({
      current: {
        block: currentBlock,
        epoch: currentEpoch,
        blocks_in_epoch: blocksInEpoch,
        epoch_progress_percent: parseFloat(epochProgress),
      },
      next: {
        epoch: nextEpoch,
        block: nextEpochBlock,
        blocks_remaining: blocksToNextEpoch,
        estimated_time: estimatedEpochTime.toISOString(),
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
      timestamp: new Date().toISOString(),
    }, { status: 200 });

  } catch (error) {
    console.error('Epoch status error:', error);
    return NextResponse.json(
      { error: 'Failed to get epoch status' },
      { status: 500 }
    );
  }
}

/**
 * Monitor script for epoch boundaries
 * This would be run as a background job
 */
export async function monitorEpochBoundaries() {
  try {
    const response = await fetch('http://localhost:3000/api/v1/consensus/epoch-status');
    const data = await response.json();

    // Alert if approaching epoch boundary
    if (data.next.blocks_remaining <= 10) {
      console.log(`⚠️ Approaching epoch ${data.next.epoch} in ${data.next.blocks_remaining} blocks`);
      
      // Check masternode readiness
      if (data.masternodes.readiness_percent < 90) {
        console.error(`🚨 Low masternode readiness: ${data.masternodes.readiness_percent}%`);
        // TODO: Send alert notification
      }
    }

    // Alert during gap period
    if (data.gap.is_gap_period) {
      console.log(`📍 In gap period. Next block production in ${data.gap.gap_end_block - data.current.block} blocks`);
    }

  } catch (error) {
    console.error('Epoch monitoring error:', error);
  }
}
