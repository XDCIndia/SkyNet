/**
 * API Route: RPC Failover Status
 * 
 * GET /api/v1/upstreams - Get status of all upstream endpoints
 * POST /api/v1/upstreams/{name}/reset - Reset circuit breaker
 * 
 * @see https://github.com/AnilChinchawale/XDCNetOwn/issues/670
 */

import { NextRequest, NextResponse } from 'next/server';
import { initializeFailoverManager, RpcFailoverManager } from '@/lib/rpc-failover';
import { authenticateRequest } from '@/lib/auth';

// Singleton instance
let failoverManager: RpcFailoverManager | null = null;

function getFailoverManager(): RpcFailoverManager {
  if (!failoverManager) {
    failoverManager = initializeFailoverManager();
    failoverManager.start();
  }
  return failoverManager;
}

/**
 * GET /api/v1/upstreams
 * Get status of all upstream RPC endpoints
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const manager = getFailoverManager();
    const statuses = manager.getAllStatus();

    const healthy = statuses.filter(s => s.isHealthy && !s.isCircuitOpen);
    const unhealthy = statuses.filter(s => !s.isHealthy);
    const circuitOpen = statuses.filter(s => s.isCircuitOpen);

    return NextResponse.json({
      success: true,
      data: {
        upstreams: statuses,
        summary: {
          total: statuses.length,
          healthy: healthy.length,
          unhealthy: unhealthy.length,
          circuitOpen: circuitOpen.length,
        },
        healthy,
        unhealthy,
        circuitOpen,
      },
    });
  } catch (error) {
    console.error('[Upstreams API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/upstreams
 * Manage upstream endpoints
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, upstream } = body;

    const manager = getFailoverManager();

    switch (action) {
      case 'reset': {
        if (!upstream) {
          return NextResponse.json(
            { success: false, error: 'upstream name required' },
            { status: 400 }
          );
        }
        manager.resetCircuit(upstream);
        return NextResponse.json({
          success: true,
          data: { message: `Circuit breaker reset for ${upstream}` },
        });
      }

      case 'markUnhealthy': {
        if (!upstream || !body.reason) {
          return NextResponse.json(
            { success: false, error: 'upstream and reason required' },
            { status: 400 }
          );
        }
        manager.markUnhealthy(upstream, body.reason);
        return NextResponse.json({
          success: true,
          data: { message: `${upstream} marked as unhealthy` },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Upstreams API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
