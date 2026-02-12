# 🔓 BugBounty Security & Pen-Test Report

**Target:** XDCNetOwn Dashboard (http://localhost:3005)  
**Date:** 2026-02-12  
**Tester:** BugBounty 🔓 (white-hat)

## Executive Summary

- **Total Findings**: 9
- **Critical**: 1 | **High**: 3 | **Medium**: 3 | **Low**: 1 | **Info**: 1
- **Overall Risk Rating**: **High**

The application uses **parameterized SQL queries** throughout (no SQL injection) and properly **authenticates all write endpoints**. However, it lacks security headers, rate limiting, input length validation, and exposes sensitive data via unauthenticated GET endpoints.

---

## Critical Findings

### [SEC-001] Telegram Bot Token Exposed in .env (Critical)
- **File:** `dashboard/.env`
- **Description:** Live Telegram bot token `8294325603:AAHk9...` hardcoded in `.env`. If this file is committed to git or the server is compromised, attackers can impersonate the bot.
- **Impact:** Full control of Telegram bot, ability to send messages to all users.
- **PoC:** `cat dashboard/.env | grep TELEGRAM_BOT_TOKEN`
- **Fix:** Rotate the token immediately. Ensure `.env` is in `.gitignore`. Use secrets management (Vault, etc.) in production.

---

## High Findings

### [SEC-002] Unauthenticated Alert Config Exposes PII (High)
- **Endpoint:** `GET /api/v1/alerts`
- **Description:** Returns alert configurations including Telegram chat IDs and email addresses without requiring authentication.
- **Impact:** Information disclosure of personal contact info.
- **PoC:** `curl -s http://localhost:3005/api/v1/alerts` → exposes `chatId: "353201749"` and `email: "anil24593@gmail.com"`
- **Fix:** Require authentication for `/api/v1/alerts` GET endpoint.

### [SEC-003] Missing Security Headers (High)
- **Description:** No security headers are set. Missing: `X-Frame-Options`, `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`.
- **Present:** `X-Powered-By: Next.js` (information disclosure).
- **Impact:** Vulnerable to clickjacking, MIME sniffing, and other client-side attacks.
- **PoC:** `curl -sI http://localhost:3005/ | grep -i x-frame` → empty
- **Fix:** Add security headers via Next.js middleware.

### [SEC-004] No Rate Limiting (High)
- **Description:** No rate limiting on any endpoint. 20 rapid requests all return 200.
- **Impact:** DoS, brute-force API key guessing, resource exhaustion.
- **PoC:** `for i in $(seq 1 20); do curl -s -o /dev/null -w "%{http_code} " http://localhost:3005/api/nodes; done` → all 200
- **Fix:** Add rate limiting middleware.

---

## Medium Findings

### [SEC-005] No Input Length/Sanitization on Node Registration (Medium)
- **Endpoint:** `POST /api/nodes`
- **Description:** The `name` and `host` fields accept arbitrary length strings with no sanitization. While auth-protected, a compromised key could inject very long strings or HTML/script content into the database.
- **Impact:** Stored XSS risk if values are rendered unsafely in frontend, DB bloat.
- **Fix:** Add max-length validation (e.g., name: 100 chars, host: 255 chars) and sanitize input.

### [SEC-006] Unauthenticated GET Endpoints Expose Infrastructure Details (Medium)
- **Endpoints:** `GET /api/nodes`, `/api/fleet`, `/api/diagnostics`, `/api/peers`, etc.
- **Description:** All GET endpoints return detailed infrastructure info (IP addresses, server versions, disk usage, peer enodes) without authentication.
- **Impact:** Reconnaissance data for attackers (IP addresses, server configs, software versions).
- **Note:** This is by design for the dashboard (`isDashboardReadRequest`), but consider adding optional auth or restricting sensitive fields.
- **Fix:** At minimum, add auth requirement for `/api/diagnostics` and consider redacting IPs in public responses.

### [SEC-007] npm Audit: 1 High Severity Vulnerability (Medium)
- **Package:** `next` (current version has 2 advisories)
- **Advisories:** GHSA-9g9p-9gw9-jx7f (DoS via Image Optimizer), GHSA-h25m-26qc-wcjf (DoS via RSC)
- **Fix:** `npm audit fix --force` or upgrade Next.js.

---

## Low Findings

### [SEC-008] X-Powered-By Header Discloses Technology (Low)
- **Description:** `X-Powered-By: Next.js` header present.
- **Impact:** Technology fingerprinting.
- **Fix:** Set `poweredByHeader: false` in `next.config.js`.

---

## Info

### [SEC-009] API Key Comparison is Not Timing-Safe (Info)
- **File:** `dashboard/lib/auth.ts:38`
- **Description:** `allowedKeys.includes(token)` uses standard string comparison, not `crypto.timingSafeEqual`. Theoretical timing attack on API key.
- **Impact:** Very low practical risk for this type of application.
- **Fix:** Use `crypto.timingSafeEqual` for key comparison.

---

## Positive Findings ✅

| Area | Status |
|------|--------|
| SQL Injection | ✅ All queries use parameterized `$1, $2` placeholders |
| Auth on write endpoints | ✅ All POST/PUT/DELETE require Bearer token |
| No eval/exec usage | ✅ No dangerous function calls found |
| Error handling | ✅ Generic error messages, no stack traces leaked |
| Database connection pooling | ✅ Proper pg Pool with limits |

---

## Security Header Audit

| Header | Status |
|--------|--------|
| X-Frame-Options | ❌ Missing |
| Content-Security-Policy | ❌ Missing |
| Strict-Transport-Security | ❌ Missing |
| X-Content-Type-Options | ❌ Missing |
| Referrer-Policy | ❌ Missing |
| Permissions-Policy | ❌ Missing |
| X-Powered-By | ⚠️ Present (should be removed) |

---

## Fixes Applied

1. **Created `middleware.ts`** — Security headers + basic rate limiting
2. **Updated `next.config.js`** — Disabled `X-Powered-By`
3. **Added input validation** — Length limits on node registration
4. **Protected `/api/v1/alerts` GET** — Now requires authentication
