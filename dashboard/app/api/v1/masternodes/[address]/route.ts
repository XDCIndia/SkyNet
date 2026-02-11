import { NextRequest, NextResponse } from 'next/server';
import { fetchCandidateDetail } from '@/lib/masternode';

/**
 * GET /api/v1/masternodes/[address]
 * Returns detailed info for a single masternode
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const { address } = params;
    
    if (!address) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Address is required',
        },
        { status: 400 }
      );
    }
    
    const detail = await fetchCandidateDetail(undefined, address);
    
    if (!detail) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Masternode not found',
        },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: detail,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching masternode detail:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch masternode detail',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
