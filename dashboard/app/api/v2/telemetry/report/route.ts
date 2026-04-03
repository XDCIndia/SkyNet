/**
 * Public Telemetry — Accept community node reports
 * Issue: https://github.com/XDCIndia/SkyNet/issues/65
 * Rate limit: 1 report/min per IP
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const rateLimit = new Map<string, number>(); // IP → last report timestamp

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown';
  const now = Date.now();
  const last = rateLimit.get(ip) ?? 0;
  if (now - last < 60000) {
    return NextResponse.json({ error: 'Rate limited: 1 report/min' }, { status: 429 });
  }
  rateLimit.set(ip, now);

  try {
    const body = await req.json();
    const { nodeName, clientType, chainId, blockNumber, peerCount, version } = body;
    if (!nodeName || !clientType || !chainId) {
      return NextResponse.json({ error: 'nodeName, clientType, chainId required' }, { status: 400 });
    }

    await query(
      `INSERT INTO community_nodes (ip, node_name, client_type, chain_id, block_number, peer_count, version, last_report)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (ip, chain_id) DO UPDATE SET
         node_name = $2, client_type = $3, block_number = $5, peer_count = $6, version = $7, last_report = NOW()`,
      [ip, nodeName, clientType, chainId, blockNumber ?? 0, peerCount ?? 0, version ?? 'unknown']
    );

    return NextResponse.json({ ok: true, message: 'Telemetry recorded' });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
