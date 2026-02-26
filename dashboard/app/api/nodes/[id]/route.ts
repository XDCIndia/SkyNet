import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth';
import { z } from 'zod';

// Validation schema for PATCH updates
const UpdateNodeSchema = z.object({
  name: z.string().min(1).max(100).transform(v => v.replace(/<[^>]*>/g, '').trim()).optional(),
  host: z.string().min(1).max(255).optional(),
  role: z.enum(['masternode', 'fullnode', 'archive', 'rpc']).optional(),
  location_city: z.string().max(100).optional(),
  location_country: z.string().max(5).optional(),
  location_lat: z.coerce.number().min(-90).max(90).optional(),
  location_lng: z.coerce.number().min(-180).max(180).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  is_active: z.boolean().optional(),
}).strict(); // Reject unknown fields

// GET /api/nodes/[id] - Get single node with details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get node details
    const nodeResult = await query(
      'SELECT * FROM skynet.nodes WHERE id = $1',
      [id]
    );

    if (nodeResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
    }

    // Get last 24h metrics summary
    const metricsResult = await query(`
      SELECT 
        COUNT(*) as data_points,
        AVG(block_height)::bigint as avg_height,
        MAX(block_height)::bigint as max_height,
        AVG(peer_count)::int as avg_peers,
        AVG(cpu_percent)::numeric(5,2) as avg_cpu,
        AVG(memory_percent)::numeric(5,2) as avg_memory,
        AVG(disk_percent)::numeric(5,2) as avg_disk,
        MAX(collected_at) as last_seen
      FROM skynet.node_metrics
      WHERE node_id = $1 AND collected_at > NOW() - INTERVAL '24 hours'
    `, [id]);

    // Get active incidents
    const incidentsResult = await query(`
      SELECT * FROM skynet.incidents
      WHERE node_id = $1 AND status = 'active'
      ORDER BY detected_at DESC
    `, [id]);

    return NextResponse.json({
      node: nodeResult.rows[0],
      metrics24h: metricsResult.rows[0],
      activeIncidents: incidentsResult.rows,
    });
  } catch (error) {
    console.error('Error fetching node:', error);
    return NextResponse.json(
      { error: 'Failed to fetch node details' },
      { status: 500 }
    );
  }
}

// PATCH /api/nodes/[id] - Update node (protected)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }

    const { id } = params;
    const body = await request.json();
    
    // Validate input with Zod schema
    const validation = UpdateNodeSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }
    
    const updates = validation.data;
    
    // Filter out undefined values
    const validUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    if (Object.keys(validUpdates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Build parameterized query with validated field names
    const allowedFields = ['name', 'host', 'role', 'location_city', 'location_country',
      'location_lat', 'location_lng', 'tags', 'is_active'] as const;
    
    const setClause = Object.keys(validUpdates)
      .filter(key => allowedFields.includes(key as typeof allowedFields[number]))
      .map((key, i) => `${key} = $${i + 2}`)
      .join(', ');
    
    if (!setClause) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const result = await query(
      `UPDATE skynet.nodes SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...Object.values(validUpdates)]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      node: result.rows[0],
      message: 'Node updated successfully',
    });
  } catch (error) {
    console.error('Error updating node:', error);
    return NextResponse.json(
      { error: 'Failed to update node' },
      { status: 500 }
    );
  }
}
