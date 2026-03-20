/**
 * CSRF Protection Utility (Issue #610)
 * 
 * Checks Origin header on state-changing requests (POST/PUT/DELETE)
 * to prevent cross-site request forgery attacks.
 */

import { NextRequest, NextResponse } from 'next/server';

// Allowed origins - these should match our app's domains
const ALLOWED_ORIGINS = [
  process.env.NEXTAUTH_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  'https://xdc.openscan.ai',
  'http://localhost:3000',
  'http://localhost:3005',
].filter(Boolean) as string[];

// HTTP methods that modify state and require CSRF protection
const STATE_CHANGING_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

/**
 * Check if a request passes CSRF validation
 * Returns true if allowed, false if rejected
 */
export function validateCSRF(request: NextRequest): boolean {
  // Skip CSRF check for GET/HEAD/OPTIONS (safe methods)
  if (!STATE_CHANGING_METHODS.includes(request.method)) {
    return true;
  }
  
  // Skip CSRF check if no allowed origins configured
  if (ALLOWED_ORIGINS.length === 0) {
    console.warn('CSRF: No allowed origins configured, skipping validation');
    return true;
  }
  
  const origin = request.headers.get('Origin');
  
  // No origin header - could be legitimate non-browser request or missing header
  // In strict mode we might reject, but for API compatibility we allow
  if (!origin) {
    // Allow requests without Origin header (e.g., from mobile apps, curl)
    // but log for monitoring
    console.debug('CSRF: No Origin header, allowing request');
    return true;
  }
  
  // Check if origin matches allowed origins
  const isAllowed = ALLOWED_ORIGINS.some(allowed => {
    // Exact match
    if (allowed === origin) return true;
    // Subdomain match for xdc.network
    if (origin.endsWith('.xdc.network') && allowed.includes('xdc.network')) return true;
    return false;
  });
  
  if (!isAllowed) {
    console.warn(`CSRF: Rejected request from origin: ${origin}`);
  }
  
  return isAllowed;
}

/**
 * Create a 403 Forbidden response for CSRF failures
 */
export function csrfForbiddenResponse(): NextResponse {
  return NextResponse.json(
    { 
      error: 'Forbidden', 
      code: 'CSRF_INVALID_ORIGIN',
      message: 'Invalid Origin header. Request rejected for security reasons.'
    },
    { status: 403 }
  );
}

/**
 * Middleware-compatible CSRF check
 * Call this in middleware to enforce CSRF protection
 */
export function csrfMiddleware(request: NextRequest): NextResponse | null {
  if (!validateCSRF(request)) {
    return csrfForbiddenResponse();
  }
  return null; // Continue to next handler
}
