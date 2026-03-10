import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// POST /api/v1/nodes/[id]/heartbeat - Receive heartbeat from node agent
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const nodeId = params.id;
    
    // Parse heartbeat data with sanitization for malformed JSON (e.g., .03 -> 0.03)
    const rawBody = await request.text();
    const sanitizedBody = rawBody.replace(/":\s*\.(\d+)/g, '": 0.$1');
    let body;
    try {
      body = JSON.parse(sanitizedBody);
    } catch (e) {
      console.error('Failed to parse heartbeat JSON:', rawBody.substring(0, 500));
      return NextResponse.json(
        { error: 'Invalid JSON in heartbeat' },
        { status: 400 }
      );
    }
    let { 
      blockHeight, 
      peerCount, 
      isSyncing, 
      clientType,
      version,
      network,
      chainId,
      enode,
      coinbase,
      fingerprint,
      os,
      system,
      security,
      storageType,
      stalled,
      lastRestart
    } = body;

    // Normalize clientType from version string if needed
    if (clientType === 'XDC' || clientType === 'unknown' || !clientType) {
      if (version) {
        const v = version.toLowerCase();
        if (v.includes('nethermind')) clientType = 'nethermind';
        else if (v.includes('erigon')) clientType = 'erigon';
        else if (v.includes('reth')) clientType = 'reth';
        else if (v.includes('xdc') || v.includes('geth')) clientType = 'geth';
      }
    }

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

    // Insert metrics with system resources
    await query(
      `INSERT INTO skynet.node_metrics 
       (node_id, block_height, peer_count, is_syncing, client_type, client_version, 
        cpu_percent, memory_percent, disk_percent, disk_used_gb, disk_total_gb,
        storage_type, os_type, os_release, os_arch, kernel_version, ipv4,
        security_score, security_issues, collected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())`,
      [
        nodeId,
        blockHeight || 0,
        peerCount || 0,
        isSyncing || false,
        clientType || 'unknown',
        version || '',
        system?.cpuPercent ?? null,
        system?.memoryPercent ?? null,
        system?.diskPercent ?? null,
        system?.diskUsedGb ?? null,
        system?.diskTotalGb ?? null,
        storageType || null,
        os?.type || null,
        os?.release || null,
        os?.arch || null,
        os?.kernel || null,
        os?.ipv4 || null,
        security?.score ?? null,
        security?.issues ? JSON.stringify(security.issues) : null
      ]
    );

    // Update node's last_seen and network info (Issue #68)
    // Also update coinbase and fingerprint if provided (Issue #71)
    // Extended data: os, system resources, security, storage (Task 2)
    await query(
      `UPDATE skynet.nodes 
       SET last_seen = NOW(), 
           is_active = true,
           block_height = COALESCE($2, block_height),
           peer_count = COALESCE($3, peer_count),
           is_syncing = COALESCE($4, is_syncing),
           client_type = CASE
                           WHEN client_type IN ('reth','nethermind','erigon') THEN client_type
                           ELSE COALESCE($5, client_type)
                         END,
           client_version = CASE
                              WHEN client_type IN ('reth','nethermind','erigon')
                                   AND $5 IS NOT NULL AND $5 != client_type THEN client_version
                              ELSE COALESCE($6, client_version)
                            END,
           network = CASE
                      WHEN network = 'apothem' THEN 'apothem'
                      ELSE COALESCE($7, network)
                    END,
           chain_id = CASE
                        WHEN network = 'apothem' THEN 51
                        WHEN network = 'mainnet'  THEN 50
                        ELSE COALESCE($8, chain_id)
                      END,
           coinbase = COALESCE($9, coinbase),
           fingerprint = COALESCE($10, fingerprint),
           os_info = COALESCE($11, os_info),
           os_type = COALESCE($12, os_type),
           os_release = COALESCE($13, os_release),
           os_arch = COALESCE($14, os_arch),
           kernel_version = COALESCE($15, kernel_version),
           cpu_percent = COALESCE($16, cpu_percent),
           memory_percent = COALESCE($17, memory_percent),
           disk_percent = COALESCE($18, disk_percent),
           disk_used_gb = COALESCE($19, disk_used_gb),
           disk_total_gb = COALESCE($20, disk_total_gb),
           storage_type = COALESCE($21, storage_type),
           security_score = COALESCE($22, security_score),
           security_issues = COALESCE($23, security_issues),
           ipv4 = COALESCE($24, ipv4)
       WHERE id = $1`,
      [
        nodeId,
        blockHeight !== undefined && blockHeight !== null ? Number(blockHeight) : null,
        peerCount !== undefined && peerCount !== null ? Number(peerCount) : null,
        isSyncing ?? null,
        clientType || null, 
        version || null, 
        network || null, 
        chainId ?? null, 
        coinbase || null, 
        fingerprint || null,
        os ? JSON.stringify(os) : null,
        os?.type || null,
        os?.release || null,
        os?.arch || null,
        os?.kernel || null,
        system?.cpuPercent ?? null,
        system?.memoryPercent ?? null,
        system?.diskPercent ?? null,
        system?.diskUsedGb ?? null,
        system?.diskTotalGb ?? null,
        storageType || null,
        security?.score ?? null,
        security?.issues ? JSON.stringify(security.issues) : null,
        os?.ipv4 || null
      ]
    );

    // Update enode if provided
    if (enode) {
      await query(
        `UPDATE skynet.nodes SET enode = $1 WHERE id = $2 AND (enode IS NULL OR enode != $1)`,
        [enode, nodeId]
      );
    }

    // SkyOne: Auto-create incident if stalled=true
    if (stalled === true) {
      await query(
        `INSERT INTO skynet.incidents 
         (node_id, type, severity, message, created_at, status)
         VALUES ($1, 'sync_stall', 'warning', $2, NOW(), 'open')
         ON CONFLICT DO NOTHING`,
        [nodeId, `Block stalled at ${blockHeight} for 5+ minutes with ${peerCount} peers`]
      );
    }

    // SkyOne: Update node with stalled status and last restart time
    if (lastRestart) {
      await query(
        `UPDATE skynet.nodes SET stalled = $2, last_restart = $3::timestamptz WHERE id = $1`,
        [nodeId, stalled === true, lastRestart]
      );
    } else {
      await query(
        `UPDATE skynet.nodes SET stalled = $2 WHERE id = $1`,
        [nodeId, stalled === true]
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
