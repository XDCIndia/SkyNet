/**
 * XDC SkyNet - Cache Layer
 * Provides API response caching and query result caching
 */

import { getRedis, isRedisConnected, getCache, setCache, deleteCache, invalidatePattern } from './redis';
import { LRUCache } from 'lru-cache';

// =============================================================================
// Cache Configuration
// =============================================================================

export const CACHE_TTLS = {
  // API responses
  nodeList: 30,           // 30 seconds
  nodeDetails: 60,        // 1 minute
  metrics: 15,            // 15 seconds
  incidents: 30,          // 30 seconds
  peers: 60,              // 1 minute
  health: 10,             // 10 seconds
  masternodes: 120,       // 2 minutes
  networkStats: 60,       // 1 minute
  
  // Query results
  queryResults: 60,       // 1 minute
  aggregations: 300,      // 5 minutes
} as const;

// =============================================================================
// LRU Fallback Cache
// =============================================================================

const lruCache = new LRUCache<string, { value: unknown; expiresAt: number }>({
  max: 5000,
  ttl: 300_000, // 5 minutes
  allowStale: false,
});

// =============================================================================
// Cache Key Generation
// =============================================================================

export function generateCacheKey(
  type: string,
  identifier: string,
  params?: Record<string, unknown>
): string {
  const baseKey = `skynet:${type}:${identifier}`;
  
  if (!params || Object.keys(params).length === 0) {
    return baseKey;
  }
  
  const paramHash = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join('&');
  
  return `${baseKey}:${Buffer.from(paramHash).toString('base64url')}`;
}

// =============================================================================
// Cache Operations
// =============================================================================

export async function getCached<T>(key: string): Promise<T | null> {
  // Try Redis first
  if (isRedisConnected()) {
    const value = await getCache<T>(key);
    if (value !== null) return value;
  }
  
  // Fallback to LRU
  const entry = lruCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.value as T;
  }
  
  return null;
}

export async function setCached<T>(
  key: string,
  value: T,
  ttlSeconds: number
): Promise<void> {
  // Try Redis first
  if (isRedisConnected()) {
    await setCache(key, value, ttlSeconds);
    return;
  }
  
  // Fallback to LRU
  lruCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

export async function deleteCached(key: string): Promise<void> {
  await deleteCache(key);
  lruCache.delete(key);
}

export async function invalidateCache(pattern: string): Promise<void> {
  await invalidatePattern(pattern);
  
  // Also clear matching LRU entries
  for (const key of lruCache.keys()) {
    if (key.includes(pattern.replace('*', ''))) {
      lruCache.delete(key);
    }
  }
}

// =============================================================================
// Cache Middleware Helper
// =============================================================================

export interface CacheConfig {
  ttl: number;
  keyGenerator?: (req: Request) => string;
  varyByHeaders?: string[];
  condition?: (req: Request) => boolean;
}

export function generateRequestCacheKey(
  req: Request,
  type: string,
  varyByHeaders?: string[]
): string {
  const url = new URL(req.url);
  const baseKey = `${type}:${url.pathname}:${url.search}`;
  
  if (!varyByHeaders || varyByHeaders.length === 0) {
    return baseKey;
  }
  
  const headerValues = varyByHeaders
    .map(h => req.headers.get(h.toLowerCase()))
    .filter(Boolean);
  
  if (headerValues.length > 0) {
    return `${baseKey}:h=${headerValues.join('|')}`;
  }
  
  return baseKey;
}

// =============================================================================
// Cache Tags for Invalidation
// =============================================================================

export const CACHE_TAGS = {
  nodes: 'skynet:nodes:*',
  metrics: 'skynet:metrics:*',
  incidents: 'skynet:incidents:*',
  peers: 'skynet:peers:*',
  health: 'skynet:health:*',
  masternodes: 'skynet:masternodes:*',
  network: 'skynet:network:*',
  all: 'skynet:*',
} as const;

export async function invalidateByTag(tag: keyof typeof CACHE_TAGS): Promise<void> {
  await invalidateCache(CACHE_TAGS[tag]);
}

// =============================================================================
// Query Result Caching
// =============================================================================

export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number
): Promise<T> {
  // Try to get from cache
  const cached = await getCached<T>(key);
  if (cached !== null) {
    return cached;
  }
  
  // Execute function
  const result = await fn();
  
  // Store in cache (don't await, fire and forget)
  setCached(key, result, ttlSeconds).catch(console.error);
  
  return result;
}

export async function withConditionalCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttlSeconds: number,
  condition: boolean
): Promise<T> {
  if (!condition) {
    return fn();
  }
  return withCache(key, fn, ttlSeconds);
}
