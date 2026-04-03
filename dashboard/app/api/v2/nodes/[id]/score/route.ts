import { NextRequest, NextResponse } from 'next/server';
import { scoreNode } from '@/services/scoring-engine';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const score = await scoreNode(params.id);
    return NextResponse.json(score);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 404 });
  }
}
