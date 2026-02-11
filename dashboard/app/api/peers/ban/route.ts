import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// POST /api/peers/ban - Ban a peer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { enode, ip, reason } = body;

    if (!enode) {
      return NextResponse.json(
        { error: 'Missing required field: enode' },
        { status: 400 }
      );
    }

    const result = await query(`
      INSERT INTO netown.banned_peers (enode, remote_ip, reason, banned_by)
      VALUES ($1, $2, $3, 'manual')
      ON CONFLICT (enode) DO NOTHING
      RETURNING *
    `, [enode, ip || null, reason || 'Manual ban']);

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Peer already banned' },
        { status: 409 }
      );
    }

    // Attempt to remove from node's peer list via RPC
    const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8989';
    try {
      await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'admin_removePeer',
          params: [enode],
          id: 1,
        }),
      });
    } catch {
      // RPC call failure is non-critical
    }

    return NextResponse.json({
      banned: result.rows[0],
      message: 'Peer banned successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error banning peer:', error);
    return NextResponse.json(
      { error: 'Failed to ban peer' },
      { status: 500 }
    );
  }
}

// DELETE /api/peers/ban - Unban a peer
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const enode = searchParams.get('enode');
    const id = searchParams.get('id');

    if (!enode && !id) {
      return NextResponse.json(
        { error: 'Must provide enode or id parameter' },
        { status: 400 }
      );
    }

    let result;
    if (id) {
      result = await query(
        'DELETE FROM netown.banned_peers WHERE id = $1 RETURNING *',
        [id]
      );
    } else {
      result = await query(
        'DELETE FROM netown.banned_peers WHERE enode = $1 RETURNING *',
        [enode]
      );
    }

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Peer not found in ban list' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      unbanned: result.rows[0],
      message: 'Peer unbanned successfully',
    });
  } catch (error) {
    console.error('Error unbanning peer:', error);
    return NextResponse.json(
      { error: 'Failed to unban peer' },
      { status: 500 }
    );
  }
}
