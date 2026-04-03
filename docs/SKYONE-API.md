# SkyOne Agent API Reference

**Issue #47 | XDCIndia/SkyNet**

SkyOne is the lightweight agent that runs on each fleet node. It acts as a bridge between the XDC client (GP5, Erigon, NM, Reth) and the SkyNet dashboard.

---

## Base URL

```
http://<node-host>:<agent-port>
```

Default ports (configurable via `AGENT_PORT` env var):

| Client | Default Port |
|--------|-------------|
| GP5 / geth-xdc | 7070 |
| Erigon XDC | 7071 |
| Nethermind XDC | 7072 |
| Reth XDC | 7073 |

---

## Authentication

All endpoints (except `/health`) require a Bearer token:

```
Authorization: Bearer <SKYONE_API_KEY>
```

The key is set via `SKYONE_API_KEY` env var on the agent. Configure the same key in SkyNet's `SKYONE_API_KEYS` env var.

---

## Endpoints

### GET /health

Public. Returns agent liveness status.

**Response:**
```json
{
  "status": "ok",
  "version": "1.2.3",
  "nodeName": "gp5-main",
  "clientType": "gp5",
  "uptime": 3600
}
```

---

### POST /api/heartbeat

Send a manual heartbeat to SkyNet. Called automatically by the agent on a configurable interval (default: 30s).

**Request body:** *(empty or optional metadata)*
```json
{
  "note": "manual ping"
}
```

**Response:**
```json
{
  "ok": true,
  "sentAt": "2024-01-01T00:00:00Z",
  "nodeId": "uuid-..."
}
```

---

### GET /api/metrics

Returns current node metrics (block height, peers, sync status, system resources).

**Response:**
```json
{
  "blockHeight": 73500000,
  "blockHash": "0xabc123...",
  "networkHeight": 73500100,
  "isSyncing": false,
  "syncPercent": 99.99,
  "peerCount": 25,
  "clientVersion": "XDC/v1.4.7-stable/linux-amd64",
  "clientType": "gp5",
  "txPoolPending": 12,
  "txPoolQueued": 3,
  "system": {
    "cpuPercent": 12.5,
    "memoryPercent": 45.2,
    "diskPercent": 62.1,
    "diskUsedGb": 620.5,
    "diskTotalGb": 1000.0
  },
  "timestamp": "2024-01-01T00:00:00Z"
}
```

---

### GET /api/container/image

Returns the running Docker image tag and container info.

**Response:**
```json
{
  "containerName": "xdc-gp5",
  "image": "xdcindia/xdc-geth:latest",
  "tag": "v1.4.7",
  "digest": "sha256:abc123...",
  "createdAt": "2024-01-01T00:00:00Z",
  "status": "running",
  "restartCount": 0
}
```

---

### POST /api/container/restart

Restart the XDC client container.

**Request body:**
```json
{
  "reason": "manual restart by admin",
  "delaySeconds": 0
}
```

**Response:**
```json
{
  "ok": true,
  "containerId": "abc123...",
  "restartedAt": "2024-01-01T00:00:00Z"
}
```

---

### POST /api/container/stop

Stop the XDC client container.

**Request body:**
```json
{
  "reason": "maintenance window",
  "timeoutSeconds": 30
}
```

**Response:**
```json
{
  "ok": true,
  "stoppedAt": "2024-01-01T00:00:00Z"
}
```

---

### POST /api/peers/inject

Inject one or more peers into the running XDC client via `admin_addPeer`.

**Request body:**
```json
{
  "peers": [
    "enode://abc123...@192.168.1.10:30303",
    "enode://def456...@192.168.1.11:30304"
  ]
}
```

**Response:**
```json
{
  "ok": true,
  "injected": 2,
  "failed": 0,
  "results": [
    { "enode": "enode://abc123...@192.168.1.10:30303", "success": true },
    { "enode": "enode://def456...@192.168.1.11:30304", "success": true }
  ]
}
```

---

### GET /api/peers

List current peers of the XDC node.

**Response:**
```json
{
  "peers": [
    {
      "enode": "enode://abc123...@10.0.0.2:30303",
      "name": "XDC/v1.4.7/linux-amd64",
      "caps": ["eth/63", "eth/68"],
      "network": {
        "remoteAddress": "10.0.0.2:30303",
        "inbound": false,
        "trusted": false,
        "static": false
      },
      "latencyMs": 12
    }
  ],
  "count": 1
}
```

---

### DELETE /api/peers/ban

Ban (remove and blacklist) a peer.

**Request body:**
```json
{
  "enode": "enode://abc123...@10.0.0.2:30303",
  "reason": "suspected spam"
}
```

**Response:**
```json
{
  "ok": true,
  "bannedAt": "2024-01-01T00:00:00Z"
}
```

---

### GET /api/logs

Stream or fetch recent container logs.

**Query params:**

| Param | Default | Description |
|-------|---------|-------------|
| `tail` | 100 | Number of lines |
| `since` | — | ISO timestamp |
| `level` | `all` | `error`, `warn`, `info`, `debug`, `all` |

**Response:**
```json
{
  "lines": [
    {
      "timestamp": "2024-01-01T00:00:01Z",
      "level": "INFO",
      "message": "Imported new chain segment",
      "fields": { "blocks": 1, "txs": 5, "elapsed": "14ms" }
    }
  ],
  "total": 100
}
```

---

### GET /api/logs/stream

Server-Sent Events (SSE) stream of live container logs.

**Headers:** `Accept: text/event-stream`

**Events:**
```
data: {"timestamp":"2024-01-01T00:00:01Z","level":"INFO","message":"..."}

data: {"timestamp":"2024-01-01T00:00:02Z","level":"WARN","message":"..."}
```

---

### POST /api/config

Update XDC client configuration (requires restart to take effect).

**Request body:**
```json
{
  "maxPeers": 50,
  "cache": 4096,
  "syncMode": "full",
  "extraParams": "--metrics"
}
```

**Response:**
```json
{
  "ok": true,
  "requiresRestart": true,
  "updatedAt": "2024-01-01T00:00:00Z"
}
```

---

### GET /api/enode

Get the node's own enode URL.

**Response:**
```json
{
  "enode": "enode://abc123...@203.0.113.1:30303",
  "nodeId": "abc123...",
  "ip": "203.0.113.1",
  "port": 30303,
  "listenAddr": "[::]:30303"
}
```

---

### GET /api/nethermind/cache

*(Nethermind only)* XdcStateRootCache metrics.

**Response:**
```json
{
  "xdcStateRootCache": {
    "hits": 125000,
    "misses": 3500,
    "size": 8192,
    "maxSize": 16384
  },
  "chainLevelCacheSize": 4096,
  "dbSize": "620 GB"
}
```

---

### GET /api/erigon/sentries

*(Erigon only)* Dual-sentry peer info.

**Response:**
```json
{
  "sentry63": {
    "port": 30303,
    "protocol": "eth/63",
    "peerCount": 18,
    "status": "online",
    "inboundPeers": 8,
    "outboundPeers": 10
  },
  "sentry68": {
    "port": 30304,
    "protocol": "eth/68",
    "peerCount": 12,
    "status": "online",
    "inboundPeers": 5,
    "outboundPeers": 7
  }
}
```

---

## Error Responses

All errors follow the same format:

```json
{
  "error": "descriptive error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

| HTTP Status | Meaning |
|-------------|---------|
| 400 | Bad request / invalid params |
| 401 | Missing or invalid auth token |
| 403 | Forbidden action |
| 404 | Resource not found |
| 500 | Agent internal error |
| 503 | XDC client unreachable |

---

## Configuration

SkyOne agent is configured via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_PORT` | 7070 | HTTP listen port |
| `SKYONE_API_KEY` | required | Auth key for API |
| `RPC_URL` | `http://localhost:8989` | XDC client RPC URL |
| `WS_URL` | `ws://localhost:8988` | XDC client WS URL |
| `CLIENT_TYPE` | `gp5` | `gp5`, `erigon`, `nethermind`, `reth` |
| `NODE_NAME` | hostname | Node name reported to SkyNet |
| `SKYNET_URL` | — | SkyNet dashboard URL for push telemetry |
| `SKYNET_API_KEY` | — | SkyNet API key |
| `HEARTBEAT_INTERVAL` | 30 | Seconds between heartbeats |
| `METRICS_INTERVAL` | 60 | Seconds between metrics polls |
| `CONTAINER_NAME` | `xdc-node` | Docker container to manage |
| `LOG_LEVEL` | `info` | Agent log level |

---

*See also: `docs/MULTI-CLIENT-GUIDE.md`, `docs/INCIDENT-RUNBOOK.md`*
