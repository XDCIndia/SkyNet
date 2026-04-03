import { NextRequest, NextResponse } from 'next/server';
import { diagnoseNode } from '@/services/node-doctor';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const diagnosis = await diagnoseNode(params.id);
    return NextResponse.json(diagnosis);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 404 });
  }
}
