/**
 * Unified API Gateway
 * 
 * Issue: #686 - No Unified API Gateway
 * 
 * This module provides a single entry point for all XDC SkyNet API services
 * with unified authentication, rate limiting, and request routing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, unauthorizedResponse, hasPermission } from '@/lib/auth';
import { rateLimiter } from '@/lib/rate-limiter';
import { logger } from '@/lib/logger';
import { withErrorHandling } from '@/lib/errors';

// API Service Registry
const API_SERVICES = {
  // Node Management
  'nodes': { path: '/api/v1/nodes', methods: ['GET', 'POST', 'PUT', 'DELETE'], auth: true },
  'nodes.register': { path: '/api/v1/nodes/register', methods: ['POST'], auth: true },
  'nodes.metrics': { path: '/api/v1/nodes/metrics', methods: ['GET', 'POST'], auth: true },
  'nodes.identify': { path: '/api/v1/nodes/identify', methods: ['POST'], auth: false },
  
  // Masternode
  'masternodes': { path: '/api/v1/masternodes', methods: ['GET'], auth: true },
  'masternodes.stats': { path: '/api/v1/masternodes/stats', methods: ['GET'], auth: true },
  
  // Alerts
  'alerts': { path: '/api/v1/alerts', methods: ['GET', 'POST'], auth: true },
  'alerts.rules': { path: '/api/v1/alerts/rules', methods: ['GET', 'POST', 'PUT', 'DELETE'], auth: true },
  'alerts.channels': { path: '/api/v1/alerts/channels', methods: ['GET', 'POST'], auth: true },
  'alerts.history': { path: '/api/v1/alerts/history', methods: ['GET'], auth: true },
  
  // Fleet Management
  'fleet.overview': { path: '/api/v1/fleet/overview', methods: ['GET'], auth: true },
  'fleet.status': { path: '/api/v1/fleet/status', methods: ['GET'], auth: true },
  
  // Analytics
  'analytics': { path: '/api/v1/analytics', methods: ['GET'], auth: true },
  
  // System
  'health': { path: '/api/health', methods: ['GET'], auth: false },
  'metrics': { path: '/api/metrics', methods: ['GET'], auth: false },
  'diagnostics': { path: '/api/diagnostics', methods: ['GET'], auth: true },
  'upgrades.check': { path: '/api/v1/upgrades/check', methods: ['GET'], auth: true },
  
  // Collector (for node heartbeats)
  'collector': { path: '/api/collector', methods: ['POST'], auth: false, apiKey: true },
};

// API Version Info
const API_VERSION = {
  version: '1.0.0',
  name: 'XDC SkyNet API',
  documentation: '/api/docs',
  support: 'https://github.com/AnilChinchawale/XDCNetOwn/issues',
};

interface ApiRoute {
  service: string;
  action?: string;
  params?: Record<string, string>;
}

/**
 * Parse the API path to determine routing
 */
function parseApiPath(path: string): ApiRoute | null {
  // Remove /api/gateway prefix
  const cleanPath = path.replace(/^\/api\/gateway/, '');
  
  // Handle root gateway request
  if (cleanPath === '' || cleanPath === '/') {
    return { service: 'gateway' };
  }
  
  const parts = cleanPath.split('/').filter(Boolean);
  
  if (parts.length === 0) {
    return { service: 'gateway' };
  }
  
  const service = parts[0];
  const action = parts[1];
  
  // Build params from remaining path parts
  const params: Record<string, string> = {};
  for (let i = 2; i < parts.length; i += 2) {
    if (parts[i + 1]) {
      params[parts[i]] = parts[i + 1];
    }
  }
  
  return { service, action, params };
}

/**
 * Get target URL for service
 */
function getTargetUrl(route: ApiRoute, request: NextRequest): string | null {
  const baseUrl = request.url.replace('/api/gateway', '');
  
  // Build service key
  let serviceKey = route.service;
  if (route.action) {
    serviceKey += `.${route.action}`;
  }
  
  const service = API_SERVICES[serviceKey as keyof typeof API_SERVICES];
  
  if (!service) {
    return null;
  }
  
  // Build target URL
  let targetUrl = `${baseUrl}${service.path}`;
  
  // Add query parameters
  const { searchParams } = new URL(request.url);
  if (searchParams.toString()) {
    targetUrl += `?${searchParams.toString()}`;
  }
  
  return targetUrl;
}

/**
 * Check if request method is allowed
 */
function isMethodAllowed(serviceKey: string, method: string): boolean {
  const service = API_SERVICES[serviceKey as keyof typeof API_SERVICES];
  if (!service) return false;
  return service.methods.includes(method);
}

/**
 * Gateway root handler - API info
 */
async function gatewayInfoHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'json';
  
  const services = Object.entries(API_SERVICES).map(([key, config]) => ({
    name: key,
    path: config.path,
    methods: config.methods,
    requiresAuth: config.auth,
  }));
  
  const response = {
    gateway: API_VERSION,
    services: services.sort((a, b) => a.name.localeCompare(b.name)),
    endpoints: {
      gateway: '/api/gateway',
      documentation: '/api/docs',
      health: '/api/health',
    },
    usage: {
      description: 'Use /api/gateway/{service}/{action} to access services',
      example: '/api/gateway/nodes?limit=10',
      authentication: 'Bearer token required for authenticated endpoints',
    },
  };
  
  if (format === 'yaml') {
    // Simple YAML output
    const yaml = `
# XDC SkyNet API Gateway
gateway:
  version: "${API_VERSION.version}"
  name: "${API_VERSION.name}"

services:
${services.map(s => `  - name: ${s.name}
    path: ${s.path}
    methods: [${s.methods.join(', ')}]
    auth: ${s.requiresAuth}`).join('\n')}
`.trim();
    
    return new NextResponse(yaml, {
      headers: { 'Content-Type': 'text/yaml' },
    });
  }
  
  return NextResponse.json(response);
}

/**
 * Main gateway handler
 */
async function gatewayHandler(request: NextRequest) {
  const startTime = Date.now();
  const { pathname } = new URL(request.url);
  
  // Parse the API path
  const route = parseApiPath(pathname);
  
  if (!route) {
    return NextResponse.json(
      { error: 'Invalid API path', path: pathname },
      { status: 400 }
    );
  }
  
  // Handle gateway info request
  if (route.service === 'gateway') {
    return gatewayInfoHandler(request);
  }
  
  // Build service key
  let serviceKey = route.service;
  if (route.action) {
    serviceKey += `.${route.action}`;
  }
  
  // Validate service exists
  const service = API_SERVICES[serviceKey as keyof typeof API_SERVICES];
  
  if (!service) {
    return NextResponse.json(
      { 
        error: 'Service not found', 
        service: serviceKey,
        available: Object.keys(API_SERVICES),
      },
      { status: 404 }
    );
  }
  
  // Validate method
  if (!isMethodAllowed(serviceKey, request.method)) {
    return NextResponse.json(
      { 
        error: 'Method not allowed', 
        method: request.method,
        allowed: service.methods,
      },
      { status: 405 }
    );
  }
  
  // Authentication check
  if (service.auth) {
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }
    
    // Check permissions
    if (!hasPermission(auth.user, `api:${route.service}`)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }
  }
  
  // Rate limiting
  const clientId = request.headers.get('x-api-key') || 
                   request.headers.get('x-forwarded-for') || 
                   'anonymous';
  
  const rateLimitResult = await rateLimiter.check(clientId, 'api');
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { 
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResult.retryAfter,
      },
      { 
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(rateLimitResult.limit),
          'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          'X-RateLimit-Reset': String(rateLimitResult.resetTime),
        },
      }
    );
  }
  
  // Get target URL
  const targetUrl = getTargetUrl(route, request);
  
  if (!targetUrl) {
    return NextResponse.json(
      { error: 'Could not determine target service' },
      { status: 500 }
    );
  }
  
  // Forward the request
  try {
    const headers = new Headers(request.headers);
    headers.set('X-Gateway-Request', 'true');
    headers.set('X-Gateway-Timestamp', new Date().toISOString());
    
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' 
        ? await request.text() 
        : undefined,
    });
    
    const duration = Date.now() - startTime;
    
    logger.info('API Gateway request', {
      service: serviceKey,
      method: request.method,
      path: pathname,
      duration,
      status: response.status,
    });
    
    // Clone response and add gateway headers
    const modifiedResponse = new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
    
    modifiedResponse.headers.set('X-Gateway-Version', API_VERSION.version);
    modifiedResponse.headers.set('X-Response-Time', `${duration}ms`);
    modifiedResponse.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining));
    
    return modifiedResponse;
    
  } catch (error) {
    logger.error('Gateway forwarding error', { error, service: serviceKey, targetUrl });
    
    return NextResponse.json(
      { error: 'Service unavailable', service: serviceKey },
      { status: 503 }
    );
  }
}

/**
 * GET /api/gateway
 * Unified API Gateway entry point
 */
export const GET = withErrorHandling(gatewayHandler);

/**
 * POST /api/gateway
 */
export const POST = withErrorHandling(gatewayHandler);

/**
 * PUT /api/gateway
 */
export const PUT = withErrorHandling(gatewayHandler);

/**
 * DELETE /api/gateway
 */
export const DELETE = withErrorHandling(gatewayHandler);

/**
 * PATCH /api/gateway
 */
export const PATCH = withErrorHandling(gatewayHandler);

// Export for use in other modules
export { API_SERVICES, API_VERSION };
