# Multi-Client Setup Guide

**Running GP5 + Erigon + Nethermind + Reth + v268 on One Server**  
Issue #48 | XDCIndia/SkyNet

---

## Overview

This guide shows how to run the full XDC multi-client fleet on a single server. Each client runs in its own Docker container, uses a distinct set of ports, and reports telemetry to SkyNet via SkyOne agents.

### Minimum Hardware

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 8 cores | 16+ cores |
| RAM | 32 GB | 64 GB |
| Disk | 1 TB NVMe | 2 TB NVMe |
| Network | 100 Mbps | 1 Gbps |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

---

## Port Allocation

Each client gets a distinct set of ports to avoid conflicts.

| Client | P2P TCP | P2P UDP | HTTP RPC | WS RPC | Auth RPC | Metrics | SkyOne Agent |
|--------|---------|---------|----------|--------|----------|---------|--------------|
| GP5 (geth-xdc) | 30303 | 30303 | 8989 | 8988 | 8551 | 6060 | 7070 |
| Erigon XDC | 30304 | 30304 | 8990 | 8991 | 8552 | 6061 | 7071 |
| Nethermind XDC | 30305 | 30305 | 8992 | 8993 | 8553 | 9091 | 7072 |
| Reth XDC | 30306 | 30306 | 8588 | 8589 | 8554 | 9092 | 7073 |
| v268 (validator) | 30307 | 30307 | 8994 | 8995 | 8555 | 6062 | 7074 |
| SkyNet Dashboard | — | — | 3005 | 3006 | — | — | — |
| PostgreSQL | — | — | 5433 | — | — | — | — |

---

## Docker Compose Setup

### 1. Directory Structure

```
/opt/xdc/
├── docker-compose.yml
├── .env
├── configs/
│   ├── gp5/genesis.json
│   ├── erigon/genesis.json
│   ├── nethermind/nethermind.cfg
│   └── reth/reth.toml
├── data/
│   ├── gp5/
│   ├── erigon/
│   ├── nethermind/
│   ├── reth/
│   └── v268/
└── static-nodes/
    └── static-nodes.json
```

### 2. docker-compose.yml

```yaml
version: '3.8'

networks:
  xdc-net:
    driver: bridge

volumes:
  gp5-data:
  erigon-data:
  nethermind-data:
  reth-data:
  v268-data:
  postgres-data:

services:
  # ─────────────────────────────────
  # Database
  # ─────────────────────────────────
  db:
    image: timescale/timescaledb:latest-pg15
    restart: unless-stopped
    environment:
      POSTGRES_USER: skynet
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: skynet
    ports:
      - "5433:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - xdc-net

  # ─────────────────────────────────
  # GP5 (geth-xdc) — XDC Go Client
  # ─────────────────────────────────
  gp5:
    image: xdcindia/xdc-geth:latest
    restart: unless-stopped
    ports:
      - "30303:30303/tcp"
      - "30303:30303/udp"
      - "8989:8989"
      - "8988:8988"
      - "6060:6060"
    volumes:
      - gp5-data:/root/.ethereum
      - ./configs/gp5:/config
      - ./static-nodes:/static-nodes
    command: >
      --networkid 50
      --port 30303
      --http --http.addr 0.0.0.0 --http.port 8989
      --http.api eth,net,web3,admin,debug,xdpos
      --ws --ws.addr 0.0.0.0 --ws.port 8988
      --ws.api eth,net,web3,admin,debug,xdpos
      --metrics --metrics.addr 0.0.0.0 --metrics.port 6060
      --cache 4096
      --syncmode full
      --gcmode full
      --maxpeers 50
      --bootnodes ${XDC_BOOTNODES}
    networks:
      - xdc-net

  skyone-gp5:
    image: xdcindia/skyone-agent:latest
    restart: unless-stopped
    ports:
      - "7070:7070"
    environment:
      NODE_NAME: gp5-main
      RPC_URL: http://gp5:8989
      WS_URL: ws://gp5:8988
      CLIENT_TYPE: gp5
      SKYNET_URL: ${SKYNET_URL}
      SKYNET_API_KEY: ${SKYNET_API_KEY}
    networks:
      - xdc-net
    depends_on:
      - gp5

  # ─────────────────────────────────
  # Erigon XDC
  # ─────────────────────────────────
  erigon:
    image: xdcindia/erigon-xdc:latest
    restart: unless-stopped
    ports:
      - "30304:30304/tcp"
      - "30304:30304/udp"
      - "8990:8990"
      - "8991:8991"
      - "6061:6061"
    volumes:
      - erigon-data:/home/erigon/.local/share/erigon
      - ./configs/erigon:/config
    command: >
      --chain xdc
      --port 30304
      --http --http.addr 0.0.0.0 --http.port 8990
      --http.api eth,net,web3,admin,debug
      --ws --ws.port 8991
      --metrics --metrics.addr 0.0.0.0 --metrics.port 6061
      --batchSize 512M
      --maxPeers 50
      --bootnodes ${XDC_BOOTNODES}
      --sentry.api.addr 0.0.0.0:9091
      --sentry2.api.addr 0.0.0.0:9092
    networks:
      - xdc-net

  skyone-erigon:
    image: xdcindia/skyone-agent:latest
    restart: unless-stopped
    ports:
      - "7071:7070"
    environment:
      NODE_NAME: erigon-main
      RPC_URL: http://erigon:8990
      WS_URL: ws://erigon:8991
      CLIENT_TYPE: erigon
      SKYNET_URL: ${SKYNET_URL}
      SKYNET_API_KEY: ${SKYNET_API_KEY}
    networks:
      - xdc-net
    depends_on:
      - erigon

  # ─────────────────────────────────
  # Nethermind XDC
  # ─────────────────────────────────
  nethermind:
    image: xdcindia/nethermind-xdc:latest
    restart: unless-stopped
    ports:
      - "30305:30305/tcp"
      - "30305:30305/udp"
      - "8992:8992"
      - "8993:8993"
      - "9091:9091"
    volumes:
      - nethermind-data:/nethermind/data
      - ./configs/nethermind:/config
    command: >
      --config /config/nethermind.cfg
      --JsonRpc.Enabled true
      --JsonRpc.Host 0.0.0.0
      --JsonRpc.Port 8992
      --JsonRpc.WebSocketsPort 8993
      --Metrics.Enabled true
      --Metrics.ExposePort 9091
      --Network.P2PPort 30305
      --Network.MaxActivePeers 50
      --Pruning.Mode None
    networks:
      - xdc-net

  skyone-nethermind:
    image: xdcindia/skyone-agent:latest
    restart: unless-stopped
    ports:
      - "7072:7070"
    environment:
      NODE_NAME: nethermind-main
      RPC_URL: http://nethermind:8992
      WS_URL: ws://nethermind:8993
      CLIENT_TYPE: nethermind
      SKYNET_URL: ${SKYNET_URL}
      SKYNET_API_KEY: ${SKYNET_API_KEY}
    networks:
      - xdc-net
    depends_on:
      - nethermind

  # ─────────────────────────────────
  # Reth XDC (Rust client)
  # ─────────────────────────────────
  reth:
    image: xdcindia/reth-xdc:latest
    restart: unless-stopped
    ports:
      - "30306:30306/tcp"
      - "30306:30306/udp"
      - "8588:8588"
      - "8589:8589"
      - "9092:9092"
    volumes:
      - reth-data:/root/.local/share/reth
      - ./configs/reth:/config
    command: >
      node
      --chain /config/reth.toml
      --port 30306
      --http --http.addr 0.0.0.0 --http.port 8588
      --ws --ws.addr 0.0.0.0 --ws.port 8589
      --metrics 0.0.0.0:9092
      --max-outbound-peers 25
      --max-inbound-peers 25
    networks:
      - xdc-net

  skyone-reth:
    image: xdcindia/skyone-agent:latest
    restart: unless-stopped
    ports:
      - "7073:7070"
    environment:
      NODE_NAME: reth-main
      RPC_URL: http://reth:8588
      WS_URL: ws://reth:8589
      CLIENT_TYPE: reth
      SKYNET_URL: ${SKYNET_URL}
      SKYNET_API_KEY: ${SKYNET_API_KEY}
    networks:
      - xdc-net
    depends_on:
      - reth

  # ─────────────────────────────────
  # v268 (validator / masternode)
  # ─────────────────────────────────
  v268:
    image: xdcindia/xdc-geth:v2.6.8
    restart: unless-stopped
    ports:
      - "30307:30307/tcp"
      - "30307:30307/udp"
      - "8994:8994"
      - "8995:8995"
    volumes:
      - v268-data:/root/.ethereum
      - ./configs/gp5:/config
    command: >
      --networkid 50
      --port 30307
      --http --http.addr 0.0.0.0 --http.port 8994
      --ws --ws.addr 0.0.0.0 --ws.port 8995
      --mine
      --unlock ${VALIDATOR_ADDRESS}
      --password /config/password.txt
      --maxpeers 50
      --bootnodes ${XDC_BOOTNODES}
    networks:
      - xdc-net

  # ─────────────────────────────────
  # SkyNet Dashboard
  # ─────────────────────────────────
  skynet:
    image: xdcindia/skynet-dashboard:latest
    restart: unless-stopped
    ports:
      - "3005:3005"
      - "3006:3006"
    environment:
      DATABASE_URL: postgresql://skynet:${DB_PASSWORD}@db:5432/skynet
      NODE_ENV: production
    networks:
      - xdc-net
    depends_on:
      - db
```

### 3. .env file

```bash
# Database
DB_PASSWORD=your-strong-password

# XDC Network
XDC_BOOTNODES=enode://3d3a...@45.76.12.34:20301,enode://4aaf...@95.179.130.90:20301

# Validator (v268)
VALIDATOR_ADDRESS=xdc...your-masternode-address

# SkyNet
SKYNET_URL=http://skynet:3005
SKYNET_API_KEY=your-api-key
```

---

## Peer Injection

After all nodes are synced, inject fleet peers between nodes for low-latency intra-fleet communication:

```bash
# Get enode from each node
GP5_ENODE=$(curl -s http://localhost:8989 -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"admin_nodeInfo","params":[],"id":1}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['result']['enode'])")

# Inject GP5's enode into Erigon
curl -s http://localhost:8990 -X POST \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"admin_addPeer\",\"params\":[\"$GP5_ENODE\"],\"id\":1}"

# Or use SkyOne bulk injection
curl -X POST http://localhost:7071/api/peers/inject \
  -H "Authorization: Bearer $SKYONE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"peers\": [\"$GP5_ENODE\"]}"
```

---

## Monitoring Setup

### 1. Register nodes in SkyNet

```bash
# Register GP5
curl -X POST http://localhost:3005/api/nodes \
  -H "X-Api-Key: $SKYNET_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "gp5-main",
    "host": "localhost",
    "rpcUrl": "http://localhost:8989",
    "wsUrl": "ws://localhost:8988",
    "agentUrl": "http://localhost:7070",
    "clientType": "gp5",
    "role": "fullnode"
  }'

# Repeat for erigon (port 7071), nethermind (7072), reth (7073)
```

### 2. Configure alerts

```bash
# Sync stall alert (block not advancing for 5 min)
# Dashboard → Alerts → New Rule → blocks_behind > 100 → Warning

# Peer loss alert
# peer_count < 3 → Critical

# Disk space alert
# disk_percent > 85 → Warning
# disk_percent > 95 → Critical
```

### 3. Verify telemetry

Check unified telemetry endpoint:
```bash
curl http://localhost:3005/api/v2/telemetry/push \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Node-Id: gp5-main" \
  -d '{"block_number": 123456, "peer_count": 15, "syncing": false}'
```

---

## Troubleshooting

| Symptom | Likely Cause | Check |
|---------|-------------|-------|
| Container exits immediately | Bad config flag | `docker logs <container>` |
| Nodes won't peer with each other | Firewall | `ufw status` |
| Disk filling fast | Archive mode | Add `--gcmode full` (GP5) |
| OOM kills | Insufficient RAM | See INCIDENT-RUNBOOK.md #4 |
| Divergence detected | Known consensus bug | See INCIDENT-RUNBOOK.md #3 |

---

*For more detail see `docs/INCIDENT-RUNBOOK.md` and `docs/SKYONE-API.md`.*
