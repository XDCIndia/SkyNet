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
    "peerCount": 25,
    "system": {
      "cpuPercent": 45.2,
      "memoryPercent": 62.1,
      "diskPercent": 78.0
    },
    "client": {
      "name": "XDC Stable",
      "version": "v2.6.8"
    }
  }'
```

**Response:**

```json
{
  "success": true,
  "timestamp": "2026-02-14T12:00:00Z",
  "nextHeartbeat": 300
}
```

### Fleet Status API

Get an overview of all registered nodes:

```bash
curl -X GET http://localhost:3000/api/v1/fleet/status \
  -H "Authorization: Bearer YOUR_API_KEY"
```

**Response:**

```json
{
  "fleet": {
    "totalNodes": 12,
    "online": 11,
    "offline": 1,
    "syncing": 2,
    "healthy": 10
  },
  "networks": {
    "mainnet": 10,
    "testnet": 2
  },
  "alerts": {
    "critical": 0,
    "warning": 2,
    "info": 5
  }
}
```

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
