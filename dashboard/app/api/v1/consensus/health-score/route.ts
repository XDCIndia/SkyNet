import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://gateway:gateway@localhost:5433/xdc_gateway'
});

export const dynamic = 'force-dynamic';

interface HealthScore {
  overallScore: number;
  status: 'green' | 'yellow' | 'red';
  components: {
    participation: {
      score: number;
      weight: number;
      weightedScore: number;
      details: {
        activeValidators: number;
        totalValidators: number;
        participationPercent: number;
      };
    };
    qcValidity: {
      score: number;
      weight: number;
      weightedScore: number;
      details: {
        validQCs: number;
        totalQCs: number;
        validityPercent: number;
        avgTimeToQC: number;
      };
    };
    gapRate: {
      score: number;
      weight: number;
      weightedScore: number;
      details: {
        gapBlocks: number;
        totalBlocks: number;
        gapRatePercent: number;
      };
    };
  };
  epoch: number;
  trend: {
    direction: 'improving' | 'stable' | 'declining';
    change: number;
  };
  history: {
    timestamp: string;
    score: number;
  }[];
}

const WEIGHTS = {
  participation: 0.4,
  qcValidity: 0.3,
  gapRate: 0.3
};

/**
 * GET /api/v1/consensus/health-score
 * Returns overall consensus health score
 */
export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    const { searchParams } = new URL(request.url);
    const historyHours = parseInt(searchParams.get('history') || '24');

    // Get current epoch
    const epochResult = await client.query(`
      SELECT DISTINCT epoch_number 
      FROM skynet.node_metrics 
      WHERE epoch_number IS NOT NULL 
      ORDER BY collected_at DESC 
      LIMIT 1
    `);
    const currentEpoch = epochResult.rows[0]?.epoch_number || 0;

    // Get participation data
    const participationResult = await client.query(`
      SELECT 
        COUNT(DISTINCT CASE WHEN vote_participation_percent > 0 THEN block_producer END) as active_validators,
        COUNT(DISTINCT block_producer) as total_validators,
        AVG(vote_participation_percent) as avg_participation
      FROM skynet.node_metrics
      WHERE epoch_number = $1
        AND collected_at > NOW() - INTERVAL '1 hour'
        AND block_producer IS NOT NULL
    `, [currentEpoch]);

    // Get QC validity data
    const qcResult = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE qc_valid = true) as valid_qcs,
        COUNT(*) as total_qcs,
        AVG(time_to_qc_ms) as avg_time_to_qc
      FROM skynet.qc_metrics
      WHERE collected_at > NOW() - INTERVAL '1 hour'
    `);

    // Fallback to node_metrics
    const qcFallbackResult = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE qc_valid = true) as valid_qcs,
        COUNT(*) FILTER (WHERE qc_valid IS NOT NULL) as total_qcs
      FROM skynet.node_metrics
      WHERE collected_at > NOW() - INTERVAL '1 hour'
        AND qc_valid IS NOT NULL
    `);

    // Get gap block data
    const gapResult = await client.query(`
      SELECT COUNT(*) as gap_count
      FROM skynet.gap_blocks
      WHERE detected_at > NOW() - INTERVAL '1 hour'
    `);

    const totalBlocksResult = await client.query(`
      SELECT COUNT(DISTINCT block_height) as total
      FROM skynet.node_metrics
      WHERE block_height IS NOT NULL
        AND collected_at > NOW() - INTERVAL '1 hour'
    `);

    // Calculate participation score
    const activeValidators = parseInt(participationResult.rows[0]?.active_validators || '0');
    const totalValidators = parseInt(participationResult.rows[0]?.total_validators || '1');
    const participationPercent = parseFloat(participationResult.rows[0]?.avg_participation || '0');
    const participationScore = Math.min(participationPercent, 100);

    // Calculate QC validity score
    const validQCs = parseInt(qcResult.rows[0]?.valid_qcs || qcFallbackResult.rows[0]?.valid_qcs || '0');
    const totalQCs = parseInt(qcResult.rows[0]?.total_qcs || qcFallbackResult.rows[0]?.total_qcs || '1');
    const validityPercent = totalQCs > 0 ? (validQCs / totalQCs) * 100 : 0;
    const avgTimeToQC = parseFloat(qcResult.rows[0]?.avg_time_to_qc || '0');
    const qcScore = Math.min(validityPercent, 100);

    // Calculate gap rate score (inverse - lower gap rate is better)
    const gapBlocks = parseInt(gapResult.rows[0]?.gap_count || '0');
    const totalBlocks = parseInt(totalBlocksResult.rows[0]?.total || '1');
    const gapRatePercent = (gapBlocks / totalBlocks) * 100;
    const gapScore = Math.max(0, 100 - (gapRatePercent * 10)); // Penalize gaps heavily

    // Calculate weighted overall score
    const weightedParticipation = participationScore * WEIGHTS.participation;
    const weightedQC = qcScore * WEIGHTS.qcValidity;
    const weightedGap = gapScore * WEIGHTS.gapRate;
    const overallScore = Math.round(weightedParticipation + weightedQC + weightedGap);

    // Determine status
    let status: 'green' | 'yellow' | 'red' = 'red';
    if (overallScore >= 80) status = 'green';
    else if (overallScore >= 50) status = 'yellow';

    // Get historical scores
    const historyResult = await client.query(`
      SELECT 
        calculated_at as timestamp,
        health_score as score
      FROM skynet.consensus_health
      WHERE calculated_at > NOW() - INTERVAL '${historyHours} hours'
      ORDER BY calculated_at ASC
      LIMIT 100
    `);

    // Calculate trend
    let trend = { direction: 'stable' as const, change: 0 };
    if (historyResult.rows.length >= 2) {
      const first = historyResult.rows[0].score;
      const last = historyResult.rows[historyResult.rows.length - 1].score;
      const change = last - first;
      trend = {
        direction: change > 5 ? 'improving' : change < -5 ? 'declining' : 'stable',
        change: Math.round(change)
      };
    }

    const health: HealthScore = {
      overallScore,
      status,
      components: {
        participation: {
          score: Math.round(participationScore),
          weight: WEIGHTS.participation,
          weightedScore: Math.round(weightedParticipation),
          details: {
            activeValidators,
            totalValidators,
            participationPercent: parseFloat(participationPercent.toFixed(2))
          }
        },
        qcValidity: {
          score: Math.round(qcScore),
          weight: WEIGHTS.qcValidity,
          weightedScore: Math.round(weightedQC),
          details: {
            validQCs,
            totalQCs,
            validityPercent: parseFloat(validityPercent.toFixed(2)),
            avgTimeToQC: Math.round(avgTimeToQC)
          }
        },
        gapRate: {
          score: Math.round(gapScore),
          weight: WEIGHTS.gapRate,
          weightedScore: Math.round(weightedGap),
          details: {
            gapBlocks,
            totalBlocks,
            gapRatePercent: parseFloat(gapRatePercent.toFixed(2))
          }
        }
      },
      epoch: currentEpoch,
      trend,
      history: historyResult.rows.map(row => ({
        timestamp: row.timestamp,
        score: row.score
      }))
    };

    return NextResponse.json({
      success: true,
      data: health,
      timestamp: new Date().toISOString()
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=10'
      }
    });
  } catch (error: any) {
    console.error('Health score error:', error.message);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  } finally {
    client.release();
  }
}
