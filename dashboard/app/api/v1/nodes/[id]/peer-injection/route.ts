import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/nodes/[id]/peer-injection
 *
 * Issue #40 — Peer Injection Visibility
 * Returns recent peer injection events for a node.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const result = await query(
      `SELECT
         id,
         injected_count,
         failed_count,
         source,
         injected_at
       FROM skynet.peer_injection_log
       WHERE node_id = $1
       ORDER BY injected_at DESC
       LIMIT 20`,
      [id]
    ).catch(() => ({ rows: [] })); // Table may not exist yet

    const rows = result.rows;
    const latest = rows[0] ?? null;

    return NextResponse.json({
      success: true,
      nodeId: id,
      latest: latest
        ? {
            injectedCount: latest.injected_count,
            failedCount: latest.failed_count,
            source: latest.source,
            injectedAt: latest.injected_at,
          }
        : null,
      history: rows.map((r: any) => ({
        id: r.id,
        injectedCount: r.injected_count,
        failedCount: r.failed_count,
        source: r.source,
        injectedAt: r.injected_at,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
