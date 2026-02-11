# XDCNetOwn — Scalability Architecture
## For 400+ Node Global Monitoring

**Version:** 2.0  
**Date:** February 2026  
**Author:** Anil (CTO)  
**Status:** Draft / Architecture Review

---

## Executive Summary

XDCNetOwn currently monitors 3 nodes. To become the definitive monitoring platform for XDC Network, we must architect for **400+ nodes across multiple continents** while maintaining sub-200ms query latency, 99.9% uptime, and operational simplicity for node operators.

This document presents a **hybrid push+pull architecture** that combines the firewall-friendliness of our current heartbeat agent with the scalability of Prometheus, orchestrated through regional collectors and a central time-series database.

**Key Numbers:**
- 400 nodes × 50 metrics × 2/min = **57.6M data points/day**
- Steady-state API load: **~13 req/s** (peak: 40 req/s)
- Storage growth: **~2GB/day** compressed metrics
- Target monthly cost at 400 nodes: **~$500/mo** (vs $20K+/mo for competitors)

---

## 1. Current State (3 Nodes)

### What Works
- **Bash heartbeat agent** (`netown-agent.sh`) pushes to central API every 60s
- **PostgreSQL** stores node registry, incidents, and fleet state
- **Next.js dashboard** with real-time node status
- **Healthy peer list** with port checking
- **Masternode integration** via XDCValidator contract

### What Doesn't Scale
| Issue | Impact at 400 Nodes | Root Cause |
|-------|---------------------|------------|
| Bash agent | Unreliable, hard to distribute | No error handling, no buffering |
| Direct HTTP push to API | API overload, single point of failure | No queue, no backpressure |
| PostgreSQL for metrics | Query timeouts, table bloat | Row-based storage for time-series |
| Polling dashboard | 400× browser load | HTTP polling every 5s |
| No regional awareness | Latency for Asia nodes | Single EU-based collector |

**The 3-node architecture:**
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Node 1     │     │  Node 2     │     │  Node 3     │
│(Finland)    │     │(Germany)    │     │(Singapore)  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │  HTTP POST        │  HTTP POST        │  HTTP POST
       │  every 60s        │  every 60s        │  every 60s
       ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────┐
│              XDCNetOwn API (Next.js)                     │
│                    (single instance)                     │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              PostgreSQL (single instance)                │
│         nodes, incidents, metrics (all tables)          │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Decision: Push + Pull Hybrid

### The Core Question: Heartbeat vs Prometheus vs Both?

#### Option A: Pure Heartbeat (Push Model)
Every node pushes metrics to a central endpoint.

**Pros:**
- ✅ Works behind NAT/firewalls (outbound-only)
- ✅ Node operator installs once, no inbound ports
- ✅ Carries rich app-level data (block height, peers, masternode status)
- ✅ Self-registering (agent reports its own identity)

**Cons:**
- ❌ Harder to detect "agent died" vs "node died"
- ❌ Push storms when 400 nodes restart simultaneously
- ❌ No built-in time-series optimization
- ❌ Alerting requires custom rule engine

#### Option B: Pure Prometheus (Pull Model)
Central Prometheus scrapes each node's `/metrics` endpoint.

**Pros:**
- ✅ Industry standard, battle-tested at scale
- ✅ Built-in alerting (AlertManager), Grafana native
- ✅ Time-series optimized (compression, retention)
- ✅ Service discovery for dynamic targets

**Cons:**
- ❌ Needs network access TO each node (firewall nightmare with 400 nodes)
- ❌ Requires Prometheus config per target
- ❌ Doesn't carry application-level context easily
- ❌ Assumes node operators will expose ports (they won't)

#### Option C: Hybrid (RECOMMENDED)
**Agent push for app data + Prometheus pull for system metrics**

```
┌─────────────┐         ┌─────────────────┐         ┌─────────────┐
│  Node Agent │────────►│  Regional       │────────►│   Central   │
│  (Go)       │  gRPC   │  Collector      │ remote  │   TSDB      │
│             │         │  (Prometheus)   │ write   │ (Mimir)     │
└─────────────┘         └─────────────────┘         └─────────────┘
       │                                                    ▲
       │ App-level metrics                                  │
       │ (block height, peers,                              │ System metrics
       │  masternode status)                                │ (CPU, mem, disk)
       ▼                                                    │
┌─────────────┐         ┌─────────────────┐                  │
│   Message   │────────►│   Central API   │──────────────────┘
│   Queue     │         │   (Next.js)     │
│  (NATS)     │         └─────────────────┘
└─────────────┘                  │
                                 ▼
                    ┌─────────────────────┐
                    │   PostgreSQL        │
                    │   (fleet state)     │
                    └─────────────────────┘
```

**Why Hybrid Wins:**
1. **Firewall-friendly:** Node operators only need outbound HTTPS (port 443)
2. **Rich context:** Agent carries XDC-specific data that Prometheus can't easily pull
3. **Scalable metrics:** Prometheus ecosystem handles high-cardinality time-series
4. **Best of both:** Industry-standard observability + domain-specific monitoring

---

## 3. Data Flow Architecture

### Complete Data Flow (400 Nodes)

```
                                    ┌─────────────────────────────────────────┐
                                    │           GLOBAL VIEW LAYER              │
                                    │  ┌──────────┐ ┌──────────┐ ┌────────┐  │
                                    │  │ Grafana  │ │ Dashboard│ │ Alerts │  │
                                    │  │(Internal)│ │ (Next.js)│ │(PagerD)│  │
                                    │  └────┬─────┘ └────┬─────┘ └───┬────┘  │
                                    └───────┼────────────┼───────────┼───────┘
                                            │            │           │
                                            ▼            ▼           ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              CENTRAL INFRASTRUCTURE                               │
│                                                                                   │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐  │
│   │   Thanos/Mimir  │    │   Central API   │    │   Alert Manager             │  │
│   │   (TSDB Query)  │◄───│   (Next.js v2)  │───►│   (Prometheus Alertmanager) │  │
│   │                 │    │                 │    │                             │  │
│   │  • Long-term    │    │  • Queue        │    │  • Routing rules            │  │
│   │    storage      │    │    consumer     │    │  • Escalation               │  │
│   │  • Global view  │    │  • Fleet API    │    │  • Silences                 │  │
│   │  • Downsampling │    │  • WebSocket    │    │                             │  │
│   └────────┬────────┘    └────────┬────────┘    └─────────────────────────────┘  │
│            │                      │                                               │
│            │                      ▼                                               │
│            │           ┌─────────────────┐    ┌─────────────────┐               │
│            │           │   PostgreSQL    │    │   Redis         │               │
│            │           │   (Fleet DB)    │    │   (Cache)       │               │
│            │           │                 │    │                 │               │
│            │           │  • Node registry│    │  • Last seen    │               │
│            │           │  • Incidents    │    │  • Rate limits  │               │
│            │           │  • Masternodes  │    │  • Sessions     │               │
│            │           │  • Alerts       │    │  • Real-time    │               │
│            │           └─────────────────┘    └─────────────────┘               │
│            │                                                                     │
│   ┌────────┴─────────────────────────────────────────────────────────────────┐  │
│   │                         MESSAGE QUEUE (NATS)                              │  │
│   │  ┌─────────────────────────────────────────────────────────────────────┐  │  │
│   │  │ Topics:                                                             │  │  │
│   │  │   • heartbeats.eu   • heartbeats.us   • heartbeats.apac            │  │  │
│   │  │   • metrics.eu      • metrics.us      • metrics.apac               │  │  │
│   │  │   • dlq (dead letter queue for failed deliveries)                  │  │  │
│   │  └─────────────────────────────────────────────────────────────────────┘  │  │
│   └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘
            ▲                                      ▲
            │                                      │
            │ remote_write                         │ remote_write
            │                                      │
┌───────────┴───────────┐              ┌───────────┴───────────┐
│   REGIONAL EU-WEST    │              │   REGIONAL US-EAST    │
│   (Amsterdam)         │              │   (Virginia)          │
│                       │              │                       │
│  ┌─────────────────┐  │              │  ┌─────────────────┐  │
│  │   Prometheus    │  │              │  │   Prometheus    │  │
│  │   (Collector)   │  │              │  │   (Collector)   │  │
│  │                 │  │              │  │                 │  │
│  │  • Scrapes local│  │              │  │  • Scrapes local│  │
│  │    nodes (pull) │  │              │  │    nodes (pull) │  │
│  │  • Receives     │  │              │  │  • Receives     │  │
│  │    agent pushes │  │              │  │    agent pushes │  │
│  │  • Thanos       │  │              │  │  • Thanos       │  │
│  │    sidecar      │  │              │  │    sidecar      │  │
│  └─────────────────┘  │              │  └─────────────────┘  │
│          ▲            │              │          ▲            │
└──────────┼────────────┘              └──────────┼────────────┘
           │                                      │
           │ Pushgateway / gRPC                   │ Pushgateway / gRPC
           │                                      │
    ┌──────┴──────┐    ┌───────────┐       ┌──────┴──────┐    ┌───────────┐
    │  Node 1     │    │  Node 2   │       │  Node 3     │    │  Node 4   │
    │ (Amsterdam) │    │ (London)  │       │ (Virginia)  │    │ (Texas)   │
    │             │    │           │       │             │    │           │
    │ ┌─────────┐ │    │ ┌─────────┐│       │ ┌─────────┐ │    │ ┌─────────┐│
    │ │netown-  │ │    │ │netown-  ││       │ │netown-  │ │    │ │netown-  ││
    │ │agent v2 │ │    │ │agent v2 ││       │ │agent v2 │ │    │ │agent v2 ││
    │ │(Go)     │ │    │ │(Go)     ││       │ │(Go)     │ │    │ │(Go)     ││
    │ └─────────┘ │    │ └─────────┘│       │ └─────────┘ │    │ └─────────┘│
    └─────────────┘    └─────────────┘       └─────────────┘    └─────────────┘
           │                  │                    │                  │
           └──────────────────┴────────────────────┴──────────────────┘
                                   ▼
                    ┌─────────────────────────┐
                    │   REGIONAL ASIA-PACIFIC │
                    │   (Singapore)           │
                    │                         │
                    │  ┌─────────────────┐    │
                    │  │   Prometheus    │    │
                    │  └─────────────────┘    │
                    │          ▲              │
                    └──────────┼──────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌──────────┐     ┌──────────┐     ┌──────────┐
        │ Node 5   │     │ Node 6   │     │ Node 7   │
        │(Singapore│     │ (Tokyo)  │     │ (Sydney) │
        └──────────┘     └──────────┘     └──────────┘
```

---

## 4. Component Breakdown

### 4.1 Node Agent (netown-agent v2)

**Why Go, not Bash:**
| Concern | Bash | Go |
|---------|------|-----|
| Binary size | N/A (source) | ~15MB single binary |
| Cross-platform | Linux only | Linux, macOS, Windows, ARM64 |
| Error handling | Fragile | Structured, recoverable |
| Resource usage | ~20MB (shell + tools) | <50MB RAM, <1% CPU |
| Distribution | Manual install | Auto-update, package managers |
| Buffering | None (fails on disconnect) | Local queue, retry logic |

**Agent Specifications:**
```yaml
agent:
  version: "2.0.0"
  binary_size: "15MB"
  ram_budget: "<50MB"
  cpu_budget: "<1% of 1 core"
  
  transport:
    protocol: "gRPC over HTTP/2"
    fallback: "HTTPS/JSON"
    compression: "zstd"
    
  push_interval:
    default: "30s"
    minimum: "10s"
    maximum: "300s"
    
  buffering:
    max_local_queue: 1000 messages
    max_retry_attempts: 10
    retry_backoff: exponential (100ms → 30s)
    
  auto_discovery:
    node_types: ["geth", "erigon", "XDC"]
    detection_method: "process + port scanning"
    
  updates:
    mechanism: "self-update via API"
    channel: "stable|beta|edge"
    auto_restart: true
```

**Metrics Collected:**
| Category | Metrics | Source |
|----------|---------|--------|
| XDC Node | block_height, sync_status, peers_count, tx_pool_size, is_masternode | RPC (8545) |
| System | cpu_percent, mem_used, disk_free, network_io, load_average | node_exporter or /proc |
| Network | peer_latency, port_30303_open, public_ip, geo_location | External checks |
| Agent | uptime, version, last_successful_push, queue_depth | Self-reported |

### 4.2 Regional Collectors (3-5 Worldwide)

**Regional Distribution:**
| Region | Location | Coverage | Estimated Nodes |
|--------|----------|----------|-----------------|
| EU-West | Amsterdam | Europe, Africa, Middle East | 150 |
| US-East | Virginia | East Coast US, South America | 120 |
| Asia-Pacific | Singapore | Asia, Australia | 100 |
| US-West | California | West Coast US, Pacific | 30 (Phase 3) |

**Collector Specs (per region):**
```yaml
regional_collector:
  prometheus:
    retention_local: "2h"  # Short-term, forwarded to central
    scrape_interval: "15s"
    scrape_targets:
      - local_nodes_that_allow_pull
      - pushgateway_for_agent_data
      
  thanos_sidecar:
    upload_interval: "30s"
    object_storage: "S3/MinIO"
    
  resources:
    cpu: "4 cores"
    ram: "8GB"
    disk: "100GB SSD"
    network: "1Gbps"
    
  ha:
    mode: "active-passive"
    failover: "automatic (keepalived)"
```

### 4.3 Message Queue (NATS)

**Why NATS over Kafka:**
| Factor | NATS | Kafka |
|--------|------|-------|
| Complexity | Single binary | ZooKeeper + brokers |
| Resource usage | 100MB RAM | 4GB+ RAM |
| Throughput | 2M+ msg/s | 1M+ msg/s |
| Learning curve | Low | High |
| Maturity for IoT | Excellent | Good |
| Self-hosted ops | Simple | Complex |

**NATS Configuration:**
```yaml
nats_server:
  version: "2.10.x"
  clustering: "3-node cluster for HA"
  
  streams:
    heartbeats:
      retention: "limits"
      max_msgs: 1000000
      max_age: "1h"
      replication: 3
      
    metrics:
      retention: "limits"
      max_msgs: 5000000
      max_age: "24h"
      replication: 3
      
  consumers:
    api_workers:
      durable_name: "fleet-api"
      ack_policy: "explicit"
      max_deliver: 3
      backoff: [1s, 5s, 30s]
```

### 4.4 Central API (XDCNetOwn API v2)

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer (nginx)                     │
│              SSL termination, rate limiting                  │
└─────────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   API Instance  │ │   API Instance  │ │   API Instance  │
│       #1        │ │       #2        │ │       #N        │
│                 │ │                 │ │                 │
│  ┌───────────┐  │ │  ┌───────────┐  │ │  ┌───────────┐  │
│  │ HTTP API  │  │ │  │ HTTP API  │  │ │  │ HTTP API  │  │
│  │ (REST)    │  │ │  │ (REST)    │  │ │  │ (REST)    │  │
│  └───────────┘  │ │  └───────────┘  │ │  └───────────┘  │
│  ┌───────────┐  │ │  ┌───────────┐  │ │  ┌───────────┐  │
│  │ WebSocket │  │ │  │ WebSocket │  │ │  │ WebSocket │  │
│  │ (SSE)     │  │ │  │ (SSE)     │  │ │  │ (SSE)     │  │
│  └───────────┘  │ │  └───────────┘  │ │  └───────────┘  │
│  ┌───────────┐  │ │  ┌───────────┐  │ │  ┌───────────┐  │
│  │ NATS      │  │ │  │ NATS      │  │ │  │ NATS      │  │
│  │ Consumer  │  │ │  │ Consumer  │  │ │  │ Consumer  │  │
│  └───────────┘  │ │  └───────────┘  │ │  └───────────┘  │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

**Key Design Decisions:**
- **Stateless:** Any instance can handle any request
- **Queue Consumer:** API instances consume from NATS, not direct HTTP from agents
- **SSE not WebSocket:** Server-Sent Events for real-time dashboard (simpler, auto-reconnect)
- **Rate Limiting:** Per-API-key limits (1000 req/min default)

### 4.5 Storage Layer

#### PostgreSQL (Fleet State)
```sql
-- Estimated size at 400 nodes
TABLE nodes           -- ~2MB (400 rows × 5KB)
TABLE incidents       -- ~100MB (10K incidents × 10KB)
TABLE alerts          -- ~50MB (5K alert configs)
TABLE masternodes     -- ~500KB (108 masternodes)
TABLE users           -- ~1MB (100 users)
TABLE api_keys        -- ~100KB
                      -- TOTAL: ~150MB
```

#### TimescaleDB (Time-Series Metrics)
```yaml
timescaledb:
  hypertables:
    metrics:
      partition_by: time
      chunk_interval: "1 day"
      retention: "90 days"
      compression: enabled (after 7 days)
      
  sizing:
    # 400 nodes × 50 metrics × 2 samples/min = 40K points/min
    # 40K × 60 × 24 = 57.6M points/day
    # 57.6M × 90 days = 5.2B points
    # Compressed: ~2GB/day × 90 = ~180GB
    estimated_storage: "200GB at 400 nodes"
    growth_rate: "~2GB/day"
    
  indexes:
    - (time DESC, node_id)
    - (node_id, metric_name, time DESC)
```

#### Redis (Cache & Real-time)
```yaml
redis:
  use_cases:
    last_seen: "node_id -> timestamp"
    rate_limits: "api_key -> counter (sliding window)"
    sessions: "session_id -> user_data"
    real_time_state: "fleet:snapshot -> compressed JSON"
    
  memory_estimate: "~1GB at 400 nodes"
  persistence: "AOF every second"
  replication: "1 replica for HA"
```

#### S3/MinIO (Object Storage)
```yaml
object_storage:
  use_cases:
    - log_archives
    - agent_binary_releases
    - dashboard_snapshots
    - backup_exports
    
  estimated_size: "~50GB/month"
  retention_policy: "1 year"
```

### 4.6 Dashboard (Next.js 14 — Enhanced)

**Technology Stack:**
| Layer | Technology | Reason |
|-------|------------|--------|
| Framework | Next.js 14 | Already built, SSR + API routes |
| Styling | Tailwind CSS | Already using |
| Charts | Recharts + D3 | SVG-based, lightweight |
| Maps | Leaflet + OpenStreetMap | No API key needed |
| Real-time | Server-Sent Events | Simpler than WebSockets |
| Tables | TanStack Table | Virtual scrolling |

**Performance Targets:**
- First Contentful Paint: <1.5s
- Time to Interactive: <3s
- 95th percentile API latency: <200ms
- Supports 100+ concurrent dashboard users

---

## 5. Node Detail Dashboard

Each node's detail page (`/nodes/[id]`) provides comprehensive observability:

### Information Architecture
```
┌─────────────────────────────────────────────────────────────────────┐
│  Node: xdc-mainnet-01 │ Amsterdam │ ● Online │ Version: v2.4.0     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  SYNC STATUS     │  │  BLOCK HEIGHT    │  │  PEERS           │  │
│  │  ████████████░░░ │  │  89,234,567      │  │  23 healthy      │  │
│  │  98.5% synced    │  │  +12 behind head │  │  2 unhealthy     │  │
│  │  ETA: 2h 15m     │  │  Last block: 30s │  │  Port 30303: ✓   │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  UPTIME GRAPH (30 days)                                       │  │
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░  │  │
│  │  99.2% uptime │ 2 incidents │ Last incident: 3 days ago       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────┐  ┌──────────────────────┐                │
│  │  SYSTEM RESOURCES    │  │  CONSENSUS (MN only) │                │
│  │  CPU: 34% ████░░░░░░ │  │  Status: Active      │                │
│  │  RAM: 12GB/32GB ████ │  │  Stake: 10M XDC      │                │
│  │  Disk: 450GB/1TB ████│  │  Sign rate: 99.8%    │                │
│  │  Net I/O: 45MB/s in  │  │  Voters: 1,247       │                │
│  │           12MB/s out │  │  Rewards (24h): 142  │                │
│  └──────────────────────┘  └──────────────────────┘                │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  PEER LIST                                                    │  │
│  │  ┌──────────────┬──────────┬────────┬──────────┬────────────┐ │  │
│  │  │ Enode        │ Location │ Latency│ Port Open│ Version    │ │  │
│  │  ├──────────────┼──────────┼────────┼──────────┼────────────┤ │  │
│  │  │ 0xabc...123  │ London   │ 12ms   │ ✓        │ v2.4.0     │ │  │
│  │  │ 0xdef...456  │ Berlin   │ 24ms   │ ✓        │ v2.3.1     │ │  │
│  │  │ ...          │ ...      │ ...    │ ...      │ ...        │ │  │
│  │  └──────────────┴──────────┴────────┴──────────┴────────────┘ │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  LOG VIEWER (last 1000 lines, searchable)                     │  │
│  │  [Filter: WARN]                                               │  │
│  │  2026-02-11 14:23:12 WARN  Falling behind on block processing │  │
│  │  2026-02-11 14:22:45 INFO  Imported new chain segment         │  │
│  │  ...                                                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  INCIDENT HISTORY                                             │  │
│  │  [2026-02-08] Node offline (45 min) - Network partition      │  │
│  │  [2026-01-15] High latency (2h) - Disk I/O saturation        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  [Restart Node]  [Update Agent]  [Add Peers]  [Export Report]      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Alerting Architecture

### Alert Levels
| Level | Trigger | Notification | Auto-escalation |
|-------|---------|--------------|-----------------|
| INFO | Node version behind | Dashboard only | No |
| WARN | Sync falling behind (>50 blocks) | Telegram, Slack | No |
| CRITICAL | Node offline (>5 min) | All channels + PagerDuty | Yes (15 min) |
| EMERGENCY | Multiple masternodes down | PagerDuty + Phone call | Yes (5 min) |

### Alert Routing
```yaml
alert_routing:
  by_node_type:
    masternode:
      - pagerduty: "xdc-mn-oncall"
      - telegram: "-1001234567890"
    rpc_node:
      - slack: "#rpc-alerts"
      - telegram: "-1001234567890"
    bootnode:
      - pagerduty: "xdc-network-oncall"
      - telegram: "-1001234567890"
      
  by_region:
    eu-west:
      slack: "#xdc-eu-alerts"
    us-east:
      slack: "#xdc-us-alerts"
    asia-pacific:
      slack: "#xdc-apac-alerts"
```

### Anomaly Detection
Beyond static thresholds:
```python
# Pseudo-code for anomaly detection
class AnomalyDetector:
    def detect(self, metric_history):
        # Statistical anomaly (Z-score > 3)
        if z_score(current, history) > 3:
            return Alert.ANOMALY
            
        # Trend detection (linear regression)
        if trend_slope(history, hours=6) < -0.5:
            return Alert.DEGRADING
            
        # Peer anomaly (sudden drop)
        if peer_count_drop(current, previous) > 50%:
            return Alert.PEER_ISSUE
```

---

## 7. Scale Numbers

### Throughput Calculations

#### Steady State (400 nodes)
```
Heartbeats: 400 nodes × 1/30s = 13.33 req/s
Metrics:    400 nodes × 50 metrics × 2/min = 40K points/min = 667 points/s
API calls:  100 dashboard users × 1 req/5s = 20 req/s
            + automation/webhooks = 10 req/s
Total: ~43 req/s sustained
```

#### Peak Load (restart scenario)
```
All 400 nodes restart and push immediately:
Heartbeats: 400 × 1/1s (initial burst) = 400 req/s for ~30s
Metrics:    400 × 50 × 6/min (catch-up) = 2000 points/s
Total: ~600 req/s peak, sustained for 30-60s
```

### Storage Calculations

#### Time-Series (TimescaleDB)
```
Per node per day:
  50 metrics × 2 samples/min × 60 min × 24 hr = 144K samples
  Sample size: ~30 bytes compressed = 4.3MB/node/day
  
At 400 nodes:
  400 × 4.3MB = 1.7GB/day
  90-day retention: 1.7GB × 90 = 153GB
  With indexes/overhead: ~200GB
```

#### PostgreSQL (Fleet State)
```
Per day growth:
  Incidents: ~10/day × 10KB = 100KB
  Heartbeat metadata: 400 × 24hr × 1KB = 9.6MB
  
Annual growth: ~3.5GB
```

#### Redis (Cache)
```
Per node:
  Last seen: 100 bytes
  State cache: 2KB
  
At 400 nodes: ~850MB
With overhead: ~1GB
```

### Query Performance Targets
| Query Type | Target P95 | Max Rows |
|------------|------------|----------|
| Fleet overview | <100ms | 400 |
| Node detail | <50ms | 1 |
| 24h metrics | <200ms | 57,600 |
| 30-day uptime | <500ms | 1,728,000 |
| Global map | <150ms | 400 |

---

## 8. Migration Path

### Phase 1: Current → 50 Nodes (Q1 2026)
**Goal:** Validate queue-based architecture

**Changes:**
- Deploy NATS message queue
- Add TimescaleDB for metrics
- Keep bash agent (patched with retry logic)
- Dashboard: Add SSE, virtual scrolling
- Add basic alerting (Telegram)

**Infrastructure:**
```
VPS 1 (EU): API + PostgreSQL + TimescaleDB + NATS
VPS 2 (EU): Prometheus + Grafana
Cost: ~$100/mo (2× Hetzner CPX31)
```

### Phase 2: 50 → 200 Nodes (Q2 2026)
**Goal:** Regional collectors, Go agent

**Changes:**
- Go agent v2 release (cross-platform binary)
- Regional collectors: EU-West, US-East
- Thanos for global Prometheus view
- Advanced alerting (Slack, PagerDuty)
- World map with node locations

**Infrastructure:**
```
EU-West: API + PostgreSQL + TimescaleDB + NATS cluster (3 nodes)
US-East: Regional Prometheus collector
Asia: Regional Prometheus collector
Central: Thanos Query + MinIO
Cost: ~$500/mo (5× VPS + storage)
```

### Phase 3: 200 → 1000 Nodes (Q3 2026)
**Goal:** Kubernetes, enterprise features

**Changes:**
- Kubernetes deployment (EKS/GKE)
- ClickHouse for high-cardinality analytics
- Auto-scaling API pods
- CDN for dashboard (CloudFlare)
- White-label support
- Mobile app (React Native)

**Infrastructure:**
```
Kubernetes cluster:
  - API: 3-10 pods (HPA)
  - Queue: NATS cluster (3 nodes)
  - DB: Managed PostgreSQL (RDS/Cloud SQL)
  - TSDB: ClickHouse cluster (3 nodes)
  - Regional: 5× Prometheus collectors
Cost: ~$2000/mo
```

---

## 9. Technology Choices (Opinionated)

| Component | Choice | Alternatives Considered | Why |
|-----------|--------|------------------------|-----|
| Agent Language | Go | Rust, Python | Cross-platform, single binary, fast compile |
| Queue | NATS | Kafka, RabbitMQ, Redis Streams | Simple, fast, purpose-built for IoT patterns |
| TSDB | TimescaleDB | ClickHouse, InfluxDB, VictoriaMetrics | PG-compatible (we use PG), compression |
| Cache | Redis | Memcached, Dragonfly | Already using, ecosystem |
| Dashboard | Next.js 14 | Vue, Svelte, pure React | Already built, SSR, API routes |
| Internal Monitoring | Prometheus + Grafana | Datadog, New Relic | Industry standard, cost |
| Container Orchestration | Kubernetes (Phase 3) | Nomad, Docker Swarm | Standard, ecosystem, auto-scaling |
| CI/CD | GitHub Actions | GitLab CI, CircleCI | Already using, free for public repos |
| Object Storage | MinIO (self-hosted) | AWS S3, GCS | Cost control, S3-compatible |
| Load Balancer | nginx / traefik | HAProxy, Envoy | Familiar, good enough |

---

## 10. Security at Scale

### Agent Security
```yaml
agent_security:
  transport:
    protocol: "HTTPS with mTLS"
    certificate_rotation: "30 days"
    
  identity:
    verification: "Ed25519 signed heartbeats"
    enrollment: "API key + signed CSR"
    
  runtime:
    sandbox: "seccomp-bpf profile"
    capabilities: "minimal (CAP_NET_BIND_SERVICE only if needed)"
```

### Network Security
```
Internet
    │
    ▼
┌─────────────────────────────────────────┐
│  CloudFlare / DDoS Protection           │
│  (Rate limiting, WAF)                   │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  Load Balancer (nginx)                  │
│  (SSL termination, header sanitization) │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  DMZ: Regional Collectors               │
│  (No access to internal DBs)            │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│  Internal: API + DB (private subnet)    │
│  (No direct internet access)            │
└─────────────────────────────────────────┘
```

### API Security
- Rate limiting: 1000 req/min per API key
- Authentication: JWT with short expiry (1h)
- Authorization: RBAC (admin, operator, viewer)
- Audit logging: All mutations logged to append-only store

### Compliance Considerations
| Control | Implementation | SOC2 Relevance |
|---------|---------------|----------------|
| Access logs | 1-year retention | CC6.1, CC7.2 |
| Encryption at rest | AES-256 for DB | CC6.7 |
| Encryption in transit | TLS 1.3 minimum | CC6.7 |
| Key rotation | 90-day policy | CC6.2 |
| Backup testing | Monthly restore drills | A1.2 |
| Incident response | Documented runbooks | CC7.4 |

---

## 11. Comparison with Competitors

| Feature | XDCNetOwn | Blockdaemon | Alchemy | Chainstack |
|---------|-----------|-------------|---------|------------|
| **Self-hosted** | ✅ Yes | ❌ SaaS only | ❌ SaaS only | ❌ SaaS only |
| **XDC-native** | ✅ Purpose-built | ❌ Generic | ❌ Generic | ⚠️ Supported |
| **Masternode monitoring** | ✅ Full consensus tracking | ❌ No | ❌ No | ❌ No |
| **Healthy peer list** | ✅ Port-checked, geolocated | ❌ No | ❌ No | ❌ No |
| **Open source agent** | ✅ GitHub | ❌ Closed | ❌ Closed | ❌ Closed |
| **Network topology view** | ✅ Planned | ❌ No | ❌ No | ❌ No |
| **Cost for 400 nodes** | ~$500/mo | ~$40K/mo | N/A (pay per request) | ~$20K/mo |
| **Custom alerting rules** | ✅ Full control | ⚠️ Limited | ⚠️ Limited | ⚠️ Limited |
| **Data sovereignty** | ✅ You own data | ❌ Vendor data | ❌ Vendor data | ❌ Vendor data |

**XDCNetOwn's Differentiation:**
1. **XDC-specific:** Built for XDPoS consensus, not generic EVM
2. **Operator-friendly:** Works behind firewalls, no port opening
3. **Cost-efficient:** 40× cheaper than alternatives at scale
4. **Open source:** Community-owned, extensible
5. **Network health focus:** Peer quality, not just node uptime

---

## 12. Dashboard Features for 400+ Nodes

### Fleet Overview
```
┌─────────────────────────────────────────────────────────────────────┐
│  XDCNetOwn Dashboard                                    [Search...] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  GLOBAL HEALTH SCORE: 94/100                                 │  │
│  │  ████████████████████████████████████████████░░░░░░░░░░░░░   │  │
│  │  376 healthy │ 18 warning │ 6 critical                       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌────────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │  Node Status   │  │  By Region   │  │  By Version  │            │
│  │                │  │              │  │              │            │
│  │  [Pie Chart]   │  │  [Bar Chart] │  │  [Bar Chart] │            │
│  │                │  │              │  │              │            │
│  │  ● Online 376  │  │  EU: 150     │  │  v2.4: 280   │            │
│  │  ▲ Warning 18  │  │  US: 120     │  │  v2.3: 100   │            │
│  │  ✕ Critical 6  │  │  APAC: 100   │  │  v2.2: 20    │            │
│  │  ○ Offline 0   │  │  Other: 30   │  │              │            │
│  └────────────────┘  └──────────────┘  └──────────────┘            │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  🌍 GLOBAL NODE MAP                                          │  │
│  │                                                              │  │
│  │    [Interactive Leaflet Map with 400 markers]               │  │
│  │                                                              │  │
│  │         ● Amsterdam   ● London                              │  │
│  │       ● Frankfurt                                          │  │
│  │              ● Virginia   ● New York                        │  │
│  │     ● Dallas        ● San Francisco                        │  │
│  │                                                              │  │
│  │                    ● Singapore  ● Tokyo                     │  │
│  │                         ● Sydney                            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  🚨 ACTIVE ALERTS (5)                                        │  │
│  │  • [CRIT] Node xdc-eu-45 offline for 12 min (auto-escalated) │  │
│  │  • [WARN] 3 nodes falling behind (>100 blocks)               │  │
│  │  • [WARN] US-East region latency elevated                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Node List (Virtual Scrolled)
```
┌────────────────────────────────────────────────────────────────────────────────┐
│  [Filter ▼] [Region: All ▼] [Status: All ▼] [Version: All ▼]     [Export CSV] │
├────────────────────────────────────────────────────────────────────────────────┤
│  Name           Region   Status  Block      Peers  CPU  Mem  Disk  Last Seen   │
│  ────────────────────────────────────────────────────────────────────────────  │
│  xdc-mainnet-01 eu-west  ● OK    89,234,567  23    34%  12G  450G  2s ago      │
│  xdc-mainnet-02 eu-west  ● OK    89,234,566  25    28%  14G  380G  3s ago      │
│  xdc-mainnet-03 us-east  ▲ WARN  89,234,500  12    67%  28G  200G  5s ago      │
│  xdc-mainnet-04 apac     ● OK    89,234,567  30    22%  10G  500G  1s ago      │
│  ... (396 more rows, virtual scrolled)                                         │
│                                                                                │
│  [◄ Previous] Page 1 of 20 [Next ►]            Showing 1-20 of 400 nodes       │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Masternode Dashboard
```
┌─────────────────────────────────────────────────────────────────────┐
│  MASTERNODES │ 108 of 108 active │ Nakamoto Coefficient: 8          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Total Stake      │  │ Daily Rewards    │  │ Voter Count      │  │
│  │ 1.08B XDC        │  │ 324,000 XDC      │  │ 45,231           │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  MN Performance Leaderboard                                   │  │
│  │  ┌────────┬────────────┬────────────┬──────────┬──────────┐  │  │
│  │  │ Rank   │ Address    │ Sign Rate  │ Stake    │ Voters   │  │  │
│  │  ├────────┼────────────┼────────────┼──────────┼──────────┤  │  │
│  │  │ #1     │ 0xabc...   │ 100%       │ 10M XDC  │ 1,247    │  │  │
│  │  │ #2     │ 0xdef...   │ 99.8%      │ 10M XDC  │ 982      │  │  │
│  │  │ ...    │ ...        │ ...        │ ...      │ ...      │  │  │
│  │  └────────┴────────────┴────────────┴──────────┴──────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Reports
```
┌─────────────────────────────────────────────────────────────────────┐
│  REPORTS                                                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Generate Weekly Report]  [Generate Monthly Report]               │
│                                                                     │
│  Available Reports:                                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  📄 Weekly Fleet Health (Feb 5-11, 2026)                     │  │
│  │     Generated: Feb 11, 2026 │ PDF │ Download                 │  │
│  │     Summary: 99.4% uptime, 2 incidents, 0 SLA breaches       │  │
│  ├──────────────────────────────────────────────────────────────┤  │
│  │  📄 Monthly SLA Report (January 2026)                        │  │
│  │     Generated: Feb 1, 2026 │ PDF │ Download                   │  │
│  │     Summary: 99.7% uptime, 5 incidents, 0 SLA breaches       │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Scheduled Reports:                                                 │
│  ☑ Weekly summary to ops@xdcnetown.com (Mondays 09:00)            │
│  ☑ Monthly SLA to board@xdcnetown.com (1st of month)              │
│  ☐ Daily digest (configure)                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Appendix A: API Rate Limits

| Endpoint | Limit | Burst |
|----------|-------|-------|
| POST /v2/heartbeat | 100/min per node | 10 |
| GET /v2/nodes | 1000/min per key | 100 |
| GET /v2/nodes/[id] | 600/min per key | 60 |
| GET /v2/metrics | 300/min per key | 30 |
| WebSocket SSE | 1 connection per user | N/A |

## Appendix B: Capacity Planning

### Node Growth Projection
| Year | Nodes | Storage/Year | Infra Cost/Month |
|------|-------|--------------|------------------|
| 2026 Q1 | 50 | 75GB | $100 |
| 2026 Q3 | 200 | 300GB | $500 |
| 2027 Q1 | 400 | 600GB | $800 |
| 2027 Q3 | 800 | 1.2TB | $1500 |
| 2028 | 1500 | 2.2TB | $2500 |

---

**Document Control**
- Review cycle: Quarterly
- Next review: May 2026
- Approvers: Anil (CTO), Engineering Lead
- Distribution: Engineering team, Operations
