# XDC SkyNet API Reference

## Base URL

```
Production: https://xdc.openscan.ai/api/v1
Local:      http://localhost:3000/api/v1
```

## Authentication

All API endpoints require Bearer token authentication:

```http
Authorization: Bearer YOUR_API_KEY
```

Configure API keys via the `API_KEYS` environment variable (comma-separated).

## Rate Limits

| Tier | Limit | Window |
|------|-------|--------|
| Public | 60 req | 1 min |
| Authenticated | 120 req | 1 min |
| Heartbeat | 120 req | 1 min |
| Write | 30 req | 1 min |
| Admin | 300 req | 1 min |

## Endpoints

### Node Registration

Register a new node with SkyNet.

**Endpoint:** `POST /nodes/register`

**Request:**
```json
{
  "name": "my-xdc-node",
  "host": "192.168.1.100",
  "role": "masternode",
  "rpcUrl": "http://192.168.1.100:8545",
  "location": {
    "city": "Singapore",
    "country": "SG",
    "lat": 1.3521,
    "lng": 103.8198
  },
  "tags": ["production", "asia"],
  "clientType": "geth",
  "nodeType": "masternode",
  "ipv4": "192.168.1.100"
}
```

**Response:**
```json
{
  "nodeId": "550e8400-e29b-41d4-a716-446655440000",
  "apiKey": "skynet_xxxxxxxxxxxxxxxx",
  "message": "Node registered successfully"
}
```

### Heartbeat

Send node heartbeat with metrics.

**Endpoint:** `POST /nodes/heartbeat`

**Request:**
```json
{
  "nodeId": "550e8400-e29b-41d4-a716-446655440000",
  "blockHeight": 89234567,
  "syncing": false,
  "syncProgress": 99.8,
  "peerCount": 25,
  "peers": [
    {
      "enode": "enode://...",
      "name": "XDC/v2.6.8",
      "protocols": ["eth"],
      "direction": "inbound"
    }
  ],
  "txPool": {
    "pending": 10,
    "queued": 5
  },
  "gasPrice": "0x1",
  "coinbase": "0x...",
  "clientVersion": "v2.6.8-stable",
  "clientType": "geth",
  "isMasternode": true,
  "nodeType": "masternode",
  "ipv4": "192.168.1.100",
  "system": {
    "cpuPercent": 45.2,
    "memoryPercent": 62.1,
    "diskPercent": 78.0,
    "diskUsedGb": 450.5,
    "diskTotalGb": 1000.0
  },
  "security": {
    "score": 85,
    "issues": ["ssh_default_port"]
  },
  "rpcLatencyMs": 12,
  "timestamp": "2026-02-26T10:00:00Z"
}
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

### Fleet Status

Get overview of all registered nodes.

**Endpoint:** `GET /fleet/status`

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
        "lastSeen": "2026-02-26T12:00:00Z",
        "clientType": "geth",
        "nodeType": "masternode",
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
    "lastUpdated": "2026-02-26T12:00:00Z"
  }
}
```

### Node Status

Get detailed status for a specific node.

**Endpoint:** `GET /nodes/{nodeId}/status`

**Response:**
```json
{
  "node": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "xdc-node-01",
    "status": "online",
    "lastHeartbeat": "2026-02-26T12:00:00Z",
    "blockHeight": 89234567,
    "syncing": false,
    "peerCount": 25,
    "healthScore": 95
  },
  "system": {
    "cpuPercent": 45.2,
    "memoryPercent": 62.1,
    "diskPercent": 78.0
  },
  "alerts": []
}
```

### Issue Reporting

Report an issue from a node.

**Endpoint:** `POST /issues/report`

**Request:**
```json
{
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
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "issueId": "issue_12345",
    "isDuplicate": false,
    "githubIssueUrl": "https://github.com/AnilChinchawale/xdc-node-setup/issues/123"
  }
}
```

### List Issues

Get all issues with filters.

**Endpoint:** `GET /issues`

**Query Parameters:**
- `status` - Filter by status: `open`, `resolved`
- `severity` - Filter by severity: `critical`, `high`, `medium`, `low`
- `nodeId` - Filter by node ID
- `limit` - Maximum results (default: 50)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "issue_12345",
      "node_id": "550e8400-e29b-41d4-a716-446655440000",
      "node_name": "xdc-node-01",
      "type": "sync_stall",
      "severity": "high",
      "title": "Block sync stalled at height 89234567",
      "status": "open",
      "github_issue_url": "https://github.com/AnilChinchawale/xdc-node-setup/issues/123",
      "solution_description": "Sync stall detected. Common causes: insufficient peers...",
      "solution_code": "#!/bin/bash\n# Fix sync stall\n...",
      "occurrence_count": 3,
      "first_seen": "2026-02-14T10:00:00Z",
      "last_seen": "2026-02-14T12:30:00Z"
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

Mark an issue as resolved.

**Endpoint:** `POST /issues/{id}/resolve`

**Request:**
```json
{
  "resolution": "Restarted node and sync resumed",
  "resolvedBy": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "issue_12345",
    "status": "resolved",
    "resolvedAt": "2026-02-26T12:00:00Z"
  }
}
```

## Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    { "field": "name", "message": "Name is required" }
  ]
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Invalid or missing API key"
}
```

### 403 Forbidden

```json
{
  "success": false,
  "error": "Insufficient permissions",
  "code": "FORBIDDEN"
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": "Node not found",
  "code": "NOT_FOUND"
}
```

### 429 Too Many Requests

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retryAfter": 60
}
```

### 500 Internal Server Error

```json
{
  "success": false,
  "error": "Internal server error"
}
```

## WebSocket API

Real-time updates via WebSocket.

**Endpoint:** `wss://xdc.openscan.ai/api/v1/ws`

### Subscribe to Events

```javascript
const ws = new WebSocket('wss://xdc.openscan.ai/api/v1/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    action: 'subscribe',
    events: ['node.heartbeat', 'incident.created']
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### Event Types

| Event | Description |
|-------|-------------|
| `node.heartbeat` | Node sent heartbeat |
| `node.offline` | Node marked offline |
| `incident.created` | New incident detected |
| `incident.resolved` | Incident resolved |
| `fleet.status` | Fleet status update |

## SDK Examples

### JavaScript/TypeScript

```typescript
import { SkyNetClient } from '@xdc/skynet-client';

const client = new SkyNetClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://xdc.openscan.ai/api/v1'
});

// Register node
const node = await client.nodes.register({
  name: 'my-node',
  host: '192.168.1.100',
  role: 'masternode'
});

// Send heartbeat
await client.nodes.heartbeat(node.nodeId, {
  blockHeight: 89234567,
  peerCount: 25,
  system: {
    cpuPercent: 45.2,
    memoryPercent: 62.1,
    diskPercent: 78.0
  }
});

// Get fleet status
const fleet = await client.fleet.getStatus();
console.log(`Health score: ${fleet.healthScore}`);
```

### Python

```python
import requests

API_KEY = 'your-api-key'
BASE_URL = 'https://xdc.openscan.ai/api/v1'
headers = {'Authorization': f'Bearer {API_KEY}'}

# Register node
response = requests.post(
    f'{BASE_URL}/nodes/register',
    headers=headers,
    json={
        'name': 'my-node',
        'host': '192.168.1.100',
        'role': 'masternode'
    }
)
node = response.json()

# Send heartbeat
requests.post(
    f'{BASE_URL}/nodes/heartbeat',
    headers=headers,
    json={
        'nodeId': node['nodeId'],
        'blockHeight': 89234567,
        'peerCount': 25
    }
)
```

### cURL

```bash
# Register node
curl -X POST https://xdc.openscan.ai/api/v1/nodes/register \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-node",
    "host": "192.168.1.100",
    "role": "masternode"
  }'

# Send heartbeat
curl -X POST https://xdc.openscan.ai/api/v1/nodes/heartbeat \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "nodeId": "550e8400-e29b-41d4-a716-446655440000",
    "blockHeight": 89234567,
    "peerCount": 25
  }'

# Get fleet status
curl https://xdc.openscan.ai/api/v1/fleet/status \
  -H "Authorization: Bearer YOUR_API_KEY"
```

## Changelog

### v1.0.0
- Initial API release
- Node registration and heartbeat
- Fleet status and monitoring
- Issue reporting and tracking
