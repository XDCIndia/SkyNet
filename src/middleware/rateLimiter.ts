import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis';

/**
 * Rate Limiting Middleware for XDCNetOwn API
 * Fixes Issue #364: API Security - No Rate Limiting on Endpoints
 * 
 * Implements Redis-based token bucket algorithm with tiered limits:
 * - Free tier: 100 requests/minute
 * - Standard tier: 1,000 requests/minute  
 * - Premium tier: 10,000 requests/minute
 * - Enterprise tier: 100,000 requests/minute
 */

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

const TIER_LIMITS: Record<string, RateLimitConfig> = {
  free: { windowMs: 60 * 1000, maxRequests: 100 },
  standard: { windowMs: 60 * 1000, maxRequests: 1000 },
  premium: { windowMs: 60 * 1000, maxRequests: 10000 },
  enterprise: { windowMs: 60 * 1000, maxRequests: 100000 },
};

class RateLimiter {
  private redis: Redis;

  constructor(redisUrl?: string) {
    this.redis = new Redis(redisUrl || process.env.REDIS_URL || 'redis://localhost:6379');
  }

  /**
   * Token bucket algorithm implementation
   */
  async checkLimit(
    identifier: string,
    tier: string = 'free'
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const config = TIER_LIMITS[tier] || TIER_LIMITS.free;
    const key = `ratelimit:${tier}:${identifier}`;
    const now = Date.now();
    const windowStart = Math.floor(now / config.windowMs) * config.windowMs;

    const multi = this.redis.multi();
    
    // Get current count
    multi.get(key);
    
    // Set expiry if key doesn't exist
    multi.setnx(key, '0');
    multi.pexpireat(key, windowStart + config.windowMs);
    
    // Increment count
    multi.incr(key);
    
    const results = await multi.exec();
    const currentCount = parseInt(results?.[2]?.[1] as string || '0');
    
    const allowed = currentCount <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - currentCount);
    const resetTime = windowStart + config.windowMs;

    return { allowed, remaining, resetTime };
  }

  /**
   * Middleware factory for Express
   */
  middleware(tier: string = 'free') {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Use API key as identifier, fallback to IP
        const identifier = (req.headers['x-api-key'] as string) || 
                          req.ip || 
                          req.socket.remoteAddress || 
                          'unknown';

        const { allowed, remaining, resetTime } = await this.checkLimit(identifier, tier);

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', TIER_LIMITS[tier]?.maxRequests || 100);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));

        if (!allowed) {
          return res.status(429).json({
            error: 'Rate limit exceeded',
            message: `Too many requests. Please try again after ${new Date(resetTime).toISOString()}`,
            retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
          });
        }

        next();
      } catch (error) {
        console.error('Rate limiting error:', error);
        // Fail open - allow request if Redis is down
        next();
      }
    };
  }

  /**
   * Tiered middleware based on API key
   */
  tieredMiddleware(getTier: (apiKey: string) => Promise<string> | string) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const apiKey = req.headers['x-api-key'] as string;
        
        if (!apiKey) {
          // Apply free tier for requests without API key
          return this.middleware('free')(req, res, next);
        }

        const tier = await getTier(apiKey);
        return this.middleware(tier)(req, res, next);
      } catch (error) {
        console.error('Tiered rate limiting error:', error);
        next();
      }
    };
  }
}

export { RateLimiter, TIER_LIMITS };
export default RateLimiter;
