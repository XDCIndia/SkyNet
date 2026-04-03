/**
 * GET /api/v2/audit — Issue #49
 * Paginated audit log with optional filters.
 *
 * Query params:
 *   actor, action, targetType, targetId, from, to, limit, offset
 */
import { NextRequest, NextResponse } from 'next/server';
import { getAuditLog, AuditLogFilter } from '@/services/audit-log';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const p = req.nextUrl.searchParams;

  const filter: AuditLogFilter = {
    actor: p.get('actor') ?? undefined,
    action: p.get('action') ?? undefined,
    targetType: p.get('targetType') ?? undefined,
    targetId: p.get('targetId') ?? undefined,
    from: p.get('from') ? new Date(p.get('from')!) : undefined,
    to: p.get('to') ? new Date(p.get('to')!) : undefined,
    limit: p.get('limit') ? Number(p.get('limit')) : 50,
    offset: p.get('offset') ? Number(p.get('offset')) : 0,
  };

  try {
    const result = await getAuditLog(filter);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
