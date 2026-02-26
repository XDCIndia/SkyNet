# XDC Node Infrastructure - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           XDC Network Infrastructure                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         SkyOne (Node Setup)                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │  Geth-XDC   │  │  Erigon-XDC │  │ Nethermind  │  │  Reth-XDC   │ │   │
│  │  │   (v2.6.8)  │  │  (v2.60.8)  │  │  (v1.25.0)  │  │  (alpha)    │ │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │   │
│  │         │                │                │                │        │   │
│  │         └────────────────┴────────────────┴────────────────┘        │   │
│  │                              │                                       │   │
│  │                    ┌─────────┴─────────┐                             │   │
│  │                    │   XDC Network     │                             │   │
│  │                    │  (Mainnet/Testnet)│                             │   │
│  │                    └─────────┬─────────┘                             │   │
│  │                              │                                       │   │
│  │                    ┌─────────┴─────────┐                             │   │
│  │                    │   SkyNet Agent    │                             │   │
│  │                    │  (Heartbeat API)  │                             │   │
│  │                    └─────────┬─────────┘                             │   │
│  └──────────────────────────────┼──────────────────────────────────────┘   │
│                                 │                                           │
│                                 ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         SkyNet (Dashboard)                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │   Web UI    │  │   Mobile    │  │    API      │  │  Analytics  │ │   │
│  │  │  (Next.js)  │  │   (React)   │  │  (Node.js)  │  │(ClickHouse) │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  │                                                                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │   │
│  │  │ PostgreSQL  │  │    Redis    │  │ Prometheus  │  │   Grafana   │ │   │
│  │  │ (Metadata)  │  │   (Cache)   │  │  (Metrics)  │  │(Dashboard)  │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### SkyOne (xdc-node-setup)

#### Multi-Client Support
| Client | Docker Image | RPC Port | P2P Port | Status |
|--------|--------------|----------|----------|--------|
| Geth-XDC | xinfinorg/xdposchain:v2.6.8 | 8545 | 30303 | Production |
| Geth-PR5 | anilchinchawale/gx:latest | 8557 | 30307 | Beta |
| Erigon-XDC | anilchinchawale/erix:latest | 8547 | 30304 | Beta |
| Nethermind | anilchinchawale/nmx:latest | 8556 | 30306 | Beta |
| Reth-XDC | anilchinchawale/reth-xdc:latest | 8546 | 30305 | Alpha |

#### Node Types
- **Full Node** - Standard full node (~500GB)
- **Archive Node** - Complete blockchain history (~4TB)
- **RPC Node** - Optimized for RPC requests
- **Masternode** - XDC Network validator node

#### Networks
- **Mainnet** - Chain ID: 50
- **Apothem (Testnet)** - Chain ID: 51
- **Devnet** - Chain ID: 551

### SkyNet (XDCNetOwn)

#### Services
1. **Node Service** - Node registration and heartbeat processing
2. **Alert Service** - Incident detection and notification
3. **Analytics Service** - Historical metrics and reporting
4. **API Gateway** - Authentication and rate limiting

#### Data Storage
- **PostgreSQL** - Node metadata, incidents, configuration
- **Redis** - Caching, rate limiting, session storage
- **Prometheus** - Time-series metrics collection
- **Grafana** - Visualization and dashboards

## Data Flow

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Node   │────▶│ Heartbeat   │────▶│   API       │────▶│  Database   │
│  (XDC)  │     │   Agent     │     │  Gateway    │     │ (PostgreSQL)│
└─────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
                                       ┌─────────────┐
                                       │   Alert     │
                                       │   Engine    │
                                       └──────┬──────┘
                                              │
                                              ▼
                                       ┌─────────────┐
                                       │ Notification│
                                       │  (Email/TG) │
                                       └─────────────┘
```

## Security Architecture

### Network Security
- RPC bound to localhost by default
- P2P port exposed for network participation
- UFW firewall rules for port management
- Fail2ban for intrusion detection

### Container Security
- Non-root user execution
- Read-only filesystems where possible
- Capability-based permissions
- Security profiles (seccomp, AppArmor)

### API Security
- JWT-based authentication
- API key scoping
- Rate limiting per endpoint
- Request validation

## Monitoring Stack

### Metrics Collection
```yaml
# Prometheus scrape configuration
scrape_configs:
  - job_name: 'xdc-node'
    static_configs:
      - targets: ['xdc-node:6060']
    metrics_path: /debug/metrics/prometheus
    
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
```

### Alert Rules
```yaml
# Critical alerts
groups:
  - name: xdc-node
    rules:
      - alert: SyncStall
        expr: xdc_sync_height_increase_rate < 1
        for: 10m
        
      - alert: PeerCountLow
        expr: xdc_peer_count < 5
        for: 5m
        
      - alert: DiskSpaceCritical
        expr: xdc_disk_usage_percent > 90
        for: 1m
```

## Deployment Patterns

### Single Node
```bash
# Quick start
curl -sSL https://raw.githubusercontent.com/AnilChinchawale/xdc-node-setup/main/setup.sh | sudo bash
```

### Multi-Client
```bash
# Run all clients simultaneously
./setup.sh --client all --network mainnet
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: xdc-node
spec:
  serviceName: xdc-node
  replicas: 1
  selector:
    matchLabels:
      app: xdc-node
  template:
    spec:
      containers:
        - name: xdc-node
          image: xinfinorg/xdposchain:v2.6.8
```

## Scaling Considerations

### Horizontal Scaling
- Multiple RPC nodes behind load balancer
- Read replicas for database queries
- Redis cluster for caching

### Vertical Scaling
- CPU: 4+ cores recommended
- RAM: 16GB+ for full nodes, 32GB+ for archive
- Disk: SSD required, NVMe recommended

## Disaster Recovery

### Backup Strategy
1. **Keystore Backup** - Encrypted wallet files
2. **Configuration Backup** - Node settings and keys
3. **Chain Data Backup** - Blockchain state (optional)

### Recovery Procedures
1. Restore keystore from backup
2. Re-sync or restore chain data
3. Verify node functionality
4. Re-register with SkyNet if needed

---

*Architecture Document - XDC EVM Expert Agent*
