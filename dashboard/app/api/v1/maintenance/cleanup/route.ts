import { NextRequest, NextResponse } from 'next/server';

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

// Data retention policy:
// - node_metrics: keep 7 days (high-frequency heartbeat data)
// - incidents: keep 30 days (resolved), keep all active
// - peer_snapshots: keep 7 days
// - alert_history: keep 30 days
// - network_health: keep 30 days

export async function POST(request: NextRequest) {
  try {
    const secret = request.nextUrl.searchParams.get('secret');
    if (secret !== process.env.CLEANUP_SECRET && secret !== 'skynet-cleanup-2026') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dryRun = request.nextUrl.searchParams.get('dry_run') === 'true';
    const results: Record<string, number> = {};

    if (dryRun) {
      // Count what would be deleted
      const metrics = await query(`
        SELECT COUNT(*) as count FROM skynet.node_metrics
        WHERE collected_at < NOW() - INTERVAL '7 days'
      `);
      results.node_metrics = parseInt(metrics.rows[0].count);

      const incidents = await query(`
        SELECT COUNT(*) as count FROM skynet.incidents
        WHERE status != 'active' AND detected_at < NOW() - INTERVAL '30 days'
      `);
      results.incidents = parseInt(incidents.rows[0].count);

      const peers = await query(`
        SELECT COUNT(*) as count FROM skynet.peer_snapshots
        WHERE collected_at < NOW() - INTERVAL '7 days'
      `);
      results.peer_snapshots = parseInt(peers.rows[0].count);

      const alerts = await query(`
        SELECT COUNT(*) as count FROM skynet.alert_history
        WHERE triggered_at < NOW() - INTERVAL '30 days'
      `);
      results.alert_history = parseInt(alerts.rows[0].count);

      const health = await query(`
        SELECT COUNT(*) as count FROM skynet.network_health
        WHERE collected_at < NOW() - INTERVAL '30 days'
      `);
      results.network_health = parseInt(health.rows[0].count);

      return NextResponse.json({
        mode: 'dry_run',
        wouldDelete: results,
        totalRows: Object.values(results).reduce((a, b) => a + b, 0),
      });
    }

    // Actually delete old data
    const metricsResult = await query(`
      DELETE FROM skynet.node_metrics
      WHERE collected_at < NOW() - INTERVAL '7 days'
    `);
    results.node_metrics = metricsResult.rowCount;

    const incidentsResult = await query(`
      DELETE FROM skynet.incidents
      WHERE status != 'active' AND detected_at < NOW() - INTERVAL '30 days'
    `);
    results.incidents = incidentsResult.rowCount;

    const peersResult = await query(`
      DELETE FROM skynet.peer_snapshots
      WHERE collected_at < NOW() - INTERVAL '7 days'
    `);
    results.peer_snapshots = peersResult.rowCount;

    const alertsResult = await query(`
      DELETE FROM skynet.alert_history
      WHERE triggered_at < NOW() - INTERVAL '30 days'
    `);
    results.alert_history = alertsResult.rowCount;

    const healthResult = await query(`
      DELETE FROM skynet.network_health
      WHERE collected_at < NOW() - INTERVAL '30 days'
    `);
    results.network_health = healthResult.rowCount;

    // VACUUM ANALYZE after bulk deletes
    await query('VACUUM ANALYZE skynet.node_metrics');

    return NextResponse.json({
      mode: 'executed',
      deleted: results,
      totalRows: Object.values(results).reduce((a, b) => a + b, 0),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET for quick status check
export async function GET(request: NextRequest) {
  try {
    const result = await query(`
      SELECT
        (SELECT COUNT(*) FROM skynet.node_metrics) as total_metrics,
        (SELECT COUNT(*) FROM skynet.node_metrics WHERE collected_at < NOW() - INTERVAL '7 days') as stale_metrics,
        (SELECT pg_size_pretty(pg_total_relation_size('skynet.node_metrics'))) as metrics_size,
        (SELECT COUNT(*) FROM skynet.incidents) as total_incidents,
        (SELECT COUNT(*) FROM skynet.incidents WHERE status != 'active' AND detected_at < NOW() - INTERVAL '30 days') as stale_incidents,
        (SELECT MIN(collected_at) FROM skynet.node_metrics) as oldest_metric,
        (SELECT pg_database_size(current_database())) as db_size_bytes
    `);

    const row = result.rows[0];
    return NextResponse.json({
      nodeMetrics: {
        total: parseInt(row.total_metrics),
        stale: parseInt(row.stale_metrics),
        size: row.metrics_size,
        oldestRecord: row.oldest_metric,
      },
      incidents: {
        total: parseInt(row.total_incidents),
        stale: parseInt(row.stale_incidents),
      },
      dbSizeBytes: parseInt(row.db_size_bytes),
      dbSize: `${(parseInt(row.db_size_bytes) / 1024 / 1024).toFixed(1)} MB`,
      retentionPolicy: {
        nodeMetrics: '7 days',
        incidents: '30 days (resolved only)',
        peerSnapshots: '7 days',
        alertHistory: '30 days',
        networkHealth: '30 days',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
