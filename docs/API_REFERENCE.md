# XDC SkyNet - API Reference

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

### Obtaining an API Key

1. Register your node with SkyNet
2. API key is returned in the registration response
3. Store securely in `skynet.conf`

## Endpoints

### Node Registration

Register a new node with SkyNet.

**Endpoint:** `POST /nodes/register`

**Request:**
```json
{
  "name": "xdc-node-01",
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
  "version": "v2.6.8-stable",
  "clientType": "geth",
  "nodeType": "masternode"
}
```

**Response:**
```json
{
  "success": true,
  "nodeId": "550e8400-e29b-41d4-a716-446655440000",
  "apiKey": "xdc_a1b2c3d4e5f6...",
  "message": "Node registered successfully"
}
```

### Heartbeat

Send node metrics to SkyNet.

**Endpoint:** `POST /nodes/heartbeat`

**Request:**
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
    "commands": ["restart", "update"]
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

**Endpoint:** `GET /nodes/{nodeId}/status`

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

### Report Issue

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
  "issueId": "issue-123",
  "isDuplicate": false,
  "githubIssueUrl": "https://github.com/AnilChinchawale/xdc-node-setup/issues/123"
}
```

### List Issues

Get list of issues with filters.

**Endpoint:** `GET /issues?status=open&severity=critical`

**Query Parameters:**
- `status`: `open`, `resolved`, `all`
- `severity`: `critical`, `high`, `medium`, `low`
- `nodeId`: Filter by node
- `limit`: Maximum results (default: 50)

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
      "github_issue_url": "https://github.com/.../issues/123",
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
  "message": "Issue marked as resolved"
}
```

### Network Health

Get overall network health metrics.

**Endpoint:** `GET /network/health`

**Response:**
```json
{
  "success": true,
  "data": {
    "healthScore": 92,
    "totalNodes": 12,
    "healthyNodes": 10,
    "degradedNodes": 1,
    "offlineNodes": 0,
    "avgBlockHeight": 89234560,
    "maxBlockHeight": 89234567,
    "totalPeers": 287,
    "avgSyncPercent": 98.5,
    "lastUpdated": "2026-02-14T12:00:00Z"
  }
}
```

### Masternode Data

Get current masternode information.

**Endpoint:** `GET /masternodes`

**Response:**
```json
{
  "success": true,
  "data": {
    "epoch": 99150,
    "round": 5,
    "blockNumber": 89234567,
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
    "totalStaked": "100000000000000000000000000",
    "nakamotoCoefficient": 7
  }
}
```

### Candidate Detail

Get detailed information about a specific candidate.

**Endpoint:** `GET /masternodes/{address}`

**Response:**
```json
{
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
  "blocksProduced": 1234,
  "blocksMissed": 12
}
```

## Rate Limits

| Tier | Limit | Window |
|------|-------|--------|
| Public | 60 req | 1 min |
| Authenticated | 120 req | 1 min |
| Heartbeat | 120 req | 1 min |
| Write | 30 req | 1 min |
| Admin | 300 req | 1 min |

## Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "error": "Invalid request body",
  "details": "Missing required field: nodeId"
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or missing API key"
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
  "error": "Internal server error",
  "requestId": "req-123-abc"
}
```

## WebSocket API

Connect to real-time updates:

```javascript
const ws = new WebSocket('wss://xdc.openscan.ai/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    action: 'subscribe',
    channel: 'fleet-updates'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Fleet update:', data);
};
```

## SDK Examples

### JavaScript/TypeScript

```typescript
class SkyNetClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = 'https://xdc.openscan.ai/api/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async registerNode(nodeData: any) {
    const response = await fetch(`${this.baseUrl}/nodes/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(nodeData)
    });
    return response.json();
  }

  async sendHeartbeat(heartbeatData: any) {
    const response = await fetch(`${this.baseUrl}/nodes/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify(heartbeatData)
    });
    return response.json();
  }

  async getFleetStatus() {
    const response = await fetch(`${this.baseUrl}/fleet/status`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });
    return response.json();
  }
}
```

### Python

```python
import requests

class SkyNetClient:
    def __init__(self, api_key, base_url='https://xdc.openscan.ai/api/v1'):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

    def register_node(self, node_data):
        response = requests.post(
            f'{self.base_url}/nodes/register',
            headers=self.headers,
            json=node_data
        )
        return response.json()

    def send_heartbeat(self, heartbeat_data):
        response = requests.post(
            f'{self.base_url}/nodes/heartbeat',
            headers=self.headers,
            json=heartbeat_data
        )
        return response.json()

    def get_fleet_status(self):
        response = requests.get(
            f'{self.base_url}/fleet/status',
            headers=self.headers
        )
        return response.json()
```

---

**Document Version:** 1.0.0  
**Last Updated:** February 27, 2026
