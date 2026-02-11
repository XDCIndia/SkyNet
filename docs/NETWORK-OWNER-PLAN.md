# XDCNetOwn — Network Owner Dashboard
## Plan of Action & Technical Specification

> **Perspective**: You are the founder of XDC Network. You have 108 masternodes, 500+ RPC nodes, 
> and millions of transactions daily. You need ONE dashboard that shows everything — 
> for your board, your DevOps team, and your Twitter audience.

---

## The Problem Today

Network owners currently have:
- Individual node dashboards (one per server) ← **what we built**
- No unified view across ALL nodes
- No historical growth data for investors/social
- No peer topology understanding
- No way to diagnose network-wide issues quickly
- No exportable metrics for social media / presentations

## The Solution: Three Dashboards in One

### 🏢 1. Executive View (CEO/CTO/Board)
*"How is our network doing? Show me in 10 seconds."*

```
┌──────────────────────────────────────────────────────────────────┐
│  XDC Network Health                                    Score: 97 │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │  108/108 │  │  99.97% │  │  2.0s   │  │  12.4M  │           │
│  │  Nodes   │  │  Uptime │  │  Block  │  │  Daily  │           │
│  │  Online  │  │  (30d)  │  │  Time   │  │  TX     │           │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘           │
│                                                                  │
│  📈 Network Growth (Last 12 Months)                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Peers: ████████████████████████████████▓▓▓▓  +340%      │   │
│  │ TX/day: ██████████████████████▓▓▓▓▓▓▓▓▓▓▓▓  +180%      │   │
│  │ Addresses: ████████████████████████████▓▓▓▓  +420%      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  🌍 Node Distribution                    🏆 Top Validators      │
│  ┌────────────────────┐                  ┌─────────────────┐    │
│  │ [World Map with    │                  │ 1. Node-Alpha    │    │
│  │  108 validator     │                  │    99.99% uptime │    │
│  │  dots + 500 RPC    │                  │ 2. Node-Beta     │    │
│  │  node dots]        │                  │    99.98% uptime │    │
│  └────────────────────┘                  └─────────────────┘    │
│                                                                  │
│  [📸 Export for Social] [📊 Download PDF] [📧 Email Report]     │
└──────────────────────────────────────────────────────────────────┘
```

**Key Metrics:**
- Network Health Score (0-100, composite)
- Total nodes online / total registered
- Network uptime (30d, 90d, 365d)
- Average block time (target: 2.0s)
- Daily transactions (with trend)
- Unique addresses (with growth rate)
- Total value locked / market cap
- Masternode count and stake distribution
- Geographic distribution (countries, continents)
- Decentralization index (Nakamoto coefficient)

**Social Export Features:**
- One-click "Network Stats Card" (PNG, branded)
- Weekly auto-generated infographic
- Monthly growth comparison chart
- Milestone celebration cards ("100M blocks!", "500 nodes!")
- Embeddable widget for websites

---

### 🔧 2. DevOps View (Engineering Team)
*"Something's wrong with the network. Show me exactly what, where, and why."*

```
┌──────────────────────────────────────────────────────────────────┐
│  ⚠️ ACTIVE INCIDENTS (2)                          [Last 24h ▼]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🔴 CRITICAL: 3 masternodes missed 5+ consecutive rounds        │
│     Nodes: MN-042, MN-067, MN-091 | Since: 14:23 UTC           │
│     Impact: Epoch 110234 participation dropped to 97.2%         │
│     [View Details] [Run Diagnostics] [Contact Operators]        │
│                                                                  │
│  🟡 WARNING: Block propagation delay spike (avg 450ms → 1.2s)  │
│     Affected: Asia-Pacific region (23 nodes)                    │
│     [View Propagation Map] [Check ISP Status]                   │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📊 Fleet Status Matrix                                          │
│  ┌──────────┬───────┬────────┬───────┬────────┬───────────────┐ │
│  │ Node     │ Block │ Peers  │ CPU   │ Disk   │ Status        │ │
│  ├──────────┼───────┼────────┼───────┼────────┼───────────────┤ │
│  │ MN-001   │ HEAD  │ 45     │ 12%   │ 34%    │ ✅ Healthy    │ │
│  │ MN-002   │ HEAD  │ 38     │ 8%    │ 67%    │ ⚠️ Disk High │ │
│  │ MN-003   │ -5    │ 12     │ 92%   │ 45%    │ 🔴 CPU Crit  │ │
│  │ RPC-001  │ HEAD  │ 50     │ 45%   │ 78%    │ ✅ Healthy    │ │
│  └──────────┴───────┴────────┴───────┴────────┴───────────────┘ │
│  [Filter ▼] [Sort ▼] [Export CSV] [Bulk Actions ▼]              │
│                                                                  │
│  🌐 P2P Topology                        📋 Recent Events       │
│  ┌────────────────────┐                 ┌────────────────────┐  │
│  │ [Force-directed    │                 │ 14:32 MN-042 miss  │  │
│  │  graph showing     │                 │ 14:28 Block 99.2M  │  │
│  │  node connections  │                 │ 14:15 Peer spike   │  │
│  │  with latency      │                 │ 14:01 Version chk  │  │
│  │  color coding]     │                 │ 13:45 Backup done  │  │
│  └────────────────────┘                 └────────────────────┘  │
│                                                                  │
│  🔍 Quick Diagnostics                                            │
│  [Check Sync] [Test P2P] [Verify Consensus] [Network Scan]     │
└──────────────────────────────────────────────────────────────────┘
```

**DevOps Features:**
- **Fleet Status Matrix**: All nodes in one sortable/filterable table
  - Block height (HEAD or blocks behind)
  - Peer count with quality indicator
  - Resource usage (CPU, RAM, Disk, Network)
  - Version, sync mode, uptime
  - One-click SSH / logs / restart
- **Incident Detection**: Auto-detect and categorize issues
  - Sync stalls (block not advancing)
  - Peer drops (sudden decrease)
  - Resource exhaustion (disk/memory/CPU)
  - Consensus failures (missed rounds)
  - Version mismatches
  - Network partitions
- **Root Cause Analysis**: Click incident → get diagnosis
  - Correlated metrics timeline
  - Log snippets from affected nodes
  - Similar past incidents
  - Recommended actions
- **P2P Topology**: Visual network graph
  - Node connections with latency
  - Identify bottlenecks and single points of failure
  - Block propagation paths
  - Geographic routing analysis

---

### 🌍 3. Peer & Network View (Network Health)
*"How decentralized and resilient is our network really?"*

```
┌──────────────────────────────────────────────────────────────────┐
│  🌍 XDC Network Topology                                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  │              [Interactive World Map]                      │   │
│  │                                                          │   │
│  │   🔵 Masternodes (108)   🟢 RPC Nodes (500+)           │   │
│  │   🟡 Archive Nodes (23)  ⚪ Light Nodes (1200+)        │   │
│  │                                                          │   │
│  │   Click node → details, latency, connections             │   │
│  │   Click region → zoom, show cluster                      │   │
│  │                                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  📊 Decentralization Metrics                                     │
│  ┌──────────────┬──────────────┬──────────────┬──────────────┐  │
│  │ Nakamoto     │ Geographic   │ ISP          │ Client       │  │
│  │ Coefficient  │ Distribution │ Diversity    │ Diversity    │  │
│  │     34       │ 42 countries │ 67 providers │ 3 clients    │  │
│  │ (need 35 to  │ 6 continents │ Max 12% by   │ Geth: 85%   │  │
│  │  control 51%)│              │ single ISP   │ Erigon: 15%  │  │
│  └──────────────┴──────────────┴──────────────┴──────────────┘  │
│                                                                  │
│  🔄 Peer Management                                              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Active Peers: 847  │  Avg Latency: 45ms  │  Bandwidth:  │   │
│  │ Inbound: 412       │  p95: 120ms         │  In: 45 MB/s │   │
│  │ Outbound: 435      │  p99: 340ms         │  Out: 52MB/s │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │ Per-Peer Health Table (sortable)                         │   │
│  │ IP        │ Country │ Latency │ Bandwidth │ Score │ Act  │   │
│  │ 149.x.x.x│ DE      │ 12ms    │ 2.4 MB/s  │ 98    │ ⭐  │   │
│  │ 5.x.x.x  │ DE      │ 15ms    │ 1.8 MB/s  │ 95    │ ⭐  │   │
│  │ 38.x.x.x │ US      │ 89ms    │ 0.3 MB/s  │ 42    │ ⚠️  │   │
│  │ [Add Peer] [Remove] [Ban] [Trust] [Optimize]            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  📈 Block Propagation                                            │
│  Time for block to reach 50% of network: 180ms                  │
│  Time for block to reach 95% of network: 890ms                  │
│  Slowest region: South America (avg 1.2s)                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Sources

### What We Collect Per Node
```
Source 1: Prometheus (metrics every 15s)
├── chain_head_block, chain_head_header
├── p2p_peers, p2p_ingress, p2p_egress
├── txpool_pending, txpool_queued
├── system_cpu_*, system_memory_*, system_disk_*
├── rpc_duration_*, rpc_requests
├── eth_db_chaindata_*, trie_memcache_*
└── 332 total native XDC metrics

Source 2: admin_peers RPC (every 30s)
├── Peer IP, port, enode
├── Protocol versions (eth/62, eth/63, eth/100)
├── Client name and version
├── Inbound/outbound direction
└── Geo-location (ip-api.com batch)

Source 3: admin_nodeInfo RPC
├── Enode URL
├── Client version
├── Network ID
├── Genesis hash
└── Protocols supported

Source 4: eth_* RPC
├── Block number, sync status
├── Coinbase address
├── Gas price
└── Chain ID

Source 5: XDPoS-specific
├── Epoch number, round
├── Masternode list
├── Validator set
├── Penalties, rewards
└── Governance proposals
```

### Network-Wide Aggregation
```
Per-Node Data → Central Aggregator → Time-Series DB (ClickHouse)
                                   → Cache (Redis)
                                   → Search (Elasticsearch for logs)

Aggregated Metrics:
├── Network-wide block height consensus
├── Total unique peers across all nodes
├── Geographic distribution
├── Version distribution
├── Average/median block propagation time
├── Consensus participation rate
├── Network throughput (TX/s, blocks/min)
└── Historical trends (hourly, daily, monthly)
```

---

## Implementation Phases

### Phase 1: Multi-Node Aggregator (Week 1-2)
**Goal**: Collect data from multiple nodes into one place

```
New Components:
├── apps/aggregator/          # Node.js service
│   ├── collectors/
│   │   ├── prometheus.ts     # Scrape Prometheus per node
│   │   ├── rpc.ts           # Poll RPC per node
│   │   ├── peers.ts         # Aggregate peer data
│   │   └── geo.ts           # Batch geo-location
│   ├── storage/
│   │   ├── timeseries.ts    # ClickHouse for metrics
│   │   └── cache.ts         # Redis for real-time
│   └── api/
│       ├── fleet.ts         # GET /api/fleet — all nodes
│       ├── network.ts       # GET /api/network — aggregated
│       └── peers.ts         # GET /api/peers/global
│
├── configs/nodes.json        # Node registry
│   [
│     { "id": "mn-001", "name": "Masternode Alpha",
│       "rpc": "http://...", "prometheus": "http://...",
│       "role": "validator", "region": "eu-west" },
│     ...
│   ]
```

### Phase 2: Executive Dashboard (Week 2-3)
**Goal**: Board-ready network overview

```
New Dashboard Pages:
├── /overview                 # Network health score + KPIs
├── /growth                   # Historical trends + social export
├── /validators               # Masternode leaderboard
└── /export                   # PNG/PDF generation
```

### Phase 3: DevOps War Room (Week 3-4)
**Goal**: Fleet management + incident detection

```
New Dashboard Pages:
├── /fleet                    # All nodes matrix
├── /incidents                # Active + historical incidents
├── /diagnostics              # Per-node deep dive
└── /topology                 # P2P network graph

New Services:
├── apps/detector/            # Anomaly detection
│   ├── rules/               # Alert rules engine
│   ├── correlator/          # Cross-node correlation
│   └── notifier/            # Multi-channel alerts
```

### Phase 4: Peer Management (Week 4-5)
**Goal**: Full peer lifecycle management

```
New Features:
├── Peer scoring algorithm
├── Add/remove/ban/trust via UI
├── Geographic optimization suggestions
├── Protocol compatibility matrix
├── Connection quality monitoring
└── Automated peer rotation
```

### Phase 5: Social & Reporting (Week 5-6)
**Goal**: Auto-generated content for growth marketing

```
New Features:
├── Weekly stats infographic generator
├── Milestone detection + celebration cards
├── Embeddable widgets for websites
├── API for third-party integrations
├── Discord/Telegram bot for stats
└── PDF board report generator
```

---

## API Specification

### Fleet API
```
GET  /api/v1/fleet                    # All registered nodes
GET  /api/v1/fleet/:nodeId            # Single node details
GET  /api/v1/fleet/:nodeId/metrics    # Node metrics history
GET  /api/v1/fleet/:nodeId/peers      # Node's peer list
GET  /api/v1/fleet/:nodeId/logs       # Node log stream
POST /api/v1/fleet/:nodeId/action     # Restart, upgrade, etc.
```

### Network API (Public)
```
GET  /api/v1/network/health           # Health score + summary
GET  /api/v1/network/stats            # Current network stats
GET  /api/v1/network/growth           # Historical growth data
GET  /api/v1/network/validators       # Validator performance
GET  /api/v1/network/peers            # Global peer map
GET  /api/v1/network/topology         # Network graph data
GET  /api/v1/network/propagation      # Block propagation stats
```

### Social API
```
GET  /api/v1/social/card/weekly       # Weekly stats PNG
GET  /api/v1/social/card/monthly      # Monthly growth PNG
GET  /api/v1/social/card/milestone    # Latest milestone PNG
GET  /api/v1/social/embed/:widget     # Embeddable widget HTML
GET  /api/v1/social/report/pdf        # Board report PDF
```

---

## Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Dashboard | Next.js 14 + Fira Sans | SSR, fast, React ecosystem |
| Charts | ECharts + SVG | World maps + lightweight gauges |
| Aggregator | Node.js + Fastify | Low latency, TypeScript |
| Time-Series DB | ClickHouse | Handles billions of metrics |
| Cache | Redis | Real-time peer/block data |
| Search | Elasticsearch | Log search + analysis |
| Image Gen | Puppeteer / Satori | Social card PNG generation |
| PDF | React-PDF | Board report generation |
| P2P Crawler | Go | Discover all network nodes |
| Alerts | Node.js | Rule engine + multi-channel |

---

## Success = Network Growth Visible to Everyone

When this is done:
1. **CTO** opens net.xdc.network → sees 97/100 health score, 108/108 nodes
2. **DevOps** gets paged → opens /fleet → sees MN-042 is 5 blocks behind → clicks → sees "disk 98% full" → clicks "Clear Pruned Data" → fixed in 30 seconds
3. **Marketing** goes to /export → downloads weekly growth card → posts on Twitter → "XDC Network: 99.97% uptime, 42 countries, 12.4M daily transactions 🚀"
4. **Investor** sees embeddable widget on xdc.network → real-time block counter, node count, TX volume

*This is how you own a network.*
