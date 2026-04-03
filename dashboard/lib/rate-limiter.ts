/**
 * XDC SkyNet - Pure TypeScript In-Memory Rate Limiter
 * Sliding window rate limiting without external dependencies
 * Compatible with Edge Runtime (no Node.js-only modules)
 */

// =============================================================================
// Types
// =============================================================================

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface RateLimitResult {
  limited: boolean;
  remaining: number;
  resetAt: number;
  totalLimit: number;
  retryAfter?: number;
}

interface RateLimitEntry {
  requests: number[]; // Timestamps of requests in the current window
}

// =============================================================================
// Rate Limit Tiers Configuration
// =============================================================================

export const RATE_LIMIT_TIERS = {
  // Public / unauthenticated requests — 60 req/min per IP
  public: {
    windowMs: 60_000,
    maxRequests: parseInt(process.env.RATE_LIMIT_PUBLIC || '600', 10),
  },
  // Authenticated (API-key) requests — 300 req/min per key
  authenticated: {
    windowMs: 60_000,
    maxRequests: parseInt(process.env.RATE_LIMIT_AUTHENTICATED || '1200', 10),
  },
  // Heartbeat — 120 req/min per node (allows ~2 req/s)
  heartbeat: {
    windowMs: 60_000,
    maxRequests: parseInt(process.env.RATE_LIMIT_HEARTBEAT || '600', 10),
  },
} as const;

export type RateLimitTier = keyof typeof RATE_LIMIT_TIERS;

// =============================================================================
// In-Memory Store
// =============================================================================

// Map of key -> entry for rate limiting
const rateLimitStore = new Map<string, RateLimitEntry>();

// Track when we last cleaned up expired entries
let lastCleanupTime = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// =============================================================================
// Cleanup Logic
// =============================================================================

/**
 * Clean up expired entries to prevent memory leaks
 * Runs every 5 minutes
 */
function maybeCleanup(): void {
  const now = Date.now();
  
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) {
    return; // Not time yet
  }
  
  lastCleanupTime = now;
  
  // Remove entries with all requests outside the window
  Array.from(rateLimitStore.entries()).forEach(([key, entry]) => {
    const validRequests = entry.requests.filter(
      timestamp => now - timestamp < 60_000
    );
    
    if (validRequests.length === 0) {
      rateLimitStore.delete(key);
    } else {
      entry.requests = validRequests;
    }
  });
}

// =============================================================================
// Sliding Window Rate Limit Logic
// =============================================================================

/**
 * Check if a request should be rate limited using sliding window algorithm
 */
function checkSlidingWindow(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  // Get or create entry
  let entry = rateLimitStore.get(key);
  
  if (!entry) {
    entry = { requests: [] };
    rateLimitStore.set(key, entry);
  }
  
  // Remove requests outside the current window (sliding window)
  entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);
  
  // Check if limit exceeded
  if (entry.requests.length >= config.maxRequests) {
    // Find the oldest request to determine when the window will slide
    const oldestRequest = Math.min(...entry.requests);
    const retryAfter = Math.ceil((oldestRequest + config.windowMs - now) / 1000);
    const resetAt = oldestRequest + config.windowMs;
    
    return {
      limited: true,
      remaining: 0,
      resetAt,
      totalLimit: config.maxRequests,
      retryAfter: Math.max(1, retryAfter),
    };
  }
  
  // Add current request timestamp
  entry.requests.push(now);
  
  // Calculate reset time (when the oldest request will expire)
  const resetAt = entry.requests.length > 0 
    ? Math.min(...entry.requests) + config.windowMs 
    : now + config.windowMs;
  
  const remaining = config.maxRequests - entry.requests.length;
  
  return {
    limited: false,
    remaining,
    resetAt,
    totalLimit: config.maxRequests,
  };
}

// =============================================================================
// Main Rate Limit Function
// =============================================================================

/**
 * Check rate limit for a given identifier and tier
 */
export function checkRateLimit(
  identifier: string,
  tier: RateLimitTier = 'public'
): RateLimitResult {
  // Run cleanup periodically (every 5 minutes)
  maybeCleanup();
  
  const config = RATE_LIMIT_TIERS[tier];
  const key = `${tier}:${identifier}`;
  
  return checkSlidingWindow(key, config);
}

// =============================================================================
// Rate Limit Headers
// =============================================================================

/**
 * Create rate limit headers for responses
 */
export function createRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.totalLimit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
  };
  
  if (result.retryAfter) {
    headers['Retry-After'] = String(result.retryAfter);
  }
  
  return headers;
}

// =============================================================================
// IP/Key Extraction Helpers
// =============================================================================

/**
 * Get the client IP address from request headers
 */
export function getClientIP(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
  return ip;
}

/**
 * Get rate limit identifier based on API key or IP
 */
export function getRateLimitIdentifier(
  req: Request,
  apiKey?: string | null
): string {
  if (apiKey) {
    // Use API key hash for identified users
    return `key:${hashString(apiKey)}`;
  }
  
  // Fall back to IP address
  return `ip:${getClientIP(req)}`;
}

/**
 * Simple string hash function (FNV-1a inspired)
 */
function hashString(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0).toString(36);
}

// =============================================================================
// Tier Determination
// =============================================================================

/**
 * Determine rate limit tier based on request path and authentication
 */
export function determineRateLimitTier(
  method: string,
  path: string,
  apiKey?: string | null
): RateLimitTier {
  // Heartbeat endpoint - 120 req/min per node
  if (path.includes('/nodes/heartbeat')) {
    return 'heartbeat';
  }
  
  // Authenticated requests - 600 req/min per key
  if (apiKey) {
    return 'authenticated';
  }
  
  // Public/unauthenticated - 60 req/min per IP
  return 'public';
}

/**
 * Extract node ID from request for heartbeat rate limiting
 * For heartbeat endpoints, we rate limit per node, not per IP
 */
export function getHeartbeatIdentifier(req: Request): string | null {
  // Try to get node ID from headers first
  const nodeIdHeader = req.headers.get('x-node-id');
  if (nodeIdHeader) {
    return nodeIdHeader;
  }
  
  // Fall back to IP if no node ID available
  return getClientIP(req);
}

// =============================================================================
// Stats (for monitoring/debugging)
// =============================================================================

export function getRateLimitStats(): {
  totalKeys: number;
  storeSize: number;
  lastCleanup: number;
} {
  return {
    totalKeys: rateLimitStore.size,
    storeSize: JSON.stringify(Array.from(rateLimitStore.entries())).length,
    lastCleanup: lastCleanupTime,
  };
}

// Stub exports for gateway route compatibility
export class RateLimitError extends Error {
  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export async function rateLimitRequest(_request: Request, _userId?: string): Promise<void> {
  // No-op stub — real rate limiting handled by proxy layer
}
