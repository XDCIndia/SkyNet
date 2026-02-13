# Architecture Review: XDC SkyNet (formerly XDCNetOwn)
**Date:** 2026-02-13  
**Reviewer:** ArchitectoBot  
**Project:** XDC Network Ownership Dashboard + Fleet Management

---

## Executive Summary

XDCNetOwn (to be rebranded as "XDC SkyNet") is a Next.js-based dashboard and API platform for XDC Network fleet management. The architecture demonstrates good practices with TypeScript, PostgreSQL, and real-time capabilities via WebSocket. However, significant gaps exist in input validation, caching strategy, rate limiting granularity, and test coverage that must be addressed for production deployment at scale.

**Overall Rating:** 6.5/10 (Promising, Needs Hardening for Production)

---

## Strengths

### 1. Modern Tech Stack ✅
- Next.js 14 with App Router
- TypeScript with strict mode
- Tailwind CSS for styling
- PostgreSQL for persistence
- WebSocket for real-time updates

### 2. Good Database Schema Design ✅
- Proper use of PostgreSQL schemas (`netown`)
- Indexing strategy for time-series data
- Foreign key constraints
- Trigger-based `updated_at` maintenance

### 3. Security Headers & Basic Rate Limiting ✅
- Comprehensive security headers in middleware
- In-memory rate limiting per IP
- Timing-safe API key comparison
- CSP policies configured

### 4. Component Architecture ✅
- Well-structured React components
- Virtual scrolling for large tables
- Responsive design patterns
- Type-safe props

---

## Critical Issues (Must Fix)

### 1. No Input Validation on API Routes 🔴
**Severity:** Critical  
**Impact:** SQL injection, XSS, data corruption vulnerabilities

**Current State (Vulnerable):**
```typescript
// app/api/v1/nodes/register/route.ts (example)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, host, role } = body;
  // Directly using user input in SQL
  await query('INSERT INTO netown.nodes (name, host, role) VALUES ($1, $2, $3)', 
    [name, host, role]);
}
```

**Recommended Fix:**
```typescript
import { z } from 'zod';

const NodeRegistrationSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9-_]+$/),
  host: z.string().url().max(255),
  role: z.enum(['masternode', 'fullnode', 'archive', 'rpc']),
  rpcUrl: z.string().url().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if (!auth.valid) return unauthorizedResponse();
  
  const body = await req.json();
  const result = NodeRegistrationSchema.safeParse(body);
  
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.format() },
      { status: 400 }
    );
  }
  
  // Now safe to use
  const { name, host, role } = result.data;
  // ...
}
```

### 2. Missing Database Connection Resilience 🔴
**Severity:** Critical  
**Location:** `lib/db/index.ts`

**Issues:**
- No connection retry logic
- No circuit breaker for DB failures
- Pool exhaustion not handled
- No graceful degradation

### 3. In-Memory Rate Limiting Won't Scale 🔴
**Severity:** High  
**Location:** `middleware.ts`

**Current Implementation:**
```typescript
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
```

**Problems:**
- Memory leak in long-running processes
- Doesn't work across multiple instances (horizontal scaling)
- No persistence across restarts
- No differentiated limits by endpoint

**Recommended Fix:**
```typescript
// Use Redis for distributed rate limiting
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

async function isRateLimited(key: string, limit: number, window: number): Promise<boolean> {
  const pipeline = redis.pipeline();
  const now = Date.now();
  const windowStart = now - window;
  
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zcard(key);
  pipeline.zadd(key, now, `${now}-${Math.random()}`);
  pipeline.pexpire(key, window);
  
  const results = await pipeline.exec();
  const current = results?.[1]?.[1] as number || 0;
  
  return current >= limit;
}
```

### 4. No Caching Strategy 🔴
**Severity:** High  
**Impact:** Database overload, poor performance under load

**Missing:**
- No API response caching
- No database query result caching
- No CDN configuration for static assets
- Cache invalidation strategy

---

## High Priority Improvements

### 5. Add API Versioning Strategy
**Current:** Version in path (`/api/v1/`)  
**Recommended:** Version in header with deprecation support

```typescript
// middleware.ts
const API_VERSIONS = ['v1', 'v2'];
const DEPRECATED_VERSIONS = [];

export function middleware(req: NextRequest) {
  const version = req.headers.get('x-api-version') || 'v1';
  
  if (DEPRECATED_VERSIONS.includes(version)) {
    response.headers.set('Deprecation', 'true');
    response.headers.set('Sunset', '2026-06-01');
  }
  // ...
}
```

### 6. Implement Request ID Tracing
**Missing:** No correlation IDs for request tracing

```typescript
// middleware.ts
import { randomUUID } from 'crypto';

export function middleware(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || randomUUID();
  
  const response = NextResponse.next();
  response.headers.set('x-request-id', requestId);
  
  // Add to AsyncLocalStorage for logging context
  return response;
}
```

### 7. Add Comprehensive Error Handling
**Current:** Generic 500 errors  
**Recommended:** Structured error responses

```typescript
// lib/errors.ts
export class ApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export class ValidationError extends ApiError {
  constructor(details: Record<string, string[]>) {
    super('VALIDATION_ERROR', 400, 'Request validation failed', details);
  }
}

export class RateLimitError extends ApiError {
  constructor(public retryAfter: number) {
    super('RATE_LIMITED', 429, 'Too many requests');
  }
}
```

### 8. Add Database Migration System
**Current:** Manual schema.sql execution  
**Recommended:** Migration framework

```bash
# Use node-pg-migrate or Prisma migrations
npm install node-pg-migrate

# migrations/001_initial_schema.sql
# migrations/002_add_indexes.sql
# migrations/003_add_api_keys.sql
```

### 9. Implement WebSocket Authentication
**Current:** No auth on WebSocket connections  
**Security Risk:** Unauthorized access to real-time data

```typescript
// ws-server.ts
import { verify } from 'jsonwebtoken';

wss.on('connection', (ws, req) => {
  const token = new URL(req.url!, 'http://localhost').searchParams.get('token');
  
  try {
    const decoded = verify(token!, process.env.JWT_SECRET!);
    (ws as any).user = decoded;
  } catch {
    ws.close(1008, 'Invalid token');
    return;
  }
  // ...
});
```

### 10. Add Observability
**Missing:**
- Application metrics (Prometheus)
- Distributed tracing (OpenTelemetry)
- Structured logging
- Error tracking (Sentry)

```typescript
// lib/observability.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

const prometheusExporter = new PrometheusExporter({ port: 9090 });
const sdk = new NodeSDK({
  metricReader: prometheusExporter,
});
sdk.start();
```

---

## Medium Priority Improvements

### 11. Add Pagination & Cursor-Based Queries
**Current:** Loading all nodes into memory  
**Risk:** OOM with large fleets

```typescript
// lib/pagination.ts
interface CursorPaginationParams {
  cursor?: string;
  limit: number;
  direction: 'asc' | 'desc';
}

function encodeCursor(data: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

function decodeCursor(cursor: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(cursor, 'base64url').toString());
}
```

### 12. Implement Background Job Queue
**Use Cases:**
- Bulk node operations
- Report generation
- Data aggregation
- Email notifications

```typescript
// Using BullMQ with Redis
import { Queue } from 'bullmq';

const jobQueue = new Queue('xdc-skynet', {
  connection: { host: process.env.REDIS_HOST },
});

// Add job
await jobQueue.add('generate-report', { nodeIds, format: 'pdf' }, {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1000 },
});
```

### 13. Add API Key Scoping & Permissions
**Current:** Binary valid/invalid check  
**Recommended:** Granular permissions

```typescript
const PERMISSIONS = {
  'nodes:read': 'View node information',
  'nodes:write': 'Create/update nodes',
  'nodes:delete': 'Remove nodes',
  'metrics:read': 'View metrics',
  'metrics:write': 'Submit metrics',
  'admin': 'All permissions',
} as const;

type Permission = keyof typeof PERMISSIONS;
```

---

## Rebranding Tasks: XDCNetOwn → XDC SkyNet

### Code Changes Required:

1. **Package.json**
   - Update `name` field
   - Update description

2. **Environment Variables**
   - `NETOWN_*` → `SKYNET_*`
   - Database schema: `netown` → `skynet`

3. **API Routes**
   - `/api/v1/netown/*` → `/api/v1/skynet/*`

4. **UI Strings**
   - "NetOwn" → "SkyNet"
   - "XDCNetOwn" → "XDC SkyNet"

5. **Documentation**
   - All README references
   - API documentation
   - Integration guides

---

## Code Quality Issues

### TypeScript Issues
```typescript
// Issue: Using any
const result: any = await query('SELECT * FROM nodes');

// Fix:
const result = await query<Node>('SELECT * FROM nodes');

// Issue: Non-null assertion
const token = req.headers.get('authorization')!;

// Fix:
const token = req.headers.get('authorization');
if (!token) return unauthorizedResponse();

// Issue: Implicit return type
export function generateApiKey() {
  return 'xdc_' + crypto.randomBytes(32).toString('hex');
}

// Fix:
export function generateApiKey(): string {
  return 'xdc_' + crypto.randomBytes(32).toString('hex');
}
```

### Security Issues
1. **No SQL injection prevention** - Use parameterized queries everywhere
2. **Missing CORS configuration** - Currently allows all origins
3. **No request size limits** - Risk of DoS via large payloads
4. **Secrets in environment only** - Should support Docker secrets

---

## Recommendations Summary

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| 🔴 Critical | Input validation (Zod) | Medium | Critical |
| 🔴 Critical | Database resilience | Medium | Critical |
| 🔴 Critical | Distributed rate limiting | Medium | High |
| 🔴 Critical | Caching strategy | Medium | High |
| 🟡 High | API versioning | Low | Medium |
| 🟡 High | Request ID tracing | Low | Medium |
| 🟡 High | Structured errors | Low | Medium |
| 🟡 High | Database migrations | Medium | Medium |
| 🟡 High | WebSocket auth | Medium | High |
| 🟢 Medium | Observability | High | Medium |
| 🟢 Medium | Pagination | Low | Medium |
| 🟢 Medium | Job queue | High | Low |

---

## Production Readiness Checklist

- [ ] Input validation on all API routes
- [ ] Database connection resilience
- [ ] Redis-based rate limiting
- [ ] Response caching implemented
- [ ] WebSocket authentication
- [ ] Database migrations
- [ ] Structured logging
- [ ] Error tracking (Sentry)
- [ ] API documentation (OpenAPI)
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Rebranding completed

---

## Conclusion

XDC SkyNet has a solid architectural foundation but requires significant hardening for production use, particularly around input validation, caching, and scalability. The rebranding from XDCNetOwn should be completed alongside these improvements. With focused effort (3-4 weeks), this can become a production-grade fleet management platform.

**Estimated effort to production-ready:** 3-4 weeks

**Immediate actions:**
1. Add Zod validation to all API routes
2. Implement Redis-based rate limiting
3. Add database connection pooling with retry logic
4. Set up proper error handling
5. Complete rebranding
