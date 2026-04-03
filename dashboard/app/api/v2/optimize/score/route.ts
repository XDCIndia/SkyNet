import { NextRequest, NextResponse } from 'next/server';
import { recordScore } from '@/services/optimization-engine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { nodeId, configHash, syncSpeed, peerHealth, resourceUse, composite, metadata } = body;
    if (!nodeId || composite === undefined) {
      return NextResponse.json({ error: 'nodeId and composite required' }, { status: 400 });
    }
    const result = await recordScore({ nodeId, configHash, syncSpeed, peerHealth, resourceUse, composite, metadata });
    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
