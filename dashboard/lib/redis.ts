/**
 * XDC SkyNet - Redis Client
 * Provides Redis connection with fallback handling
 */

import Redis from 'ioredis';
import { config } from './config';

// =============================================================================
// Redis Client Singleton
// =============================================================================

let redis: Redis | null = null;
let isRedisAvailable = false;

export function getRedis(): Redis | null {
  if (redis) return redis;
  
  if (!config.REDIS_URL) {
    return null;
  }
  
  try {
    redis = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });
    
    redis.on('connect', () => {
      console.log('[Redis] Connected successfully');
      isRedisAvailable = true;
    });
    
    redis.on('error', (err) => {
      console.error('[Redis] Error:', err.message);
      isRedisAvailable = false;
    });
    
    redis.on('close', () => {
      console.warn('[Redis] Connection closed');
      isRedisAvailable = false;
    });
    
    return redis;
  } catch (error) {
    console.error('[Redis] Failed to create client:', error);
    return null;
  }
}

export function isRedisConnected(): boolean {
  return isRedisAvailable && redis?.status === 'ready';
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    isRedisAvailable = false;
  }
}

// =============================================================================
// Cache Helpers
// =============================================================================

export async function getCache<T>(key: string): Promise<T | null> {
  const client = getRedis();
  if (!client) return null;
  
  try {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export async function setCache<T>(
  key: string, 
  value: T, 
  ttlSeconds: number
): Promise<void> {
  const client = getRedis();
  if (!client) return;
  
  try {
    await client.setex(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.error('[Redis] Cache set error:', error);
  }
}

export async function deleteCache(key: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  
  try {
    await client.del(key);
  } catch (error) {
    console.error('[Redis] Cache delete error:', error);
  }
}

export async function invalidatePattern(pattern: string): Promise<void> {
  const client = getRedis();
  if (!client) return;
  
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  } catch (error) {
    console.error('[Redis] Cache invalidation error:', error);
  }
}
