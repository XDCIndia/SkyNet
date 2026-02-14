import { NextRequest, NextResponse } from 'next/server';
import { queryAll } from '@/lib/db';
import { withErrorHandling } from '@/lib/errors';
import { z } from 'zod';

const QuerySchema = z.object({
  days: z.coerce.number().min(1).max(30).optional().default(7),
});

/**
 * GET /api/v1/issues/trends
 * Returns issue trends over time (opened vs resolved)
 * Query params: days (1-30, default 7)
 */
async function getHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const validationResult = QuerySchema.safeParse({
    days: searchParams.get('days') || '7',
  });

  if (!validationResult.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: validationResult.error.errors },
      { status: 400 }
    );
  }

  const { days } = validationResult.data;

  // Get daily trends
  const trendsQuery = `
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as opened,
      COUNT(*) FILTER (WHERE status = 'resolved') as resolved
    FROM skynet.issues 
    WHERE created_at > NOW() - INTERVAL '${days} days'
    GROUP BY DATE(created_at)
    ORDER BY date
  `;
  
  const trends = await queryAll(trendsQuery);

  // Fill in missing dates with zeros
  const result: Array<{ date: string; opened: number; resolved: number }> = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const existing = trends.find((t: any) => t.date === dateStr);
    result.push({
      date: dateStr,
      opened: existing ? parseInt(existing.opened) : 0,
      resolved: existing ? parseInt(existing.resolved) : 0,
    });
  }

  return NextResponse.json({
    success: true,
    data: result,
  });
}

export const GET = withErrorHandling(getHandler);
