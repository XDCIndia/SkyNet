import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCollectorStatus, startCollector, stopCollector } from '@/lib/collector';
import { query } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth';

// Zod schema for collector action validation
const CollectorActionSchema = z.object({
  action: z.enum(['start', 'stop'], {
    errorMap: () => ({ message: 'Action must be "start" or "stop"' }),
  }),
});

// GET /api/collector - Get collector status
export async function GET() {
  try {
    const status = getCollectorStatus();
    
    // Get nodes being monitored
    const nodesResult = await query(
      'SELECT COUNT(*) as count FROM skynet.nodes WHERE is_active = true'
    );
    
    // Get last metric collection time
    const lastRunResult = await query(
      'SELECT MAX(collected_at) as last_run FROM skynet.node_metrics'
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

// POST /api/collector - Control collector (protected)
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json();
    
    // Validate input with Zod
    const validationResult = CollectorActionSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validationResult.error.format() 
        },
        { status: 400 }
      );
    }

    const { action } = validationResult.data;

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
