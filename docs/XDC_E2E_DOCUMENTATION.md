# XDC Node Setup & SkyNet - End-to-End Documentation

**Version:** 2.2.0  
**Date:** February 26, 2026  
**Author:** XDC EVM Expert Agent  

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Setup Instructions](#2-setup-instructions)
3. [Configuration Guide](#3-configuration-guide)
4. [Multi-Client Support](#4-multi-client-support)
5. [XDPoS 2.0 Consensus Monitoring](#5-xdpos-20-consensus-monitoring)
6. [Security Hardening](#6-security-hardening)
7. [Troubleshooting](#7-troubleshooting)
8. [API Reference](#8-api-reference)
9. [Integration Testing](#9-integration-testing)
10. [Operational Runbooks](#10-operational-runbooks)

---

## 1. Architecture Overview

### 1.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         XDC Node Ecosystem                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     XDC Node Setup (SkyOne)                      │    │
│  │                                                                  │    │
│  │  ┌─────────────┐    ┌──────────────┐    ┌─────────────────────┐ │    │
│  │  │   CLI Tool  │    │  SkyOne UI   │    │  SkyNet Agent       │ │    │
│  │  │   (xdc)     │◄──►│  (Port 7070) │◄──►│  (Heartbeat)        │ │    │
│  │  └──────┬──────┘    └──────┬───────┘    └─────────────────────┘ │    │
│  │         │                  │                                     │    │
│  │         ▼                  ▼                                     │    │
│  │  ┌──────────────────────────────────────────────────────────┐   │    │
│  │  │              Docker Compose Stack                         │   │    │
│  │  │  ┌───────────┐  ┌───────────┐  ┌──────────────────────┐  │   │    │
│  │  │  │ XDC Node  │  │  SkyOne   │  │ Prometheus/Grafana   │  │   │    │
│  │  │  │  (Geth/   │  │ Dashboard │  │   (Metrics)          │  │   │    │
│  │  │  │  Erigon/  │  │           │  │                      │  │   │    │
│  │  │  │  Nether/  │  │           │  │                      │  │   │    │
│  │  │  │  Reth)    │  │           │  │                      │  │   │    │
│  │  │  └─────┬─────┘  └───────────┘  └──────────────────────┘  │   │    │
│  │  │        │                                                │   │    │
│  │  │        ▼                                                │   │    │
│  │  │  ┌───────────┐  ┌───────────┐                          │   │    │
│  │  │  │  XDC Chain │  │   Data    │                          │   │    │
│  │  │  │   Data    │  │  Volume   │                          │   │    │
│  │  │  └───────────┘  └───────────┘                          │   │    │
│  │  └──────────────────────────────────────────────────────────┘   │    │
│  │                          │                                       │    │
│  └──────────────────────────┼───────────────────────────────────────┘    │
│                             │                                            │
│                             ▼                                            │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     XDC SkyNet (XDCNetOwn)                       │    │
│  │                                                                  │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │    │
│  │  │   Web Dashboard │  │   Mobile App    │  │   Public API    │  │    │
│  │  │   (Next.js 14)  │  │   (React Native)│  │   (REST + WS)   │  │    │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │    │
│  │           │                    │                    │           │    │
│  │           └────────────────────┼────────────────────┘           │    │
│  │                                ▼                                │    │
│  │  ┌─────────────────────────────────────────────────────────┐   │    │
│  │  │                    API Gateway                           │   │    │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │   │    │
│  │  │  │    Auth     │  │   Rate      │  │   Request       │  │   │    │
│  │  │  │   (JWT)     │  │   Limiting  │  │   Router        │  │   │    │
│  │  │  └─────────────┘  └─────────────┘  └─────────────────┘  │   │    │
│  │  └─────────────────────────────────────────────────────────┘   │    │
│  │                                │                                │    │
│  │           ┌────────────────────┼────────────────────┐           │    │
│  │           ▼                    ▼                    ▼           │    │
│  │  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐   │    │
│  │  │  Node Service │    │ Alert Service │    │  Analytics    │   │    │
│  │  └───────┬───────┘    └───────┬───────┘    └───────┬───────┘   │    │
│  │          │                    │                    │           │    │
│  │          └────────────────────┼────────────────────┘           │    │
│  │                               ▼                                │    │
│  │  ┌─────────────────────────────────────────────────────────┐   │    │
│  │  │                      Data Layer                          │   │    │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │   │    │
│  │  │  │  PostgreSQL │  │    Redis    │  │   Time-Series   │  │   │    │
│  │  │  │  (Metadata) │  │   (Cache)   │  │   (Metrics)     │  │   │    │
│  │  │  └─────────────┘  └─────────────┘  └─────────────────┘  │   │    │
│  │  └─────────────────────────────────────────────────────────┘   │    │
│  │                                                                  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│                             │                                            │
│                             ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     XDC P2P Network                               │   │
│  │         (Mainnet / Testnet / Devnet)                              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Interactions

| Component | Protocol | Port | Purpose |
|-----------|----------|------|---------|
| XDC Node | HTTP RPC | 8545 | JSON-RPC API |
| XDC Node | WebSocket | 8546 | Real-time subscriptions |
| XDC Node | P2P | 30303 | Peer-to-peer networking |
| SkyOne Dashboard | HTTP | 7070 | Local monitoring UI |
| SkyNet Agent | HTTPS | 443 | Fleet heartbeat API |
| Prometheus | HTTP | 9090 | Metrics collection |

---

## 2. Setup Instructions

### 2.1 Quick Start (One-Liner)

```bash
# One-command installation
curl -fsSL https://raw.githubusercontent.com/AnilChinchawale/xdc-node-setup/main/install.sh | sudo bash

# Check status
xdc status
```

### 2.2 Manual Installation

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

### 2.3 Multi-Client Setup

```bash
# Start with specific client
xdc start --client erigon
xdc start --client nethermind
xdc start --client reth

# Check current client
xdc client

# Switch clients
xdc stop
xdc start --client <client-name>
```

### 2.4 SkyNet Registration

```bash
# Automatic during setup
# Or manual registration:
curl -X POST https://xdc.openscan.ai/api/v1/nodes/register \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-xdc-node",
    "host": "https://rpc.my-node.example.com",
    "role": "masternode"
  }'
```

---

## 3. Configuration Guide

### 3.1 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NETWORK` | mainnet | Network: mainnet, testnet, devnet |
| `CLIENT` | stable | Client: stable, geth-pr5, erigon, nethermind, reth |
| `RPC_PORT` | 8545 | JSON-RPC port |
| `WS_PORT` | 8546 | WebSocket port |
| `P2P_PORT` | 30303 | P2P networking port |
| `SYNC_MODE` | full | Sync mode: full, fast, snap |
| `INSTANCE_NAME` | xdc-node | Node identifier |

### 3.2 Security Configuration

```bash
# ~/.xdc-node/config.toml
[node]
NetworkId = 50
DataDir = "/xdcchain"
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

### 3.3 Client-Specific Configuration

#### Erigon-XDC
```bash
# Erigon uses different ports
RPC_PORT=8547
P2P_PORT=30304
P2P_PORT_68=30311
INSTANCE_NAME=Erigon_XDC_Node
```

#### Nethermind-XDC
```bash
# Nethermind configuration
RPC_PORT=8558
P2P_PORT=30306
INSTANCE_NAME=Nethermind_XDC_Node
```

#### Reth-XDC
```bash
# Reth configuration
RPC_PORT=7073
P2P_PORT=40303
INSTANCE_NAME=Reth_XDC_Node
```

---

## 4. Multi-Client Support

### 4.1 Client Comparison Matrix

| Feature | XDC Stable | XDC Geth PR5 | Erigon-XDC | Nethermind-XDC | Reth-XDC |
|---------|------------|--------------|------------|----------------|----------|
| **Version** | v2.6.8 | Latest | Latest | Latest | Latest |
| **Status** | Production | Testing | Experimental | Beta | Alpha |
| **RPC Port** | 8545 | 8545 | 8547 | 8558 | 7073 |
| **P2P Port** | 30303 | 30303 | 30304/30311 | 30306 | 40303 |
| **Memory** | 4GB+ | 4GB+ | 8GB+ | 12GB+ | 16GB+ |
| **Disk** | ~500GB | ~500GB | ~400GB | ~350GB | ~300GB |
| **Sync Speed** | Standard | Standard | Fast | Very Fast | Very Fast |

### 4.2 Running Multiple Clients

```bash
# Run multiple clients on same machine
# Each client uses isolated ports and data directories

# Client 1: Geth Stable
xdc start --client stable --data-dir /data/geth --rpc-port 8545 --p2p-port 30303

# Client 2: Erigon
xdc start --client erigon --data-dir /data/erigon --rpc-port 8547 --p2p-port 30304

# Client 3: Nethermind
xdc start --client nethermind --data-dir /data/nethermind --rpc-port 8558 --p2p-port 30306
```

### 4.3 Cross-Client Peer Connections

```bash
# Add Erigon as trusted peer to Geth (use port 30304!)
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "admin_addTrustedPeer",
    "params": ["enode://<erigon_node_id>@<erigon_ip>:30304"],
    "id": 1
  }'
```

---

## 5. XDPoS 2.0 Consensus Monitoring

### 5.1 Epoch Structure

```
Epoch Length: 900 blocks
Gap Blocks: 450-899 (no block production)
Vote Collection: Active during gap period
Masternode Set: Determined at epoch start
```

### 5.2 Consensus Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `xdpos_epoch` | Current epoch number | - |
| `xdpos_epoch_block` | Block within epoch (0-899) | - |
| `xdpos_is_gap` | In gap period (bool) | - |
| `xdpos_vote_count` | Votes in current round | < 2/3 masternodes |
| `xdpos_qc_formed` | Quorum certificate formed | false for > 30s |
| `xdpos_timeout_count` | Timeout certificates | > 3 per epoch |

### 5.3 Monitoring Commands

```bash
# Check current epoch
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"XDPoS_getEpochNumber","params":[],"id":1}'

# Get masternode list
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"XDPoS_getMasternodes","params":[],"id":1}'

# Check vote status
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"XDPoS_getVoted","params":["0x..."],"id":1}'
```

### 5.4 Gap Block Monitoring

```bash
# Monitor gap block processing
#!/bin/bash
BLOCK=$(curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq -r '.result' | xargs printf '%d\n')

EPOCH=$((BLOCK / 900))
EPOCH_BLOCK=$((BLOCK % 900))

if [ $EPOCH_BLOCK -ge 450 ]; then
  echo "In gap period - Epoch $EPOCH, Block $EPOCH_BLOCK"
  # Check vote collection
fi
```

---

## 6. Security Hardening

### 6.1 RPC Security

```bash
# Bind RPC to localhost only (CRITICAL)
RPC_ADDR=127.0.0.1
RPC_CORS_DOMAIN=http://localhost:7070
RPC_VHOSTS=localhost,127.0.0.1

# Use nginx reverse proxy for external access
server {
    listen 443 ssl;
    server_name rpc.your-domain.com;
    
    location / {
        proxy_pass http://127.0.0.1:8545;
        auth_basic "XDC RPC";
        auth_basic_user_file /etc/nginx/.htpasswd;
        
        # Rate limiting
        limit_req zone=rpc burst=10 nodelay;
    }
}
```

### 6.2 Firewall Configuration

```bash
# UFW rules
sudo ufw default deny incoming
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 30303/tcp comment 'XDC P2P'
sudo ufw allow 30303/udp comment 'XDC P2P Discovery'

# DO NOT expose RPC ports directly
# sudo ufw allow 8545/tcp  # DANGEROUS - Only via reverse proxy

sudo ufw enable
```

### 6.3 Docker Security

```yaml
# docker-compose.yml security options
services:
  xdc-node:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID
    read_only: true
    tmpfs:
      - /tmp:nosuid,size=100m
```

### 6.4 Secrets Management

```bash
# Use Docker secrets or environment files
# NEVER commit .env files to git

echo ".env" >> .gitignore
echo ".pwd" >> .gitignore
echo "*.key" >> .gitignore

# Use .env.example for templates
cp .env .env.example
# Edit .env.example to remove real values
```

---

## 7. Troubleshooting

### 7.1 Node Won't Start

```bash
# Check Docker status
sudo systemctl status docker

# Check port conflicts
sudo ss -tlnp | grep -E '8545|30303|7070'

# View logs
xdc logs --follow

# Check resources
xdc info
```

### 7.2 Sync Issues

```bash
# Check peer count
xdc peers

# Check sync status
xdc sync

# Reset sync (last resort)
xdc stop
rm -rf mainnet/.xdc-node/geth/nodes
xdc start

# Download snapshot
xdc snapshot download --network mainnet
xdc snapshot apply
```

### 7.3 Consensus Issues

```bash
# Check if in gap period
xdc consensus status

# Check masternode participation
xdc masternodes list

# Check vote propagation
xdco consensus votes

# Restart if stuck
xdc restart
```

### 7.4 Performance Issues

```bash
# High memory usage
xdc config set cache 2048
xdc restart

# Disk space
xdc prune

# Slow sync
xdc config set max_peers 100
xdc restart
```

---

## 8. API Reference

### 8.1 SkyNet API

#### Register Node
```http
POST /api/v1/nodes/register
Authorization: Bearer {API_KEY}
Content-Type: application/json

{
  "name": "xdc-node-01",
  "host": "https://rpc.node.example.com",
  "role": "masternode",
  "rpcUrl": "https://rpc.node.example.com"
}
```

#### Heartbeat
```http
POST /api/v1/nodes/heartbeat
Authorization: Bearer {API_KEY}
Content-Type: application/json

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

#### Fleet Status
```http
GET /api/v1/fleet/status
Authorization: Bearer {API_KEY}
```

Response:
```json
{
  "healthScore": 92,
  "totalNodes": 12,
  "nodes": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "xdc-node-01",
      "status": "healthy",
      "blockHeight": 89234567,
      "clientType": "geth"
    }
  ]
}
```

### 8.2 XDC JSON-RPC

Standard Ethereum JSON-RPC with XDPoS extensions:

```bash
# Get block by number
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["latest",false],"id":1}'

# XDPoS specific: Get epoch info
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"XDPoS_getEpochNumber","params":[],"id":1}'

# XDPoS specific: Get masternodes
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"XDPoS_getMasternodes","params":[],"id":1}'
```

---

## 9. Integration Testing

### 9.1 Multi-Client Test Suite

```bash
#!/bin/bash
# test-multi-client.sh

CLIENTS=("stable" "erigon" "nethermind" "reth")

for client in "${CLIENTS[@]}"; do
  echo "Testing $client..."
  
  # Start client
  xdc start --client "$client" --data-dir "/tmp/test-$client"
  sleep 30
  
  # Test RPC
  curl -sf http://localhost:8545 \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' || echo "FAIL: $client RPC"
  
  # Test sync
  xdc sync | grep -q "syncing.*true" && echo "OK: $client syncing" || echo "FAIL: $client not syncing"
  
  # Stop client
  xdc stop
done
```

### 9.2 Consensus Test

```bash
#!/bin/bash
# test-consensus.sh

# Monitor for 2 epochs (30 minutes)
DURATION=1800
START=$(date +%s)

while [ $(($(date +%s) - START)) -lt $DURATION ]; do
  BLOCK=$(curl -s -X POST http://localhost:8545 \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq -r '.result')
  
  EPOCH_BLOCK=$((BLOCK % 900))
  
  if [ $EPOCH_BLOCK -eq 0 ]; then
    echo "Epoch boundary at block $BLOCK"
    # Verify consensus
  fi
  
  sleep 10
done
```

### 9.3 Load Testing

```bash
# Using k6 or similar
k6 run --vus 10 --duration 30s - <<EOF
import http from 'k6/http';

export default function () {
  http.post('http://localhost:8545', JSON.stringify({
    jsonrpc: '2.0',
    method: 'eth_blockNumber',
    params: [],
    id: 1
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
EOF
```

---

## 10. Operational Runbooks

### 10.1 Node Deployment

```bash
# 1. Provision server (Ubuntu 22.04 LTS)
# 2. Install XDC Node Setup
curl -fsSL https://raw.githubusercontent.com/AnilChinchawale/xdc-node-setup/main/install.sh | sudo bash

# 3. Configure
xdc config set network mainnet
xdc config set client stable
xdc config set max_peers 50

# 4. Start
xdc start

# 5. Verify
xdc status
xdc health --full

# 6. Register with SkyNet
xdc skynet register --api-key YOUR_API_KEY
```

### 10.2 Upgrade Procedure

```bash
# 1. Check current version
xdc version

# 2. Download snapshot (optional but recommended)
xdc snapshot download

# 3. Stop node
xdc stop

# 4. Backup
xdc backup create

# 5. Update
xdc update

# 6. Start
xdc start

# 7. Verify
xdc status
```

### 10.3 Disaster Recovery

```bash
# Scenario: Data corruption

# 1. Stop node
xdc stop

# 2. Restore from backup
xdc backup restore --file backup-2026-02-26.tar.gz

# 3. Or resync from snapshot
rm -rf mainnet/xdcchain/XDC/chaindata
xdc snapshot download
xdc snapshot apply
xdc start

# 4. Verify
xdc sync
```

### 10.4 Incident Response

| Incident | Detection | Response |
|----------|-----------|----------|
| Node Down | SkyNet Alert | Check `xdc status`, restart if needed |
| Sync Stall | Block height stuck | Check peers, restart, download snapshot |
| Consensus Fork | Block hash mismatch | Stop node, investigate, resync |
| High Memory | Prometheus Alert | Reduce cache, restart, scale up |
| Disk Full | SkyNet Alert | Prune, archive, or expand volume |

---

## Appendix A: XDPoS 2.0 Reference

### A.1 Consensus Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Epoch Length | 900 blocks | Masternode set changes every epoch |
| Gap Blocks | 450-899 | No block production, vote collection |
| Block Time | 2 seconds | Target block production time |
| Masternodes | 108 | Maximum masternode count |
| Quorum | 2/3 + 1 | Required for consensus |

### A.2 Key Contracts

| Contract | Address | Purpose |
|----------|---------|---------|
| Validator | 0x000...0088 | Masternode management |
| Random | 0x000...0090 | Randomness beacon |

---

## Appendix B: Client-Specific Notes

### B.1 Erigon-XDC

- Dual sentry architecture (eth/63 + eth/68)
- Port 30304 for XDC-compatible peers
- Port 30311 for standard Ethereum peers (NOT XDC compatible)

### B.2 Nethermind-XDC

- eth/100 protocol support
- Fast sync with reduced disk usage
- .NET-based implementation

### B.3 Reth-XDC

- Rust-based, memory-safe
- Fastest sync speed
- Requires `--debug.tip` for initial sync

---

*Document Version: 2.2.0*  
*Last Updated: February 26, 2026*  
*Maintained by: XDC EVM Expert Agent*
