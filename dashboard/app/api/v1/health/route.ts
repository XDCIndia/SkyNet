import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * GET /api/v1/health/live
 * Liveness probe - returns 200 if the application is running
 * Used by Kubernetes and load balancers to check if process is alive
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const checkType = searchParams.get('type') || 'live';

    switch (checkType) {
      case 'live':
        return await livenessCheck();
      case 'ready':
        return await readinessCheck();
      case 'sync':
        return await syncCheck();
      default:
        return NextResponse.json(
          { error: 'Invalid health check type. Use: live, ready, sync' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { 
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}

/**
 * Liveness check - is the process running?
 */
async function livenessCheck() {
  return NextResponse.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    service: 'xdc-skynet-api',
    version: process.env.APP_VERSION || '1.0.0',
  }, { status: 200 });
}

/**
 * Readiness check - is the application ready to receive traffic?
 * Checks database connectivity and critical dependencies
 */
async function readinessCheck() {
  const checks: any = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    checks: {},
  };

  let allHealthy = true;

  // Check database connectivity
  try {
    const start = Date.now();
    await query('SELECT 1');
    const latency = Date.now() - start;
    
    checks.checks.database = {
      status: 'pass',
      latency_ms: latency,
    };
  } catch (error) {
    checks.checks.database = {
      status: 'fail',
      error: 'Database connection failed',
    };
    allHealthy = false;
  }

  // Check if we can read from nodes table
  try {
    const start = Date.now();
    const result = await query('SELECT COUNT(*) as count FROM skynet.nodes');
    const latency = Date.now() - start;
    
    checks.checks.nodes_table = {
      status: 'pass',
      latency_ms: latency,
      node_count: parseInt(result.rows[0].count),
    };
  } catch (error) {
    checks.checks.nodes_table = {
      status: 'fail',
      error: 'Cannot read nodes table',
    };
    allHealthy = false;
  }

  if (!allHealthy) {
    checks.status = 'unhealthy';
    return NextResponse.json(checks, { status: 503 });
  }

  return NextResponse.json(checks, { status: 200 });
}

/**
 * Sync check - how far behind is the network?
 * Useful for nodes to check their sync status
 */
async function syncCheck() {
  try {
    // Get the latest block from our nodes
    const result = await query(`
      SELECT 
        MAX((metrics->>'blockHeight')::bigint) as latest_block,
        COUNT(*) as total_nodes,
        COUNT(CASE WHEN (metrics->>'syncing')::boolean = true THEN 1 END) as syncing_nodes
      FROM skynet.node_metrics
      WHERE collected_at > NOW() - INTERVAL '5 minutes'
    `);

    const row = result.rows[0];
    const latestBlock = row.latest_block ? parseInt(row.latest_block) : 0;
    const totalNodes = parseInt(row.total_nodes) || 0;
    const syncingNodes = parseInt(row.syncing_nodes) || 0;

    // Determine sync status
    let syncStatus = 'synced';
    if (syncingNodes > totalNodes / 2) {
      syncStatus = 'syncing';
    }

    return NextResponse.json({
      status: syncStatus,
      latest_block: latestBlock,
      nodes_reporting: totalNodes,
      nodes_syncing: syncingNodes,
      timestamp: new Date().toISOString(),
    }, { status: 200 });
  } catch (error) {
    return NextResponse.json({
      status: 'unknown',
      error: 'Could not determine sync status',
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }
}
