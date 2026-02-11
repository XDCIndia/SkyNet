import { NextRequest, NextResponse } from 'next/server';
import { getCollectorStatus, startCollector, stopCollector } from '@/lib/collector';
import { query } from '@/lib/db';

// GET /api/collector - Get collector status
export async function GET() {
  try {
    const status = getCollectorStatus();
    
    // Get nodes being monitored
    const nodesResult = await query(
      'SELECT COUNT(*) as count FROM netown.nodes WHERE is_active = true'
    );
    
    // Get last metric collection time
    const lastRunResult = await query(
      'SELECT MAX(collected_at) as last_run FROM netown.node_metrics'
    );

    return NextResponse.json({
      ...status,
      nodesMonitored: parseInt(nodesResult.rows[0]?.count || '0'),
      lastRun: lastRunResult.rows[0]?.last_run || null,
    });
  } catch (error) {
    console.error('Error fetching collector status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collector status' },
      { status: 500 }
    );
  }
}

// POST /api/collector - Control collector
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action || !['start', 'stop'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "start" or "stop"' },
        { status: 400 }
      );
    }

    if (action === 'start') {
      startCollector();
      return NextResponse.json({
        message: 'Collector started',
        status: getCollectorStatus(),
      });
    } else {
      stopCollector();
      return NextResponse.json({
        message: 'Collector stopped',
        status: getCollectorStatus(),
      });
    }
  } catch (error) {
    console.error('Error controlling collector:', error);
    return NextResponse.json(
      { error: 'Failed to control collector' },
      { status: 500 }
    );
  }
}
