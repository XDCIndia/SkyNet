# XDC Node Setup & SkyNet - End-to-End Documentation

**Version:** 2.2.0  
**Last Updated:** February 26, 2026  
**Maintainer:** XDC EVM Expert Agent

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Quick Start Guide](#quick-start-guide)
3. [Configuration Guide](#configuration-guide)
4. [Multi-Client Setup](#multi-client-setup)
5. [XDPoS 2.0 Consensus](#xdpos-20-consensus)
6. [Monitoring & Alerting](#monitoring--alerting)
7. [Security Hardening](#security-hardening)
8. [Troubleshooting](#troubleshooting)
9. [API Reference](#api-reference)
10. [Best Practices](#best-practices)

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           XDC Infrastructure Stack                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         SkyNet (XDCNetOwn)                           │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │    │
│  │  │   Dashboard  │  │    API       │  │    Alert Manager         │  │    │
│  │  │  (Next.js)   │  │  (Node.js)   │  │  (Telegram/Email)        │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │    │
│  │                                                                      │    │
│  │  Database: PostgreSQL  │  Cache: Redis  │  Metrics: Prometheus    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    ▲                                         │
│                                    │ HTTPS/WebSocket                          │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      SkyOne (xdc-node-setup)                         │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │    │
│  │  │  XDC Node    │  │   Agent      │  │    Dashboard             │  │    │
│  │  │  (Docker)    │  │  (SkyNet)    │  │    (Port 7070)           │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │    │
│  │                                                                      │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │    │
│  │  │ Prometheus   │  │   Grafana    │  │    Node Exporter         │  │    │
│  │  │ (Metrics)    │  │(Dashboards)  │  │    (System metrics)      │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                           P2P Network (Port 30303)                           │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         XDC Network                                  │    │
│  │              (Mainnet / Apothem Testnet / Devnet)                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Descriptions

| Component | Technology | Purpose |
|-----------|------------|---------|
| XDC Node | Geth/Erigon/Nethermind/Reth | Blockchain client |
| SkyOne Agent | Bash/Node.js | Node monitoring & reporting |
| SkyOne Dashboard | Next.js 14 | Single-node monitoring UI |
| SkyNet Dashboard | Next.js 14 | Fleet-wide monitoring |
| SkyNet API | Node.js/Express | REST API for agents |
| PostgreSQL | PostgreSQL 14+ | Persistent data storage |
| Prometheus | Prometheus | Metrics collection |
| Grafana | Grafana | Visualization dashboards |

---

## Quick Start Guide

### Prerequisites

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| OS | Ubuntu 20.04 | Ubuntu 22.04 LTS |
| CPU | 4 cores | 8 cores |
| RAM | 16GB | 32GB |
| Disk | 500GB SSD | 1TB NVMe SSD |
| Network | 10 Mbps | 100 Mbps |

### One-Line Installation

```bash
# Install XDC Node with SkyOne
curl -fsSL https://raw.githubusercontent.com/AnilChinchawale/xdc-node-setup/main/setup.sh | sudo bash

# Check status
xdc status
```

### Manual Installation

```bash
# 1. Clone repository
git clone https://github.com/AnilChinchawale/xdc-node-setup.git
cd xdc-node-setup

# 2. Run setup
sudo ./setup.sh

# 3. Start node
xdc start

# 4. Access dashboard
open http://localhost:7070
```

### Connect to SkyNet

```bash
# Register node with SkyNet fleet monitoring
xdc config set skynet_enabled true
xdc config set skynet_api_key YOUR_API_KEY
xdc restart

# Verify connection
xdc skynet status
```

---

## Configuration Guide

### Node Configuration

#### Environment Variables

```bash
# Network selection
NETWORK=mainnet              # mainnet, testnet, apothem, devnet
CHAIN_ID=50                  # 50=mainnet, 51=testnet, 551=devnet

# Node type
NODE_TYPE=full               # full, archive, rpc, masternode
SYNC_MODE=full               # full, snap

# Ports
RPC_PORT=8545
WS_PORT=8546
P2P_PORT=30303
DASHBOARD_PORT=7070

# Client selection
CLIENT=stable                # stable, geth-pr5, erigon, nethermind, reth

# Features
ENABLE_MONITORING=true
ENABLE_SKYNET=true
ENABLE_SECURITY=true
```

#### config.toml

```toml
[node]
NetworkId = 50
DataDir = "/work/xdcchain"
HTTPPort = 8545
WSPort = 8546
Port = 30303
MaxPeers = 50

[eth]
SyncMode = "full"
GCMode = "full"
Cache = 4096

[metrics]
Enabled = true
Port = 6060
```

### Multi-Client Configuration

#### Geth-XDC (Default)
```bash
CLIENT=stable
RPC_PORT=8545
P2P_PORT=30303
```

#### Erigon-XDC
```bash
CLIENT=erigon
RPC_PORT=8547          # Different from Geth
P2P_PORT=30304         # eth/63 compatible
P2P_PORT_68=30311      # eth/68 (not XDC compatible)
```

#### Nethermind-XDC
```bash
CLIENT=nethermind
RPC_PORT=8558
P2P_PORT=30306
```

#### Reth-XDC
```bash
CLIENT=reth
RPC_PORT=7073
P2P_PORT=40303
```

---

## Multi-Client Setup

### Running Multiple Clients

```bash
# Start Geth node
xdc start --client stable --name xdc-geth

# Start Erigon node (different ports)
xdc start --client erigon --name xdc-erigon

# Start Nethermind node
xdc start --client nethermind --name xdc-nethermind
```

### Client Comparison Dashboard

Access the multi-client comparison at:
```
http://localhost:7070/clients
```

### Cross-Client Peer Connections

```bash
# Get Erigon enode (use port 30304 for XDC compatibility)
curl -X POST http://localhost:8547 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"admin_nodeInfo","params":[],"id":1}'

# Add as trusted peer on Geth (use port 30304!)
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "admin_addTrustedPeer",
    "params": ["enode://<id>@<ip>:30304"],
    "id": 1
  }'
```

---

## XDPoS 2.0 Consensus

### Epoch Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              XDPoS 2.0 Epoch                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Epoch Length: 900 blocks                                                   │
│  Gap Period: 450 blocks (blocks 450-899)                                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Blocks 0-449: Normal block production                               │    │
│  │ • Masternodes produce blocks in round-robin                         │    │
│  │ • Transactions processed normally                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Blocks 450-899: Gap period (NO block production)                    │    │
│  │ • Vote collection for next epoch                                    │    │
│  │ • Masternode set determination                                      │    │
│  │ • Timeout handling if votes insufficient                            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ Block 900: Epoch transition                                         │    │
│  │ • New masternode set activated                                      │    │
│  │ • Quorum Certificate verification                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Consensus Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Epoch Length | 900 blocks | Blocks per epoch |
| Gap Blocks | 450 blocks | Voting period |
| Masternodes | 108 | Active validators |
| Standby Nodes | Variable | Waiting validators |
| Block Time | 2 seconds | Target block interval |
| Quorum | 2/3 + 1 | Required for consensus |

### Monitoring Consensus

```bash
# Get current epoch
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"XDPoS_getEpochNumber","params":[],"id":1}'

# Get masternodes for current epoch
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"XDPoS_getMasternodesByNumber","params":["latest"],"id":1}'

# Check if node is in masternode set
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "XDPoS_isMasternode",
    "params": ["<address>"],
    "id": 1
  }'
```

---

## Monitoring & Alerting

### SkyOne Dashboard

Access your node dashboard at:
```
http://localhost:7070
```

#### Dashboard Sections

| Section | Metrics | Refresh |
|---------|---------|---------|
| Overview | Block height, sync status, peers | 10s |
| Performance | CPU, memory, disk, network | 10s |
| Consensus | Epoch, masternode status | 30s |
| Peers | Connected peers, geographic map | 30s |
| Alerts | Active alerts, history | Real-time |

### SkyNet Fleet Dashboard

Access fleet-wide monitoring at:
```
https://net.xdc.network
```

### Prometheus Metrics

```yaml
# Key metrics to monitor
- xdc_block_number          # Current block height
- xdc_sync_progress         # Sync percentage
- xdc_peer_count            # Connected peers
- xdc_chain_data_size       # Chain data size
- xdc_database_size         # Total database size
- xdc_vote_participation    # Vote participation rate (if masternode)
```

### Alert Rules

```yaml
# Example alert rules
groups:
  - name: xdc_node_alerts
    rules:
      - alert: XDCNodeDown
        expr: up{job="xdc-node"} == 0
        for: 5m
        labels:
          severity: critical
        
      - alert: XDCNodeNotSyncing
        expr: xdc_sync_progress < 99
        for: 30m
        labels:
          severity: warning
        
      - alert: XDCPeerCountLow
        expr: xdc_peer_count < 5
        for: 10m
        labels:
          severity: warning
```

---

## Security Hardening

### Production Checklist

- [ ] RPC bound to localhost only (`127.0.0.1`)
- [ ] CORS restricted to specific origins
- [ ] Firewall configured (UFW/iptables)
- [ ] SSH key authentication only
- [ ] Fail2ban enabled
- [ ] Automatic security updates
- [ ] Log rotation configured
- [ ] Secrets not committed to git

### Firewall Configuration

```bash
# Allow SSH
sudo ufw allow 22/tcp comment 'SSH'

# Allow P2P (required)
sudo ufw allow 30303/tcp comment 'XDC P2P'
sudo ufw allow 30303/udp comment 'XDC P2P UDP'

# Dashboard (optional, restrict to your IP)
sudo ufw allow from YOUR_IP to any port 7070 comment 'SkyOne Dashboard'

# Grafana (optional)
sudo ufw allow from YOUR_IP to any port 3000 comment 'Grafana'

# Enable firewall
sudo ufw enable
```

### RPC Security

```bash
# Secure RPC configuration
RPC_ADDR=127.0.0.1              # Bind to localhost only
RPC_CORS_DOMAIN=http://localhost:7070  # Specific origin
RPC_VHOSTS=localhost,127.0.0.1  # Virtual hosts

# Use nginx reverse proxy for external access
server {
    listen 443 ssl;
    server_name rpc.yourdomain.com;
    
    location / {
        proxy_pass http://127.0.0.1:8545;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # Rate limiting
        limit_req zone=rpc burst=10 nodelay;
    }
}
```

---

## Troubleshooting

### Common Issues

#### Node Won't Start
```bash
# Check Docker is running
sudo systemctl status docker

# Check port conflicts
sudo ss -tlnp | grep -E '8545|30303|7070'

# View logs
xdc logs --follow
```

#### Sync Stalled
```bash
# Check peer count
xdc peers

# Check sync status
xdc sync

# If no peers, restart with fresh peer discovery
xdc stop
rm -rf mainnet/.xdc-node/geth/nodes
xdc start

# Download snapshot for fast sync
xdc snapshot download --network mainnet
xdc snapshot apply
```

#### High Resource Usage
```bash
# Reduce memory cache
xdc config set cache 2048
xdc restart

# Check disk space
df -h

# Enable pruning
xdc config set prune_mode full
xdc restart
```

#### Dashboard Not Accessible
```bash
# Check if dashboard is running
docker ps | grep dashboard

# Check firewall
sudo ufw status

# Restart dashboard
xdc dashboard restart
```

### Debug Commands

```bash
# Get node info
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"admin_nodeInfo","params":[],"id":1}'

# Get peers
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"admin_peers","params":[],"id":1}'

# Check syncing
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_syncing","params":[],"id":1}'
```

---

## API Reference

### SkyNet API

#### Register Node
```bash
POST /api/v1/nodes/register
Authorization: Bearer YOUR_API_KEY

{
  "name": "xdc-node-01",
  "host": "192.168.1.100",
  "role": "masternode",
  "rpcUrl": "http://192.168.1.100:8545"
}
```

#### Send Heartbeat
```bash
POST /api/v1/nodes/heartbeat
Authorization: Bearer YOUR_API_KEY

{
  "nodeId": "550e8400-e29b-41d4-a716-446655440000",
  "blockHeight": 89234567,
  "syncing": false,
  "syncProgress": 99.8,
  "peerCount": 25,
  "system": {
    "cpuPercent": 45.2,
    "memoryPercent": 62.1,
    "diskPercent": 78.0
  },
  "clientType": "geth",
  "clientVersion": "v2.6.8-stable"
}
```

#### Get Fleet Status
```bash
GET /api/v1/fleet/status
Authorization: Bearer YOUR_API_KEY
```

### XDC Node RPC

#### Standard Ethereum RPC
```bash
# Get block number
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Get balance
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "eth_getBalance",
    "params": ["0x...", "latest"],
    "id": 1
  }'
```

#### XDPoS Specific RPC
```bash
# Get epoch number
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"XDPoS_getEpochNumber","params":[],"id":1}'

# Get masternodes
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"XDPoS_getMasternodesByNumber","params":["latest"],"id":1}'

# Get voter rewards
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "XDPoS_getRewardByHash",
    "params": ["0x..."],
    "id": 1
  }'
```

---

## Best Practices

### Node Operation

1. **Regular Backups**
   ```bash
   # Backup keystore and chain data
   xdc backup create
   ```

2. **Monitor Disk Space**
   ```bash
   # Set up disk usage alerts
   xdc monitor disk --threshold 80
   ```

3. **Keep Software Updated**
   ```bash
   # Check for updates
   xdc update check
   
   # Apply updates
   xdc update apply
   ```

4. **Secure Key Management**
   - Never commit keystore files
   - Use hardware wallets for masternodes
   - Regularly rotate API keys

### Masternode Operation

1. **Stake Requirements**
   - Minimum 10,000,000 XDC for masternode
   - Keep node online 24/7
   - Maintain good peer connections

2. **Performance Optimization**
   - Use SSD/NVMe storage
   - Ensure stable network connection
   - Monitor vote participation rate

3. **Security**
   - Use dedicated server for masternode
   - Enable 2FA on all accounts
   - Regular security audits

### Fleet Management

1. **Use SkyNet for Multi-Node**
   - Centralized monitoring
   - Automated alerting
   - Fleet-wide analytics

2. **Diversify Clients**
   - Run mix of Geth, Erigon, Nethermind
   - Improves network resilience
   - Reduces single-client risk

3. **Geographic Distribution**
   - Deploy nodes in multiple regions
   - Improves network decentralization
   - Reduces latency for users

---

## Support

### Resources

- [GitHub Issues](https://github.com/AnilChinchawale/xdc-node-setup/issues)
- [XDC Documentation](https://docs.xdc.community/)
- [XDC Network Explorer](https://xdc.network/)
- [XDC Community Discord](https://discord.gg/xdc)

### Emergency Contacts

For critical security issues:
- Email: security@xdc.network
- PGP Key: [Available on Keybase](https://keybase.io/xdc)

---

*Documentation Version: 2.2.0*  
*Last Updated: February 26, 2026*
