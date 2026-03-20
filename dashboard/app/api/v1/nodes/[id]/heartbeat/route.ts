import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { queryWithResilience } from '@/lib/db/resilient-client';

// Severity levels for incident classification (Issue #511)
type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

// Issue type to severity mapping (Issue #511)
const ISSUE_SEVERITY_MAP: Record<string, Severity> = {
  fork_detected: 'CRITICAL',
  sync_stall: 'HIGH',
  node_down: 'CRITICAL',
};

/**
 * Determine severity for peer_drop based on duration
 */
function getPeerDropSeverity(durationMinutes: number): Severity {
  return durationMinutes > 10 ? 'HIGH' : 'MEDIUM';
}

/**
 * Determine severity for disk_critical based on disk usage percentage
 */
function getDiskSeverity(diskPercent: number): Severity {
  if (diskPercent > 95) return 'CRITICAL';
  if (diskPercent > 85) return 'HIGH';
  return 'MEDIUM';
}

/**
 * Create incident with proper severity (Issue #511)
 */
async function createIncident(
  nodeId: string,
  type: string,
  severity: Severity,
  message: string,
  context?: Record<string, any>
): Promise<void> {
  try {
    await query(
      `INSERT INTO skynet.incidents 
       (node_id, type, severity, message, context, detected_at, status)
       VALUES ($1, $2, $3, $4, $5, NOW(), 'active')
       ON CONFLICT DO NOTHING`,
      [nodeId, type, severity, message, context ? JSON.stringify(context) : null]
    );
  } catch (error) {
    console.error(`Failed to create incident for node ${nodeId}:`, error);
  }
}

// POST /api/v1/nodes/[id]/heartbeat - Receive heartbeat from node agent
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now();
  const nodeId = params.id;
  
  try {
    // Parse heartbeat data with sanitization for malformed JSON (e.g., .03 -> 0.03)
    const rawBody = await request.text();
    const sanitizedBody = rawBody.replace(/":\s*\.(\d+)/g, '": 0.$1');
    let body;
    try {
      body = JSON.parse(sanitizedBody);
    } catch (e) {
      console.error(`[Heartbeat:${nodeId}] Failed to parse JSON:`, rawBody.substring(0, 500));
      return NextResponse.json(
        { error: 'Invalid JSON in heartbeat' },
        { status: 400 }
      );
    }
    let { 
      blockHeight, 
      blockHash,
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
      lastRestart,
      // New fields for enhanced alerting
      forkDetected,
      peerDropDuration,
      diskCritical,
      dockerImage,
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

    // Check if node exists — support both UUID and name lookups
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nodeId);
    let resolvedNodeId = nodeId;
    
    let nodeResult;
    if (isUUID) {
      nodeResult = await queryWithResilience(
        'SELECT id FROM skynet.nodes WHERE id = $1',
        [nodeId],
        { maxRetries: 3, baseDelay: 100 }
      );
    } else {
      // nodeId is a name string, look up by name
      nodeResult = await queryWithResilience(
        'SELECT id FROM skynet.nodes WHERE name = $1',
        [nodeId],
        { maxRetries: 3, baseDelay: 100 }
      );
      if (nodeResult.rows.length > 0) {
        resolvedNodeId = nodeResult.rows[0].id;
      }
    }

    if (nodeResult.rows.length === 0) {
      // Auto-create node if it doesn't exist
      const newNode = await queryWithResilience(
        `INSERT INTO skynet.nodes (name, network, status, is_active, last_seen, client_type)
         VALUES ($1, $2, 'active', true, NOW(), $3)
         RETURNING id`,
        [nodeId, network || 'mainnet', clientType || 'unknown'],
        { maxRetries: 2, baseDelay: 100 }
      );
      resolvedNodeId = newNode.rows[0].id;
    }

    // Insert metrics with system resources (with retry)
    await queryWithResilience(
      `INSERT INTO skynet.node_metrics 
       (node_id, block_height, block_hash, peer_count, is_syncing, client_type, client_version, 
        cpu_percent, memory_percent, disk_percent, disk_used_gb, disk_total_gb,
        storage_type, os_type, os_release, os_arch, kernel_version, ipv4,
        security_score, security_issues, collected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW())`,
      [
        resolvedNodeId,
        blockHeight || 0,
        blockHash || null,
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
      ],
      { maxRetries: 3, baseDelay: 100 }
    );

    // Update node's last_seen and network info
    await queryWithResilience(
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
           ipv4 = COALESCE($24, ipv4),
           docker_image = COALESCE($25, docker_image)
       WHERE id = $1`,
      [
        resolvedNodeId,
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
        os?.ipv4 || null,
        dockerImage || null
      ],
      { maxRetries: 3, baseDelay: 100 }
    );

    // Update enode if provided
    if (enode) {
      await queryWithResilience(
        `UPDATE skynet.nodes SET enode = $1 WHERE id = $2 AND (enode IS NULL OR enode != $1)`,
        [enode, resolvedNodeId],
        { maxRetries: 2, baseDelay: 50 }
      );
    }

    // Enhanced Incident Creation with Severity Classification (Issue #511)
    
    // Fork detection - CRITICAL
    if (forkDetected === true) {
      await createIncident(
        resolvedNodeId,
        'fork_detected',
        'CRITICAL',
        `Fork detected at block ${blockHeight}`,
        { blockHeight, clientType, version }
      );
    }
    
    // Sync stall - HIGH
    if (stalled === true) {
      await createIncident(
        resolvedNodeId,
        'sync_stall',
        'HIGH',
        `Block stalled at ${blockHeight} for 5+ minutes with ${peerCount} peers`,
        { blockHeight, peerCount, clientType }
      );
    }
    
    // Peer drop with duration
    if (peerDropDuration && peerDropDuration > 0) {
      const severity = getPeerDropSeverity(peerDropDuration);
      await createIncident(
        resolvedNodeId,
        'peer_drop',
        severity,
        `Peer count dropped for ${peerDropDuration} minutes`,
        { peerCount, durationMinutes: peerDropDuration }
      );
    }
    
    // Disk critical with severity based on usage
    if (diskCritical === true && system?.diskPercent) {
      const severity = getDiskSeverity(system.diskPercent);
      await createIncident(
        resolvedNodeId,
        'disk_critical',
        severity,
        `Disk usage critical at ${system.diskPercent}%`,
        { diskPercent: system.diskPercent, diskUsedGb: system.diskUsedGb }
      );
    }

    // Update node with stalled status and last restart time
    if (lastRestart) {
      await queryWithResilience(
        `UPDATE skynet.nodes SET stalled = $2, last_restart = $3::timestamptz WHERE id = $1`,
        [resolvedNodeId, stalled === true, lastRestart],
        { maxRetries: 2, baseDelay: 50 }
      );
    } else {
      await queryWithResilience(
        `UPDATE skynet.nodes SET stalled = $2 WHERE id = $1`,
        [resolvedNodeId, stalled === true],
        { maxRetries: 2, baseDelay: 50 }
      );
    }

    // Issue #452: Fork Detection - Check for divergence when blockHash is provided
    if (blockHash && blockHeight) {
      await checkForForkAndCreateIncident(resolvedNodeId, blockHeight, blockHash, clientType);
    }

    const duration = Date.now() - startTime;
    return NextResponse.json({
      success: true,
      message: 'Heartbeat recorded',
      nodeId,
      durationMs: duration,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`[Heartbeat:${nodeId}] Error processing heartbeat:`, error);
    
    // Return 500 with Retry-After header for agent backoff (Issue #501)
    const response = NextResponse.json(
      { 
        error: 'Failed to process heartbeat',
        nodeId,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
    
    // Add Retry-After header so agents back off properly
    response.headers.set('Retry-After', '30');
    
    return response;
  }
}

// GET /api/v1/nodes/[id]/heartbeat - Get latest heartbeat for node
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const nodeId = params.id;

    const result = await queryWithResilience(
      `SELECT block_height, peer_count, is_syncing, client_type, version, collected_at
       FROM skynet.node_metrics
       WHERE node_id = $1
       ORDER BY collected_at DESC
       LIMIT 1`,
      [nodeId],
      { maxRetries: 2, baseDelay: 50 }
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

// Issue #452: Check for fork and create incident if divergence detected
async function checkForForkAndCreateIncident(
  nodeId: string, 
  blockHeight: number, 
  blockHash: string,
  clientType: string = 'unknown'
): Promise<void> {
  try {
    // Check if any other node has same block height but different block_hash
    const result = await query(
      `SELECT n2.id, n2.name, n2.block_hash, n2.client_type 
       FROM skynet.nodes n2
       WHERE n2.block_height = $1 
         AND n2.id != $2 
         AND n2.block_hash != $3
         AND n2.is_active = true
       LIMIT 1`,
      [blockHeight, nodeId, blockHash]
    );

    if (result.rows.length === 0) {
      return; // No fork detected
    }

    // Fork detected! Get this node's name
    const nodeResult = await query(
      'SELECT name FROM skynet.nodes WHERE id = $1',
      [nodeId]
    );
    const nodeName = nodeResult.rows[0]?.name || nodeId;

    // Create fingerprint for deduplication
    const fingerprint = `fork-${blockHeight}-${blockHash.substring(0, 16)}`;

    // Check if incident already exists for this block height
    const existingResult = await query(
      `SELECT id FROM skynet.incidents 
       WHERE fingerprint = $1 AND status IN ('open', 'active')
       LIMIT 1`,
      [fingerprint]
    );

    if (existingResult.rows.length > 0) {
      return; // Incident already exists
    }

    // Create CRITICAL incident (Issue #452)
    const divergentNode = result.rows[0];

    await query(
      `INSERT INTO skynet.incidents 
       (node_id, type, severity, fingerprint, message, title, description, context, status, first_seen, last_seen, occurrence_count, auto_detected)
       VALUES ($1, 'fork_detected', 'CRITICAL', $2, $3, $4, $5, $6, 'active', NOW(), NOW(), 1, true)`,
      [
        nodeId,
        fingerprint,
        `Fork detected at block ${blockHeight}. ${nodeName} (${clientType}): ${blockHash} vs ${divergentNode.name} (${divergentNode.client_type}): ${divergentNode.block_hash}`,
        `Fork Detected at Block #${blockHeight}`,
        `Network fork detected at block height ${blockHeight}. Node ${nodeName} (${clientType}) has divergent block hash ${blockHash} compared to ${divergentNode.name}.`,
        JSON.stringify({
          blockHeight,
          divergentNode: { id: nodeId, name: nodeName, blockHash, clientType },
          otherNode: { 
            id: divergentNode.id, 
            name: divergentNode.name, 
            blockHash: divergentNode.block_hash,
            clientType: divergentNode.client_type 
          },
          detectedAt: new Date().toISOString()
        })
      ]
    );

    console.log(`🚨 FORK DETECTED at block ${blockHeight} by node ${nodeName}`);
  } catch (error) {
    console.error('Error checking for fork:', error);
    // Don't throw - we don't want fork detection to break heartbeats
  }
}
