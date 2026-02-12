# Architecture Review — XDCNetOwn
> Authored by ArchitectoBot 🏗️ | 2026-02-12

---

## 1. Code Architecture

### Project Structure
```
XDCNetOwn/
├── dashboard/
│   ├── app/                  # Next.js 14 App Router
│   │   ├── page.tsx          # Main fleet dashboard (1500+ lines)
│   │   ├── layout.tsx        # Root layout + DashboardLayout
│   │   ├── fleet/page.tsx    # Fleet overview
│   │   ├── executive/page.tsx # Executive summary
│   │   ├── network/page.tsx  # Network topology
│   │   ├── masternodes/      # Masternode management
│   │   ├── peers/            # Peer management
│   │   ├── nodes/[id]/       # Individual node detail
│   │   └── api/              # 35+ API routes (v1 + legacy)
│   ├── components/           # 15+ shared components
│   ├── lib/                  # Business logic layer
│   │   ├── db/               # PostgreSQL connection pool + schema
│   │   ├── auth.ts           # API key authentication
│   │   ├── alert-engine.ts   # Auto-incident detection + notifications
│   │   ├── collector.ts      # Metrics aggregation
│   │   ├── masternode.ts     # Masternode contract interaction
│   │   ├── notifications.ts  # Telegram + Email alerts
│   │   ├── node-registry.ts  # Node lifecycle management
│   │   └── ws-server.ts      # WebSocket server (real-time updates)
│   ├── migrations/           # SQL migrations
│   └── docker-compose.yml    # Deployment config
├── docs/                     # Architecture + integration docs
└── README.md
```

### Component Organization
- **Pages:** App Router with file-based routing — standard Next.js 14 pattern ✅
- **API Layer:** Dual API surface — legacy `/api/*` (no auth, dashboard-facing) + `/api/v1/*` (authenticated, agent-facing)
- **Business Logic:** Cleanly separated in `lib/` — database, auth, alerts, notifications
- **Components:** Mix of shared UI components + page-specific inline components

**Concern:** Main `page.tsx` is 1500+ lines with multiple inline components. Should be decomposed.

### API Design Patterns

**V1 API (Agent-facing, authenticated):**
- `POST /api/v1/nodes/register` — Node registration with API key generation
- `POST /api/v1/nodes/heartbeat` — Metrics push + incident detection + command queue
- `GET /api/v1/nodes/{id}/status` — Node status
- `GET /api/v1/fleet/status` — Fleet overview
- `GET /api/v1/masternodes` — Masternode listing from on-chain data
- `POST /api/v1/alerts/notify` — Alert webhook

**Legacy API (Dashboard-facing, no auth):**
- `GET /api/nodes` — List nodes with latest metrics
- `POST /api/nodes` — Register node (NO AUTH! ⚠️)
- `DELETE /api/nodes` — Delete node (NO AUTH! ⚠️)
- `GET /api/peers` — Peer listing

### Database Schema
**PostgreSQL with custom `netown` schema** — well-designed relational model:
- `nodes` — Fleet registry (UUID PKs, role constraints, geo data)
- `node_metrics` — Time-series metrics (indexed by node+time)
- `peer_snapshots` — Peer topology snapshots
- `incidents` — Auto-detected + manual incidents with lifecycle
- `network_health` — Aggregated network health scores
- `banned_peers` — Peer ban list
- `upgrade_plans` — Rolling upgrade orchestration
- `api_keys` — Per-node API key management
- `command_queue` — Remote command dispatch
- `masternode_snapshots` — Historical masternode data

**Assessment:** Excellent schema design. Proper use of UUIDs, constraints, indexes, triggers. The `LATERAL JOIN` pattern in queries is efficient. Time-series indexing is correct.

### State Management
- **Server:** PostgreSQL (persistent) + in-memory caches in lib modules
- **Client:** React useState/useEffect with polling (10s interval via `NEXT_PUBLIC_REFRESH_INTERVAL`)
- **Real-time:** WebSocket server for live updates (separate process via `ws-server.ts`)

### Error Handling
- API routes: Try/catch with typed error responses ✅
- Standardized error helpers in `auth.ts` (unauthorizedResponse, badRequestResponse, etc.) ✅
- DB errors: Postgres error codes handled (23505 unique violation) ✅
- Alert engine: Non-blocking with `.catch()` for fire-and-forget ✅

---

## 2. Security Audit

### 🔴 Critical Issues

| # | Issue | Location | Risk |
|---|-------|----------|------|
| S1 | **Telegram bot token committed to .env** | `dashboard/.env` → `TELEGRAM_BOT_TOKEN=8294325603:AAH...` | Token exposed — anyone can impersonate the bot |
| S2 | **Database credentials committed to .env** | `dashboard/.env` → `DATABASE_URL` with password | Full database access |
| S3 | **API keys committed to .env** | `dashboard/.env` → `API_KEYS=xdc-netown-key-2026-prod,...` | Full API access |
| S4 | **Legacy POST/DELETE /api/nodes has NO authentication** | `dashboard/app/api/nodes/route.ts` | Anyone can register/delete nodes |
| S5 | **PATCH /api/nodes/[id] has NO authentication** | `dashboard/app/api/nodes/[id]/route.ts` | Anyone can modify node records |
| S6 | **`network_mode: host`** in docker-compose | `dashboard/docker-compose.yml` | No network isolation |
| S7 | **Math.random() used for API key generation** | `lib/auth.ts` → `generateApiKey()` | Cryptographically insecure — predictable keys |
| S8 | **SQL string interpolation in PATCH handler** | `dashboard/app/api/nodes/[id]/route.ts` → dynamic `SET` clause | Potential SQL injection via field names (mitigated by allowlist, but fragile) |

### 🟡 Important Issues

| # | Issue | Location |
|---|-------|----------|
| S9 | No rate limiting on any endpoint | All API routes |
| S10 | No CORS configuration | Next.js defaults (permissive) |
| S11 | No CSRF protection on mutating endpoints | POST/PATCH/DELETE routes |
| S12 | No input length validation (DoS via oversized payloads) | Heartbeat route accepts unlimited peer arrays |
| S13 | No TLS configured | Docker-compose exposes HTTP only |
| S14 | DB connection string fallback hardcodes credentials | `lib/db/index.ts` default `DATABASE_URL` |
| S15 | GET endpoints leak internal data without auth | `/api/nodes`, `/api/peers` — full fleet topology exposed |
| S16 | No audit logging for mutations | No record of who created/deleted/modified nodes |

### ✅ Good Security Practices
- V1 API routes use Bearer token authentication ✅
- Per-node API keys with granular permissions ✅
- Node ownership verification in heartbeat ✅
- Parameterized SQL queries throughout (no raw string interpolation in values) ✅
- Connection pooling with proper release patterns ✅
- Transaction support with proper rollback ✅
- `isDashboardReadRequest()` pattern to distinguish read/write auth needs ✅

---

## 3. Scalability Analysis

### Current Bottlenecks
1. **Time-series table growth:** `node_metrics` grows unbounded — no retention policy, no partitioning. At 1 metric/30s/node × 100 nodes = 288K rows/day
2. **Peer snapshots:** Same unbounded growth issue — potentially larger than metrics
3. **N+1 query in heartbeat:** Each peer is inserted individually in a loop — should use batch INSERT
4. **No caching:** Every dashboard request hits PostgreSQL directly
5. **Single WebSocket server:** Not horizontally scalable (no Redis pub/sub backing)

### Database Query Efficiency
- `LATERAL JOIN` for latest metrics per node — good ✅
- Indexes on `(node_id, collected_at DESC)` — correct ✅
- Missing: Partitioning on `collected_at` for metrics tables
- Missing: `VACUUM` and retention policy (DELETE old metrics)

### Caching Strategy
- **None currently** — every page load triggers fresh DB queries
- Recommendation: Redis or in-memory cache for:
  - Fleet status (5s TTL)
  - Network health (30s TTL)
  - Masternode list (60s TTL)

### Horizontal Scaling Readiness
- **Database:** PostgreSQL single instance — would need read replicas or TimescaleDB for scale
- **API:** Next.js can scale horizontally, but WebSocket server is standalone
- **Agent communication:** Pull-based (agents push heartbeats) — scales well ✅

### Connection Pooling
- Pool configured: max 20, idle timeout 30s, connection timeout 5s ✅
- Proper client release in finally blocks ✅
- Pool error handler registered ✅

---

## 4. Code Quality

### TypeScript Usage
- Strong typing in `lib/db/index.ts` with full interface definitions ✅
- API routes use `any` in some catch blocks — could be tighter
- No shared types between API and frontend (potential for drift)
- `lib/types.ts` exists with dashboard-specific types

### Error Boundaries
- No React error boundaries in any page component ⚠️
- Server-side errors return JSON — good for API consumers
- Client-side: Uncaught errors would show Next.js default error page

### Testing Coverage
- **Zero tests.** No test files, no test dependencies, no test scripts ⚠️
- No Jest, no Vitest, no Playwright, no Cypress
- Critical gap for a production fleet management platform

### Documentation Quality
- `docs/ARCHITECTURE.md` — comprehensive system design ✅
- `docs/INTEGRATION.md` — agent integration guide ✅
- `docs/SCALABILITY-ARCHITECTURE.md` — future scaling plans ✅
- `ROADMAP.md` — feature roadmap ✅
- `DESIGN-AUDIT.md` — UI/UX audit ✅
- API routes have JSDoc comments ✅

### Dependency Health
- Next.js 14.2.35 — stable, maintained ✅
- pg 8.18.0 — current ✅
- echarts 6.0.0 — current ✅
- ws 8.19.0 — current ✅
- No known CVEs in dependencies at current versions

---

## 5. Improvement Recommendations

### P0 — Critical (Fix Now)
1. **Remove all secrets from `.env`** — use `.env.example` with placeholder values, add `.env` to `.gitignore`
2. **Add authentication to legacy `/api/nodes` POST/DELETE/PATCH** endpoints
3. **Replace `Math.random()` in `generateApiKey()`** with `crypto.randomBytes(32).toString('hex')`
4. **Add data retention policy** — cron job or scheduled query to DELETE metrics/peers older than 90 days
5. **Rotate the exposed Telegram bot token** immediately

### P1 — Important (Next Quarter)
1. Add rate limiting middleware (e.g., `next-rate-limit` or custom)
2. Add CORS configuration in `next.config.mjs`
3. Batch peer INSERT in heartbeat route (single multi-row INSERT)
4. Add React error boundaries to page layouts
5. Add basic test suite: API route integration tests + component snapshot tests
6. Partition `node_metrics` and `peer_snapshots` by month
7. Add Redis caching layer for dashboard queries
8. Replace `network_mode: host` with proper Docker networking

### P2 — Nice-to-Have (Later)
1. Migrate to TimescaleDB for time-series optimization
2. Add OpenAPI/Swagger spec for V1 API
3. Implement WebSocket scaling via Redis pub/sub
4. Add audit logging table for all mutations
5. Add input validation library (Zod) for API request bodies
6. Server-sent events as WebSocket alternative for simpler clients
7. Add Prometheus metrics export from the dashboard itself
