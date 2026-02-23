import { NextRequest, NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { generateApiKey } from '@/lib/auth';
import { createErrorResponse, withErrorHandling } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Public registration schema (no auth required) with smart naming support
const PublicRegistrationSchema = z.object({
  name: z.string().min(3).max(100).regex(/^[a-zA-Z0-9._-]+$/),
  host: z.string().min(1).max(255),
  rpcUrl: z.string().url().optional(),
  role: z.enum(['masternode', 'fullnode', 'archive', 'rpc']),
  email: z.string().email().optional().or(z.literal('')),
  telegram: z.string().max(100).optional().or(z.literal('')),
  locationCity: z.string().max(100).optional(),
  locationCountry: z.string().max(5).optional(),
  // Smart naming fields
  client: z.enum(['geth', 'erigon', 'gp5', 'nethermind', 'XDC', 'unknown']).optional(),
  clientVersion: z.string().max(100).optional(),
  network: z.enum(['mainnet', 'apothem', 'devnet']).optional().default('mainnet'),
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

// Parse smart node name to extract components
// Format: {client}-{version}-{type}-{ip}-{network}
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
 * POST /api/v1/nodes/register
 * Public node registration endpoint
 * No authentication required
 * Supports smart node naming format: {client}-{version}-{type}-{ip}-{network}
 */
async function postHandler(request: NextRequest) {
  const body = await request.json();
  
  // Validate request body
  const validation = PublicRegistrationSchema.safeParse(body);
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
  
  // Parse smart node name for metadata
  const smartNameInfo = parseSmartNodeName(data.name);
  
  try {
    const result = await withTransaction(async (client) => {
      // Check if name already exists
      // Match by name only (not host) — allows multiple clients on same IP
      const existingNode = await client.query(
        'SELECT id FROM skynet.nodes WHERE name = $1',
        [data.name]
      );

      let node;
      let isUpdate = false;

      if (existingNode.rows.length > 0) {
        // Update existing node (re-registration)
        isUpdate = true;
        const existingId = existingNode.rows[0].id;
        const updateResult = await client.query(
          `UPDATE skynet.nodes 
           SET name = $1, host = $2, role = $3, location_city = $4, location_country = $5,
               is_active = true, email = COALESCE(NULLIF($6, ''), email),
               telegram = COALESCE(NULLIF($7, ''), telegram), updated_at = NOW(),
               client_type = COALESCE($8, client_type),
               client_version = COALESCE($9, client_version),
               network = COALESCE($10, network)
           WHERE id = $11
           RETURNING id, name, host, role, created_at`,
          [
            data.name,
            data.host,
            data.role,
            data.locationCity || null,
            data.locationCountry || null,
            data.email || null,
            data.telegram || null,
            smartNameInfo?.clientType || data.client || null,
            smartNameInfo?.version || data.clientVersion || null,
            smartNameInfo?.network || data.network || 'mainnet',
            existingId,
          ]
        );
        node = updateResult.rows[0];
      } else {
        // Insert new node with smart name metadata
        const nodeResult = await client.query(
          `INSERT INTO skynet.nodes 
           (name, host, role, location_city, location_country, tags, is_active, email, telegram,
            client_type, client_version, network)
           VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10, $11)
           RETURNING id, name, host, role, created_at`,
          [
            data.name,
            data.host,
            data.role,
            data.locationCity || null,
            data.locationCountry || null,
            [`registered_by:${data.email || 'unknown'}`, `smart-name:${data.name}`],
            data.email || null,
            data.telegram || null,
            smartNameInfo?.clientType || data.client || 'unknown',
            smartNameInfo?.version || data.clientVersion || null,
            smartNameInfo?.network || data.network || 'mainnet',
          ]
        );
        node = nodeResult.rows[0];
      }

      // Create or refresh API key for this node
      if (isUpdate) {
        // Delete old keys and create fresh one
        await client.query('DELETE FROM skynet.api_keys WHERE node_id = $1', [node.id]);
      }
      await client.query(
        `INSERT INTO skynet.api_keys 
         (key, node_id, name, permissions)
         VALUES ($1, $2, $3, $4)`,
        [
          apiKey, 
          node.id, 
          `${data.name} auto-generated key`, 
          ['heartbeat', 'metrics', 'notifications', 'errors']
        ]
      );

      // Log registration
      logger.info('Node registered via public form with smart name', { 
        nodeId: node.id, 
        name: data.name, 
        role: data.role,
        email: data.email,
        smartNameParsed: smartNameInfo,
        clientType: smartNameInfo?.clientType || data.client,
        network: smartNameInfo?.network || data.network,
      });

      return {
        nodeId: node.id,
        name: node.name,
        host: node.host,
        role: node.role,
        createdAt: node.created_at,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        apiKey,
      },
      message: 'Node registered successfully. Please save your API key - it will not be shown again.',
      setupCommand: generateSetupCommand(data.name, apiKey, data.host, data.rpcUrl),
    }, { status: 201 });

  } catch (error: any) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Registration failed' 
      },
      { status: 500 }
    );
  }
}

/**
 * Generate the curl one-liner for agent installation
 */
function generateSetupCommand(
  nodeName: string, 
  apiKey: string, 
  host: string,
  rpcUrl?: string
): string {
  const agentUrl = process.env.AGENT_INSTALL_URL || 'https://raw.githubusercontent.com/AnilChinchawale/XDCSkyNet/main/netown-agent.sh';
  const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:3005';
  
  return `curl -fsSL "${agentUrl}" | bash -s -- \\
    --name "${nodeName}" \\
    --api-key "${apiKey}" \\
    --host "${host}" \\
    --dashboard "${dashboardUrl}"${rpcUrl ? ` \\
    --rpc-url "${rpcUrl}"` : ''}`;
}

/**
 * GET /api/v1/nodes/register
 * Get registration form schema/info
 */
export async function GET() {
  return NextResponse.json({
    schema: {
      name: 'string (3-100 chars, alphanumeric with -_)',
      host: 'string (IP or hostname)',
      rpcUrl: 'string (optional, valid URL)',
      role: 'enum: masternode, fullnode, archive, rpc',
      email: 'string (valid email for notifications)',
      locationCity: 'string (optional)',
      locationCountry: 'string (optional, ISO code)',
      client: 'enum: geth, erigon, gp5, nethermind, XDC, unknown (optional)',
      clientVersion: 'string (optional, client version)',
      network: 'enum: mainnet, apothem, devnet (optional)',
    },
    smartNameFormat: '{client}-{version}-{type}-{ip}-{network}',
    smartNameExamples: [
      'geth-v2.6.8-fullnode-65.21.27.213-mainnet',
      'gp5-v1.17.0-fullnode-95.217.56.168-mainnet',
      'erigon-v3.4.0-fullnode-65.21.27.213-mainnet',
      'nethermind-v1.30-fullnode-65.21.71.4-apothem',
    ],
    roles: [
      { value: 'masternode', label: 'Masternode', description: 'Block producer node with validator responsibilities' },
      { value: 'fullnode', label: 'Full Node', description: 'Full blockchain sync, no mining' },
      { value: 'archive', label: 'Archive Node', description: 'Full historical state preservation' },
      { value: 'rpc', label: 'RPC Node', description: 'Public API endpoint node' },
    ],
  });
}

export const POST = withErrorHandling(postHandler);
