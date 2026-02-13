# Changelog

All notable changes to XDC SkyNet will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive Zod validation for all API routes
- Redis-based distributed rate limiting with LRU fallback
- Circuit breaker pattern for database connections
- Request ID tracing (x-request-id) across all requests
- Structured JSON logging with context
- API versioning with deprecation headers
- OpenAPI 3.0 specification
- Database migrations system
- Docker and docker-compose support
- CI/CD pipeline with GitHub Actions
- WebSocket connection management (heartbeat, reconnection)
- Response caching with Redis and LRU fallback
- Graceful shutdown handling
- Performance profiling middleware
- Comprehensive test suite (Vitest)

### Changed
- Rebranded from XDCNetOwn to XDC SkyNet
- Migrated database schema from `netown` to `skynet`
- Enhanced database client with retry logic and connection pooling
- Improved rate limiting with per-endpoint tiers
- Tightened CSP and security headers
- Standardized error responses across all endpoints

### Security
- Added CORS configuration
- Implemented request size limits
- Added timing-safe API key comparison
- Enhanced input validation to prevent SQL injection

## [0.2.0] - 2026-02-13

### Added
- Initial rebranding to XDC SkyNet
- Zod validation library
- Structured error handling
- Centralized configuration
- Enhanced database client

### Changed
- Updated branding throughout UI
- Improved API response structure

## [0.1.0] - 2026-01-15

### Added
- Initial release as XDCNetOwn
- Node registration and management
- Real-time metrics collection
- WebSocket-based live updates
- Incident detection (sync stall, peer drop, disk pressure)
- Fleet health dashboard
- Peer monitoring and banning
- Masternode tracking
- Basic rate limiting
- API authentication

### Infrastructure
- Next.js 14 with App Router
- PostgreSQL database
- WebSocket server
- Tailwind CSS styling

---

## Version History

| Version | Date | Status |
|---------|------|--------|
| 0.2.0 | 2026-02-13 | Current |
| 0.1.0 | 2026-01-15 | Initial Release |

## Upgrade Notes

### Upgrading to 0.2.0

1. **Database Migration Required**
   ```bash
   npm run db:migrate
   ```

2. **Environment Variables**
   - Optional: Add `REDIS_URL` for distributed rate limiting
   - Optional: Add `LOG_LEVEL` (debug/info/warn/error)

3. **Breaking Changes**
   - API responses now include `success` field
   - Error responses have standardized `code` field
   - Rate limit headers changed to `X-RateLimit-*`

### Upgrading to 0.3.0 (Upcoming)

- TBD

---

[Unreleased]: https://github.com/AnilChinchawale/XDCSkyNet/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/AnilChinchawale/XDCSkyNet/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/AnilChinchawale/XDCSkyNet/releases/tag/v0.1.0
