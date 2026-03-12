# XDC SkyNet Unified API Gateway

## Overview

The Unified API Gateway provides a single entry point for all XDC SkyNet API services. It handles authentication, rate limiting, and request routing to appropriate backend services.

## Base URL

```
https://api.xdc.network/gateway/v1
```

## Authentication

All API requests require authentication using Bearer tokens:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.xdc.network/gateway/v1/nodes
```

## Rate Limiting

- Default: 1000 requests per minute
- Headers included in responses:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp

## Available Services

| Service | Path | Description |
|---------|------|-------------|
| nodes | `/gateway/v1/nodes` | Node management and registration |
| masternodes | `/gateway/v1/masternodes` | Masternode information |
| alerts | `/gateway/v1/alerts` | Alert management |
| fleet | `/gateway/v1/fleet` | Fleet overview |
| analytics | `/gateway/v1/analytics` | Analytics and metrics |
| upgrades | `/gateway/v1/upgrades` | Version management |
| incidents | `/gateway/v1/incidents` | Incident tracking |
| peers | `/gateway/v1/peers` | Peer network info |

## Examples

### List all nodes
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://api.xdc.network/gateway/v1/nodes
```

### Create alert rule
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High CPU Alert",
    "conditionType": "cpu_usage",
    "thresholdValue": 90,
    "severity": "warning"
  }' \
  https://api.xdc.network/gateway/v1/alerts/rules
```

### Get fleet status
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://api.xdc.network/gateway/v1/fleet/overview
```

## Health Check

```bash
curl https://api.xdc.network/gateway/health
```

## Response Format

All responses follow a consistent format:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-03-11T08:30:00Z",
    "requestId": "uuid"
  }
}
```

## Error Handling

Errors follow RFC 7807 (Problem Details):

```json
{
  "type": "https://api.xdc.network/errors/rate-limit",
  "title": "Rate Limit Exceeded",
  "status": 429,
  "detail": "Request limit of 1000 per minute exceeded",
  "retryAfter": 30
}
```
