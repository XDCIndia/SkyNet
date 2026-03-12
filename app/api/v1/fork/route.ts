/**
 * API Route: Fork Detection
 * 
 * GET /api/v1/fork/status - Get current fork status
 * GET /api/v1/fork/history - Get recent divergence history
 * POST /api/v1/fork/check - Trigger manual fork check
 * 
 * @see https://github.com/AnilChinchawale/XDCNetOwn/issues/679
 */

import { NextRequest, NextResponse } from 'next/server';
import { ForkDetector, initializeForkDetector } from '@/lib/fork-detector';
import { authenticateRequest } from '@/lib/auth';

const forkDetector = initializeForkDetector();

/**
 * GET /api/v1/fork/status
 * Get current fork detection status
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';

    if (action === 'history') {
      // Get recent divergence history
      const limit = parseInt(searchParams.get('limit') || '10', 10);
      const history = await ForkDetector.getRecentDivergences(limit);

      return NextResponse.json({
        success: true,
        data: {
          divergences: history,
          count: history.length,
        },
      });
    }

    // Get current status (no active fork check, just return config)
    return NextResponse.json({
      success: true,
      data: {
        status: 'active',
        checkIntervalMs: 30000,
        confirmationDepth: 6,
        endpoints: [
          { name: 'xdc-mainnet-1', region: 'us-east', isHealthy: true },
          { name: 'xdc-mainnet-2', region: 'eu-west', isHealthy: true },
          { name: 'xdc-mainnet-3', region: 'asia-southeast', isHealthy: true },
        ],
      },
    });
  } catch (error) {
    console.error('[Fork API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/fork/check
 * Trigger manual fork check
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.success) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Run fork check
    const report = await forkDetector.checkForForks();

    if (report) {
      return NextResponse.json({
        success: true,
        data: {
          forkDetected: true,
          report: {
            blockNumber: report.blockNumber,
            severity: report.severity,
            affectedClients: report.affectedClients,
            expectedHash: report.expectedHash,
            detectedAt: report.detectedAt,
            details: report.details,
            recommendedAction: report.recommendedAction,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        forkDetected: false,
        message: 'No consensus fork detected',
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[Fork API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
