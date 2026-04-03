/**
 * Watchdog Monitor — Issue #46
 *
 * GET  /api/v2/watchdog         → list all watchdog entries + health status
 * POST /api/v2/watchdog/ping    → called by cron/watchdog to record heartbeat
 *
 * The watchdog table tracks named cron jobs. Each cron calls ping to record
 * its last run. If a job hasn't pinged within `expected_interval_seconds`,
 * the watchdog fires an alert.
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────────────────────
// GET — list watchdog status
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  try {
    const result = await query(`
      SELECT
        id,
        name,
        description,
        last_run_at,
        expected_interval_seconds,
        CASE
          WHEN last_run_at IS NULL THEN 'never_run'
          WHEN NOW() - last_run_at > (expected_interval_seconds * INTERVAL '1 second') * 1.5
            THEN 'overdue'
          ELSE 'ok'
        END AS status,
        EXTRACT(EPOCH FROM (NOW() - last_run_at))::int AS seconds_since_last_run
      FROM skynet.watchdog_jobs
      ORDER BY name
    `).catch(() => ({ rows: [] as any[] }));

    const entries = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      lastRunAt: row.last_run_at,
      expectedIntervalSeconds: Number(row.expected_interval_seconds),
      status: row.status,
      secondsSinceLastRun: row.seconds_since_last_run != null
        ? Number(row.seconds_since_last_run)
        : null,
    }));

    // Fire alerts for overdue jobs
    for (const entry of entries) {
      if (entry.status === 'overdue') {
        const fingerprint = `watchdog-overdue-${entry.name}`;
        await query(
          `INSERT INTO skynet.alerts
             (severity, title, message, status, fingerprint, triggered_at)
           VALUES ('warning', $1, $2, 'active', $3, NOW())
           ON CONFLICT (fingerprint) DO UPDATE SET triggered_at = NOW(), status = 'active'`,
          [
            `Watchdog overdue: ${entry.name}`,
            `Job "${entry.name}" last ran ${entry.secondsSinceLastRun}s ago (expected every ${entry.expectedIntervalSeconds}s).`,
            fingerprint,
          ]
        ).catch(() => {});
      }
    }

    return NextResponse.json({ watchdogs: entries, checkedAt: new Date() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — record a watchdog ping
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { name: string; description?: string; expectedIntervalSeconds?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }

  try {
    await query(
      `INSERT INTO skynet.watchdog_jobs
         (name, description, expected_interval_seconds, last_run_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (name) DO UPDATE SET
         last_run_at = NOW(),
         description = COALESCE(EXCLUDED.description, skynet.watchdog_jobs.description),
         expected_interval_seconds = COALESCE(EXCLUDED.expected_interval_seconds, skynet.watchdog_jobs.expected_interval_seconds)`,
      [body.name, body.description ?? null, body.expectedIntervalSeconds ?? 300]
    );

    logger.debug('[Watchdog] Ping recorded', { name: body.name });
    return NextResponse.json({ ok: true, name: body.name, pingAt: new Date() });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
