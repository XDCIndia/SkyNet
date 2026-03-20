import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { query, queryAll } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, isDashboardReadRequest } from '@/lib/auth';

/**
 * GET /api/v1/network/bootnodes?network=mainnet&client=erigon&limit=20
 * Return active bootnodes filtered by network and optionally client type.
 * Sorted by last_seen DESC (freshest first).
 */
export async function GET(request: NextRequest) {
  try {
    if (!isDashboardReadRequest(request)) {
      const auth = await authenticateRequest(request);
      if (!auth.valid) {
        return unauthorizedResponse(auth.error);
      }
    }

    const { searchParams } = new URL(request.url);
    const network = searchParams.get('network') || 'mainnet';
    const client = searchParams.get('client') || null;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    let sql: string;
    let params: any[];

    if (client) {
      sql = `
        SELECT enode, network, client_type, ip, port, last_seen
        FROM skynet.bootnodes
        WHERE network = $1
          AND client_type = $2
          AND is_active = true
          AND last_seen > NOW() - INTERVAL '1 hour'
        ORDER BY last_seen DESC
        LIMIT $3
      `;
      params = [network, client, limit];
    } else {
      sql = `
        SELECT enode, network, client_type, ip, port, last_seen
        FROM skynet.bootnodes
        WHERE network = $1
          AND is_active = true
          AND last_seen > NOW() - INTERVAL '1 hour'
        ORDER BY last_seen DESC
        LIMIT $2
      `;
      params = [network, limit];
    }

    const rows = await queryAll(sql, params);

    return NextResponse.json({
      success: true,
      bootnodes: rows.map((r: any) => ({
        enode: r.enode,
        network: r.network,
        clientType: r.client_type,
        ip: r.ip,
        port: r.port,
        lastSeen: r.last_seen,
      })),
    });
  } catch (err: any) {
    console.error('[Bootnodes GET] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/v1/network/bootnodes
 * Accept array of bootnodes from SkyOne agent.
 * Body: { nodeId, network, bootnodes: [{ enode, clientType }] }
 * Upserts: updates last_seen if exists, inserts if new.
 * Also marks bootnodes not seen in 1 hour as inactive.
 */
export async function POST(request: NextRequest) {
  try {
    // Accept requests from SkyOne agents (via nodeId auth) or API key
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json();
    const { nodeId, network = 'mainnet', bootnodes } = body;

    if (!nodeId || !Array.isArray(bootnodes) || bootnodes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'nodeId and bootnodes[] are required' },
        { status: 400 }
      );
    }

    // Extract IP from enode (format: enode://pubkey@ip:port)
    const parseEnode = (enode: string) => {
      const match = enode.match(/@([^:]+):(\d+)/);
      return {
        ip: match ? match[1] : null,
        port: match ? parseInt(match[2]) : null,
      };
    };

    // Resolve source_node_id UUID from nodeId string
    const nodeRow = await query(
      `SELECT id FROM skynet.nodes WHERE id::text = $1 OR node_id = $1 LIMIT 1`,
      [nodeId]
    ).catch(() => null);
    const sourceNodeId = (nodeRow as any)?.id || null;

    let upserted = 0;
    for (const bn of bootnodes.slice(0, 50)) {
      if (!bn.enode || typeof bn.enode !== 'string') continue;
      const { ip, port } = parseEnode(bn.enode);
      try {
        await query(
          `INSERT INTO skynet.bootnodes (enode, network, client_type, ip, port, last_seen, source_node_id, is_active)
           VALUES ($1, $2, $3, $4, $5, NOW(), $6, true)
           ON CONFLICT (enode, network) DO UPDATE
             SET last_seen = NOW(),
                 client_type = COALESCE(EXCLUDED.client_type, skynet.bootnodes.client_type),
                 ip = COALESCE(EXCLUDED.ip, skynet.bootnodes.ip),
                 port = COALESCE(EXCLUDED.port, skynet.bootnodes.port),
                 source_node_id = COALESCE(EXCLUDED.source_node_id, skynet.bootnodes.source_node_id),
                 is_active = true`,
          [bn.enode, network, bn.clientType || null, ip, port, sourceNodeId]
        );
        upserted++;
      } catch (e: any) {
        // Skip invalid entries
        console.warn('[Bootnodes POST] Skipping enode:', bn.enode, e.message);
      }
    }

    // Mark stale bootnodes as inactive (not seen in 1 hour)
    await query(
      `UPDATE skynet.bootnodes SET is_active = false
       WHERE network = $1 AND is_active = true AND last_seen < NOW() - INTERVAL '1 hour'`,
      [network]
    );

    return NextResponse.json({ success: true, upserted });
  } catch (err: any) {
    console.error('[Bootnodes POST] Error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
