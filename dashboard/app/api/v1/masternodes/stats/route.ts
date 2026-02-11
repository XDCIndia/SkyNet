import { NextRequest, NextResponse } from 'next/server';
import { fetchMasternodeData } from '@/lib/masternode';

/**
 * GET /api/v1/masternodes/stats
 * Returns aggregate masternode statistics
 */
export async function GET(request: NextRequest) {
  try {
    const data = await fetchMasternodeData();
    
    // Calculate stats
    const totalActive = data.masternodes.length;
    const totalStandby = data.standbynodes.length;
    const totalPenalized = data.penalized.length;
    
    // Calculate average stake
    const allNodes = [...data.masternodes, ...data.standbynodes];
    const totalStakeXDC = Number(data.totalStaked) / 1e18;
    const avgStake = totalActive > 0 ? totalStakeXDC / totalActive : 0;
    
    // Get top 10 by stake
    const topValidators = [...data.masternodes]
      .filter(m => m.stake)
      .sort((a, b) => {
        const aStake = parseFloat(a.stake?.replace(/,/g, '') || '0');
        const bStake = parseFloat(b.stake?.replace(/,/g, '') || '0');
        return bStake - aStake;
      })
      .slice(0, 10)
      .map(m => ({
        address: m.xdcAddress,
        stake: m.stake,
        percentage: totalStakeXDC > 0 
          ? ((parseFloat(m.stake?.replace(/,/g, '') || '0') / totalStakeXDC) * 100).toFixed(2)
          : '0',
      }));
    
    return NextResponse.json({
      success: true,
      data: {
        epoch: data.epoch,
        round: data.round,
        blockNumber: data.blockNumber,
        totalActive,
        totalStandby,
        totalPenalized,
        totalStaked: totalStakeXDC.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        totalStakedRaw: data.totalStaked.toString(),
        averageStake: avgStake.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        nakamotoCoefficient: data.nakamotoCoefficient,
        topValidators,
      },
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    });
  } catch (error: any) {
    console.error('Error fetching masternode stats:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch masternode stats',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
