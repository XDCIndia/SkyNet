import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://gateway:gateway@localhost:5433/xdc_gateway'
});

// GET /api/v1/network/fork-status - Check for network forks
// Issue #452 - Network Fork Detection System
export async function GET(request: NextRequest) {
  const client = await pool.connect();
  
  try {
    // Find the most recent block height with multiple clients reporting
    // and check for hash divergence
    const result = await client.query(`
      WITH recent_metrics AS (
        SELECT DISTINCT ON (n.id, m.block_height)
          n.id AS node_id,
          n.name,
          m.block_height,
          m.block_hash,
          m.client_type,
          m.collected_at
        FROM skynet.nodes n
        JOIN skynet.node_metrics m ON m.node_id = n.id
        WHERE n.is_active = true
          AND m.block_hash IS NOT NULL
          AND m.collected_at > NOW() - INTERVAL '10 minutes'
        ORDER BY n.id, m.block_height, m.collected_at DESC
      ),
      heights_with_multiple_clients AS (
        SELECT block_height
        FROM recent_metrics
        GROUP BY block_height
        HAVING COUNT(DISTINCT node_id) >= 2
      ),
      hash_groups AS (
        SELECT 
          rm.block_height,
          rm.block_hash,
          json_agg(
            json_build_object(
              'id', rm.node_id,
              'name', rm.name,
              'clientType', rm.client_type
            )
          ) AS clients
        FROM recent_metrics rm
        JOIN heights_with_multiple_clients h ON h.block_height = rm.block_height
        GROUP BY rm.block_height, rm.block_hash
      ),
      divergence_check AS (
        SELECT 
          block_height,
          COUNT(*) AS hash_count,
          json_agg(
            json_build_object(
              'blockHash', block_hash,
              'clients', clients
            )
          ) AS hash_groups
        FROM hash_groups
        GROUP BY block_height
        HAVING COUNT(*) > 1
        ORDER BY block_height DESC
        LIMIT 1
      )
      SELECT * FROM divergence_check
    `);

    if (result.rows.length === 0) {
      // No fork detected - get latest block info from all clients for response
      const latestResult = await client.query(`
        SELECT DISTINCT ON (n.id)
          n.name,
          m.block_height AS "blockHeight",
          m.block_hash AS "blockHash",
          m.client_type AS "clientType"
        FROM skynet.nodes n
        JOIN skynet.node_metrics m ON m.node_id = n.id
        WHERE n.is_active = true
          AND m.block_hash IS NOT NULL
          AND m.collected_at > NOW() - INTERVAL '10 minutes'
        ORDER BY n.id, m.collected_at DESC
        LIMIT 10
      `);

      return NextResponse.json({
        forked: false,
        divergenceBlock: null,
        clients: latestResult.rows.map((row: any) => ({
          name: row.name,
          blockHash: row.blockHash,
          blockHeight: parseInt(row.blockHeight)
        }))
      });
    }

    // Fork detected!
    const divergence = result.rows[0];
    const hashGroups = divergence.hash_groups;
    
    // Find the majority hash (if any)
    let majorityHash = '';
    let majorityCount = 0;
    const allClients: any[] = [];
    
    for (const group of hashGroups) {
      const count = group.clients.length;
      if (count > majorityCount) {
        majorityCount = count;
        majorityHash = group.blockHash;
      }
      for (const client of group.clients) {
        allClients.push({
          name: client.name,
          blockHash: group.blockHash,
          blockHeight: parseInt(divergence.block_height),
          clientType: client.clientType
        });
      }
    }

    return NextResponse.json({
      forked: true,
      divergenceBlock: parseInt(divergence.block_height),
      majorityHash: majorityHash,
      clients: allClients
    });

  } catch (error: any) {
    console.error('Error checking fork status:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
