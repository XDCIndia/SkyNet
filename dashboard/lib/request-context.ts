/**
 * XDC SkyNet - Request ID Tracing
 * Provides request correlation and context propagation
 * Edge Runtime Compatible
 */

// =============================================================================
// Request Context Type
// =============================================================================

interface RequestContext {
  requestId: string;
  startTime: number;
  path: string;
  method: string;
  userAgent?: string;
  ip?: string;
}

// Simple context store (per-request, not async)
let currentContext: RequestContext | undefined;

// =============================================================================
// Request ID Generation (Edge-compatible)
// =============================================================================

export function generateRequestId(): string {
  // Use Web Crypto API (available in Edge runtime)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function getRequestIdFromHeader(req: Request): string | undefined {
  return req.headers.get('x-request-id') ||
         req.headers.get('x-correlation-id') ||
         req.headers.get('x-trace-id') ||
         undefined;
}

// =============================================================================
// Context Management (Simplified for Edge)
// =============================================================================

export function getRequestContext(): RequestContext | undefined {
  return currentContext;
}

export function getCurrentRequestId(): string | undefined {
  return currentContext?.requestId;
}

export async function runWithContext<T>(
  context: RequestContext,
  fn: () => T | Promise<T>
): Promise<T> {
  const previousContext = currentContext;
  currentContext = context;
  try {
    return await fn();
  } finally {
    currentContext = previousContext;
  }
}

// =============================================================================
// Timing Helpers
// =============================================================================

export function getRequestDuration(): number {
  if (!currentContext) return 0;
  return Date.now() - currentContext.startTime;
}

// =============================================================================
// Request ID Config
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
