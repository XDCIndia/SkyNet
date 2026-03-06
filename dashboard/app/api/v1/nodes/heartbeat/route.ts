import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://gateway:gateway@localhost:5433/xdc_gateway'
});

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();
    const { 
      nodeId, 
      blockHeight = 0, 
      peerCount = 0, 
      network = 'mainnet',
      chainId = 50,
      isSyncing = false,
      clientType = 'unknown',
      diskPercent = 0,
      memoryPercent = 0,
      cpuPercent = 0
    } = body;
    
    if (!nodeId) {
      return NextResponse.json(
        { success: false, error: 'nodeId required' },
        { status: 400 }
      );
    }
    
    // Upsert node
    await client.query(
      `INSERT INTO skynet.nodes (id, name, network, status, last_heartbeat, client_type)
       VALUES ($1, $2, $3, 'active', NOW(), $4)
       ON CONFLICT (id) DO UPDATE SET
         network = EXCLUDED.network,
         status = 'active',
         last_heartbeat = NOW(),
         client_type = EXCLUDED.client_type`,
      [nodeId, nodeId.split('-')[0] || nodeId, network, clientType]
    );
    
    // Insert metrics with system data
    await client.query(
      `INSERT INTO skynet.node_metrics 
       (node_id, block_height, peer_count, is_syncing, disk_percent, memory_percent, cpu_percent, collected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [nodeId, blockHeight, peerCount, isSyncing, diskPercent, memoryPercent, cpuPercent]
    );
    
    return NextResponse.json({
      success: true,
      data: { ok: true }
    });
  } catch (error: any) {
    console.error('Heartbeat error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process heartbeat' },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
