import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';

/**
 * Cron endpoint for data retention cleanup
 * Issue #281: Implement data retention policy
 * 
 * Configure Vercel Cron or external cron to call daily:
 * curl -X POST https://xdc.openscan.ai/api/cron/cleanup \
 *   -H "Authorization: Bearer $CRON_SECRET"
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
    
    if (!authHeader || authHeader !== expectedAuth) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Run cleanup function
    const result = await queryAll('SELECT * FROM skynet.cleanup_old_metrics()');
    
    if (result && result.length > 0) {
      const { metrics_deleted, peers_deleted, incidents_archived } = result[0];
      
      // Log to maintenance_log
      await queryAll(
        `INSERT INTO skynet.maintenance_log 
         (operation, metrics_deleted, peers_deleted, incidents_archived)
         VALUES ('cleanup_old_data', $1, $2, $3)`,
        [metrics_deleted, peers_deleted, incidents_archived]
      );

      return NextResponse.json({
        success: true,
        deleted: {
          metrics: metrics_deleted,
          peers: peers_deleted,
          incidentsArchived: incidents_archived
        },
        timestamp: new Date().toISOString()
      });
    }

    return NextResponse.json({ success: true, deleted: { metrics: 0, peers: 0, incidentsArchived: 0 } });

  } catch (error: any) {
    console.error('[Cron Cleanup Error]', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

// GET for status check
export async function GET() {
  try {
    const recentRuns = await queryAll(
      'SELECT * FROM skynet.maintenance_log ORDER BY executed_at DESC LIMIT 5'
    );
    
    return NextResponse.json({
      success: true,
      recentRuns: recentRuns || []
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
