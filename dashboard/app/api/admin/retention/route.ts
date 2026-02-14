/**
 * XDC SkyNet - Data Retention API
 * 
 * POST /api/admin/retention - Run data retention cleanup
 * Requires admin API key
 */

import { NextRequest, NextResponse } from 'next/server';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

export async function POST(req: NextRequest) {
  // Check authentication
  const authHeader = req.headers.get('authorization');
  const apiKey = authHeader?.replace('Bearer ', '');
  
  if (!ADMIN_API_KEY) {
    return NextResponse.json(
      { error: 'Admin API key not configured' },
      { status: 503 }
    );
  }
  
  if (!apiKey || apiKey !== ADMIN_API_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  try {
    // Dynamically import to avoid issues during build
    const { runRetention } = await import('@/scripts/data-retention');
    const result = await runRetention();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Data retention error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to run data retention',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Also allow GET for simple health check / cron compatibility
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const apiKey = authHeader?.replace('Bearer ', '');
  
  if (!ADMIN_API_KEY) {
    return NextResponse.json(
      { error: 'Admin API key not configured' },
      { status: 503 }
    );
  }
  
  if (!apiKey || apiKey !== ADMIN_API_KEY) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  try {
    // Dynamically import to avoid issues during build
    const { runRetention } = await import('@/scripts/data-retention');
    const result = await runRetention();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Data retention error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to run data retention',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
