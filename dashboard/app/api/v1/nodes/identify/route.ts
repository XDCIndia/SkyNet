import { NextRequest, NextResponse } from 'next/server';
import { withTransaction, query } from '@/lib/db';
import { createErrorResponse, withErrorHandling } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Node identity schema
const NodeIdentitySchema = z.object({
  fingerprint: z.string().min(1).max(100),
  coinbase: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
  ip: z.string().ip().optional(),
  clientType: z.enum(['geth', 'erigon', 'geth-pr5', 'nethermind', 'XDC', 'unknown']).optional().default('unknown'),
  clientVersion: z.string().max(200).optional(),
  name: z.string().min(3).max(100).regex(/^[a-zA-Z0-9._-]+$/).optional(),
});

// Generate a secure API key
function generateSecureApiKey(): string {
  const prefix = 'xdc_';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = prefix;
  for (let i = 0; i < 48; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * POST /api/v1/nodes/identify
 * Node identity endpoint for auto-registration and recovery
 * Accepts fingerprint (coinbase@ip) and returns node credentials
 * 
 * If fingerprint exists: return existing node credentials (recovery)
 * If fingerprint is new: auto-register and return new credentials
 */
async function postHandler(request: NextRequest) {
  const body = await request.json();
  
  // Validate request body
  const validation = NodeIdentitySchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Validation failed',
        details: validation.error.errors 
      },
      { status: 400 }
    );
  }

  const data = validation.data;
  const apiKey = generateSecureApiKey();
  
  try {
    const result = await withTransaction(async (client) => {
      // First, try to find existing node by fingerprint
      const existingByFingerprint = await client.query(
        'SELECT id, name, api_key FROM skynet.nodes WHERE fingerprint = $1',
        [data.fingerprint]
      );

      if (existingByFingerprint.rows.length > 0) {
        // Node recovery - fingerprint found
        const node = existingByFingerprint.rows[0];
        
        // Update coinbase if provided and different
        if (data.coinbase) {
          await client.query(
            'UPDATE skynet.nodes SET coinbase = $1, updated_at = NOW() WHERE id = $2 AND (coinbase IS NULL OR coinbase != $1)',
            [data.coinbase, node.id]
          );
        }
        
        // Update client info if provided
        if (data.clientType || data.clientVersion) {
          await client.query(
            `UPDATE skynet.nodes 
             SET client_type = COALESCE($1, client_type),
                 client_version = COALESCE($2, client_version),
                 updated_at = NOW()
             WHERE id = $3`,
            [data.clientType || null, data.clientVersion || null, node.id]
          );
        }

        logger.info('Node identity recovery', { 
          nodeId: node.id, 
          fingerprint: data.fingerprint 
        });

        return {
          nodeId: node.id,
          name: node.name,
          apiKey: node.api_key,
          isNew: false,
        };
      }

      // Check if name already exists (for new registrations)
      let nodeName = data.name;
      if (nodeName) {
        const existingName = await client.query(
          'SELECT id FROM skynet.nodes WHERE name = $1',
          [nodeName]
        );
        if (existingName.rows.length > 0) {
          // Append random suffix to make name unique
          nodeName = `${nodeName}-${Math.floor(Math.random() * 10000)}`;
        }
      } else {
        // Generate name from fingerprint
        const fingerprintHash = data.fingerprint.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
        nodeName = `xdc-${data.clientType || 'node'}-${fingerprintHash}`;
      }

      // Extract IP from fingerprint for host field
      const hostIp = data.ip || data.fingerprint.split('@')[1] || 'unknown';

      // Insert new node with fingerprint
      const nodeResult = await client.query(
        `INSERT INTO skynet.nodes 
         (name, host, role, is_active, fingerprint, coinbase, client_type, client_version, tags)
         VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8)
         RETURNING id, name, created_at`,
        [
          nodeName,
          hostIp,
          'fullnode',
          data.fingerprint,
          data.coinbase || null,
          data.clientType || 'unknown',
          data.clientVersion || null,
          ['auto-registered', `fingerprint:${data.fingerprint}`],
        ]
      );
      const node = nodeResult.rows[0];

      // Create API key for this node
      await client.query(
        `INSERT INTO skynet.api_keys 
         (key, node_id, name, permissions)
         VALUES ($1, $2, $3, $4)`,
        [
          apiKey, 
          node.id, 
          `${nodeName} auto-generated key`, 
          ['heartbeat', 'metrics', 'notifications']
        ]
      );

      // Store api_key on nodes table for quick lookup
      await client.query(
        'UPDATE skynet.nodes SET api_key = $1 WHERE id = $2',
        [apiKey, node.id]
      );

      logger.info('Node auto-registered via identity', { 
        nodeId: node.id, 
        name: nodeName, 
        fingerprint: data.fingerprint,
        clientType: data.clientType 
      });

      return {
        nodeId: node.id,
        name: node.name,
        apiKey: apiKey,
        isNew: true,
        createdAt: node.created_at,
      };
    });

    const message = result.isNew 
      ? 'Node registered successfully. Please save your API key - it will not be shown again.'
      : 'Node identity recovered. Use the provided credentials.';

    return NextResponse.json({
      success: true,
      data: {
        nodeId: result.nodeId,
        name: result.name,
        apiKey: result.apiKey,
        isNew: result.isNew,
        ...(result.createdAt && { createdAt: result.createdAt }),
      },
      message,
    }, { status: result.isNew ? 201 : 200 });

  } catch (error: any) {
    console.error('Node identity error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Identity verification failed' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/nodes/identify
 * Get identity endpoint info
 */
export async function GET() {
  return NextResponse.json({
    description: 'Node identity and auto-registration endpoint',
    fingerprintFormat: 'coinbase@ip (e.g., 0xabc123@95.217.56.168)',
    schema: {
      fingerprint: 'string (required, unique identifier)',
      coinbase: 'string (optional, 0x-prefixed Ethereum address)',
      ip: 'string (optional, IP address)',
      clientType: 'enum: geth, erigon, geth-pr5, nethermind, XDC, unknown',
      clientVersion: 'string (optional, client version)',
      name: 'string (optional, node name)',
    },
    behavior: {
      existing: 'Returns existing nodeId and apiKey (node recovery)',
      new: 'Auto-registers node and returns new credentials',
    },
  });
}

export const POST = withErrorHandling(postHandler);
