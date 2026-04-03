import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  const chainId = req.nextUrl.searchParams.get('chainId') ?? '50';
  const nodes = await query(
    `SELECT node_name, client_type, chain_id, block_number, peer_count, version, last_report
     FROM community_nodes WHERE chain_id = $1 AND last_report > NOW() - INTERVAL '1 hour'
     ORDER BY block_number DESC`,
    [parseInt(chainId)]
  );
  return NextResponse.json({ chainId, count: nodes.rows.length, nodes: nodes.rows });
}
