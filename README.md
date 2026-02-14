# XDC SkyNet

<div align="center">

![XDC SkyNet](https://img.shields.io/badge/XDC-SkyNet-blue?style=for-the-badge&logo=server)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)
[![Status](https://img.shields.io/badge/Status-Live-brightgreen?style=for-the-badge)](https://net.xdc.network)

**Mission Control for XDC Network**

*The definitive dashboard and API platform for XDC Network owners and operators*

[🌐 Live Dashboard](https://net.xdc.network) • [API Docs](#api-documentation) • [Quick Start](#quick-start) • [Architecture](#architecture)

</div>

---

## 🎯 What is XDC SkyNet?

**XDC SkyNet** is a **dashboard + API platform** for XDC Network owners. It provides real-time monitoring, fleet management, and operational intelligence for your XDC nodes — think **Datadog meets Blockchain Infrastructure**, purpose-built for XDC.

### Key Capabilities

| Capability | Description |
|------------|-------------|
| 📊 **Fleet Management** | Monitor 1 to 1,000 nodes from one screen |
| 🔍 **Node Diagnostics** | Root cause analysis in under 60 seconds |
| 🌍 **Network Intelligence** | Geographic distribution, latency, health scoring |
| 🚨 **Incident Detection** | Auto-detected anomalies with instant alerts |
| 📡 **REST API** | Full-featured API for automation |
| ⚡ **Real-time Updates** | WebSocket support for live dashboards |

> ⚠️ **Note:** XDC SkyNet is **NOT** a node setup toolkit. For deploying XDC nodes, use [XDC Node Setup](https://github.com/AnilChinchawale/XDC-Node-Setup) instead.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- PostgreSQL 14+ database
- Redis (optional, for rate limiting)

### Installation

```bash
# Clone the repository
git clone https://github.com/AnilChinchawale/XDCNetOwn.git
cd XDCNetOwn

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL and API_KEYS

# Run database migrations
npm run db:init

# Start development server
npm run dev
```

### Connect Your Node

If you're using [XDC Node Setup](https://github.com/AnilChinchawale/XDC-Node-Setup), SkyNet integration is automatic.

For manual registration:

```bash
curl -X POST http://localhost:3000/api/v1/nodes/register \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-xdc-node",
    "host": "https://rpc.my-node.example.com",
    "role": "masternode",
    "rpcUrl": "https://rpc.my-node.example.com"
  }'
```

---

## ✨ Features

### Dashboard Views

| Feature | Status | Description |
|---------|--------|-------------|
| Executive Dashboard | ✅ Live | Network health, fleet overview, growth metrics |
| Fleet Management | ✅ Live | Multi-node monitoring with health scoring |
| Node Diagnostics | ✅ Live | RPC health, sync status, peer analysis |
| Peer Intelligence | ✅ Live | Geographic map, latency, client versions |
| Incident Detection | ✅ Live | Auto-detected issues with severity |
| Automated Issue Pipeline | ✅ Live | Deduplication, GitHub integration, auto-fixes |
| Validator Leaderboard | 🔄 Beta | Real-time ranking by stake and performance |
| Mobile App | 📅 Q3 2026 | iOS/Android companion app |
| AI Diagnostics | 📅 Q4 2026 | Intelligent root cause analysis |

### API Features

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/nodes/register` | POST | Node self-registration |
| `/api/v1/nodes/heartbeat` | POST | Heartbeat + metrics push |
| `/api/v1/nodes/metrics` | POST | Batch metrics (Prometheus-compatible) |
| `/api/v1/notifications` | POST | Alert/notification receiver |
| `/api/v1/fleet/status` | GET | Fleet overview |
| `/api/v1/nodes/{id}/status` | GET | Individual node status |
| `/api/v1/nodes/{id}/commands` | GET/POST | Remote command queue |

---

## 📡 API Documentation

### Authentication

All API endpoints require Bearer token authentication:

```http
Authorization: Bearer YOUR_API_KEY
```

Configure API keys via the `API_KEYS` environment variable (comma-separated).

### Heartbeat API

Nodes send regular heartbeats to report their status:

```bash
curl -X POST http://localhost:3000/api/v1/nodes/heartbeat \
  -H "Authorization: Bearer YOUR_NODE_API_KEY" \
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

**Request Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `nodeId` | string (UUID) | Unique identifier for the node |
| `blockHeight` | number | Current blockchain height |
| `syncing` | boolean | Whether node is syncing |
| `syncProgress` | number | Sync percentage (0-100) |
| `peerCount` | number | Number of connected peers |
| `system` | object | System metrics (cpu, memory, disk) |
| `clientType` | string | Client type: `geth`, `erigon`, `geth-pr5` |
| `nodeType` | string | Node type: `full`, `archive`, `fast`, `snap` |
| `syncMode` | string | Sync mode: `full`, `fast`, `snap` |
| `clientVersion` | string | Client version string |
| `chainDataSize` | number | Chain data size in bytes |
| `databaseSize` | number | Database size in bytes |
| `ipv4` | string | Node IPv4 address |
| `os` | object | OS information (type, release, arch, kernel) |

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

### Automated Issue Pipeline

SkyNet includes an automated issue pipeline that receives problems from SkyOne nodes, deduplicates them, and creates GitHub issues with analysis and suggested fixes.

#### How SkyOne Reports Issues

Nodes report issues via the report API:

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

**Issue Types:**

| Type | Severity | Description |
|------|----------|-------------|
| `sync_stall` | warning/high | Block sync has stopped progressing |
| `peer_drop` | critical/high | Peer count dropped critically |
| `disk_critical` | critical/high | Disk usage exceeded threshold |
| `rpc_error` | high/medium | RPC endpoint not responding |
| `bad_block` | critical | BAD BLOCK detected |
| `container_crash` | critical | Node container crashed |

#### Issue Deduplication Logic

The pipeline automatically deduplicates issues:
- Same `node_id` + same `type` + `status = 'open'` + `last_seen` within last 24h = duplicate
- Duplicates increment `occurrence_count` instead of creating new records
- API returns `{ isDuplicate: true, issue: { ... } }` for duplicates

#### GitHub Integration

For critical and high severity issues, SkyNet automatically creates GitHub issues:

1. **Analysis**: Generates solution description based on known patterns
2. **Code Generation**: Provides solution scripts for common problems
3. **GitHub Issue**: Created via `gh` CLI on the appropriate repository
4. **Issue Body** includes:
   - Node details (name, IP, client version)
   - Full diagnostics (metrics, logs, errors)
   - Suggested solution and files to check
   - Ready-to-run fix script

Labels applied: `auto-detected`, severity level, issue type

#### Issue API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/issues/report` | POST | Report new issue from node |
| `/api/v1/issues` | GET | List issues with filters |
| `/api/v1/issues/{id}/resolve` | POST | Mark issue as resolved |

**List Issues Query Parameters:**

```bash
# Get all open critical issues
curl "http://localhost:3000/api/v1/issues?status=open&severity=critical" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Get issues for specific node
curl "http://localhost:3000/api/v1/issues?nodeId=550e8400-...&limit=50" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "node_id": "...",
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

#### Dashboard Integration

The Issues page (`/issues`) provides:
- **Issue Cards**: Severity badges, occurrence count, duration
- **Filters**: By status (open/resolved) and severity
- **Diagnostics View**: Expandable metrics and logs
- **Solution View**: Suggested fixes with code
- **Resolve Action**: Mark issues as resolved
- **GitHub Links**: Direct links to created issues

Sidebar shows real-time count of open issues.

Get an overview of all registered nodes with real-time metrics:

```bash
curl -X GET http://localhost:3000/api/v1/fleet/status \
  -H "Authorization: Bearer YOUR_API_KEY"
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

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `healthScore` | number | Fleet health score (0-100) |
| `totalNodes` | number | Total number of active nodes |
| `nodes` | array | List of nodes with detailed metrics |
| `nodes[].status` | string | Node status: `healthy`, `syncing`, `degraded`, `offline` |
| `nodes[].clientType` | string | Client type: `geth`, `erigon`, `geth-pr5` |
| `nodes[].nodeType` | string | Node type: `full`, `archive`, `fast`, `snap` |
| `nodes[].syncMode` | string | Sync mode: `full`, `fast`, `snap` |
| `nodes[].chainDataSize` | number | Chain data size in bytes |
| `nodes[].databaseSize` | number | Database size in bytes |
| `nodes[].clientVersion` | string | Client version string |
| `nodeCounts` | object | Count of nodes by status |
| `incidents` | object | Active incident counts by severity |

### Node Status API

Get detailed status for a specific node:

```bash
curl -X GET http://localhost:3000/api/v1/nodes/{nodeId}/status \
  -H "Authorization: Bearer YOUR_API_KEY"
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

### Rate Limiting

| Tier | Limit | Window |
|------|-------|--------|
| Public | 60 req | 1 min |
| Authenticated | 120 req | 1 min |
| Heartbeat | 120 req | 1 min |
| Write | 30 req | 1 min |
| Admin | 300 req | 1 min |

---

## 🚀 Fleet Monitoring Features

### Node Type & Client Display

Each node displays its client type and sync mode:

- **Client Badges**: 🔷 Geth / 🔶 Erigon / 🟢 Geth PR5 / ⚡ XDC
- **Node Types**: Full Node / Archive / Fast Sync / Snap Sync / Masternode / Standby
- **Sync Mode**: full, fast, snap, archive

### Real-Time Storage Metrics

Track blockchain storage usage in real-time:

- **Chain Data Size**: Size of blockchain data on disk
- **Database Size**: Total database storage usage
- Storage displayed in human-readable format (GB, TB)
- Historical storage growth charts

### Block Increase Tracking

Monitor sync progress and block production:

- **Block Increase**: Shows "+N blocks" since last refresh
- **Blocks/min**: Real-time calculation of block processing rate
- **Sync ETA**: Estimated time remaining when syncing
- Block height sparkline charts

### Dynamic Charts (Pure SVG)

All charts are rendered as pure SVG without external libraries:

- **Time Range Selector**: 1h, 6h, 24h views
- **Multi-Series Support**: Block height, peers, CPU, memory, disk, storage
- **Interactive Legend**: Toggle series on/off
- **Responsive Design**: Charts adapt to container size

### Architecture: Agent → API → DB → Dashboard

```
┌────────────────────────────────────────────────────────────────────────┐
│                        XDC SkyNet Data Flow                            │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────┐     ┌────────────────┐     ┌─────────────────────┐  │
│  │  XDC Node 1  │────▶│                │────▶│                     │  │
│  └──────────────┘     │                │     │                     │  │
│                       │   Heartbeat    │     │   PostgreSQL        │  │
│  ┌──────────────┐     │   API          │     │   (skynet schema)   │  │
│  │  XDC Node 2  │────▶│   /api/v1/     │────▶│                     │  │
│  └──────────────┘     │   nodes/       │     │   • nodes           │  │
│                       │   heartbeat    │     │   • node_metrics    │  │
│  ┌──────────────┐     │                │     │   • incidents       │  │
│  │  XDC Node N  │────▶│                │────▶│   • peer_snapshots  │  │
│  └──────────────┘     └────────────────┘     └─────────────────────┘  │
│         │                                              │              │
│         │  Every 30-60s                                │              │
│         │  sends:                                      │              │
│         │  • blockHeight                               ▼              │
│         │  • peerCount                   ┌─────────────────────────┐  │
│         │  • system metrics              │                         │  │
│         │  • clientType/nodeType         │   Fleet Dashboard       │  │
│         │  • chainDataSize               │   /fleet                │  │
│         │  • databaseSize                │                         │  │
│         │                                │   • Node cards          │  │
│         │                                │   • Client badges       │  │
│         ▼                                │   • Block tracking      │  │
│  ┌──────────────┐                        │   • Storage metrics     │  │
│  │  Response:   │                        │   • Historical charts   │  │
│  │  • ok: true  │                        │                         │  │
│  │  • commands  │◀───────────────────────│   Real-time updates     │  │
│  │    (remote)  │                        │   every 30s             │  │
│  └──────────────┘                        └─────────────────────────┘  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🖼️ Dashboard Overview

### Executive Dashboard

The main dashboard provides a high-level overview of your entire fleet:

- **Network Health Score**: Overall fleet health (0-100)
- **Active Nodes**: Online vs total registered nodes
- **Chain Statistics**: Latest block, average block time, TPS
- **Geographic Distribution**: World map of node locations
- **Recent Alerts**: Timeline of incidents and notifications

### Fleet Management

Monitor all your nodes in one view:

- **Health Indicators**: Color-coded status (green/yellow/red)
- **Key Metrics**: Block height, peers, sync status
- **Quick Actions**: Restart, investigate, acknowledge alerts
- **Filtering**: By network, region, client type, status

### Node Diagnostics

Deep-dive into individual node performance:

- **RPC Health Checks**: Response time, error rates
- **Sync Progress**: Blocks behind, estimated completion
- **Peer Analysis**: Connected peers, geographic distribution
- **Resource Usage**: CPU, memory, disk trends
- **Log Viewer**: Recent log entries with search

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          XDC SkyNet Architecture                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │
│  │   Web Dashboard │  │   Mobile App    │  │   Public API    │           │
│  │   (Next.js 14)  │  │   (React Native)│  │   (REST + WS)   │           │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘           │
│           │                    │                    │                    │
│           └────────────────────┼────────────────────┘                    │
│                                ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │                    API Gateway (Node.js)                     │        │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │        │
│  │  │    Auth     │  │   Rate      │  │   Request Router    │  │        │
│  │  │   (JWT)     │  │   Limiting  │  │                     │  │        │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                │                                         │
│           ┌────────────────────┼────────────────────┐                    │
│           ▼                    ▼                    ▼                    │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐            │
│  │  Node Service │    │ Alert Service │    │  Analytics    │            │
│  │               │    │               │    │   Service     │            │
│  └───────┬───────┘    └───────┬───────┘    └───────┬───────┘            │
│          │                    │                    │                    │
│          └────────────────────┼────────────────────┘                    │
│                               ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │                      Data Layer                              │        │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │        │
│  │  │  PostgreSQL │  │    Redis    │  │   Time-Series DB    │  │        │
│  │  │  (Metadata) │  │   (Cache)   │  │   (Metrics)         │  │        │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │                    External Integrations                     │        │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │        │
│  │  │  XDC Nodes  │  │ XDC Network │  │   Notification      │  │        │
│  │  │  (Heartbeat)│  │  (RPC/API)  │  │   (Email/SMS/Slack) │  │        │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Nodes** send heartbeats via the API
2. **API Gateway** validates requests and applies rate limiting
3. **Services** process data and trigger alerts if needed
4. **Data Layer** stores metrics, metadata, and time-series data
5. **Dashboard** queries data for visualization
6. **Notifications** sent via configured channels

### Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, WebSocket |
| Database | PostgreSQL 14+, Redis |
| Monitoring | Prometheus, Grafana (optional) |
| Deployment | Docker, Docker Compose |

### Design System

- **Font:** Fira Sans (geometric, technical feel)
- **Colors:**
  - Background: `#0A0E1A` (deep obsidian)
  - Cards: `#111827`
  - Accent: `#1E90FF` (electric blue)
  - Text: `#F0F0F0` (off-white)

---

## 🚢 Deployment Guide

### Docker Deployment (Recommended)

```bash
# Clone and configure
git clone https://github.com/AnilChinchawale/XDCNetOwn.git
cd XDCNetOwn
cp .env.example .env
# Edit .env with your settings

# Start services
docker-compose up -d

# Access at http://localhost:3005
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `API_KEYS` | Yes | Comma-separated list of master API keys |
| `NEXT_PUBLIC_API_URL` | No | Public API base URL |
| `WEBSOCKET_URL` | No | WebSocket server URL |
| `REDIS_URL` | No | Redis URL for distributed rate limiting |
| `LOG_LEVEL` | No | Logging level (debug/info/warn/error) |
| `CORS_ALLOWED_ORIGINS` | No | Comma-separated allowed origins |

### Production Deployment

For production deployments, see [DEPLOYMENT.md](DEPLOYMENT.md) for:
- Kubernetes manifests
- Database migration strategies
- SSL/TLS configuration
- Backup and disaster recovery
- Monitoring and alerting setup

---

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/my-feature`
3. **Install** dependencies: `npm install`
4. **Test** your changes: `npm run test`
5. **Commit** your changes: `git commit -am 'Add new feature'`
6. **Push** to the branch: `git push origin feature/my-feature`
7. **Submit** a Pull Request

### Development Commands

```bash
npm run dev        # Start dev server
npm run build      # Build for production
npm run type-check # Run TypeScript checks
npm run lint       # Run ESLint
npm run test       # Run tests
```

---

## 🔗 Related Projects

| Project | Description | Link |
|---------|-------------|------|
| **XDC Node Setup** | Node deployment toolkit (CLI, scripts, Docker) | [GitHub](https://github.com/AnilChinchawale/XDC-Node-Setup) |
| **XDC Gateway** | Enterprise RPC infrastructure | [gateway.xdc.network](https://gateway.xdc.network) |
| **XDC SkyNet** | Dashboard + API platform (this repo) | [net.xdc.network](https://net.xdc.network) |

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [XDC Foundation](https://www.xdc.org/) for the XDC Network
- All contributors and community members
- The broader blockchain infrastructure community

---

<div align="center">

**Built for network owners. By network builders.**

*XDC SkyNet — Own Your Network.*

[🌐 Live Dashboard](https://net.xdc.network) • [📚 Documentation](docs/) • [💬 Discord](https://discord.gg/xdc)

</div>
