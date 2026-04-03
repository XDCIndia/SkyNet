/**
 * XDC SkyNet - Enhanced Middleware
 * Provides request ID tracing, rate limiting, security headers, and API versioning
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateRequestId, getRequestIdFromHeader, runWithContext } from './lib/request-context';
import { logger } from './lib/logger';
import {
  checkRateLimit,
  createRateLimitHeaders,
  getRateLimitIdentifier,
  determineRateLimitTier,
  getClientIP,
  getHeartbeatIdentifier,
} from './lib/rate-limiter';
import { csrfMiddleware } from './lib/csrf';

// =============================================================================
// Configuration
// =============================================================================

const API_VERSIONS = ['v1', 'v2'];
const DEPRECATED_VERSIONS: string[] = [];
const SUNSET_DATES: Record<string, string> = {};

const CORS_CONFIG = {
  allowedOrigins: process.env.CORS_ALLOWED_ORIGINS?.split(',') || ['*'],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Version',
    'X-Request-ID',
    'X-Node-ID',
  ],
  maxAge: 86400,
};

// =============================================================================
// Security Headers
// =============================================================================

const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-DNS-Prefetch-Control': 'on',
  'X-Download-Options': 'noopen',
  'X-XSS-Protection': '1; mode=block',
};

const CSP_HEADER = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "media-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join('; ');

// =============================================================================
// API Version Handling
// =============================================================================

function getApiVersion(req: NextRequest): string {
  const version = req.headers.get('x-api-version');
  if (version && API_VERSIONS.includes(version)) {
    return version;
  }
  // Default to v1
  return 'v1';
}

function addVersionHeaders(response: NextResponse, version: string): void {
  response.headers.set('X-API-Version', version);

  if (DEPRECATED_VERSIONS.includes(version)) {
    response.headers.set('Deprecation', 'true');
    if (SUNSET_DATES[version]) {
      response.headers.set('Sunset', SUNSET_DATES[version]);
    }
  }
}

// =============================================================================
// CORS Handling
// =============================================================================

function handleCORS(req: NextRequest, response: NextResponse): NextResponse {
  const origin = req.headers.get('origin');

  // Check if origin is allowed
  const allowedOrigin = CORS_CONFIG.allowedOrigins.includes('*')
    ? '*'
    : CORS_CONFIG.allowedOrigins.find((o) => o === origin) || CORS_CONFIG.allowedOrigins[0];

  response.headers.set('Access-Control-Allow-Origin', allowedOrigin || '');
  response.headers.set('Access-Control-Allow-Methods', CORS_CONFIG.allowedMethods.join(', '));
  response.headers.set('Access-Control-Allow-Headers', CORS_CONFIG.allowedHeaders.join(', '));
  response.headers.set('Access-Control-Max-Age', String(CORS_CONFIG.maxAge));

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: response.headers,
    });
  }

  return response;
}

// =============================================================================
// Rate Limiting
// =============================================================================

/**
 * Apply rate limiting to API requests
 * Returns null if allowed, or a response if rate limited
 */
function applyRateLimit(
  req: NextRequest,
  path: string
): { limited: boolean; result?: ReturnType<typeof checkRateLimit> } {
  // Apply to /api/v1/* and /api/v2/* routes
  if (!path.startsWith('/api/v1/') && !path.startsWith('/api/v2/')) {
    return { limited: false };
  }

  // Extract API key from Authorization header
  const authHeader = req.headers.get('authorization');
  const apiKey = authHeader?.replace('Bearer ', '') || null;

  // Determine rate limit tier
  const tier = determineRateLimitTier(req.method, path, apiKey);

  // Get appropriate identifier
  let identifier: string;
  if (tier === 'heartbeat') {
    // For heartbeat, try to get node ID, fall back to IP
    identifier = getHeartbeatIdentifier(req) || getClientIP(req);
  } else {
    identifier = getRateLimitIdentifier(req, apiKey);
  }

  // Check rate limit
  const result = checkRateLimit(identifier, tier);

  return {
    limited: result.limited,
    result,
  };
}

// =============================================================================
// API Authentication (Issue #519)
// =============================================================================

const ADMIN_SECRET = process.env.ADMIN_SECRET;

/**
 * Check if request is authenticated for admin endpoints
 */
function checkAdminAuth(req: NextRequest): boolean {
  const adminSecret = req.headers.get('X-Admin-Secret');
  if (!ADMIN_SECRET || !adminSecret) return false;
  return adminSecret === ADMIN_SECRET;
}

/**
 * Check API key for write endpoints (future-proofing)
 */
function checkApiKey(req: NextRequest): boolean {
  // Heartbeat endpoints have their own auth - skip here
  const path = req.nextUrl.pathname;
  if (path.includes('/nodes/') && path.includes('/heartbeat')) {
    return true; // Let heartbeat handler handle its own auth
  }
  
  // Admin endpoints handled separately
  if (path.startsWith('/api/v1/admin/')) {
    return true; // Will be checked by checkAdminAuth
  }
  
  // For now, allow all other requests (read-only GETs are public)
  // Future write endpoints can check X-API-Key here
  return true;
}

// =============================================================================
// Main Middleware
// =============================================================================

export async function middleware(req: NextRequest) {
  const startTime = Date.now();
  const requestId = getRequestIdFromHeader(req) || generateRequestId();
  const apiVersion = getApiVersion(req);
  const path = req.nextUrl.pathname;

  // Run request handling in context
  return runWithContext(
    {
      requestId,
      startTime,
      path,
      method: req.method,
      userAgent: req.headers.get('user-agent') || undefined,
      ip: getClientIP(req),
    },
    async () => {
      try {
        // Log request start
        logger.debug('Request started', {
          method: req.method,
          path,
          query: req.nextUrl.search,
          apiVersion,
        });
        
        // CSRF Protection for state-changing requests (Issue #610)
        const csrfCheck = csrfMiddleware(req);
        if (csrfCheck) {
          return csrfCheck;
        }
        
        // Admin endpoint authentication (Issue #519)
        if (path.startsWith('/api/v1/admin/')) {
          if (!checkAdminAuth(req)) {
            logger.warn('Admin auth failed', { path, ip: getClientIP(req) });
            return NextResponse.json(
              { error: 'Unauthorized', code: 'ADMIN_AUTH_REQUIRED' },
              { status: 401 }
            );
          }
        }
        
        // API Key check for write endpoints (Issue #519)
        if (!checkApiKey(req)) {
          return NextResponse.json(
            { error: 'Unauthorized', code: 'API_KEY_REQUIRED' },
            { status: 401 }
          );
        }

        // Issue #60: Apply per-API-key rate limiting for all API routes.
        // Enabled by default; set ENABLE_RATE_LIMIT=false to disable.
        const enableRateLimit = process.env.ENABLE_RATE_LIMIT !== 'false';
        const rateLimitCheck = enableRateLimit
          ? applyRateLimit(req, path)
          : { limited: false, result: null as any };

        // If rate limited, return 429 response
        if (rateLimitCheck.limited && rateLimitCheck.result) {
          const result = rateLimitCheck.result;
          logger.warn('Rate limit exceeded', {
            path,
            method: req.method,
            ip: getClientIP(req),
          });

          const response = NextResponse.json(
            {
              error: 'Too Many Requests',
              code: 'RATE_LIMIT_EXCEEDED',
              message: `Rate limit exceeded. Try again in ${result.retryAfter} seconds.`,
              requestId,
            },
            { status: 429 }
          );

          // Add rate limit headers
          const headers = createRateLimitHeaders(result);
          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });

          response.headers.set('x-request-id', requestId);
          return handleCORS(req, response);
        }

        // Continue to route handler
        const response = NextResponse.next();

        // Add security headers
        Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        response.headers.set('Content-Security-Policy', CSP_HEADER);

        // Add request ID
        response.headers.set('x-request-id', requestId);

        // Add API version headers
        addVersionHeaders(response, apiVersion);

        // Add rate limit headers if this was an API request
        if (rateLimitCheck.result) {
          const headers = createRateLimitHeaders(rateLimitCheck.result);
          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });
        }

        // Remove X-Powered-By
        response.headers.delete('X-Powered-By');

        return handleCORS(req, response);
      } catch (error) {
        logger.error('Middleware error', error as Error, {
          path,
          method: req.method,
        });

        const response = NextResponse.json(
          {
            error: 'Internal server error',
            code: 'INTERNAL_ERROR',
            requestId,
          },
          { status: 500 }
        );

        response.headers.set('x-request-id', requestId);
        return response;
      }
    }
  );
}

// =============================================================================
// Config
// =============================================================================

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
