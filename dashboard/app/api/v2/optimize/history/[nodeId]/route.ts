import { NextRequest, NextResponse } from 'next/server';
import { getHistory } from '@/services/optimization-engine';

export async function GET(_req: NextRequest, { params }: { params: { nodeId: string } }) {
  const history = await getHistory(params.nodeId);
  return NextResponse.json({ nodeId: params.nodeId, history });
}
