# XDC SkyNet Implementation TODO

## Critical/High Priority

### 1. ✅ Zod Validation for ALL API Routes
- [x] Create validation schemas (already done in validation.ts)
- [ ] Apply to nodes/register
- [ ] Apply to nodes/heartbeat
- [ ] Apply to nodes/metrics
- [ ] Apply to nodes/[id]/commands
- [ ] Apply to nodes/[id]/logs
- [ ] Apply to nodes/[id]/metrics/history
- [ ] Apply to nodes/[id]/peers
- [ ] Apply to nodes/[id]/status
- [ ] Apply to alerts
- [ ] Apply to alerts/notify
- [ ] Apply to notifications
- [ ] Apply to masternodes/*
- [ ] Apply to network/*
- [ ] Apply to peers/*
- [ ] Apply to upgrades/*
- [ ] Apply to fleet/*

### 2. Database Connection Resilience
- [x] Enhanced DB client with retry logic (exists)
- [ ] Circuit breaker pattern
- [ ] Pool management metrics
- [ ] Graceful degradation

### 3. Redis-based Rate Limiting
- [ ] Install ioredis
- [ ] Create rate limiter with Redis backend
- [ ] Fallback to LRU sliding window if Redis unavailable
- [ ] Different limits per endpoint/API key tier

### 4. Caching Strategy
- [ ] Response caching middleware
- [ ] Query result caching with TTL
- [ ] Cache invalidation helpers

### 5. Request ID Tracing
- [ ] Middleware to generate x-request-id
- [ ] Pass to all logs
- [ ] Include in error responses

### 6. API Versioning with Deprecation Headers
- [ ] Version detection from header
- [ ] Deprecation header support
- [ ] Sunset date support

## Medium Priority

### 7. Comprehensive Test Suite
- [ ] Vitest setup
- [ ] API route tests
- [ ] Component tests with RTL

### 8. WebSocket Connection Management
- [ ] Reconnection logic
- [ ] Heartbeat/ping-pong
- [ ] Exponential backoff

### 9. Database Migrations System
- [ ] Migration runner script
- [ ] Numbered migration files
- [ ] Up/down scripts

### 10. OpenAPI/Swagger Documentation
- [ ] OpenAPI spec generation
- [ ] Swagger UI endpoint

### 11. Monitoring & Observability
- [ ] Structured logging
- [ ] Request metrics
- [ ] Health check endpoint expansion

### 12. Documentation
- [ ] CONTRIBUTING.md
- [ ] CHANGELOG.md

### 13. CI/CD Pipeline
- [ ] GitHub Actions workflow
- [ ] Build, test, deploy

### 14. Docker Support
- [ ] Dockerfile
- [ ] docker-compose.yml

### 15. Environment Validation
- [ ] Startup validation

## Low Priority

### 16. API Client SDK Generation
- [ ] Generate from OpenAPI

### 17. Performance Profiling
- [ ] Middleware for profiling

### 18. Graceful Shutdown
- [ ] SIGTERM/SIGINT handling

### 19. Database Query Optimization
- [ ] EXPLAIN ANALYZE for slow queries

### 20. Security
- [ ] CORS configuration
- [ ] CSP tightening
