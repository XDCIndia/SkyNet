/**
 * GET /api/v2/fleet/peers
 *
 * Issue #62 — Peer Fleet View
 *
 * For each active node, queries admin_peers via the SkyOne agent (RPC).
 * Returns a peer connection matrix showing which fleet nodes are connected
 * to each other, plus the raw peer lists.
 *
 * Response shape:
 * {
 *   nodes: { id, name, clientType, enode }[],
 *   matrix: Record<nodeId, nodeId[]>,   // nodeId → array of fleet nodeIds it is connected to
 *   peerLists: Record<nodeId, Peer[]>,  // raw admin_peers output per node
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

interface AdminPeer {
  id?: string;          // enode id (public key)
  name?: string;        // client identifier
  caps?: string[];
  network?: {
    remoteAddress?: string;
  };
  protocols?: Record<string, any>;
}

interface FleetNode {
  id: string;
  name: string;
  clientType: string | null;
  enode: string | null;
  rpcUrl: string | null;
}

/** Call admin_peers on a node via its RPC URL */
async function fetchAdminPeers(rpcUrl: string): Promise<AdminPeer[]> {
  try {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'admin_peers',
        params: [],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return [];
    const json = await response.json();
    return Array.isArray(json?.result) ? json.result : [];
  } catch {
    return [];
  }
}

/** Extract enode ID (pubkey part) from a full enode string */
function enodeId(enode: string | null): string | null {
  if (!enode) return null;
  // enode://PUBKEY@ip:port
  const match = enode.match(/^enode:\/\/([0-9a-fA-F]+)@/);
  return match ? match[1].toLowerCase() : null;
}

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    // Fetch all active fleet nodes
    const nodesResult = await query(`
      SELECT
        id,
        name,
        client_type  AS "clientType",
        enode,
        rpc_url      AS "rpcUrl"
      FROM skynet.nodes
      WHERE is_active = true
        AND last_heartbeat > NOW() - INTERVAL '10 minutes'
      ORDER BY name
    `);

    const fleetNodes: FleetNode[] = nodesResult.rows;

    if (fleetNodes.length === 0) {
      return NextResponse.json({
        nodes: [],
        matrix: {},
        peerLists: {},
      });
    }

    // Build a lookup: enode-pubkey → nodeId (for fleet nodes only)
    const enodeToNodeId = new Map<string, string>();
    for (const node of fleetNodes) {
      const eid = enodeId(node.enode);
      if (eid) enodeToNodeId.set(eid, node.id);
    }

    // Query admin_peers for every fleet node that has an rpcUrl
    const peerListsRaw: Record<string, AdminPeer[]> = {};
    await Promise.allSettled(
      fleetNodes
        .filter(n => n.rpcUrl)
        .map(async (node) => {
          const peers = await fetchAdminPeers(node.rpcUrl!);
          peerListsRaw[node.id] = peers;
        })
    );

    // Build connection matrix: nodeId → [fleet nodeIds it is connected to]
    const matrix: Record<string, string[]> = {};
    for (const node of fleetNodes) {
      matrix[node.id] = [];
      const peers = peerListsRaw[node.id] ?? [];
      for (const peer of peers) {
        // peer.id is the enode public key (without 0x prefix in geth/reth)
        const pid = peer.id?.toLowerCase().replace(/^0x/, '');
        if (pid && enodeToNodeId.has(pid)) {
          const connectedNodeId = enodeToNodeId.get(pid)!;
          if (connectedNodeId !== node.id) {
            matrix[node.id].push(connectedNodeId);
          }
        }
      }
    }

    // Clean peerLists output (strip nulls, trim to 50 peers per node)
    const peerLists: Record<string, AdminPeer[]> = {};
    for (const [nodeId, peers] of Object.entries(peerListsRaw)) {
      peerLists[nodeId] = peers.slice(0, 50).map(p => ({
        id: p.id,
        name: p.name,
        caps: p.caps,
        remoteAddress: p.network?.remoteAddress,
      }));
    }

    return NextResponse.json({
      nodes: fleetNodes.map(n => ({
        id: n.id,
        name: n.name,
        clientType: n.clientType,
        enode: n.enode,
      })),
      matrix,
      peerLists,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Fleet Peers] Error building peer matrix', { error });
    return NextResponse.json(
      { error: 'Failed to build peer fleet matrix' },
      { status: 500 }
    );
  }
}
