import { NextRequest, NextResponse } from 'next/server';
import { handleUpdate } from '@/services/chatops-bot';

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    await handleUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
