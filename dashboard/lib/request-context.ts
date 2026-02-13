/**
 * XDC SkyNet - Request ID Tracing
 * Provides request correlation and context propagation
 */

import { randomUUID } from 'crypto';
import { AsyncLocalStorage } from 'async_hooks';

// =============================================================================
// AsyncLocalStorage for Request Context
// =============================================================================

interface RequestContext {
  requestId: string;
  startTime: number;
  path: string;
  method: string;
  userAgent?: string;
  ip?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

// =============================================================================
// Request ID Generation
// =============================================================================

export function generateRequestId(): string {
  return randomUUID();
}

export function getRequestIdFromHeader(req: Request): string | undefined {
  return req.headers.get('x-request-id') ||
         req.headers.get('x-correlation-id') ||
         req.headers.get('x-trace-id') ||
         undefined;
}

// =============================================================================
// Context Management
// =============================================================================

export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

export function getCurrentRequestId(): string | undefined {
  return asyncLocalStorage.getStore()?.requestId;
}

export function runWithContext<T>(
  context: RequestContext,
  fn: () => T | Promise<T>
): Promise<T> {
  return asyncLocalStorage.run(context, fn);
}

// =============================================================================
// Timing Helpers
// =============================================================================

export function getRequestDuration(): number {
  const context = asyncLocalStorage.getStore();
  if (!context) return 0;
  return Date.now() - context.startTime;
}

// =============================================================================
// Request ID Middleware Factory
// =============================================================================

export interface RequestIdConfig {
  headerName?: string;
  responseHeaderName?: string;
  generateOnMissing?: boolean;
}

export const defaultRequestIdConfig: RequestIdConfig = {
  headerName: 'x-request-id',
  responseHeaderName: 'x-request-id',
  generateOnMissing: true,
};
