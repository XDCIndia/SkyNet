import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse, isDashboardReadRequest } from '@/lib/auth';
import { z } from 'zod';

const LogsBodySchema = z.object({
  lines: z.coerce.number().int().min(1).max(10000).default(100),
  filter: z.string().max(200).optional(),
});

/**
 * POST /api/v1/nodes/[id]/logs
 * Fetch node logs (mock implementation)
 * In production, this would SSH to the node or use a log aggregation service
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate request
    if (!isDashboardReadRequest(request)) {
      const auth = await authenticateRequest(request);
      if (!auth.valid) {
        return unauthorizedResponse(auth.error);
      }
    }

    const { id } = await params;
    const body = await request.json();
    const validation = LogsBodySchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }
    const { lines, filter } = validation.data;

    // Mock log data - in production, fetch from node via SSH or log aggregation
    const mockLogs = generateMockLogs(lines, filter);

    return NextResponse.json({
      logs: mockLogs,
      timestamp: new Date().toISOString(),
      nodeId: id,
      lines: mockLogs.length,
      filter: filter || null,
    });
  } catch (error: any) {
    console.error('Error fetching logs:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch logs', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// Generate realistic mock logs
function generateMockLogs(count: number, filter?: string): string[] {
  const levels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
  const components = [
    'eth',
    'p2p',
    'rpc',
    'consensus',
    'trie',
    'miner',
    'downloader',
    'txpool'
  ];
  
  const messages = [
    'Imported new chain segment',
    'Commit new mining work',
    'Signed recently, must wait for others',
    'Peer connected',
    'Peer disconnected',
    'Block synchronisation started',
    'Synchronisation completed',
    'Regenerated local transaction journal',
    'Database compacting',
    'Committed new head block',
    'Loop round state',
    'New block',
    'Transaction pool price threshold updated',
    'Message handling timed out',
    'Header broke chain ancestry',
  ];

  const logs: string[] = [];
  const baseTime = Date.now() - count * 5000;

  for (let i = 0; i < count; i++) {
    const timestamp = new Date(baseTime + i * 5000).toISOString();
    const level = levels[Math.floor(Math.random() * levels.length)];
    const component = components[Math.floor(Math.random() * components.length)];
    const message = messages[Math.floor(Math.random() * messages.length)];
    const blockNum = 85000000 + Math.floor(Math.random() * 1000);
    
    const log = `${timestamp} [${level}] ${component}: ${message} number=${blockNum} hash=0x${generateHex(64)}`;
    
    if (filter) {
      const filterLower = filter.toLowerCase();
      if (level.toLowerCase() === filterLower || 
          message.toLowerCase().includes(filterLower) ||
          component.toLowerCase().includes(filterLower)) {
        logs.push(log);
      }
    } else {
      logs.push(log);
    }
  }

  return logs;
}

function generateHex(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
