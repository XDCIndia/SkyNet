import { NextRequest, NextResponse } from 'next/server';
import { queryWithResilience } from '@/lib/db/resilient-client';

/**
 * GET /api/v1/nodes/:id/peers
 *
 * Returns the latest peer snapshot for a node, plus aggregated diversity counts
 * from the nodes table.
 *
 * Response shape:
 * {
 *   diversity: { geth: N, erigon: N, nethermind: N, reth: N, unknown: N, total: N },
 *   peers: [{ ip, clientType, clientVersion, caps, direction, country, city, lat, lng }],
 *   capturedAt: ISO string | null
 * }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id: nodeId } = params;

  try {
    // Fetch diversity counts from nodes table
    const diversityResult = await queryWithResilience(
      `SELECT 
         peer_geth    AS geth,
         peer_erigon  AS erigon,
         peer_nm      AS nethermind,
         peer_reth    AS reth,
         peer_unknown AS unknown
       FROM skynet.nodes
       WHERE id = $1`,
      [nodeId],
      { maxRetries: 2, baseDelay: 100 }
    );

    if (diversityResult.rowCount === 0) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    const div = diversityResult.rows[0];
    const total =
      (div.geth ?? 0) +
      (div.erigon ?? 0) +
      (div.nethermind ?? 0) +
      (div.reth ?? 0) +
      (div.unknown ?? 0);

    const diversity = {
      geth: div.geth ?? 0,
      erigon: div.erigon ?? 0,
      nethermind: div.nethermind ?? 0,
      reth: div.reth ?? 0,
      unknown: div.unknown ?? 0,
      total,
    };

    // Fetch latest peer snapshot batch (peers with same max(collected_at))
    const peersResult = await queryWithResilience(
      `SELECT
         remote_ip        AS ip,
         client_type      AS "clientType",
         client_version   AS "clientVersion",
         protocols        AS caps,
         direction,
         country,
         city,
         collected_at     AS "capturedAt"
       FROM skynet.peer_snapshots
       WHERE node_id = $1
         AND collected_at = (
           SELECT MAX(collected_at)
           FROM skynet.peer_snapshots
           WHERE node_id = $1
         )
       ORDER BY collected_at DESC
       LIMIT 100`,
      [nodeId],
      { maxRetries: 2, baseDelay: 100 }
    );

    const capturedAt =
      peersResult.rows.length > 0
        ? peersResult.rows[0].capturedAt ?? null
        : null;

    const peers = peersResult.rows.map((r) => ({
      ip: r.ip ?? '',
      clientType: r.clientType ?? 'unknown',
      clientVersion: r.clientVersion ?? '',
      caps: r.caps ?? [],
      direction: r.direction ?? 'outbound',
      country: r.country ?? null,
      city: r.city ?? null,
    }));

    return NextResponse.json({ diversity, peers, capturedAt });
  } catch (error) {
    console.error(`[Peers API] Error fetching peers for node ${nodeId}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch peer data' },
      { status: 500 }
    );
  }
}
