/**
 * XDC SkyNet - Test Setup
 * Vitest configuration and test utilities
 */

import { vi } from 'vitest';
import { NextRequest } from 'next/server';

// =============================================================================
// Mock Setup
// =============================================================================

// Mock environment variables
process.env.DATABASE_URL = 'postgresql://localhost:5432/skynet_test';
process.env.API_KEYS = 'test_master_key_12345';
process.env.NODE_ENV = 'test';

// =============================================================================
// Test Utilities
// =============================================================================

export function createMockRequest(
  method: string,
  url: string,
  options: {
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const { body, headers = {} } = options;
  
  const req = new NextRequest(new URL(url, 'http://localhost'), {
    method,
    headers: new Headers(headers),
    body: body ? JSON.stringify(body) : undefined,
  });
  
  return req;
}

export function createAuthenticatedRequest(
  method: string,
  url: string,
  options: {
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
    apiKey?: string;
  } = {}
): NextRequest {
  const { body, headers = {}, apiKey = 'test_master_key_12345' } = options;
  
  return createMockRequest(method, url, {
    body,
    headers: {
      ...headers,
      Authorization: `Bearer ${apiKey}`,
    },
  });
}

// =============================================================================
// Database Mock
// =============================================================================

export const mockQuery = vi.fn();
export const mockWithTransaction = vi.fn();

vi.mock('@/lib/db', () => ({
  query: mockQuery,
  queryAll: mockQuery,
  queryOne: mockQuery,
  withTransaction: mockWithTransaction,
}));

// =============================================================================
// Redis Mock
// =============================================================================

export const mockRedisGet = vi.fn();
export const mockRedisSet = vi.fn();
export const mockRedisDel = vi.fn();

vi.mock('@/lib/redis', () => ({
  getRedis: () => ({
    get: mockRedisGet,
    setex: mockRedisSet,
    del: mockRedisDel,
    pipeline: () => ({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      zrange: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([null, [null, 0], null, null, null]),
    }),
  }),
  isRedisConnected: () => false,
  getCache: mockRedisGet,
  setCache: mockRedisSet,
  deleteCache: mockRedisDel,
}));
