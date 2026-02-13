import { NextRequest, NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { generateApiKey } from '@/lib/auth';
import { createErrorResponse, withErrorHandling } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { z } from 'zod';

// Public registration schema (no auth required)
const PublicRegistrationSchema = z.object({
  name: z.string().min(3).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  host: z.string().min(1).max(255),
  rpcUrl: z.string().url().optional(),
  role: z.enum(['masternode', 'fullnode', 'archive', 'rpc']),
  email: z.string().email().optional().or(z.literal('')),
  telegram: z.string().max(100).optional().or(z.literal('')),
  locationCity: z.string().max(100).optional(),
  locationCountry: z.string().max(5).optional(),
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
 * POST /api/v1/nodes/register
 * Public node registration endpoint
 * No authentication required
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
  
  try {
    const result = await withTransaction(async (client) => {
      // Check if name already exists
      const existingNode = await client.query(
        'SELECT id FROM netown.nodes WHERE name = $1',
        [data.name]
      );

      if (existingNode.rows.length > 0) {
        throw new Error(`Node name "${data.name}" already exists`);
      }

      // Insert node
      const nodeResult = await client.query(
        `INSERT INTO netown.nodes 
         (name, host, role, location_city, location_country, tags, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING id, name, host, role, created_at`,
        [
          data.name,
          data.host,
          data.role,
          data.locationCity || null,
          data.locationCountry || null,
          [`registered_by:${data.email}`],
        ]
      );

      const node = nodeResult.rows[0];

      // Create API key for this node
      await client.query(
        `INSERT INTO netown.api_keys 
         (key, node_id, name, permissions)
         VALUES ($1, $2, $3, $4)`,
        [
          apiKey, 
          node.id, 
          `${data.name} auto-generated key`, 
          ['heartbeat', 'metrics', 'notifications']
        ]
      );

      // Log registration
      logger.info('Node registered via public form', { 
        nodeId: node.id, 
        name: data.name, 
        role: data.role,
        email: data.email 
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
    },
    roles: [
      { value: 'masternode', label: 'Masternode', description: 'Block producer node with validator responsibilities' },
      { value: 'fullnode', label: 'Full Node', description: 'Full blockchain sync, no mining' },
      { value: 'archive', label: 'Archive Node', description: 'Full historical state preservation' },
      { value: 'rpc', label: 'RPC Node', description: 'Public API endpoint node' },
    ],
  });
}

export const POST = withErrorHandling(postHandler);
