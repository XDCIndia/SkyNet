/**
 * XDC SkyNet - Enhanced Middleware
 * Provides request ID tracing, rate limiting, security headers, and API versioning
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateRequestId, getRequestIdFromHeader, runWithContext, getRequestContext } from './lib/request-context';
import { logger, log } from './lib/logger';
import {
  checkRateLimit,
  createRateLimitHeaders,
  getRateLimitIdentifier,
  determineRateLimitTier,
} from './lib/rate-limiter';

// =============================================================================
// Configuration
// =============================================================================

const API_VERSIONS = ['v1', 'v2'];
const DEPRECATED_VERSIONS: string[] = [];
const SUNSET_DATES: Record<string, string> = {};

const CORS_CONFIG = {
  allowedOrigins: process.env.CORS_ALLOWED_ORIGINS?.split(',') || ['*'],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Version', 'X-Request-ID'],
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
// Main Middleware
// =============================================================================

export async function middleware(req: NextRequest) {
  const startTime = Date.now();
  const requestId = getRequestIdFromHeader(req) || generateRequestId();
  const apiVersion = getApiVersion(req);

  // Run request handling in context
  return runWithContext(
    {
      requestId,
      startTime,
      path: req.nextUrl.pathname,
      method: req.method,
      userAgent: req.headers.get('user-agent') || undefined,
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          req.headers.get('x-real-ip') ||
          undefined,
    },
    async () => {
      try {
        // Log request start
        logger.debug('Request started', {
          method: req.method,
          path: req.nextUrl.pathname,
          query: req.nextUrl.search,
          apiVersion,
        });

        // Rate limiting disabled for now
        // TODO: Re-enable when production traffic warrants it
        const apiKey = req.headers.get('authorization')?.replace('Bearer ', '');

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

        // Remove X-Powered-By
        response.headers.delete('X-Powered-By');

        return handleCORS(req, response);
      } catch (error) {
        logger.error('Middleware error', error as Error, {
          path: req.nextUrl.pathname,
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
