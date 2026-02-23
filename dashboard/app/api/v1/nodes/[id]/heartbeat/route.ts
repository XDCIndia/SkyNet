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
      storageType
    } = body;

    // Normalize clientType from version string if needed
    if (clientType === 'XDC' || clientType === 'unknown' || !clientType) {
      if (version) {
        const v = version.toLowerCase();
        if (v.includes('nethermind')) clientType = 'nethermind';
        else if (v.includes('erigon')) clientType = 'erigon';
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

    // Update node's last_seen and network info (Issue #68)
    // Also update coinbase and fingerprint if provided (Issue #71)
    // Extended data: os, system resources, security, storage (Task 2)
    await query(
      `UPDATE skynet.nodes 
       SET last_seen = NOW(), 
           is_active = true,
           client_type = COALESCE($2, client_type),
           client_version = COALESCE($3, client_version),
           network = COALESCE($4, network),
           chain_id = COALESCE($5, chain_id),
           coinbase = COALESCE($6, coinbase),
           fingerprint = COALESCE($7, fingerprint),
           os_info = COALESCE($8, os_info),
           os_type = COALESCE($9, os_type),
           os_release = COALESCE($10, os_release),
           os_arch = COALESCE($11, os_arch),
           kernel_version = COALESCE($12, kernel_version),
           cpu_percent = COALESCE($13, cpu_percent),
           memory_percent = COALESCE($14, memory_percent),
           disk_percent = COALESCE($15, disk_percent),
           disk_used_gb = COALESCE($16, disk_used_gb),
           disk_total_gb = COALESCE($17, disk_total_gb),
           storage_type = COALESCE($18, storage_type),
           security_score = COALESCE($19, security_score),
           security_issues = COALESCE($20, security_issues)
       WHERE id = $1`,
      [
        nodeId, 
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
        security?.issues ? JSON.stringify(security.issues) : null
      ]
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
