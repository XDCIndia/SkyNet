import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      nodeId, 
      blockHeight = 0, 
      peerCount = 0, 
      network = 'mainnet',
      chainId = 50,
      isSyncing = false,
      clientType = 'unknown'
    } = body;
    
    if (!nodeId) {
      return NextResponse.json(
        { success: false, error: 'nodeId required' },
        { status: 400 }
      );
    }
    
    // Upsert node
    await query(
      `INSERT INTO skynet.nodes (id, name, network, status, last_heartbeat, client_type)
       VALUES ($1, $2, $3, 'active', NOW(), $4)
       ON CONFLICT (id) DO UPDATE SET
         network = EXCLUDED.network,
         status = 'active',
         last_heartbeat = NOW(),
         client_type = EXCLUDED.client_type`,
      [nodeId, nodeId.split('-')[0] || nodeId, network, clientType]
    );
    
    // Insert metrics
    await query(
      `INSERT INTO skynet.node_metrics 
       (node_id, block_height, peer_count, is_syncing, collected_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [nodeId, blockHeight, peerCount, isSyncing]
    );
    
    return NextResponse.json({
      success: true,
      data: { ok: true }
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process heartbeat' },
      { status: 500 }
    );
  }
}
