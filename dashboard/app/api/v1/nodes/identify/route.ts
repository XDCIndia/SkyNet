import { NextRequest, NextResponse } from 'next/server';
import { withTransaction, query } from '@/lib/db';
import { createErrorResponse, withErrorHandling } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import crypto from 'crypto';

// Node identity schema with smart naming support
const NodeIdentitySchema = z.object({
  fingerprint: z.string().min(1).max(100),
  coinbase: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
  ip: z.string().max(100).optional(),
  clientType: z.enum(['geth', 'erigon', 'gp5', 'nethermind', 'reth', 'XDC', 'unknown']).optional().default('unknown'),
  clientVersion: z.string().max(200).optional(),
  // Smart naming fields
  name: z.string().min(3).max(100).regex(/^[a-zA-Z0-9._-]+$/).optional(),
  network: z.enum(['mainnet', 'apothem', 'devnet']).optional().default('mainnet'),
  role: z.enum(['masternode', 'fullnode', 'archive', 'rpc']).optional().default('fullnode'),
});

// Generate a secure API key using crypto.randomBytes
function generateSecureApiKey(): string {
  // Generate 32 bytes (256 bits) of random data and convert to hex
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return 'xdc_' + randomBytes;
}

// Parse smart node name to extract components
// Format: {client}-{version}-{type}-{ip}-{network}
// Example: geth-v2.6.8-fullnode-65.21.27.213-mainnet
function parseSmartNodeName(name: string): {
  clientType: string;
  version: string;
  nodeType: string;
  ip: string;
  network: string;
} | null {
  const parts = name.split('-');
  if (parts.length < 5) return null;
  
  // Last part is network
  const network = parts[parts.length - 1];
  // Second to last is IP (with dashes instead of dots)
  const ip = parts[parts.length - 2].replace(/-/g, '.');
  // Third from last is node type
  const nodeType = parts[parts.length - 3];
  // Version is typically second part (starts with v)
  const versionPart = parts.find(p => p.startsWith('v') && /v?\d/.test(p));
  const version = versionPart || 'unknown';
  // Client is first part
  const clientType = parts[0];
  
  return { clientType, version, nodeType, ip, network };
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
             SET client_type = COALESCE(NULLIF($1, 'unknown'), client_type),
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

      // Parse smart node name for metadata extraction
      const smartNameInfo = parseSmartNodeName(nodeName);
      
      // Extract IP from fingerprint or use provided IP
      const hostIp = data.ip || data.fingerprint.split('@')[1] || 'unknown';

      // Insert new node with fingerprint and smart name metadata
      const nodeResult = await client.query(
        `INSERT INTO skynet.nodes 
         (name, host, role, is_active, fingerprint, coinbase, client_type, client_version, tags, network)
         VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8, $9)
         RETURNING id, name, created_at`,
        [
          nodeName,
          hostIp,
          data.role || 'fullnode',
          data.fingerprint,
          data.coinbase || null,
          smartNameInfo?.clientType || data.clientType || 'unknown',
          smartNameInfo?.version || data.clientVersion || null,
          ['auto-registered', `fingerprint:${data.fingerprint}`, `smart-name:${nodeName}`],
          data.network || 'mainnet',
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
          ['heartbeat', 'metrics', 'notifications', 'errors']
        ]
      );

      // Store api_key on nodes table for quick lookup
      await client.query(
        'UPDATE skynet.nodes SET api_key = $1 WHERE id = $2',
        [apiKey, node.id]
      );

      logger.info('Node auto-registered via identity with smart name', { 
        nodeId: node.id, 
        name: nodeName, 
        fingerprint: data.fingerprint,
        clientType: data.clientType,
        network: data.network,
        smartNameParsed: smartNameInfo
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
    smartNameFormat: '{client}-{version}-{type}-{ip}-{network}',
    smartNameExamples: [
      'geth-v2.6.8-fullnode-65.21.27.213-mainnet',
      'gp5-v1.17.0-fullnode-95.217.56.168-mainnet',
      'erigon-v3.4.0-fullnode-65.21.27.213-mainnet',
      'nethermind-v1.30-fullnode-65.21.71.4-apothem',
    ],
    schema: {
      fingerprint: 'string (required, unique identifier)',
      coinbase: 'string (optional, 0x-prefixed Ethereum address)',
      ip: 'string (optional, IP address)',
      clientType: 'enum: geth, erigon, gp5, nethermind, XDC, unknown',
      clientVersion: 'string (optional, client version)',
      name: 'string (optional, smart node name)',
      network: 'enum: mainnet, apothem, devnet',
      role: 'enum: masternode, fullnode, archive, rpc',
    },
    behavior: {
      existing: 'Returns existing nodeId and apiKey (node recovery)',
      new: 'Auto-registers node and returns new credentials with smart naming',
    },
  });
}

export const POST = withErrorHandling(postHandler);
