import { NextRequest, NextResponse } from 'next/server';
import { query, Node } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth';

// GET /api/nodes - List all nodes with latest metrics
export async function GET() {
  try {
    const result = await query(`
      SELECT 
        n.*,
        m.block_height,
        m.sync_percent,
        m.peer_count,
        m.cpu_percent,
        m.memory_percent,
        m.disk_percent,
        m.rpc_latency_ms,
        m.is_syncing,
        m.client_version,
        m.collected_at as last_seen
      FROM netown.nodes n
      LEFT JOIN LATERAL (
        SELECT * FROM netown.node_metrics
        WHERE node_id = n.id
        ORDER BY collected_at DESC
        LIMIT 1
      ) m ON true
      ORDER BY n.created_at DESC
    `);

    return NextResponse.json({
      nodes: result.rows,
      total: result.rowCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching nodes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch nodes' },
      { status: 500 }
    );
  }
}

// POST /api/nodes - Register new node (protected)
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json();
    const {
      name,
      host,
      role,
      location_city,
      location_country,
      location_lat,
      location_lng,
      tags,
    } = body;

    // Validation
    if (!name || !host || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: name, host, role' },
        { status: 400 }
      );
    }

    // Input length validation
    if (typeof name !== 'string' || name.length > 100) {
      return NextResponse.json(
        { error: 'name must be a string of max 100 characters' },
        { status: 400 }
      );
    }
    if (typeof host !== 'string' || host.length > 255) {
      return NextResponse.json(
        { error: 'host must be a string of max 255 characters' },
        { status: 400 }
      );
    }

    // Sanitize: strip HTML tags from name
    const sanitizedName = name.replace(/<[^>]*>/g, '').trim();
    if (!sanitizedName) {
      return NextResponse.json(
        { error: 'name cannot be empty after sanitization' },
        { status: 400 }
      );
    }

    const validRoles = ['masternode', 'fullnode', 'archive', 'rpc'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO netown.nodes 
       (name, host, role, location_city, location_country, location_lat, location_lng, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [sanitizedName, host, role, location_city, location_country, location_lat, location_lng, tags || []]
    );

    return NextResponse.json({
      node: result.rows[0],
      message: 'Node registered successfully',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating node:', error);
    
    if (error.code === '23505') { // Unique violation
      return NextResponse.json(
        { error: 'Node with this name already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create node' },
      { status: 500 }
    );
  }
}

// DELETE /api/nodes - Remove nodes by filter (bulk delete) (protected)
export async function DELETE(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const name = searchParams.get('name');

    if (!id && !name) {
      return NextResponse.json(
        { error: 'Must provide id or name parameter' },
        { status: 400 }
      );
    }

    let result;
    if (id) {
      result = await query(
        'DELETE FROM netown.nodes WHERE id = $1 RETURNING *',
        [id]
      );
    } else {
      result = await query(
        'DELETE FROM netown.nodes WHERE name = $1 RETURNING *',
        [name]
      );
    }

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      deleted: result.rows[0],
      message: 'Node removed successfully',
    });
  } catch (error) {
    console.error('Error deleting node:', error);
    return NextResponse.json(
      { error: 'Failed to delete node' },
      { status: 500 }
    );
  }
}
