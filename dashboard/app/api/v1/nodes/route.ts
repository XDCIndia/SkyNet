import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const network = searchParams.get('network');
    
    // Simple query
    const result = await query(
      'SELECT * FROM skynet.nodes WHERE network = $1 ORDER BY last_heartbeat DESC LIMIT $2',
      [network || 'mainnet', limit]
    );
    
    return NextResponse.json({ success: true, nodes: result.rows });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
