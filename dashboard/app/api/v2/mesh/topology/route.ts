/**
 * GET /api/v2/mesh/topology — Issue #71
 */
import { NextResponse } from 'next/server';
import { getMeshTopology } from '@/services/peer-mesh';

export async function GET(): Promise<NextResponse> {
  try {
    const topology = await getMeshTopology();
    return NextResponse.json(topology);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
