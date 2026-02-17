import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// POST /api/v1/nodes/[id]/heartbeat - Receive heartbeat from node agent
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const nodeId = params.id;
    
    // Parse heartbeat data
    const body = await request.json();
    const { 
      blockHeight, 
      peerCount, 
      isSyncing, 
      clientType,
      version,
      enode 
    } = body;

    // Check if node exists
    const nodeResult = await query(
      'SELECT id FROM skynet.nodes WHERE id = $1',
      [nodeId]
    );

    if (nodeResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
    }

    // Insert metrics
    await query(
      `INSERT INTO skynet.node_metrics 
       (node_id, block_height, peer_count, is_syncing, client_type, client_version, collected_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        nodeId,
        blockHeight || 0,
        peerCount || 0,
        isSyncing || false,
        clientType || 'unknown',
        version || ''
      ]
    );

    // Update node's last_seen
    await query(
      `UPDATE skynet.nodes 
       SET last_seen = NOW(), is_active = true 
       WHERE id = $1`,
      [nodeId]
    );

    // Update enode if provided
    if (enode) {
      await query(
        `UPDATE skynet.nodes SET enode = $1 WHERE id = $2 AND (enode IS NULL OR enode != $1)`,
        [enode, nodeId]
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Heartbeat recorded',
      nodeId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing heartbeat:', error);
    return NextResponse.json(
      { error: 'Failed to process heartbeat' },
      { status: 500 }
    );
  }
}

// GET /api/v1/nodes/[id]/heartbeat - Get latest heartbeat for node
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const nodeId = params.id;

    const result = await query(
      `SELECT block_height, peer_count, is_syncing, client_type, version, collected_at
       FROM skynet.node_metrics
       WHERE node_id = $1
       ORDER BY collected_at DESC
       LIMIT 1`,
      [nodeId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'No heartbeats found for this node' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching heartbeat:', error);
    return NextResponse.json(
      { error: 'Failed to fetch heartbeat' },
      { status: 500 }
    );
  }
}
