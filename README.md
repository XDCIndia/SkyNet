# XDC SkyNet

> **Own Your Network.** The definitive dashboard and API platform for XDC Network owners and operators.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![XDC Network](https://img.shields.io/badge/XDC-Network-blue)](https://xdc.network)

<p align="center">
  <img src="docs/images/dashboard-preview.png" alt="XDC SkyNet Dashboard" width="800"/>
</p>

## What is XDC SkyNet?

**XDC SkyNet** is a **dashboard + API platform** for XDC Network owners. It provides real-time monitoring, fleet management, and operational intelligence for your XDC nodes — think **Datadog meets Polygon Supernets Dashboard**, purpose-built for XDC.

> ⚠️ **Note:** XDC SkyNet is **NOT** a node setup toolkit. For deploying and configuring XDC nodes, use [xdc-node-setup](https://github.com/AnilChinchawale/xdc-node-setup) instead.

### Key Capabilities

**Dashboard Views**
- 📊 **Executive Dashboard** — Network health score, fleet overview, growth metrics
- 🖥️ **Fleet Management** — Monitor 1 to 1,000 nodes from one screen
- 🔍 **Node Diagnostics** — Root cause analysis in under 60 seconds
- 🌍 **Peer Intelligence** — Geographic distribution, latency, health scoring
- 🚨 **Incident Detection** — Auto-detected anomalies with alerts

**API Platform**
- 📡 **REST API** — Full-featured API for node registration, metrics, and commands
- 🔑 **API Key Auth** — Secure bearer token authentication
- ⚡ **WebSocket** — Real-time updates for live dashboards
- 📈 **Metrics Ingestion** — Prometheus-compatible metrics push

## Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- PostgreSQL 14+ database
- XDC node deployed via [xdc-node-setup](https://github.com/AnilChinchawale/xdc-node-setup)

### Installation

```bash
git clone https://github.com/AnilChinchawale/XDCSkyNet.git
cd XDCSkyNet/dashboard

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

```bash
# Register your node with the platform
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

See [docs/INTEGRATION.md](docs/INTEGRATION.md) for complete integration instructions.

## Architecture

```
XDC SkyNet (Dashboard + API Platform)
├── dashboard/              # Next.js 14 application
│   ├── app/               # App router pages
│   ├── components/        # React components (Tailwind + Fira Sans)
│   ├── lib/
│   │   ├── db/           # PostgreSQL client & schema
│   │   ├── auth.ts       # API key authentication
│   │   ├── validation.ts # Zod schemas for API validation
│   │   ├── errors.ts     # Structured error handling
│   │   └── hooks/        # React hooks
│   ├── app/api/v1/       # REST API routes
│   │   ├── nodes/register     # Node self-registration
│   │   ├── nodes/heartbeat    # Metrics heartbeat
│   │   ├── nodes/metrics      # Batch metrics push
│   │   ├── notifications      # Alert receiver
│   │   ├── fleet/status       # Fleet overview
│   │   └── upgrades/check     # Version checking
│   └── public/           # Static assets
├── docs/                 # Documentation
│   ├── INTEGRATION.md   # xdc-node-setup integration guide
│   └── ARCHITECTURE.md  # Technical architecture
├── README.md            # This file
├── ROADMAP.md           # Project roadmap
└── LICENSE              # MIT License

xdc-node-setup (Separate Project - Node Deployment Toolkit)
├── cli/                 # xdc CLI tool
├── scripts/             # Setup, monitoring, backup scripts
├── docker/              # Docker Compose configs
├── configs/             # XDC node configurations
└── monitoring/          # Prometheus/Grafana configs
```

## Features

### Dashboard Views

| Feature | Status | Description |
|---------|--------|-------------|
| Executive Dashboard | ✅ Live | Network health, fleet overview, growth metrics |
| Fleet Management | ✅ Live | Multi-node monitoring with health scoring |
| Node Diagnostics | ✅ Live | RPC health, sync status, peer analysis |
| Peer Intelligence | ✅ Live | Geographic map, latency, client versions |
| Incident Detection | ✅ Live | Auto-detected issues with severity |
| Consensus Monitor | 🔜 Phase 2 | Epoch tracking, masternode status |
| Social Export | 🔜 Phase 2 | Branded stats images for Twitter/LinkedIn |
| AI Diagnostics | 🔜 Phase 5 | Intelligent root cause analysis |

### API Features

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/nodes/register` | POST | Node self-registration |
| `/api/v1/nodes/heartbeat` | POST | Heartbeat + metrics push |
| `/api/v1/nodes/metrics` | POST | Batch metrics (Prometheus) |
| `/api/v1/notifications` | POST | Alert/notification receiver |
| `/api/v1/fleet/status` | GET | Fleet overview |
| `/api/v1/nodes/{id}/status` | GET | Node status |
| `/api/v1/nodes/{id}/commands` | GET/POST | Remote command queue |
| `/api/v1/upgrades/check` | GET | Version checking |

## Design System

- **Font:** Fira Sans (geometric, technical feel)
- **Colors:**
  - Background: `#0A0E1A` (deep obsidian)
  - Cards: `#111827`
  - Accent: `#1E90FF` (electric blue)
  - Text: `#F0F0F0` (off-white)
- **Framework:** Next.js 14, TypeScript strict, Tailwind CSS

## API Reference

### Authentication

All API endpoints require Bearer token authentication:

```http
Authorization: Bearer YOUR_API_KEY
```

Configure API keys via the `API_KEYS` environment variable (comma-separated).

### Example: Register Node

```bash
curl -X POST http://localhost:3000/api/v1/nodes/register \
  -H "Authorization: Bearer xdc_master_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "xdc-node-01",
    "host": "https://rpc.example.com",
    "role": "masternode",
    "rpcUrl": "https://rpc.example.com"
  }'
```

### Example: Send Heartbeat

```bash
curl -X POST http://localhost:3000/api/v1/nodes/heartbeat \
  -H "Authorization: Bearer xdc_node_key" \
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
    }
  }'
```

See [docs/INTEGRATION.md](docs/INTEGRATION.md) for complete API documentation.

## Screenshots

<p align="center">
  <img src="docs/images/dashboard-main.png" alt="Main Dashboard" width="600"/>
  <br/>
  <em>Executive Dashboard - Fleet Overview</em>
</p>

<p align="center">
  <img src="docs/images/node-diagnostics.png" alt="Node Diagnostics" width="600"/>
  <br/>
  <em>Node Diagnostics Panel</em>
</p>

<p align="center">
  <img src="docs/images/peer-map.png" alt="Peer Map" width="600"/>
  <br/>
  <em>Global Peer Distribution</em>
</p>

## Related Projects

| Project | Description | Link |
|---------|-------------|------|
| **xdc-node-setup** | Node deployment toolkit (CLI, scripts, Docker) | [GitHub](https://github.com/AnilChinchawale/xdc-node-setup) |
| **XDC SkyNet** | Dashboard + API platform (this repo) | [GitHub](https://github.com/AnilChinchawale/XDCSkyNet) |

## Documentation

- [Integration Guide](docs/INTEGRATION.md) — Connect xdc-node-setup to XDC SkyNet
- [Architecture Overview](docs/ARCHITECTURE.md) — Technical design and data flow
- [API Reference](docs/INTEGRATION.md#api-endpoints-reference) — Complete endpoint documentation
- [Roadmap](ROADMAP.md) — Development phases and milestones

## Development

```bash
cd dashboard

# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Run type checking
npm run type-check

# Run linting
npm run lint

# Run tests
npm run test
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `API_KEYS` | Yes | Comma-separated list of master API keys |
| `NEXT_PUBLIC_API_URL` | No | Public API base URL |
| `WEBSOCKET_URL` | No | WebSocket server URL |
| `REDIS_URL` | No | Redis URL for distributed rate limiting |

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License. See [LICENSE](LICENSE) for details.

---

**Built for network owners. By network builders.**

*XDC SkyNet — Own Your Network.*
