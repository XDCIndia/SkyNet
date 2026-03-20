# XDC SkyNet API Authentication Guide

## Overview

This guide covers authentication and authorization for the XDC SkyNet API.

## Authentication Methods

### 1. Bearer Token Authentication

All API requests must include an Authorization header:

```http
Authorization: Bearer YOUR_API_KEY
```

### 2. API Key Types

| Type | Format | Permissions |
|------|--------|-------------|
| Master Key | `xdc-netown-key-*` | Full access |
| Node Key | `xdc_*` (64 hex chars) | Node-specific |

## Obtaining API Keys

### Master API Keys

Master keys are configured via environment variable:

```bash
# .env
API_KEYS=key1,key2,key3
```

### Node-Specific API Keys

Nodes receive unique API keys upon registration:

```bash
# Register node
curl -X POST https://xdc.openscan.ai/api/v1/nodes/register \
  -H "Authorization: Bearer MASTER_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-node",
    "host": "192.168.1.100",
    "role": "fullnode"
  }'

# Response
{
  "nodeId": "550e8400-e29b-41d4-a716-446655440000",
  "apiKey": "xdc_a1b2c3d4e5f6..."
}
```

## Using API Keys

### Node Heartbeat

```bash
curl -X POST https://xdc.openscan.ai/api/v1/nodes/heartbeat \
  -H "Authorization: Bearer xdc_a1b2c3d4e5f6..." \
  -H "Content-Type: application/json" \
  -d '{
    "nodeId": "550e8400-e29b-41d4-a716-446655440000",
    "blockHeight": 89234567,
    "syncing": false
  }'
```

### Fleet Status (Master Key)

```bash
curl https://xdc.openscan.ai/api/v1/fleet/status \
  -H "Authorization: Bearer xdc-netown-key-2026-prod"
```

## Security Best Practices

### 1. Key Rotation

```bash
# Rotate master keys
# 1. Generate new key
NEW_KEY=$(openssl rand -hex 32)
echo "xdc-netown-key-$NEW_KEY"

# 2. Update environment
API_KEYS=new_key,old_key  # Both valid during transition

# 3. Update nodes
# 4. Remove old key after transition period
```

### 2. Key Storage

**Never commit keys to git:**

```bash
# .gitignore
.env
.env.local
secrets/
```

**Use Docker Secrets:**

```yaml
# docker-compose.yml
secrets:
  api_key:
    file: ./secrets/api_key.txt

services:
  app:
    secrets:
      - api_key
    environment:
      - API_KEY_FILE=/run/secrets/api_key
```

### 3. Key Scope

| Endpoint | Required Key |
|----------|--------------|
| POST /api/v1/nodes/heartbeat | Node Key |
| GET /api/v1/nodes/:id/status | Node Key or Master Key |
| GET /api/v1/fleet/status | Master Key |
| POST /api/v1/nodes/register | Master Key |
| DELETE /api/v1/nodes/:id | Master Key |

## Error Handling

### 401 Unauthorized

```json
{
  "error": "Missing Authorization header",
  "code": "UNAUTHORIZED"
}
```

### 403 Forbidden

```json
{
  "error": "Insufficient permissions",
  "code": "FORBIDDEN"
}
```

### 429 Rate Limited

```json
{
  "error": "Too many requests",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 30
}
```

## Implementation Example

### TypeScript Client

```typescript
class SkyNetClient {
  private apiKey: string;
  private baseUrl: string;
  
  constructor(apiKey: string, baseUrl = 'https://xdc.openscan.ai') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }
  
  async sendHeartbeat(nodeId: string, metrics: Metrics) {
    const response = await fetch(`${this.baseUrl}/api/v1/nodes/heartbeat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        nodeId,
        ...metrics,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }
    
    return response.json();
  }
}
```

### Python Client

```python
import requests

class SkyNetClient:
    def __init__(self, api_key: str, base_url: str = 'https://xdc.openscan.ai'):
        self.api_key = api_key
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
        })
    
    def send_heartbeat(self, node_id: str, metrics: dict):
        response = self.session.post(
            f'{self.base_url}/api/v1/nodes/heartbeat',
            json={'nodeId': node_id, **metrics}
        )
        response.raise_for_status()
        return response.json()
```

## Troubleshooting

### Key Not Working

1. Check key format (should start with `xdc_`)
2. Verify key hasn't been revoked
3. Check Authorization header format
4. Ensure key has required permissions

### Rate Limiting

Default rate limits:
- Heartbeat: 120 requests/minute
- Read: 120 requests/minute
- Write: 30 requests/minute

## References

- [API Reference](API.md)
- [Node Setup Integration](INTEGRATION.md)

---

**Last Updated:** 2026-02-27  
**Version:** 1.0.0
