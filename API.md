# XDC SkyNet - API Reference
> Complete API documentation for fleet monitoring

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Node Management](#node-management)
4. [Heartbeat API](#heartbeat-api)
5. [Fleet API](#fleet-api)
6. [Alert API](#alert-api)
7. [Issue API](#issue-api)
8. [Network API](#network-api)
9. [Masternode API](#masternode-api)
10. [WebSocket API](#websocket-api)

---

## Overview

### Base URL

```
Development: http://localhost:3000
Production: https://xdc.openscan.ai
```

### API Version

Current version: `v1`

All endpoints are prefixed with `/api/v1/` unless otherwise noted.

### Content Type

All requests should include:

```
Content-Type: application/json
```

---

## Authentication

### Bearer Token

All API requests require authentication using a Bearer token:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://xdc.openscan.ai/api/v1/fleet/status
```

### API Key Types

| Type | Permissions | Use Case |
|------|-------------|----------|
| Master Key | Full access | Dashboard, automation |
| Node Key | Node-specific | Agent heartbeats |

### Obtaining API Keys

Master keys are configured via the `API_KEYS` environment variable:

```bash
API_KEYS=key1,key2,key3
```

Node keys are generated during node registration.

---

## Node Management

### Register Node

Register a new node with the fleet.

**Endpoint:** `POST /api/v1/nodes/register`

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/nodes/register \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "xdc-node-01",
    "host": "192.168.1.100",
    "role": "masternode",
    "location_city": "Singapore",
    "location_country": "SG",
    "location_lat": 1.3521,
    "location_lng": 103.8198,
    "tags": ["production", "asia"]
  }'
```

**Response:**
```json
{
  "node": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "xdc-node-01",
    "host": "192.168.1.100",
    "role": "masternode",
    "api_key": "xdc_abc123...",
    "created_at": "2026-02-25T10:00:00Z"
  }
}
```

### List Nodes

Get all registered nodes with latest metrics.

**Endpoint:** `GET /api/v1/nodes`

**Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/api/v1/nodes
```

**Response:**
```json
{
  "nodes": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "xdc-node-01",
      "host": "192.168.1.100",
      "role": "masternode",
      "status": "healthy",
      "block_height": 89234567,
      "sync_percent": 100,
      "peer_count": 25,
      "cpu_percent": 45.2,
      "memory_percent": 62.1,
      "disk_percent": 78.0,
      "last_seen": "2026-02-25T10:00:00Z",
      "client_type": "geth",
      "client_version": "v2.6.8-stable"
    }
  ],
  "total": 1,
  "timestamp": "2026-02-25T10:00:00Z"
}
```

### Get Node Status

Get detailed status for a specific node.

**Endpoint:** `GET /api/v1/nodes/{id}/status`

**Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/api/v1/nodes/550e8400-e29b-41d4-a716-446655440000/status
```

**Response:**
```json
{
  "node": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "xdc-node-01",
    "status": "online",
    "last_heartbeat": "2026-02-25T10:00:00Z",
    "block_height": 89234567,
    "syncing": false,
    "peer_count": 25,
    "health_score": 95
  },
  "system": {
    "cpu_percent": 45.2,
    "memory_percent": 62.1,
    "disk_percent": 78.0
  },
  "alerts": []
}
```

### Delete Node

Remove a node from the fleet.

**Endpoint:** `DELETE /api/v1/nodes?id={id}`

**Request:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer YOUR_API_KEY" \
  "http://localhost:3000/api/v1/nodes?id=550e8400-e29b-41d4-a716-446655440000"
```

---

## Heartbeat API

### Send Heartbeat

Nodes send regular heartbeats to report their status.

**Endpoint:** `POST /api/v1/nodes/heartbeat`

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/nodes/heartbeat \
  -H "Authorization: Bearer NODE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "nodeId": "550e8400-e29b-41d4-a716-446655440000",
    "blockHeight": 89234567,
    "syncing": false,
    "syncProgress": 99.8,
    "peerCount": 25,
    "system": {
      "cpuPercent": 45.2,
      "memoryPercent": 62.1,
      "diskPercent": 78.0,
      "diskUsedGb": 450.5,
      "diskTotalGb": 1000.0
    },
    "clientType": "geth",
    "nodeType": "full",
    "syncMode": "full",
    "clientVersion": "v2.6.8-stable",
    "chainDataSize": 485000000000,
    "databaseSize": 520000000000,
    "ipv4": "203.0.113.1",
    "os": {
      "type": "linux",
      "release": "Ubuntu 22.04",
      "arch": "amd64",
      "kernel": "5.15.0"
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ok": true,
    "commands": []
  },
  "incidentsDetected": 0
}
```

### Heartbeat with Commands

If there are pending commands for the node:

**Response:**
```json
{
  "success": true,
  "data": {
    "ok": true,
    "commands": [
      {
        "id": "cmd-123",
        "type": "restart",
        "params": {},
        "timeout": 300
      }
    ]
  },
  "incidentsDetected": 0
}
```

---

## Fleet API

### Fleet Status

Get an overview of the entire fleet.

**Endpoint:** `GET /api/v1/fleet/status`

**Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/api/v1/fleet/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "healthScore": 92,
    "totalNodes": 12,
    "nodes": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "xdc-node-01",
        "host": "192.168.1.100",
        "role": "masternode",
        "status": "healthy",
        "blockHeight": 89234567,
        "syncPercent": 100,
        "peerCount": 25,
        "cpuPercent": 45.2,
        "memoryPercent": 62.1,
        "diskPercent": 78.0,
        "lastSeen": "2026-02-25T10:00:00Z",
        "clientType": "geth",
        "nodeType": "full",
        "syncMode": "full",
        "chainDataSize": 485000000000,
        "databaseSize": 520000000000,
        "clientVersion": "v2.6.8-stable"
      }
    ],
    "nodeCounts": {
      "healthy": 10,
      "syncing": 1,
      "degraded": 1,
      "offline": 0
    },
    "incidents": {
      "critical": 0,
      "warning": 2,
      "info": 5,
      "total": 7
    },
    "avgBlockHeight": 89234560,
    "maxBlockHeight": 89234567,
    "lastUpdated": "2026-02-25T10:00:00Z"
  }
}
```

---

## Alert API

### Send Alert

Send an alert/notification.

**Endpoint:** `POST /api/v1/alerts/notify`

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/alerts/notify \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "severity": "high",
    "title": "High CPU Usage",
    "message": "CPU usage exceeded 90% for 5 minutes",
    "nodeId": "550e8400-e29b-41d4-a716-446655440000",
    "metadata": {
      "cpuPercent": 92.5,
      "duration": "5m"
    }
  }'
```

### List Alert Rules

**Endpoint:** `GET /api/v1/alerts/rules`

**Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/api/v1/alerts/rules
```

### Update Alert Rule

**Endpoint:** `POST /api/v1/alerts/rules`

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/alerts/rules \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "high_cpu",
    "condition": "cpuPercent > 90",
    "duration": "5m",
    "severity": "warning",
    "enabled": true
  }'
```

---

## Issue API

### Report Issue

Report an issue from a node.

**Endpoint:** `POST /api/v1/issues/report`

**Request:**
```bash
curl -X POST http://localhost:3000/api/v1/issues/report \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "nodeId": "550e8400-e29b-41d4-a716-446655440000",
    "nodeName": "xdc-node-01",
    "type": "sync_stall",
    "severity": "high",
    "title": "Block sync stalled at height 89234567",
    "description": "Node has not progressed for over 10 minutes",
    "diagnostics": {
      "blockHeight": 89234567,
      "peerCount": 5,
      "cpuPercent": 45,
      "memoryPercent": 62,
      "diskPercent": 78,
      "clientVersion": "v2.6.8-stable",
      "clientType": "geth",
      "isSyncing": false,
      "recentErrors": ["p2p dial timeout", "sync failed"]
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "issue-123",
    "isDuplicate": false,
    "githubIssueUrl": "https://github.com/AnilChinchawale/xdc-node-setup/issues/123"
  }
}
```

### List Issues

**Endpoint:** `GET /api/v1/issues`

**Query Parameters:**
- `status` - Filter by status (open, resolved)
- `severity` - Filter by severity (critical, high, medium, low)
- `nodeId` - Filter by node
- `limit` - Number of results (default: 50)

**Request:**
```bash
curl "http://localhost:3000/api/v1/issues?status=open&severity=critical" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "issue-123",
      "node_id": "550e8400-...",
      "node_name": "xdc-node-01",
      "type": "sync_stall",
      "severity": "high",
      "title": "Block sync stalled at height 89234567",
      "status": "open",
      "github_issue_url": "https://github.com/...",
      "solution_description": "Sync stall detected...",
      "solution_code": "#!/bin/bash\n# Fix script...",
      "occurrence_count": 3,
      "first_seen": "2026-02-25T10:00:00Z",
      "last_seen": "2026-02-25T12:30:00Z"
    }
  ],
  "summary": {
    "open": 5,
    "critical": 1,
    "high": 2,
    "resolved": 12,
    "total": 17
  }
}
```

### Resolve Issue

**Endpoint:** `POST /api/v1/issues/{id}/resolve`

**Request:**
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/api/v1/issues/issue-123/resolve
```

---

## Network API

### Network Health

Get overall network health metrics.

**Endpoint:** `GET /api/v1/network/health`

**Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/api/v1/network/health
```

**Response:**
```json
{
  "success": true,
  "data": {
    "healthScore": 95,
    "totalNodes": 108,
    "healthyNodes": 105,
    "degradedNodes": 2,
    "offlineNodes": 1,
    "avgBlockTime": 2.0,
    "avgPeerCount": 24.5,
    "lastUpdated": "2026-02-25T10:00:00Z"
  }
}
```

### Network Stats

Get network statistics.

**Endpoint:** `GET /api/v1/network/stats`

**Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/api/v1/network/stats
```

### Epoch Information

Get current epoch information.

**Endpoint:** `GET /api/v1/network/epoch`

**Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/api/v1/network/epoch
```

**Response:**
```json
{
  "success": true,
  "data": {
    "epoch": 6171,
    "blockNumber": 5553900,
    "blocksUntilNextEpoch": 300,
    "masternodeCount": 108,
    "standbyCount": 50
  }
}
```

---

## Masternode API

### List Masternodes

Get all masternodes from the XDC Network.

**Endpoint:** `GET /api/v1/masternodes`

**Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/api/v1/masternodes
```

**Response:**
```json
{
  "success": true,
  "data": {
    "epoch": 6171,
    "round": 26,
    "blockNumber": 5553900,
    "masternodes": [
      {
        "address": "0x...",
        "xdcAddress": "xdc...",
        "status": "active",
        "stake": "10,000,000.00",
        "owner": "0x..."
      }
    ],
    "standbynodes": [...],
    "penalized": [...],
    "totalStaked": "1,080,000,000.00",
    "nakamotoCoefficient": 34
  }
}
```

### Get Masternode Detail

Get detailed information about a specific masternode.

**Endpoint:** `GET /api/v1/masternodes/{address}`

**Request:**
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/api/v1/masternodes/0x...
```

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "0x...",
    "xdcAddress": "xdc...",
    "status": "active",
    "stake": "10,000,000.00",
    "owner": "0x...",
    "voters": [
      {
        "address": "0x...",
        "xdcAddress": "xdc...",
        "stake": "1,000,000.00"
      }
    ],
    "voterCount": 15
  }
}
```

---

## WebSocket API

### Connection

Connect to the WebSocket endpoint:

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  console.log('Connected to SkyNet');
  
  // Subscribe to fleet updates
  ws.send(JSON.stringify({
    action: 'subscribe',
    channel: 'fleet'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Update:', data);
};
```

### Subscribe to Node Updates

```javascript
ws.send(JSON.stringify({
  action: 'subscribe',
  channel: 'node',
  nodeId: '550e8400-e29b-41d4-a716-446655440000'
}));
```

### Subscribe to Alerts

```javascript
ws.send(JSON.stringify({
  action: 'subscribe',
  channel: 'alerts'
}));
```

### Message Format

**Server to Client:**
```json
{
  "type": "heartbeat",
  "timestamp": "2026-02-25T10:00:00Z",
  "data": {
    "nodeId": "550e8400-...",
    "blockHeight": 89234567,
    "status": "healthy"
  }
}
```

---

## Rate Limiting

### Limits

| Tier | Limit | Window |
|------|-------|--------|
| Public | 60 req | 1 min |
| Authenticated | 120 req | 1 min |
| Heartbeat | 120 req | 1 min |
| Write | 30 req | 1 min |
| Admin | 300 req | 1 min |

### Rate Limit Headers

```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 119
X-RateLimit-Reset: 1708857600
```

### Exceeding Limits

When rate limit is exceeded:

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMITED",
  "retryAfter": 60
}
```

---

## Error Codes

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Bad request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict |
| 429 | Too many requests |
| 500 | Internal server error |

### Error Response Format

```json
{
  "error": "Description of error",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Invalid or missing API key |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid request data |
| `RATE_LIMITED` | Too many requests |
| `INTERNAL_ERROR` | Server error |

---

## SDK Examples

### JavaScript/TypeScript

```typescript
class SkyNetClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = 'http://localhost:3000') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async getFleetStatus() {
    const response = await fetch(`${this.baseUrl}/api/v1/fleet/status`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
    return response.json();
  }

  async sendHeartbeat(nodeId: string, data: any) {
    const response = await fetch(`${this.baseUrl}/api/v1/nodes/heartbeat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ nodeId, ...data })
    });
    return response.json();
  }
}
```

### Python

```python
import requests

class SkyNetClient:
    def __init__(self, api_key, base_url='http://localhost:3000'):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

    def get_fleet_status(self):
        response = requests.get(
            f'{self.base_url}/api/v1/fleet/status',
            headers=self.headers
        )
        return response.json()

    def send_heartbeat(self, node_id, data):
        response = requests.post(
            f'{self.base_url}/api/v1/nodes/heartbeat',
            headers=self.headers,
            json={'nodeId': node_id, **data}
        )
        return response.json()
```

---

## Related Documentation

- [Setup Guide](SETUP.md) - Installation instructions
- [Architecture Documentation](docs/ARCHITECTURE.md) - System design
- [Integration Guide](docs/INTEGRATION.md) - Node integration
