import { NextRequest, NextResponse } from 'next/server';
import { fetchMasternodeData } from '@/lib/masternode';

/**
 * GET /api/v1/masternodes
 * Returns all masternodes with stake data
 * Cached for 5 minutes
 */
export async function GET(request: NextRequest) {
  try {
    const data = await fetchMasternodeData();
    
    return NextResponse.json({
      success: true,
      data: {
        epoch: data.epoch,
        round: data.round,
        blockNumber: data.blockNumber,
        masternodes: data.masternodes,
        standbynodes: data.standbynodes,
        penalized: data.penalized,
        totalStaked: data.totalStaked.toString(),
        nakamotoCoefficient: data.nakamotoCoefficient,
      },
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    });
  } catch (error: any) {
    console.error('Error fetching masternodes:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch masternode data',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
