/**
 * API Route: Consensus Health Scoring
 * 
 * GET /api/v1/consensus/health - Get current consensus health
 * GET /api/v1/consensus/trend - Get health trend over time
 * GET /api/v1/consensus/leaderboard - Get masternode leaderboard
 * GET /api/v1/consensus/masternode/{address} - Get individual masternode score
 * 
 * @see https://github.com/AnilChinchawale/XDCNetOwn/issues/600
 * @see https://github.com/AnilChinchawale/XDCNetOwn/issues/577
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  calculateConsensusHealth, 
  getConsensusHealthTrend,
  calculateMasternodeScore,
  getMasternodeLeaderboard,
} from '@/lib/consensus-scoring';
import { authenticateRequest } from '@/lib/auth';

/**
 * GET /api/v1/consensus/health
 * Get current consensus health score
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'health';
    const networkId = searchParams.get('network') || 'mainnet';

    switch (action) {
      case 'health': {
        const score = await calculateConsensusHealth(networkId);
        return NextResponse.json({
          success: true,
          data: {
            overall: score.overall,
            epochParticipation: score.epochParticipation,
            votePropagation: score.votePropagation,
            masternodeStability: score.masternodeStability,
            timestamp: score.timestamp,
            details: score.details,
          },
        });
      }

      case 'trend': {
        const hours = parseInt(searchParams.get('hours') || '24', 10);
        const trend = await getConsensusHealthTrend(networkId, hours);
        return NextResponse.json({
          success: true,
          data: {
            trend,
            hours,
            dataPoints: trend.length,
          },
        });
      }

      case 'leaderboard': {
        const epoch = parseInt(searchParams.get('epoch') || '0', 10);
        const limit = parseInt(searchParams.get('limit') || '100', 10);
        const currentEpoch = epoch || await getCurrentEpoch(networkId);
        
        const leaderboard = await getMasternodeLeaderboard(currentEpoch, limit, networkId);
        
        return NextResponse.json({
          success: true,
          data: {
            epoch: currentEpoch,
            leaderboard,
            statistics: calculateStatistics(leaderboard),
          },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Consensus API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Helper: Get current epoch
 */
async function getCurrentEpoch(networkId: string): Promise<number> {
  // This would query the blockchain or database
  // For now, return a placeholder
  return Math.floor(Date.now() / 1000 / 900); // Approximate epoch
}

/**
 * Helper: Calculate leaderboard statistics
 */
function calculateStatistics(leaderboard: any[]) {
  if (leaderboard.length === 0) {
    return {
      averageScore: 0,
      medianScore: 0,
      goldCount: 0,
      silverCount: 0,
      bronzeCount: 0,
      needsImprovementCount: 0,
    };
  }

  const scores = leaderboard.map(m => m.totalScore).sort((a, b) => a - b);
  const goldCount = leaderboard.filter(m => m.tier === 'gold').length;
  const silverCount = leaderboard.filter(m => m.tier === 'silver').length;
  const bronzeCount = leaderboard.filter(m => m.tier === 'bronze').length;
  const needsImprovementCount = leaderboard.filter(m => m.tier === 'needs-improvement').length;

  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const medianScore = scores[Math.floor(scores.length / 2)];

  return {
    averageScore: Math.round(averageScore * 10) / 10,
    medianScore: Math.round(medianScore * 10) / 10,
    goldCount,
    silverCount,
    bronzeCount,
    needsImprovementCount,
  };
}
