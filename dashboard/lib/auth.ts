import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export interface AuthResult {
  valid: boolean;
  nodeId?: string;
  permissions?: string[];
  error?: string;
}

/**
 * Authenticate a request using Bearer token from Authorization header
 * Validates against API_KEYS env var (comma-separated list)
 */
export async function authenticateRequest(req: NextRequest): Promise<AuthResult> {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader) {
    return { valid: false, error: 'Missing Authorization header' };
  }

  const [scheme, token] = authHeader.split(' ');
  
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return { valid: false, error: 'Invalid Authorization format. Use: Bearer <token>' };
  }

  // Get allowed API keys from env
  const apiKeysEnv = process.env.API_KEYS || '';
  const allowedKeys = apiKeysEnv.split(',').map(k => k.trim()).filter(Boolean);
  
  if (allowedKeys.length === 0) {
    console.warn('API_KEYS env var not configured');
    return { valid: false, error: 'Server misconfiguration: no API keys configured' };
  }

  // Check if token is a valid master API key (timing-safe comparison)
  const tokenBuf = Buffer.from(token);
  const isValidMasterKey = allowedKeys.some(key => {
    const keyBuf = Buffer.from(key);
    if (tokenBuf.length !== keyBuf.length) return false;
    return crypto.timingSafeEqual(tokenBuf, keyBuf);
  });
  if (isValidMasterKey) {
    return { 
      valid: true, 
      permissions: ['*'] // Master keys have all permissions
    };
  }

  // Check if token is a node-specific API key in the database
  try {
    const { getPool } = await import('./db');
    const pool = getPool();
    const result = await pool.query(
      `SELECT node_id, permissions FROM netown.api_keys 
       WHERE key = $1 AND is_active = true`,
      [token]
    );
    
    if (result.rows.length === 0) {
      return { valid: false, error: 'Invalid API key' };
    }

    // Update last_used_at
    await pool.query(
      `UPDATE netown.api_keys SET last_used_at = NOW() WHERE key = $1`,
      [token]
    );

    return {
      valid: true,
      nodeId: result.rows[0].node_id,
      permissions: result.rows[0].permissions
    };
  } catch (error) {
    console.error('Auth DB error:', error);
    return { valid: false, error: 'Authentication service error' };
  }
}

/**
 * Check if the authenticated request has required permission
 */
export function hasPermission(auth: AuthResult, permission: string): boolean {
  if (!auth.valid) return false;
  if (auth.permissions?.includes('*')) return true;
  return auth.permissions?.includes(permission) ?? false;
}

/**
 * Create a standard 401 error response
 */
export function unauthorizedResponse(message = 'Unauthorized'): NextResponse {
  return NextResponse.json(
    { error: message, code: 'UNAUTHORIZED' },
    { status: 401 }
  );
}

/**
 * Create a standard 403 error response
 */
export function forbiddenResponse(message = 'Forbidden'): NextResponse {
  return NextResponse.json(
    { error: message, code: 'FORBIDDEN' },
    { status: 403 }
  );
}

/**
 * Create a standard 400 error response
 */
export function badRequestResponse(message: string): NextResponse {
  return NextResponse.json(
    { error: message, code: 'BAD_REQUEST' },
    { status: 400 }
  );
}

/**
 * Create a standard 404 error response
 */
export function notFoundResponse(resource: string): NextResponse {
  return NextResponse.json(
    { error: `${resource} not found`, code: 'NOT_FOUND' },
    { status: 404 }
  );
}

/**
 * Create a standard 500 error response
 */
export function serverErrorResponse(message = 'Internal server error'): NextResponse {
  return NextResponse.json(
    { error: message, code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}

/**
 * Generate a secure random API key using crypto.randomBytes
 */
export function generateApiKey(): string {
  // Generate 32 bytes of random data and convert to hex
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return 'xdc_' + randomBytes;
}

/**
 * For dashboard-facing GET routes: auth is optional.
 * Returns true always for GET without auth header (dashboard calls).
 * POST/PUT/DELETE still require auth.
 */
export function isDashboardReadRequest(req: NextRequest): boolean {
  return req.method === 'GET' && !req.headers.get('authorization');
}
