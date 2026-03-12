import { NextRequest, NextResponse } from 'next/server';
import { runRetentionJob } from '@/scripts/retention-job';

/**
 * Admin Retention API Endpoint (Issue #614)
 * GET /api/v1/admin/retention
 * 
 * Runs the data retention cleanup job.
 * Protected by ADMIN_SECRET header.
 */

const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function GET(request: NextRequest) {
  // Check for admin secret
  const authHeader = request.headers.get('X-Admin-Secret');
  
  if (!ADMIN_SECRET) {
    console.error('ADMIN_SECRET not configured');
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    );
  }
  
  if (!authHeader || authHeader !== ADMIN_SECRET) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  try {
    const result = await runRetentionJob();
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'Retention cleanup completed',
        deleted: result.deleted,
        durationMs: result.durationMs,
        timestamp: new Date().toISOString(),
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Retention cleanup failed',
          durationMs: result.durationMs,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error running retention job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
