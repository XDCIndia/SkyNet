# XDCNetOwn

> **Own Your Network.** The definitive monitoring, diagnostics, and intelligence platform for XDC Network owners and operators.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![XDC Network](https://img.shields.io/badge/XDC-Network-blue)](https://xdc.network)

<p align="center">
  <img src="docs/assets/dashboard-preview.png" alt="XDCNetOwn Dashboard" width="800"/>
</p>

## What is XDCNetOwn?

XDCNetOwn is an open-source platform that gives XDC Network owners complete visibility into their infrastructure. Think **Datadog meets Polygon Supernets Dashboard** — purpose-built for XDC.

### For Network Owners & CTOs
- 📊 **Executive Dashboard** — Network health score, growth metrics, social-ready stats
- 📈 **Growth Analytics** — Track peers, blocks, transactions over time
- 🏆 **Validator Leaderboard** — Rank masternodes by performance
- 🐦 **Social Export** — One-click branded stats for Twitter/LinkedIn

### For DevOps Engineers
- 🔍 **Root Cause Analysis** — Diagnose issues in under 60 seconds
- 📋 **Log Intelligence** — Structured logs with pattern detection
- 🚨 **Smart Alerts** — Anomaly detection with auto-diagnosis
- 🖥️ **Fleet Management** — Monitor 1 to 1,000 nodes from one screen

### For Validators
- 👑 **Consensus Monitor** — Epoch tracking, signing rate, participation
- 💰 **Rewards Dashboard** — APY, reward history, stake management
- 🌍 **Peer Intelligence** — Geographic distribution, latency, health scoring
- 🔄 **Auto-Upgrade** — Rolling updates with rollback safety

## Quick Start

### One-Line Install
```bash
curl -sSL https://raw.githubusercontent.com/AnilChinchawale/XDCNetOwn/main/scripts/setup.sh | bash
```

### Docker
```bash
git clone https://github.com/AnilChinchawale/XDCNetOwn.git
cd XDCNetOwn
docker compose up -d
```

### CLI
```bash
# After installation
xdc status          # Node status at a glance
xdc peers           # Peer management
xdc sync            # Sync progress
xdc health          # Full health check
xdc dashboard       # Open web dashboard
```

## Architecture

```
XDCNetOwn
├── dashboard/          # Next.js 14 web dashboard (Fira Sans, Obsidian theme)
├── cli/                # xdc CLI tool (22 commands)
├── scripts/            # Setup, monitoring, backup, security scripts
├── monitoring/         # Prometheus + Grafana configs & dashboards
├── docker/             # Docker Compose for XDC node + monitoring stack
├── configs/            # XDPoS v2, versions, network configs
├── enterprise/         # Ansible, Terraform, Kubernetes templates
├── docs/               # Comprehensive documentation
└── tests/              # E2E test suite (37 tests)
```

## Dashboard Features

| Feature | Status |
|---------|--------|
| Real-time block height & sync | ✅ Live |
| Coinbase address & ethstats | ✅ Live |
| World peer map with geo-location | ✅ Live |
| SVG circular gauges (CPU/MEM/Disk) | ✅ Live |
| Consensus epoch tracking | ✅ Live |
| Transaction pool monitoring | ✅ Live |
| macOS-style dock navigation | ✅ Live |
| Fira Sans + Obsidian dark theme | ✅ Live |
| Auto-refresh (10s) | ✅ Live |
| Skeleton loading states | ✅ Live |
| Peer management system | 🔜 Phase 1 |
| Social stats export (PNG) | 🔜 Phase 1 |
| Fleet management | 🔜 Phase 2 |
| AI-powered diagnostics | 🔜 Phase 5 |

## Live Demo

- **Dashboard**: [http://175.110.113.12:8888/](http://175.110.113.12:8888/)
- **Grafana**: [https://cloud.xdcrpc.com/grafana/](https://cloud.xdcrpc.com/grafana/)

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the complete 5-phase roadmap from foundation to AI-powered operations.

## Documentation

- [Quick Start Guide](docs/QUICKSTART.md)
- [Architecture Overview](docs/ARCHITECTURE.md)
- [XDPoS v2 Deep Dive](docs/XDPOS-V2.md)
- [Masternode Guide](docs/MASTERNODE-GUIDE.md)
- [Security Hardening](docs/SECURITY.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [CTO Playbook](docs/CTO-PLAYBOOK.md)

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License. See [LICENSE](LICENSE) for details.

---

**Built for network owners. By network builders.**

*XDCNetOwn — Own Your Network.*
