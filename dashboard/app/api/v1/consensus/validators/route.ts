import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://gateway:gateway@localhost:5433/xdc_gateway'
});

export const dynamic = 'force-dynamic';

interface Validator {
  address: string;
  xdcAddress: string;
  status: 'active' | 'standby' | 'penalized';
  rank?: number;
  stake?: string;
  uptimePercent?: number;
  blocksProduced: number;
  blocksExpected: number;
  blockProductionRate: number;
  votesParticipated: number;
  votesExpected: number;
  voteParticipationPercent: number;
  qcContributions: number;
  qcContributionPercent: number;
  missedBlocks: number;
  gapBlocks: number;
  overallScore: number;
  lastSeen: string;
}

/**
 * GET /api/v1/consensus/validators
 * Returns validator list with performance metrics
 */
export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const filter = searchParams.get('filter') || 'all'; // active, standby, penalized, all
    const epoch = parseInt(searchParams.get('epoch') || '0'); // 0 = current

    // Get current epoch if not specified
    let targetEpoch = epoch;
    if (targetEpoch === 0) {
      const epochResult = await client.query(`
        SELECT DISTINCT epoch_number 
        FROM skynet.node_metrics 
        WHERE epoch_number IS NOT NULL 
        ORDER BY collected_at DESC 
        LIMIT 1
      `);
      if (epochResult.rows.length > 0) {
        targetEpoch = epochResult.rows[0].epoch_number;
      }
    }

    // Get validators from masternode_snapshots
    let statusFilter = '';
    const params: any[] = [targetEpoch];
    if (filter !== 'all') {
      statusFilter = `AND status = $${params.length + 1}`;
      params.push(filter);
    }

    const validatorResult = await client.query(`
      SELECT DISTINCT ON (address)
        address,
        status,
        epoch,
        stake_xdc,
        collected_at
      FROM skynet.masternode_snapshots
      WHERE epoch = $1 ${statusFilter}
      ORDER BY address, collected_at DESC
      LIMIT ${limit}
    `, params);

    // Get performance metrics for these validators
    const addresses = validatorResult.rows.map(r => r.address.toLowerCase());
    
    let performanceData: any[] = [];
    if (addresses.length > 0) {
      const perfResult = await client.query(`
        SELECT DISTINCT ON (address)
          address,
          uptime_percent,
          blocks_produced,
          blocks_expected,
          block_production_rate,
          votes_participated,
          votes_expected,
          vote_participation_percent,
          qc_contributions,
          qc_contribution_percent,
          missed_blocks,
          gap_blocks_created,
          overall_score,
          calculated_at
        FROM skynet.validator_performance
        WHERE address = ANY($1) AND epoch_number = $2
        ORDER BY address, calculated_at DESC
      `, [addresses, targetEpoch]);
      performanceData = perfResult.rows;
    }

    // Merge validator data with performance metrics
    const validators: Validator[] = validatorResult.rows.map((v, index) => {
      const perf = performanceData.find(p => p.address.toLowerCase() === v.address.toLowerCase());
      const xdcAddress = v.address.startsWith('0x') 
        ? v.address.replace('0x', 'xdc')
        : v.address;

      return {
        address: v.address.toLowerCase(),
        xdcAddress: xdcAddress.toLowerCase(),
        status: v.status,
        rank: index + 1,
        stake: v.stake_xdc ? parseFloat(v.stake_xdc).toFixed(2) : undefined,
        uptimePercent: perf?.uptime_percent ? parseFloat(perf.uptime_percent.toFixed(2)) : undefined,
        blocksProduced: perf?.blocks_produced || 0,
        blocksExpected: perf?.blocks_expected || 0,
        blockProductionRate: perf?.block_production_rate ? parseFloat(perf.block_production_rate.toFixed(2)) : 0,
        votesParticipated: perf?.votes_participated || 0,
        votesExpected: perf?.votes_expected || 0,
        voteParticipationPercent: perf?.vote_participation_percent ? parseFloat(perf.vote_participation_percent.toFixed(2)) : 0,
        qcContributions: perf?.qc_contributions || 0,
        qcContributionPercent: perf?.qc_contribution_percent ? parseFloat(perf.qc_contribution_percent.toFixed(2)) : 0,
        missedBlocks: perf?.missed_blocks || 0,
        gapBlocks: perf?.gap_blocks_created || 0,
        overallScore: perf?.overall_score || 0,
        lastSeen: v.collected_at
      };
    });

    // Calculate summary stats
    const activeCount = validators.filter(v => v.status === 'active').length;
    const totalCount = validators.length;
    const avgScore = validators.length > 0 
      ? validators.reduce((sum, v) => sum + v.overallScore, 0) / validators.length 
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        epoch: targetEpoch,
        validators,
        summary: {
          total: totalCount,
          active: activeCount,
          standby: validators.filter(v => v.status === 'standby').length,
          penalized: validators.filter(v => v.status === 'penalized').length,
          averageScore: parseFloat(avgScore.toFixed(2)),
          highPerformers: validators.filter(v => v.overallScore >= 80).length,
          lowPerformers: validators.filter(v => v.overallScore < 50).length
        }
      },
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=30'
      }
    });
  } catch (error: any) {
    console.error('Validators error:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  } finally {
    client.release();
  }
}
