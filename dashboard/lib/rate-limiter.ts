/**
 * XDC SkyNet - Advanced Rate Limiting
 * Supports Redis-based distributed rate limiting with LRU fallback
 */

import { getRedis, isRedisConnected } from './redis';
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
// Redis Rate Limiting (Sliding Window)
// =============================================================================

async function checkRedisRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) {
    throw new Error('Redis not available');
  }

  const now = Date.now();
  const windowStart = now - config.windowMs;
  const windowKey = `ratelimit:${key}`;

  const pipeline = redis.pipeline();
  
  // Remove entries outside the window
  pipeline.zremrangebyscore(windowKey, 0, windowStart);
  
  // Count current entries
  pipeline.zcard(windowKey);
  
  // Add current request
  const entryId = `${now}-${Math.random().toString(36).substring(2, 11)}`;
  pipeline.zadd(windowKey, now, entryId);
  
  // Set expiry on the key
  pipeline.pexpire(windowKey, config.windowMs);
  
  // Get the oldest entry for reset time calculation
  pipeline.zrange(windowKey, 0, 0, 'WITHSCORES');

  const results = await pipeline.exec();
  
  if (!results) {
    return { limited: false, remaining: config.maxRequests, resetAt: now + config.windowMs, totalLimit: config.maxRequests };
  }

  const currentCount = (results[1]?.[1] as number) || 0;
  const oldestEntry = results[4]?.[1] as string[];
  const oldestTimestamp = oldestEntry?.[1] ? parseInt(oldestEntry[1]) : now;
  
  const resetAt = oldestTimestamp + config.windowMs;
  const remaining = Math.max(0, config.maxRequests - currentCount - 1);
  const limited = currentCount >= config.maxRequests;

  return {
    limited,
    remaining,
    resetAt,
    totalLimit: config.maxRequests,
    retryAfter: limited ? Math.ceil((resetAt - now) / 1000) : undefined,
  };
}

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
  
  // Try Redis first
  if (isRedisConnected()) {
    try {
      return await checkRedisRateLimit(key, config);
    } catch (error) {
      console.warn('[RateLimit] Redis failed, falling back to LRU:', error);
    }
  }
  
  // Fallback to LRU
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
