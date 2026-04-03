/**
 * POST /api/v2/telemetry/push — Issue #63
 * Unified telemetry push endpoint.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processTelemetryPush } from '@/services/unified-telemetry';

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Optional node ID override from header or query param
  const overrideNodeId =
    req.nextUrl.searchParams.get('nodeId') ??
    req.headers.get('x-node-id') ??
    undefined;

  try {
    const payload = await processTelemetryPush(body, overrideNodeId);
    return NextResponse.json({
      ok: true,
      nodeId: payload.nodeId,
      clientType: payload.clientType,
      blockHeight: payload.blockHeight,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 });
  }
}
