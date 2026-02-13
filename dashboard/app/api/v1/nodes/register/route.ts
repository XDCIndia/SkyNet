import { NextRequest, NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { generateApiKey, authenticateRequest, unauthorizedResponse } from '@/lib/auth';
import { NodeRegistrationSchema, validateBody, ValidationError } from '@/lib/validation';
import { createErrorResponse, withErrorHandling } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { invalidateByTag } from '@/lib/cache';

/**
 * POST /api/v1/nodes/register
 * Register a new node (called by setup.sh when a new node is deployed)
 * Auth: Bearer API key
 * Body: { name, host, role, rpcUrl, location?, tags? }
 * Response: { nodeId, apiKey }
 */
async function postHandler(request: NextRequest) {
  // Authenticate request
  const auth = await authenticateRequest(request);
  if (!auth.valid) {
    return unauthorizedResponse(auth.error);
  }

  // Validate request body using Zod
  const body = await validateBody(request, NodeRegistrationSchema);

  const {
    name,
    host,
    role,
    rpcUrl,
    locationCity,
    locationCountry,
    locationLat,
    locationLng,
    tags,
  } = body;

  // Use transaction to create node and API key
  const nodeApiKey = generateApiKey();
  
  const result = await withTransaction(async (client) => {
    // Insert node
    const nodeResult = await client.query(
      `INSERT INTO skynet.nodes 
       (name, host, role, location_city, location_country, location_lat, location_lng, tags, rpc_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [name, host, role, locationCity || null, locationCountry || null, locationLat || null, locationLng || null, tags || [], rpcUrl]
    );

    const nodeId = nodeResult.rows[0].id;

    // Create API key for this node
    await client.query(
      `INSERT INTO skynet.api_keys 
       (key, node_id, name, permissions)
       VALUES ($1, $2, $3, $4)`,
      [nodeApiKey, nodeId, `${name} node key`, ['heartbeat', 'metrics', 'notifications']]
    );

    logger.info('Node registered', { nodeId, name, role });

    return { nodeId, apiKey: nodeApiKey };
  });

  // Invalidate cache
  await invalidateByTag('nodes');

  return NextResponse.json({
    success: true,
    data: {
      nodeId: result.nodeId,
      apiKey: result.apiKey,
    },
    message: 'Node registered successfully',
  }, { status: 201 });
}

export const POST = withErrorHandling(postHandler);

/**
 * GET /api/v1/nodes/register
 * Get registration info/schema
 */
export async function GET() {
  return NextResponse.json({
    schema: {
      name: 'string (1-100 chars, alphanumeric with -_)',
      host: 'string (valid URL)',
      role: 'enum: masternode, fullnode, archive, rpc',
      rpcUrl: 'string (valid URL, optional)',
      locationCity: 'string (optional)',
      locationCountry: 'string (optional)',
      locationLat: 'number -90 to 90 (optional)',
      locationLng: 'number -180 to 180 (optional)',
      tags: 'string[] max 10 (optional)',
    },
  });
}
