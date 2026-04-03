import { NextRequest, NextResponse } from 'next/server';
import { leaderboard } from '@/services/scoring-engine';

export async function GET(req: NextRequest) {
  const network = req.nextUrl.searchParams.get('network') ?? 'mainnet';
  const scores = await leaderboard(network);
  return NextResponse.json({ network, nodes: scores });
}
