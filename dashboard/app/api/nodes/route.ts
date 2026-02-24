import { NextRequest, NextResponse } from 'next/server';
import { query, Node } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth';
import { z } from 'zod';

const CreateNodeSchema = z.object({
  name: z.string().min(1).max(100).transform(v => v.replace(/<[^>]*>/g, '').trim()),
  host: z.string().min(1).max(255),
  role: z.enum(['masternode', 'fullnode', 'archive', 'rpc']),
  location_city: z.string().max(100).optional(),
  location_country: z.string().max(5).optional(),
  location_lat: z.coerce.number().min(-90).max(90).optional(),
  location_lng: z.coerce.number().min(-180).max(180).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

// GET /api/nodes - List all nodes with latest metrics (protected)
export async function GET(request: NextRequest) {
  try {
    // Authenticate request - Issue #175 fix
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }
    // Use CTE with DISTINCT ON to batch-fetch latest metrics for all nodes
    // instead of per-node LATERAL join (fixes N+1 query pattern - Issue #26)
    const result = await query(`
      WITH latest_metrics AS (
        SELECT DISTINCT ON (node_id)
          node_id, block_height, sync_percent, peer_count, cpu_percent,
          memory_percent, disk_percent, rpc_latency_ms, is_syncing,
          client_version, collected_at
        FROM skynet.node_metrics
        ORDER BY node_id, collected_at DESC
      )
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
      FROM skynet.nodes n
      LEFT JOIN latest_metrics m ON m.node_id = n.id
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
    const validation = CreateNodeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { name, host, role, location_city, location_country, location_lat, location_lng, tags } = validation.data;

    if (!name) {
      return NextResponse.json(
        { error: 'name cannot be empty after sanitization' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO skynet.nodes 
       (name, host, role, location_city, location_country, location_lat, location_lng, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name, host, role, location_city, location_country, location_lat, location_lng, tags || []]
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
        'DELETE FROM skynet.nodes WHERE id = $1 RETURNING *',
        [id]
      );
    } else {
      result = await query(
        'DELETE FROM skynet.nodes WHERE name = $1 RETURNING *',
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
