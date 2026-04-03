import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v2/peers/inject
 *
 * Issues #1/#2 — Batch Peer Injection (Nethermind + Erigon stuck peers)
 *
 * Given a nodeId, fetches all healthy fleet enodes from the DB and calls
 * admin_addPeer on each via the target node's RPC URL.
 *
 * Body: { nodeId: string, source?: string }
 * Returns: { injected: number, failed: number, enodes: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nodeId, source = 'manual' } = body;

    if (!nodeId) {
      return NextResponse.json({ success: false, error: 'nodeId required' }, { status: 400 });
    }

    // Fetch target node RPC URL
    const nodeResult = await query(
      `SELECT id, name, rpc_url, client_type FROM skynet.nodes WHERE id = $1 AND is_active = true`,
      [nodeId]
    );

    if (!nodeResult.rows.length) {
      return NextResponse.json({ success: false, error: 'Node not found or inactive' }, { status: 404 });
    }

    const targetNode = nodeResult.rows[0];
    const rpcUrl = targetNode.rpc_url;

    if (!rpcUrl) {
      return NextResponse.json({ success: false, error: 'Node has no RPC URL configured' }, { status: 400 });
    }

    // Fetch healthy enodes from DB — registered active nodes with valid enodes (excluding self)
    const enodesResult = await query(
      `SELECT DISTINCT n.enode, n.name, n.client_type
       FROM skynet.nodes n
       WHERE n.is_active = true
         AND n.enode IS NOT NULL AND n.enode != ''
         AND n.id != $1
         AND n.last_heartbeat > NOW() - INTERVAL '15 minutes'
       LIMIT 50`,
      [nodeId]
    );

    // Also get enodes from healthy peer snapshots
    const peerEnodesResult = await query(
      `SELECT DISTINCT ps.peer_enode AS enode
       FROM skynet.peer_snapshots ps
       WHERE ps.collected_at > NOW() - INTERVAL '30 minutes'
         AND ps.peer_enode IS NOT NULL AND ps.peer_enode != ''
         AND ps.node_id != $1
       LIMIT 50`,
      [nodeId]
    );

    // Deduplicate
    const enodeSet = new Set<string>();
    for (const r of enodesResult.rows) {
      if (r.enode) enodeSet.add(r.enode);
    }
    for (const r of peerEnodesResult.rows) {
      if (r.enode) enodeSet.add(r.enode);
    }

    const enodes = Array.from(enodeSet);

    if (!enodes.length) {
      return NextResponse.json({
        success: true,
        injected: 0,
        failed: 0,
        enodes: [],
        message: 'No healthy peer enodes found in fleet',
      });
    }

    // Call admin_addPeer on target node for each enode
    let injected = 0;
    let failed = 0;

    for (const enode of enodes) {
      try {
        const rpcRes = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'admin_addPeer',
            params: [enode],
            id: 1,
          }),
          signal: AbortSignal.timeout(5000),
        });

        const rpcData = await rpcRes.json();
        if (rpcData.result === true || rpcData.result === 'OK') {
          injected++;
        } else {
          logger.debug('[PeerInject] admin_addPeer returned non-true', { enode, result: rpcData.result });
          injected++; // Many clients return null but still add the peer
        }
      } catch (err: any) {
        logger.warn('[PeerInject] Failed to inject peer', { nodeId, enode, err: err.message });
        failed++;
      }
    }

    // Log the injection event to peer_injection_log table (Issue #40)
    try {
      await query(
        `INSERT INTO skynet.peer_injection_log (node_id, injected_count, failed_count, source, injected_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT DO NOTHING`,
        [nodeId, injected, failed, source]
      );
    } catch (logErr: any) {
      // Table may not exist yet — ignore
      if (!logErr.message?.includes('does not exist')) {
        logger.error('[PeerInject] Failed to write injection log', { err: logErr.message });
      }
    }

    logger.info('[PeerInject] Peer injection complete', {
      nodeId,
      nodeName: targetNode.name,
      total: enodes.length,
      injected,
      failed,
      source,
    });

    return NextResponse.json({
      success: true,
      nodeId,
      nodeName: targetNode.name,
      total: enodes.length,
      injected,
      failed,
      enodes,
      source,
    });
  } catch (error: any) {
    logger.error('[PeerInject] Unexpected error', { err: error.message });
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
