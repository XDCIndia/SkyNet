/**
 * XDC SkyNet API Error Handling
 * Provides structured error responses and error types
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';

// =============================================================================
// Error Types
// =============================================================================

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'DATABASE_ERROR'
  | 'EXTERNAL_SERVICE_ERROR';

export interface ErrorDetails {
  field?: string;
  message: string;
  code?: string;
}

// =============================================================================
// Custom Error Classes
// =============================================================================

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: ErrorDetails[];
  public readonly isOperational: boolean;

  constructor(
    code: ErrorCode,
    statusCode: number,
    message: string,
    details?: ErrorDetails[],
    isOperational = true
  ) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    
    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: ErrorDetails[]) {
    super('VALIDATION_ERROR', 400, message, details);
  }

  static fromZodError(error: ZodError): ValidationError {
    const details = error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));
    
    return new ValidationError('Validation failed', details);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', 401, message);
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', 403, message);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super('NOT_FOUND', 404, `${resource} not found`);
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super('CONFLICT', 409, message);
  }
}

export class RateLimitError extends ApiError {
  public readonly retryAfter: number;

  constructor(retryAfter = 60) {
    super('RATE_LIMITED', 429, 'Too many requests');
    this.retryAfter = retryAfter;
  }
}

export class DatabaseError extends ApiError {
  constructor(message = 'Database error occurred') {
    super('DATABASE_ERROR', 500, message, undefined, false);
  }
}

export class ExternalServiceError extends ApiError {
  constructor(service: string, message?: string) {
    super(
      'EXTERNAL_SERVICE_ERROR',
      502,
      message || `External service error: ${service}`,
      undefined,
      false
    );
  }
}

// =============================================================================
// Error Response Helpers
// =============================================================================

export interface ErrorResponse {
  error: string;
  code: ErrorCode;
  details?: ErrorDetails[];
  requestId?: string;
  timestamp: string;
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: ApiError | Error,
  requestId?: string
): NextResponse<ErrorResponse> {
  const timestamp = new Date().toISOString();

  if (error instanceof ApiError) {
    const response: ErrorResponse = {
      error: error.message,
      code: error.code,
      timestamp,
    };

    if (error.details && error.details.length > 0) {
      response.details = error.details;
    }

    if (requestId) {
      response.requestId = requestId;
    }

    const headers: Record<string, string> = {};
    
    if (error instanceof RateLimitError) {
      headers['Retry-After'] = String(error.retryAfter);
    }

    return NextResponse.json(response, {
      status: error.statusCode,
      headers,
    });
  }

  // Handle unknown errors
  console.error('Unhandled error:', error);
  
  return NextResponse.json(
    {
      error: 'Internal server error',
      code: 'INTERNAL_ERROR' as ErrorCode,
      timestamp,
      requestId,
    },
    { status: 500 }
  );
}

/**
 * Validate request body against a Zod schema
 */
export async function validateBody<T>(
  request: Request,
  schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: ZodError } }
): Promise<T> {
  let body: unknown;
  
  try {
    body = await request.json();
  } catch {
    throw new ValidationError('Invalid JSON body');
  }

  const result = schema.safeParse(body);
  
  if (!result.success) {
    throw ValidationError.fromZodError(result.error!);
  }

  return result.data!;
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: ZodError } }
): T {
  const params: Record<string, string | string[]> = {};
  
  searchParams.forEach((value, key) => {
    const existing = params[key];
    if (existing) {
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        params[key] = [existing, value];
      }
    } else {
      params[key] = value;
    }
  });

  const result = schema.safeParse(params);
  
  if (!result.success) {
    throw ValidationError.fromZodError(result.error!);
  }

  return result.data!;
}

// =============================================================================
// Error Handling Middleware
// =============================================================================

/**
 * Wrap an API route handler with error handling
 */
export function withErrorHandling<R extends Request = Request, T = unknown>(
  handler: (req: R, context?: T) => Promise<NextResponse>
): (req: R, context?: T) => Promise<NextResponse> {
  return async (req: R, context?: T) => {
    const requestId = crypto.randomUUID();

    try {
      const response = await handler(req, context);
      
      // Add request ID to successful responses
      response.headers.set('x-request-id', requestId);
      
      return response;
    } catch (error) {
      if (error instanceof ApiError) {
        return createErrorResponse(error, requestId);
      }

      // Log unexpected errors
      console.error(`[${requestId}] Unexpected error:`, error);

      return createErrorResponse(
        new ApiError('INTERNAL_ERROR', 500, 'An unexpected error occurred'),
        requestId
      );
    }
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Assert a condition and throw NotFoundError if false
 */
export function assertFound<T>(
  value: T | null | undefined,
  resource: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new NotFoundError(resource);
  }
}

/**
 * Assert a condition and throw ValidationError if false
 */
export function assertValid(
  condition: boolean,
  message: string
): asserts condition {
  if (!condition) {
    throw new ValidationError(message);
  }
}
