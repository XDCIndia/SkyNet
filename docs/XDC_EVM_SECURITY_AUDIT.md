# XDC Node Setup - Security Audit Report

**Date:** February 25, 2026  
**Auditor:** XDC EVM Expert Agent  
**Repositories:** 
- https://github.com/AnilChinchawale/xdc-node-setup (SkyOne)
- https://github.com/AnilChinchawale/XDCNetOwn (SkyNet)

---

## Executive Summary

This security audit identified **critical vulnerabilities** in both repositories that require immediate attention. The most severe issues involve committed secrets, exposed RPC endpoints, and missing authentication on API routes.

### Risk Summary

| Repository | Critical | High | Medium | Overall Risk |
|------------|----------|------|--------|--------------|
| xdc-node-setup | 2 | 3 | 4 | **HIGH** |
| XDCNetOwn | 3 | 4 | 3 | **CRITICAL** |

---

## Critical Findings

### 1. Hardcoded Credentials in Repository (P0)

**Location:** `xdc-node-setup/docker/mainnet/.env`, `XDCNetOwn/dashboard/.env`

**Issue:** Sensitive credentials committed to git history:
- Database passwords
- API keys
- Telegram bot tokens
- Keystore passwords

**Impact:** 
- Full database compromise
- Unauthorized API access
- Telegram bot impersonation
- Fund theft if keystore is exposed

**Remediation:**
1. Rotate ALL exposed secrets immediately
2. Remove files from git history using `git-filter-repo`
3. Add to `.gitignore`
4. Use `.env.example` templates only

### 2. RPC Endpoints Exposed Without Authentication (P0)

**Location:** `xdc-node-setup/docker/mainnet/.env`

**Issue:**
```bash
RPC_ADDR=0.0.0.0          # Exposed to internet
RPC_CORS_DOMAIN=*         # Any domain can call
RPC_VHOSTS=*              # No virtual host validation
WS_ORIGINS=*              # No WebSocket origin validation
```

**Impact:**
- Remote fund theft if wallet unlocked
- Node manipulation
- Data exfiltration

**Remediation:**
```bash
# Bind to localhost only
RPC_ADDR=127.0.0.1
RPC_CORS_DOMAIN=http://localhost:7070
# Use nginx reverse proxy for external access with auth
```

### 3. Legacy API Without Authentication (P0)

**Location:** `XDCNetOwn/dashboard/app/api/nodes/route.ts`

**Issue:** POST and DELETE endpoints allow unauthenticated node registration/deletion.

**Impact:**
- Unauthorized fleet manipulation
- Data poisoning
- DoS via node deletion

**Remediation:** Add Bearer token authentication to all mutating endpoints.

### 4. Insecure API Key Generation (P0)

**Location:** `XDCNetOwn/dashboard/lib/auth.ts`

**Issue:** Uses `Math.random()` for API key generation.

```typescript
// VULNERABLE
return 'xdc_' + Math.random().toString(36).substring(2);
```

**Remediation:**
```typescript
import { randomBytes } from 'crypto';
return 'xdc_' + randomBytes(32).toString('hex');
```

---

## High Severity Findings

### 5. SQL Injection Risk (P1)

**Location:** `XDCNetOwn/dashboard/app/api/nodes/[id]/route.ts`

**Issue:** Dynamic SET clause construction without proper validation.

### 6. No Rate Limiting (P1)

**Location:** All API routes

**Issue:** No protection against brute force or DoS attacks.

### 7. Unbounded Database Growth (P1)

**Location:** `XDCNetOwn/dashboard/lib/db/schema.sql`

**Issue:** Time-series tables grow without retention policy.

**Impact:** Database performance degradation, potential OOM.

### 8. Docker Security Issues (P1)

**Location:** `xdc-node-setup/docker/docker-compose.yml`

**Issues:**
- Docker socket mounted in containers
- cAdvisor runs privileged
- Network mode host used

---

## XDPoS Consensus Findings

### 9. Missing Epoch Boundary Monitoring (P0)

**Issue:** No monitoring for XDPoS epoch transitions (every 900 blocks).

**Impact:** Missed masternode set changes, consensus fork risk.

### 10. No Gap Block Handling (P0)

**Issue:** Gap blocks (blocks 450-899 of each epoch) have special consensus rules not monitored.

### 11. Missing QC Formation Tracking (P1)

**Issue:** Quorum Certificate formation time not tracked.

### 12. No Cross-Client Divergence Detection (P1)

**Issue:** Block hash differences between clients not detected.

---

## Recommendations

### Immediate Actions (24-48 hours)

1. Rotate all exposed secrets
2. Add authentication to legacy API endpoints
3. Bind RPC to localhost
4. Fix API key generation

### Short-term (1-2 weeks)

1. Implement input validation with Zod
2. Add rate limiting
3. Create data retention policy
4. Add epoch monitoring

### Long-term (1 month)

1. Comprehensive test suite
2. Security audit by third party
3. Bug bounty program
4. Regular security reviews

---

## Compliance

### Security Standards

- [ ] OWASP Top 10 compliance
- [ ] CIS Docker Benchmark
- [ ] NIST Cybersecurity Framework

### Blockchain Security

- [ ] Consensus monitoring
- [ ] Fork detection
- [ ] Masternode participation tracking

---

## Appendix: GitHub Issues Created

### xdc-node-setup
- #163: XDPoS Consensus epoch boundary handling
- #164: Cross-client block hash divergence detection
- #165: Masternode consensus participation monitoring
- #166: Container-native deployment improvements
- #167: Comprehensive integration test suite
- #168: XDPoS consensus documentation

### XDCNetOwn
- #253: Secrets committed and authentication bypass
- #254: XDPoS masternode monitoring and epoch tracking
- #255: Database retention policy
- #256: Caching and connection resilience
- #257: Client-specific performance metrics
- #258: Request validation with Zod
- #259: Comprehensive test suite
- #260: API reference documentation
