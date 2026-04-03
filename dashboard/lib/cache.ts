/**
 * Issue #18 — In-Memory TTL Cache
 *
 * Simple Map-based cache to reduce DB load.
 * No Redis required. Falls back transparently if Redis is unavailable.
 *
 * TTLs:
 *   - Node list: 30s
 *   - Single node: 5s
 *   - Fleet status: 5s
 *   - Metrics: 30s
 */

// ──────────────────────────────────────────────────────────────
// In-Memory Cache (always available, zero dependencies)
// ──────────────────────────────────────────────────────────────

interface MemCacheEntry<T = unknown> {
  value: T;
  expiresAt: number;
}

const memStore = new Map<string, MemCacheEntry>();

/** In-memory TTL cache — get a value or undefined if missing/expired */
export function memGet<T>(key: string): T | undefined {
  const entry = memStore.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    memStore.delete(key);
    return undefined;
  }
  return entry.value as T;
}

/** In-memory TTL cache — set a value with TTL in seconds */
export function memSet<T>(key: string, value: T, ttlSeconds: number): void {
  memStore.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

/** In-memory TTL cache — delete a key */
export function memDel(key: string): void {
  memStore.delete(key);
}

/** In-memory TTL cache — delete all keys matching a prefix */
export function memDelPrefix(prefix: string): void {
  for (const key of memStore.keys()) {
    if (key.startsWith(prefix)) memStore.delete(key);
  }
}

/**
 * getMemCached — Fetch from in-memory cache or call fetcher and cache result.
 * Drop-in replacement for getCached() when Redis is not available.
 *
 * @example
 * const nodes = await getMemCached('skynet:nodes', () => db.query(...), 30);
 */
export async function getMemCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  const cached = memGet<T>(key);
  if (cached !== undefined) return cached;

  const fresh = await fetcher();
  memSet(key, fresh, ttlSeconds);
  return fresh;
}

// Prune expired entries periodically to prevent memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memStore.entries()) {
      if (now > entry.expiresAt) memStore.delete(key);
    }
  }, 60_000);
}

import Redis from 'ioredis';

// Redis client singleton
let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redis = new Redis(redisUrl, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
    });

    redis.on('error', (err) => {
      console.error('Redis error:', err);
    });

    redis.on('connect', () => {
      console.log('Redis connected');
    });
  }

  return redis;
}

// Cache configuration
const DEFAULT_TTL = 300; // 5 minutes

interface CacheConfig {
  ttl?: number;
  key?: string;
}

/**
 * Get cached data or fetch from source
 */
export async function getCached<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> {
  try {
    const client = getRedisClient();
    const cached = await client.get(key);

    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.warn('Redis get failed, fetching from source:', error);
  }

  // Fetch fresh data
  const data = await fetcher();

  // Try to cache the result
  try {
    const client = getRedisClient();
    await client.setex(key, ttl, JSON.stringify(data));
  } catch (error) {
    console.warn('Redis set failed:', error);
  }

  return data;
}

/**
 * Set cache value
 */
export async function setCache<T>(
  key: string,
  value: T,
  ttl: number = DEFAULT_TTL
): Promise<void> {
  try {
    const client = getRedisClient();
    await client.setex(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.warn('Redis set failed:', error);
  }
}

/**
 * Delete cached value
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    const client = getRedisClient();
    await client.del(key);
  } catch (error) {
    console.warn('Redis delete failed:', error);
  }
}

/**
 * Delete cached values by pattern
 */
export async function invalidateCache(pattern: string): Promise<void> {
  try {
    const client = getRedisClient();
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch (error) {
    console.warn('Redis invalidate failed:', error);
  }
}

// Cache key builders
export const CacheKeys = {
  fleetStatus: () => 'skynet:fleet:status',
  nodeDetail: (nodeId: string) => `skynet:node:${nodeId}`,
  nodeMetrics: (nodeId: string) => `skynet:node:${nodeId}:metrics`,
  networkHealth: () => 'skynet:network:health',
  masternodeList: () => 'skynet:masternodes:list',
  blockHeight: () => 'skynet:block:height',
  peerCount: (nodeId: string) => `skynet:node:${nodeId}:peers`,
};

// Cache TTL configuration
export const CacheTTL = {
  fleetStatus: 5,        // 5 seconds
  nodeDetail: 10,        // 10 seconds
  nodeMetrics: 30,       // 30 seconds
  networkHealth: 30,     // 30 seconds
  masternodeList: 60,    // 1 minute
  blockHeight: 2,        // 2 seconds
  peerCount: 10,         // 10 seconds
};

// Aliases used by API routes
export const CACHE_TTLS = {
  health: 5,
  nodes: 10,
  metrics: 30,
  incidents: 15,
  fleet: 5,
};

/**
 * Generate a deterministic cache key from segments + params
 */
export function generateCacheKey(...parts: any[]): string {
  const segments = parts.map(p =>
    typeof p === 'object' ? JSON.stringify(p, Object.keys(p).sort()) : String(p)
  );
  return `skynet:${segments.join(':')}`;
}

/**
 * withCache — wrapper around getCached for route handlers
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> {
  return getCached(key, fetcher, ttl);
}

/**
 * Invalidate cache entries by tag/pattern prefix
 */
export async function invalidateByTag(tag: string): Promise<void> {
  return invalidateCache(`skynet:${tag}:*`);
}
