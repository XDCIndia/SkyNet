import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://gateway:gateway@localhost:5433/xdc_gateway'
});

// GET /api/v1/network/block-comparison?height=<n>
// Issue #510 - Cross-Client Block Comparison Engine
export async function GET(request: NextRequest) {
  const client = await pool.connect();
  
  try {
    const { searchParams } = new URL(request.url);
    const heightParam = searchParams.get('height');
    
    if (!heightParam) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: height' },
        { status: 400 }
      );
    }

    const blockHeight = parseInt(heightParam);
    if (isNaN(blockHeight) || blockHeight < 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid height parameter' },
        { status: 400 }
      );
    }

    // Query all nodes for their block data at the given height
    const result = await client.query(`
      SELECT DISTINCT ON (n.id)
        n.id AS node_id,
        n.name,
        n.client_type,
        m.block_height,
        m.block_hash,
        m.peer_count,
        m.sync_percent,
        m.cpu_percent,
        m.memory_percent,
        m.is_syncing,
        m.collected_at
      FROM skynet.nodes n
      JOIN skynet.node_metrics m ON m.node_id = n.id
      WHERE n.is_active = true
        AND m.block_height = $1
        AND m.block_hash IS NOT NULL
        AND m.collected_at > NOW() - INTERVAL '30 minutes'
      ORDER BY n.id, m.collected_at DESC
    `, [blockHeight]);

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: true,
        blockHeight,
        timestamp: new Date().toISOString(),
        comparisons: [],
        consensus: null,
        divergent: false
      });
    }

    // Group by hash to find consensus
    const hashGroups = new Map<string, any[]>();
    const comparisons = result.rows.map((row: any) => ({
      nodeId: row.node_id,
      name: row.name,
      clientType: row.client_type,
      blockHeight: parseInt(row.block_height),
      blockHash: row.block_hash,
      peerCount: row.peer_count,
      syncPercent: row.sync_percent,
      cpuPercent: row.cpu_percent,
      memoryPercent: row.memory_percent,
      isSyncing: row.is_syncing,
      collectedAt: row.collected_at
    }));

    for (const comp of comparisons) {
      const existing = hashGroups.get(comp.blockHash) || [];
      existing.push(comp);
      hashGroups.set(comp.blockHash, existing);
    }

    // Determine consensus
    let consensus: string | null = null;
    let majorityCount = 0;
    const hashAgreements: { hash: string; count: number; nodes: string[] }[] = [];

    for (const [hash, nodes] of hashGroups) {
      if (nodes.length > majorityCount) {
        majorityCount = nodes.length;
        consensus = hash;
      }
      hashAgreements.push({
        hash,
        count: nodes.length,
        nodes: nodes.map((n: any) => n.name)
      });
    }

    const totalNodes = comparisons.length;
    const isDivergent = hashGroups.size > 1;

    return NextResponse.json({
      success: true,
      blockHeight,
      timestamp: new Date().toISOString(),
      comparisons,
      consensus: consensus ? {
        blockHash: consensus,
        agreeingNodes: majorityCount,
        totalNodes,
        agreementPercent: Math.round((majorityCount / totalNodes) * 100)
      } : null,
      divergent: isDivergent,
      hashGroups: hashAgreements,
      // Agreement matrix - which nodes agree with each other
      agreementMatrix: comparisons.map((comp: any) => ({
        node: comp.name,
        blockHash: comp.blockHash,
        agreesWithConsensus: comp.blockHash === consensus,
        divergentFrom: comparisons
          .filter((c: any) => c.blockHash !== comp.blockHash)
          .map((c: any) => c.name)
      }))
    });

  } catch (error: any) {
    console.error('Error in block comparison:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
