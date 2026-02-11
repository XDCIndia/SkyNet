import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { generateApiKey, authenticateRequest, unauthorizedResponse, badRequestResponse } from '@/lib/auth';

/**
 * POST /api/v1/nodes/register
 * Register a new node (called by setup.sh when a new node is deployed)
 * Auth: Bearer API key
 * Body: { name, host, role, rpcUrl, location?, tags?, version }
 * Response: { nodeId, apiKey }
 */
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
      rpcUrl,
      location,
      tags,
      version,
    } = body;

    // Validation
    if (!name || !host || !role || !rpcUrl) {
      return badRequestResponse('Missing required fields: name, host, role, rpcUrl');
    }

    const validRoles = ['masternode', 'fullnode', 'archive', 'rpc'];
    if (!validRoles.includes(role)) {
      return badRequestResponse(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Parse location if provided
    let location_city, location_country, location_lat, location_lng;
    if (location) {
      location_city = location.city;
      location_country = location.country;
      location_lat = location.lat;
      location_lng = location.lng;
    }

    // Use transaction to create node and API key
    const nodeApiKey = generateApiKey();
    
    const result = await withTransaction(async (client) => {
      // Insert node
      const nodeResult = await client.query(
        `INSERT INTO netown.nodes 
         (name, host, role, location_city, location_country, location_lat, location_lng, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [name, host, role, location_city, location_country, location_lat, location_lng, tags || []]
      );

      const nodeId = nodeResult.rows[0].id;

      // Create API key for this node
      await client.query(
        `INSERT INTO netown.api_keys 
         (key, node_id, name, permissions)
         VALUES ($1, $2, $3, $4)`,
        [nodeApiKey, nodeId, `${name} node key`, ['heartbeat', 'metrics', 'notifications']]
      );

      return { nodeId, apiKey: nodeApiKey };
    });

    return NextResponse.json({
      nodeId: result.nodeId,
      apiKey: result.apiKey,
      message: 'Node registered successfully',
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error registering node:', error);
    
    if (error.code === '23505') { // Unique violation
      return NextResponse.json(
        { error: 'Node with this name already exists', code: 'DUPLICATE_NAME' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to register node', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
