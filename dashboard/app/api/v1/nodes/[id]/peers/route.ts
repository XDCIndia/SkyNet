import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, isDashboardReadRequest } from '@/lib/auth';

/**
 * GET /api/v1/nodes/[id]/peers
 * Get peers for a specific node from latest heartbeat
 */
export async function GET(
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
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    // Get latest peer snapshots for this node
    const result = await query(`
      SELECT DISTINCT ON (peer_enode)
        id,
        peer_enode as enode,
        peer_name as name,
        remote_ip as ip,
        remote_port as port,
        client_version,
        protocols,
        direction,
        country,
        city,
        collected_at
      FROM skynet.peer_snapshots
      WHERE node_id = $1
        AND collected_at > NOW() - INTERVAL '5 minutes'
      ORDER BY peer_enode, collected_at DESC
      LIMIT $2
    `, [id, limit]);

    // Format peers
    const peers = result.rows.map(row => ({
      id: row.id.toString(),
      enode: row.enode,
      name: row.name || 'Unknown',
      ip: row.ip || 'unknown',
      port: row.port || 0,
      clientVersion: row.client_version || 'Unknown',
      protocols: row.protocols || [],
      direction: row.direction || 'outbound',
      country: row.country || 'Unknown',
      city: row.city || 'Unknown',
      lastSeen: row.collected_at,
    }));

    return NextResponse.json({
      nodeId: id,
      peers,
      total: peers.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error fetching node peers:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch node peers', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
