# XDCNetOwn (SkyNet) - API Reference

## Overview

This document provides comprehensive API documentation for XDCNetOwn (SkyNet), the centralized monitoring dashboard for XDC Network nodes.

## Base URL

```
Production: https://net.xdc.network/api/v1
Development: http://localhost:3000/api/v1
```

## Authentication

All API requests require authentication using a Bearer token.

```http
Authorization: Bearer YOUR_API_KEY
```

### API Key Types

| Type | Scope | Use Case |
|------|-------|----------|
| `node` | Single node | Node heartbeat, metrics |
| `operator` | Multiple nodes | Fleet management |
| `admin` | Full access | Administration |

## Endpoints

### Node Registration

Register a new node with SkyNet.

```http
POST /nodes/register
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

**Request Body:**

```json
{
  "name": "xdc-node-01",
  "host": "192.168.1.100",
  "role": "masternode",
  "rpcUrl": "http://192.168.1.100:8545",
  "clientType": "geth",
  "network": "mainnet"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "xdc-node-01",
    "apiKey": "sk_live_xxxxxxxxxxxxxxxx",
    "registeredAt": "2026-02-26T10:00:00Z"
  }
}
```

### Heartbeat

Send periodic heartbeat with node metrics.

```http
POST /nodes/heartbeat
Content-Type: application/json
Authorization: Bearer NODE_API_KEY
```

**Request Body:**

```json
{
  "nodeId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-02-26T10:00:00Z",
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
    "commands": [
      {
        "type": "update",
        "priority": "normal",
        "payload": {
          "version": "v2.6.9"
        }
      }
    ]
  },
  "incidentsDetected": 0
}
```

### Fleet Status

Get overview of all registered nodes.

```http
GET /fleet/status
Authorization: Bearer YOUR_API_KEY
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `network` | string | Filter by network (mainnet, testnet, devnet) |
| `status` | string | Filter by status (healthy, syncing, degraded, offline) |
| `clientType` | string | Filter by client type (geth, erigon, nethermind, reth) |

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
    "lastUpdated": "2026-02-26T12:00:00Z"
  }
}
```

### Node Status

Get detailed status for a specific node.

```http
GET /nodes/{nodeId}/status
Authorization: Bearer YOUR_API_KEY
```

**Response:**

```json
{
  "success": true,
  "data": {
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
      "diskPercent": 78.0,
      "uptime": 86400
    },
    "consensus": {
      "epoch": 99150,
      "epochProgress": 67,
      "voteParticipation": 98.5,
      "qcFormationTime": 450
    },
    "alerts": []
  }
}
```

### Metrics Query

Query historical metrics for a node.

```http
GET /nodes/{nodeId}/metrics
Authorization: Bearer YOUR_API_KEY
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `metric` | string | Metric name (blockHeight, peerCount, cpuPercent, etc.) |
| `from` | string | Start time (ISO 8601) |
| `to` | string | End time (ISO 8601) |
| `interval` | string | Aggregation interval (1m, 5m, 1h, 1d) |

**Response:**

```json
{
  "success": true,
  "data": {
    "metric": "blockHeight",
    "interval": "1h",
    "points": [
      {
        "timestamp": "2026-02-26T10:00:00Z",
        "value": 89234000,
        "min": 89233950,
        "max": 89234050,
        "avg": 89234000
      }
    ]
  }
}
```

### Issue Reporting

Report an issue from a node.

```http
POST /issues/report
Content-Type: application/json
Authorization: Bearer NODE_API_KEY
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

**Response:**

```json
{
  "success": true,
  "data": {
    "issueId": "issue-12345",
    "isDuplicate": false,
    "githubIssueUrl": "https://github.com/AnilChinchawale/xdc-node-setup/issues/123",
    "createdAt": "2026-02-26T12:00:00Z"
  }
}
```

### List Issues

Get list of issues with filters.

```http
GET /issues
Authorization: Bearer YOUR_API_KEY
```

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status (open, resolved) |
| `severity` | string | Filter by severity (critical, high, medium, low) |
| `nodeId` | string | Filter by node ID |
| `type` | string | Filter by issue type |
| `limit` | number | Maximum results (default: 50) |
| `offset` | number | Pagination offset |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "issue-12345",
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

```http
POST /issues/{issueId}/resolve
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

**Request Body:**

```json
{
  "resolution": "fixed",
  "notes": "Restarted node and sync resumed"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "issue-12345",
    "status": "resolved",
    "resolvedAt": "2026-02-26T12:30:00Z"
  }
}
```

### XDPoS Epoch Metrics

Get XDPoS 2.0 epoch metrics.

```http
GET /consensus/epoch/{epochNumber}
Authorization: Bearer YOUR_API_KEY
```

**Response:**

```json
{
  "success": true,
  "data": {
    "epochNumber": 99150,
    "startBlock": 89235000,
    "endBlock": 89235900,
    "masternodes": [
      "0x...",
      "0x..."
    ],
    "masternodeCount": 108,
    "qcFormationTime": 450,
    "timeoutCount": 2,
    "voteParticipation": 98.5,
    "blocksProduced": 900,
    "avgBlockTime": 2.1
  }
}
```

### Network Topology

Get network topology information.

```http
GET /network/topology
Authorization: Bearer YOUR_API_KEY
```

**Response:**

```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "xdc-node-01",
        "location": {
          "country": "US",
          "region": "California",
          "city": "San Francisco",
          "lat": 37.7749,
          "lon": -122.4194
        },
        "peers": [
          "node-id-2",
          "node-id-3"
        ]
      }
    ],
    "connections": [
      {
        "source": "node-id-1",
        "target": "node-id-2",
        "latency": 45
      }
    ]
  }
}
```

## WebSocket API

### Real-time Updates

Connect to WebSocket for real-time updates.

```javascript
const ws = new WebSocket('wss://net.xdc.network/ws');

ws.onopen = () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'YOUR_API_KEY'
  }));
  
  // Subscribe to fleet updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'fleet'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Update:', data);
};
```

### Message Types

| Type | Description |
|------|-------------|
| `heartbeat` | Node heartbeat received |
| `alert` | New alert generated |
| `status_change` | Node status changed |
| `metric_update` | Metric threshold crossed |

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 60 seconds.",
    "details": {
      "limit": 120,
      "window": "1m",
      "retryAfter": 60
    }
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing API key |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `VALIDATION_ERROR` | 422 | Invalid request data |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limiting

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Public API | 60 req | 1 min |
| Authenticated | 120 req | 1 min |
| Heartbeat | 120 req | 1 min |
| WebSocket | 10 msg | 1 sec |

## SDK Examples

### Node.js

```javascript
const SkyNetClient = require('@xdc/skynet-client');

const client = new SkyNetClient({
  apiKey: 'YOUR_API_KEY',
  baseUrl: 'https://net.xdc.network/api/v1'
});

// Register node
const node = await client.nodes.register({
  name: 'xdc-node-01',
  host: '192.168.1.100',
  role: 'masternode'
});

// Send heartbeat
await client.nodes.heartbeat(node.id, {
  blockHeight: 89234567,
  peerCount: 25,
  // ... other metrics
});

// Get fleet status
const fleet = await client.fleet.getStatus();
```

### Python

```python
from xdc_skynet import SkyNetClient

client = SkyNetClient(api_key='YOUR_API_KEY')

# Register node
node = client.nodes.register(
    name='xdc-node-01',
    host='192.168.1.100',
    role='masternode'
)

# Send heartbeat
client.nodes.heartbeat(
    node_id=node.id,
    block_height=89234567,
    peer_count=25
)

# Get fleet status
fleet = client.fleet.get_status()
```

### Go

```go
package main

import (
    "context"
    "github.com/xdc/skynet-go"
)

func main() {
    client := skynet.NewClient("YOUR_API_KEY")
    
    // Register node
    node, _ := client.Nodes.Register(context.Background(), skynet.NodeRegistration{
        Name: "xdc-node-01",
        Host: "192.168.1.100",
        Role: "masternode",
    })
    
    // Send heartbeat
    client.Nodes.Heartbeat(context.Background(), node.ID, skynet.NodeMetrics{
        BlockHeight: 89234567,
        PeerCount: 25,
    })
}
```

## Changelog

### v1.0.0 (2026-02-26)
- Initial API release
- Node registration and heartbeat
- Fleet management
- Issue reporting
- XDPoS 2.0 metrics

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [DASHBOARD.md](./DASHBOARD.md) - Dashboard features
- [ALERTS.md](./ALERTS.md) - Alert configuration
- [METRICS.md](./METRICS.md) - Metrics collection
