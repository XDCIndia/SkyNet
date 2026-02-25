# XDC SkyNet - API Reference

## Base URL

```
Production: https://net.xdc.network
Local:      http://localhost:3000
```

## Authentication

All API requests require Bearer token authentication:

```http
Authorization: Bearer YOUR_API_KEY
```

API keys are configured via the `API_KEYS` environment variable (comma-separated).

## Rate Limits

| Tier | Limit | Window |
|------|-------|--------|
| Public | 60 | 1 minute |
| Authenticated | 120 | 1 minute |
| Heartbeat | 120 | 1 minute |
| Write | 30 | 1 minute |
| Admin | 300 | 1 minute |

## Endpoints

### Node Registration

Register a new node with SkyNet.

```http
POST /api/v1/nodes/register
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "xdc-node-01",
  "host": "192.168.1.100",
  "role": "masternode",
  "rpcUrl": "http://192.168.1.100:8545",
  "clientType": "geth",
  "nodeType": "full",
  "syncMode": "full"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "apiKey": "xdc_abc123...",
    "name": "xdc-node-01",
    "registeredAt": "2026-02-14T12:00:00Z"
  }
}
```

### Heartbeat

Send node metrics and receive commands.

```http
POST /api/v1/nodes/heartbeat
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Request Body:**

```json
{
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

```http
GET /api/v1/fleet/status
Authorization: Bearer YOUR_API_KEY
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
        "lastSeen": "2026-02-14T12:00:00Z",
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
    "lastUpdated": "2026-02-14T12:00:00Z"
  }
}
```

### Node Status

Get detailed status for a specific node.

```http
GET /api/v1/nodes/{nodeId}/status
Authorization: Bearer YOUR_API_KEY
```

**Response:**

```json
{
  "node": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "xdc-node-01",
    "status": "online",
    "lastHeartbeat": "2026-02-14T12:00:00Z",
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

### Node Metrics History

Get historical metrics for a node.

```http
GET /api/v1/nodes/{nodeId}/metrics/history?hours=24
Authorization: Bearer YOUR_API_KEY
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| hours | number | 24 | Hours of history to retrieve |
| limit | number | 1000 | Maximum data points |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "blockHeight": 89234567,
      "peerCount": 25,
      "cpuPercent": 45.2,
      "memoryPercent": 62.1,
      "diskPercent": 78.0,
      "collectedAt": "2026-02-14T12:00:00Z"
    }
  ]
}
```

### Report Issue

Report an issue from a node.

```http
POST /api/v1/issues/report
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Request Body:**

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

**Issue Types:**

| Type | Description |
|------|-------------|
| sync_stall | Block sync has stopped progressing |
| peer_drop | Peer count dropped critically |
| disk_critical | Disk usage exceeded threshold |
| rpc_error | RPC endpoint not responding |
| bad_block | BAD BLOCK detected |
| container_crash | Node container crashed |

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 123,
    "isDuplicate": false,
    "githubIssueUrl": "https://github.com/AnilChinchawale/xdc-node-setup/issues/123"
  }
}
```

### List Issues

Get all reported issues.

```http
GET /api/v1/issues?status=open&severity=critical
Authorization: Bearer YOUR_API_KEY
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | Filter by status: open, resolved |
| severity | string | Filter by severity: critical, high, medium, low |
| nodeId | string | Filter by node ID |
| limit | number | Maximum results (default: 50) |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "node_id": "550e8400-e29b-41d4-a716-446655440000",
      "node_name": "xdc-node-01",
      "type": "sync_stall",
      "severity": "high",
      "title": "Block sync stalled at height 89234567",
      "status": "open",
      "github_issue_url": "https://github.com/AnilChinchawale/xdc-node-setup/issues/123",
      "solution_description": "Sync stall detected. Common causes: insufficient peers...",
      "solution_code": "#!/bin/bash\n# Fix sync stall...",
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

```http
POST /api/v1/issues/{id}/resolve
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

**Request Body:**

```json
{
  "resolution": "Restarted node, sync resumed",
  "resolvedBy": "operator@example.com"
}
```

### Network Health

Get network-wide health status.

```http
GET /api/v1/network/health
Authorization: Bearer YOUR_API_KEY
```

**Response:**

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "healthScore": 92,
    "totalNodes": 12,
    "healthyNodes": 10,
    "syncingNodes": 1,
    "degradedNodes": 1,
    "offlineNodes": 0,
    "avgBlockHeight": 89234560,
    "maxBlockHeight": 89234567,
    "blockHeightDelta": 7,
    "avgPeerCount": 23,
    "lastUpdated": "2026-02-14T12:00:00Z"
  }
}
```

### Epoch Information

Get current XDPoS epoch information.

```http
GET /api/v1/network/epoch
Authorization: Bearer YOUR_API_KEY
```

**Response:**

```json
{
  "success": true,
  "data": {
    "epoch": 99150,
    "round": 3,
    "blockNumber": 89234567,
    "epochStartBlock": 89235001,
    "epochEndBlock": 89235900,
    "blocksUntilEpochEnd": 933,
    "masternodeCount": 108,
    "standbyCount": 12
  }
}
```

### Masternodes

Get current masternode list.

```http
GET /api/v1/masternodes
Authorization: Bearer YOUR_API_KEY
```

**Response:**

```json
{
  "success": true,
  "data": {
    "epoch": 99150,
    "masternodes": [
      {
        "address": "0x...",
        "xdcAddress": "xdc...",
        "status": "active",
        "stake": "10,000,000.00",
        "owner": "0x..."
      }
    ],
    "standbynodes": [],
    "penalized": [],
    "totalStaked": "1,080,000,000.00",
    "nakamotoCoefficient": 7
  }
}
```

## WebSocket API

Connect for real-time updates:

```javascript
const ws = new WebSocket('wss://net.xdc.network/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'fleet-updates'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Fleet update:', data);
};
```

## Error Responses

### Standard Error Format

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### HTTP Status Codes

| Status | Description |
|--------|-------------|
| 200 | Success |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Internal Server Error |

### Error Codes

| Code | Description |
|------|-------------|
| UNAUTHORIZED | Missing or invalid API key |
| FORBIDDEN | Insufficient permissions |
| BAD_REQUEST | Invalid request parameters |
| NOT_FOUND | Resource not found |
| RATE_LIMITED | Too many requests |
| INTERNAL_ERROR | Server error |

## SDK Examples

### Python

```python
import requests

API_KEY = 'your-api-key'
BASE_URL = 'https://net.xdc.network'

headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

# Register node
response = requests.post(
    f'{BASE_URL}/api/v1/nodes/register',
    headers=headers,
    json={
        'name': 'xdc-node-01',
        'role': 'masternode'
    }
)
node = response.json()['data']

# Send heartbeat
requests.post(
    f'{BASE_URL}/api/v1/nodes/heartbeat',
    headers=headers,
    json={
        'nodeId': node['id'],
        'blockHeight': 89234567,
        'syncing': False,
        'peerCount': 25
    }
)
```

### JavaScript

```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'https://net.xdc.network',
  headers: {
    'Authorization': 'Bearer your-api-key',
    'Content-Type': 'application/json'
  }
});

// Register node
const { data } = await client.post('/api/v1/nodes/register', {
  name: 'xdc-node-01',
  role: 'masternode'
});

// Send heartbeat
await client.post('/api/v1/nodes/heartbeat', {
  nodeId: data.data.id,
  blockHeight: 89234567,
  syncing: false,
  peerCount: 25
});
```

## References

- [Integration Guide](docs/INTEGRATION.md)
- [Architecture Overview](docs/ARCHITECTURE.md)
- [XDPoS Monitoring](docs/XDPOS-MONITORING.md)
