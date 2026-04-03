/**
 * POST /api/v2/mesh/optimize — Issue #71
 * Suggest optimal peer sets for each fleet node.
 */
import { NextResponse } from 'next/server';
import { optimisePeerMesh } from '@/services/peer-mesh';

export async function POST(): Promise<NextResponse> {
  try {
    const suggestions = await optimisePeerMesh();
    return NextResponse.json({ suggestions });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
