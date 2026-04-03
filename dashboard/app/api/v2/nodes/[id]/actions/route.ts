/**
 * POST /api/v2/nodes/:id/actions
 * Issue #39 — Rollback/Resync via Dashboard
 *
 * Supported actions:
 *   restart     — restart the node container/process via SkyOne agent
 *   rollback    — call debug_setHead on the node's RPC to roll back to a block
 *   resync      — clear state and restart from genesis / checkpoint
 *   add-peer    — call admin_addPeer with a supplied enode
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://gateway:gateway@localhost:5433/xdc_gateway',
});

// SkyOne agent port map (matches TOOLS.md)
const SKYONE_PORTS: Record<string, number> = {
  geth: 7070,
  erigon: 7071,
  nethermind: 7072,
  reth: 8588,
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

interface ActionPayload {
  action: 'restart' | 'rollback' | 'resync' | 'add-peer';
  /** For rollback: target block number (hex or decimal) */
  blockNumber?: string | number;
  /** For add-peer: enode URL */
  enode?: string;
}

async function skyoneRequest(
  host: string,
  port: number,
  method: string,
  params: unknown[]
) {
  const url = `http://${host}:${port}`;
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`SkyOne RPC error: HTTP ${res.status}`);
  return res.json();
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  // Auth check
  const apiKey = request.headers.get('X-API-Key');
  if (process.env.DASHBOARD_API_KEY && apiKey !== process.env.DASHBOARD_API_KEY) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401, headers: CORS_HEADERS }
    );
  }

  let payload: ActionPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const { action } = payload;
  const allowedActions = ['restart', 'rollback', 'resync', 'add-peer'];
  if (!allowedActions.includes(action)) {
    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Fetch node from DB
  const client = await pool.connect();
  let node: {
    id: string;
    host: string;
    client_type: string;
    rpc_port: number;
    skyone_port?: number;
  };

  try {
    const result = await client.query(
      `SELECT id, host, client_type, rpc_port, skyone_port FROM skynet.nodes WHERE id = $1`,
      [id]
    );
    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Node not found' },
        { status: 404, headers: CORS_HEADERS }
      );
    }
    node = result.rows[0];
  } finally {
    client.release();
  }

  const skyonePort =
    node.skyone_port ??
    SKYONE_PORTS[node.client_type?.toLowerCase() ?? 'geth'] ??
    7070;

  try {
    let result: unknown;

    switch (action) {
      case 'restart': {
        // SkyOne exposes a management endpoint: skyone_restart
        result = await skyoneRequest(node.host, skyonePort, 'skyone_restart', []);
        break;
      }

      case 'rollback': {
        if (!payload.blockNumber) {
          return NextResponse.json(
            { success: false, error: 'blockNumber required for rollback' },
            { status: 400, headers: CORS_HEADERS }
          );
        }
        const blockHex =
          typeof payload.blockNumber === 'number'
            ? '0x' + payload.blockNumber.toString(16)
            : payload.blockNumber.startsWith('0x')
            ? payload.blockNumber
            : '0x' + parseInt(payload.blockNumber, 10).toString(16);
        // debug_setHead rolls back chain head
        result = await skyoneRequest(node.host, node.rpc_port ?? 8545, 'debug_setHead', [blockHex]);
        break;
      }

      case 'resync': {
        // SkyOne exposes skyone_resync which triggers a chain resync
        result = await skyoneRequest(node.host, skyonePort, 'skyone_resync', []);
        break;
      }

      case 'add-peer': {
        if (!payload.enode) {
          return NextResponse.json(
            { success: false, error: 'enode required for add-peer' },
            { status: 400, headers: CORS_HEADERS }
          );
        }
        result = await skyoneRequest(node.host, node.rpc_port ?? 8545, 'admin_addPeer', [payload.enode]);
        break;
      }
    }

    // Log the action
    const logClient = await pool.connect();
    try {
      await logClient.query(
        `INSERT INTO skynet.node_actions (node_id, action, payload, performed_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT DO NOTHING`,
        [id, action, JSON.stringify(payload)]
      );
    } catch {
      // Table may not exist yet — non-fatal
    } finally {
      logClient.release();
    }

    return NextResponse.json(
      { success: true, action, result },
      { headers: CORS_HEADERS }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Action failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 502, headers: CORS_HEADERS }
    );
  }
}
