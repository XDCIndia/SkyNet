# XDC SkyNet - Security Best Practices

## Overview

This guide outlines security best practices for deploying and operating XDC SkyNet, the fleet monitoring platform for XDC Network.

## Critical Security Issues

### 1. Secrets Management

**Issue:** Secrets committed to repository in `.env` file.

**Immediate Actions:**
```bash
# 1. Rotate all exposed secrets
# Telegram Bot Token: Message @BotFather, use /revoke
# Database Password: ALTER USER skynet WITH PASSWORD 'new_secure_pass';
# API Keys: Generate new ones with crypto.randomBytes(32).toString('hex')

# 2. Remove from git
git rm --cached dashboard/.env
echo ".env" >> .gitignore
git commit -m "Remove .env from repository"

# 3. Clean git history (requires force push)
bfg --delete-files .env
bfg --replace-text passwords.txt
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

**Proper Secrets Management:**
```bash
# Use Docker secrets (production)
docker secret create skynet_db_url -
# Enter DATABASE_URL, then Ctrl+D

# Use environment files (development)
cp dashboard/.env.example dashboard/.env
# Edit with real values, never commit
```

### 2. API Authentication

**Issue:** Legacy API endpoints lack authentication.

**Fix:**
```typescript
// middleware.ts
import { authenticateRequest } from '@/lib/auth';

export async function middleware(request: NextRequest) {
  // Require auth for all /api/* except /api/v1/* and /api/health
  const path = request.nextUrl.pathname;
  
  if (path.startsWith('/api/health')) {
    return NextResponse.next();
  }
  
  if (path.startsWith('/api/v1/')) {
    // V1 has its own auth
    return NextResponse.next();
  }
  
  if (path.startsWith('/api/')) {
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }
  
  return NextResponse.next();
}
```

### 3. Rate Limiting

**Implementation:**
```typescript
// lib/rate-limit.ts
import { LRUCache } from 'lru-cache';

const rateLimitCache = new LRUCache<string, number>({
  max: 500,
  ttl: 1000 * 60, // 1 minute
});

export function rateLimit(
  identifier: string,
  limit: number = 100
): boolean {
  const current = rateLimitCache.get(identifier) || 0;
  
  if (current >= limit) {
    return false; // Rate limited
  }
  
  rateLimitCache.set(identifier, current + 1);
  return true;
}

// Usage in API routes
export async function POST(request: NextRequest) {
  const ip = request.ip || 'unknown';
  
  if (!rateLimit(ip, 30)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
  }
  
  // Process request
}
```

## Database Security

### Connection Security

```typescript
// Use SSL for database connections
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
    ca: fs.readFileSync('/path/to/ca.crt').toString(),
  } : false,
});
```

### Data Retention

```sql
-- Implement data retention (security + performance)
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS void AS $$
BEGIN
  -- Retain metrics for 90 days
  DELETE FROM skynet.node_metrics 
  WHERE collected_at < NOW() - INTERVAL '90 days';
  
  -- Retain peer snapshots for 7 days
  DELETE FROM skynet.peer_snapshots 
  WHERE collected_at < NOW() - INTERVAL '7 days';
  
  -- Retain resolved incidents for 1 year
  DELETE FROM skynet.incidents 
  WHERE status = 'resolved' 
    AND resolved_at < NOW() - INTERVAL '1 year';
  
  -- Vacuum to reclaim space
  VACUUM ANALYZE skynet.node_metrics;
  VACUUM ANALYZE skynet.peer_snapshots;
END;
$$ LANGUAGE plpgsql;

-- Schedule daily cleanup
SELECT cron.schedule('daily-cleanup', '0 3 * * *', 'SELECT cleanup_old_data()');
```

## Network Security

### CORS Configuration

```typescript
// next.config.mjs
const nextConfig = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.ALLOWED_ORIGINS || 'https://net.xdc.network',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
  },
};
```

### TLS/SSL

```yaml
# docker-compose.yml with TLS
version: '3.8'
services:
  skynet:
    image: xdc-skynet:latest
    environment:
      - NODE_ENV=production
    volumes:
      - ./ssl/cert.pem:/app/ssl/cert.pem:ro
      - ./ssl/key.pem:/app/ssl/key.pem:ro
    
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
```

## Input Validation

### Request Validation

```typescript
// lib/validation.ts
import { z } from 'zod';

export const HeartbeatSchema = z.object({
  nodeId: z.string().uuid(),
  blockHeight: z.number().int().min(0),
  peerCount: z.number().int().min(0).max(1000),
  system: z.object({
    cpuPercent: z.number().min(0).max(100).optional(),
    memoryPercent: z.number().min(0).max(100).optional(),
    diskPercent: z.number().min(0).max(100).optional(),
  }).optional(),
});

export function validateBody<T>(
  request: NextRequest,
  schema: z.ZodSchema<T>
): Promise<T> {
  return request.json().then(schema.parse);
}
```

## Monitoring & Alerting

### Security Event Logging

```typescript
// lib/security-logger.ts
import { logger } from './logger';

export function logSecurityEvent(
  event: string,
  details: Record<string, unknown>
) {
  logger.warn('Security event', {
    event,
    ...details,
    timestamp: new Date().toISOString(),
  });
}

// Usage
logSecurityEvent('auth_failure', {
  ip: request.ip,
  endpoint: request.url,
  reason: 'invalid_token',
});
```

### Failed Login Alerts

```typescript
// Track failed auth attempts
const failedAttempts = new Map<string, number>();

export async function trackFailedAuth(ip: string) {
  const attempts = (failedAttempts.get(ip) || 0) + 1;
  failedAttempts.set(ip, attempts);
  
  if (attempts >= 5) {
    // Alert admin
    await sendAlert({
      severity: 'warning',
      title: 'Multiple failed auth attempts',
      description: `IP ${ip} has ${attempts} failed attempts`,
    });
    
    // Could also block IP temporarily
  }
}
```

## Deployment Security

### Docker Security

```dockerfile
# Dockerfile security hardening
FROM node:18-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Set proper permissions
COPY --chown=nextjs:nodejs . .

# Switch to non-root user
USER nextjs

# Don't run as root
EXPOSE 3000
CMD ["npm", "start"]
```

```yaml
# docker-compose.security.yml
version: '3.8'
services:
  skynet:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID
    read_only: true
    tmpfs:
      - /tmp:noexec,nosuid,size=100m
```

## Incident Response

### Security Incident Checklist

1. **Immediate Response**
   - [ ] Identify scope of breach
   - [ ] Revoke compromised credentials
   - [ ] Preserve logs for forensics

2. **Containment**
   - [ ] Isolate affected systems
   - [ ] Block malicious IPs
   - [ ] Disable compromised accounts

3. **Recovery**
   - [ ] Rotate all secrets
   - [ ] Apply security patches
   - [ ] Verify system integrity

4. **Post-Incident**
   - [ ] Document incident timeline
   - [ ] Update security procedures
   - [ ] Conduct security review

## Compliance

### Security Checklist

- [ ] No secrets in code repository
- [ ] All API endpoints authenticated
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] Database uses SSL connections
- [ ] CORS properly configured
- [ ] Security headers set
- [ ] Data retention policies implemented
- [ ] Audit logging enabled
- [ ] Regular security scans performed

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/security.html)

---

*Last updated: 2026-02-25*
