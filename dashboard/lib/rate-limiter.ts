/**
 * XDC SkyNet - Advanced Rate Limiting
 * Uses LRU cache for Edge-compatible rate limiting
 * Note: Redis support removed for Edge runtime compatibility
 */

import { LRUCache } from 'lru-cache';

// =============================================================================
// Rate Limit Tiers
// =============================================================================

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  burstAllowance?: number;
}

export const RATE_LIMIT_TIERS = {
  // Public read endpoints
  public: {
    windowMs: 60_000,
    maxRequests: 60,
    burstAllowance: 10,
  },
  // Authenticated read endpoints
  authenticated: {
    windowMs: 60_000,
    maxRequests: 120,
    burstAllowance: 20,
  },
  // Write endpoints (POST/PUT/DELETE)
  write: {
    windowMs: 60_000,
    maxRequests: 30,
    burstAllowance: 5,
  },
  // Heartbeat endpoint (frequent calls expected)
  heartbeat: {
    windowMs: 60_000,
    maxRequests: 120,
    burstAllowance: 10,
  },
  // Admin endpoints
  admin: {
    windowMs: 60_000,
    maxRequests: 300,
    burstAllowance: 50,
  },
} as const;

export type RateLimitTier = keyof typeof RATE_LIMIT_TIERS;

// =============================================================================
// Rate Limit Result
// =============================================================================

export interface RateLimitResult {
  limited: boolean;
  remaining: number;
  resetAt: number;
  totalLimit: number;
  retryAfter?: number;
}

// =============================================================================
// LRU Fallback Cache
// =============================================================================

interface LimiterEntry {
  count: number;
  resetAt: number;
}

const lruCache = new LRUCache<string, LimiterEntry>({
  max: 10000,
  ttl: 120_000, // 2 minutes max TTL
  allowStale: false,
  updateAgeOnGet: true,
});

// =============================================================================
// LRU Rate Limiting (Sliding Window)
// =============================================================================

function checkLruRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const windowKey = `ratelimit:${key}`;
  
  let entry = lruCache.get(windowKey);
  
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + config.windowMs };
  }
  
  entry.count++;
  lruCache.set(windowKey, entry);
  
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const limited = entry.count > config.maxRequests;
  
  return {
    limited,
    remaining,
    resetAt: entry.resetAt,
    totalLimit: config.maxRequests,
    retryAfter: limited ? Math.ceil((entry.resetAt - now) / 1000) : undefined,
  };
}

// =============================================================================
// Main Rate Limit Function
// =============================================================================

export async function checkRateLimit(
  identifier: string,
  tier: RateLimitTier = 'public'
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_TIERS[tier];
  const key = `${tier}:${identifier}`;
  
  // Use LRU cache (Edge-compatible)
  return checkLruRateLimit(key, config);
}

// =============================================================================
// Rate Limit Headers
// =============================================================================

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

export function getRateLimitIdentifier(
  req: Request,
  apiKey?: string
): string {
  if (apiKey) {
    // Use API key hash for identified users
    return `key:${hashString(apiKey)}`;
  }
  
  // Fall back to IP address
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ip = forwarded?.split(',')[0]?.trim() || realIp || 'unknown';
  
  return `ip:${ip}`;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// =============================================================================
// Tier Determination
// =============================================================================

export function determineRateLimitTier(
  method: string,
  path: string,
  isAuthenticated: boolean
): RateLimitTier {
  // Heartbeat endpoint
  if (path.includes('/heartbeat')) {
    return 'heartbeat';
  }
  
  // Admin endpoints
  if (path.includes('/admin') || path.includes('/upgrades')) {
    return 'admin';
  }
  
  // Write operations
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase())) {
    return 'write';
  }
  
  // Authenticated reads
  if (isAuthenticated) {
    return 'authenticated';
  }
  
  // Public reads
  return 'public';
}
