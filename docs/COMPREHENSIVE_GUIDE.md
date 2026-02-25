# XDC SkyNet - Comprehensive Documentation

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Quick Start](#quick-start)
3. [Multi-Client View](#multi-client-view)
4. [Masternode Monitoring](#masternode-monitoring)
5. [Network Topology](#network-topology)
6. [Alert System](#alert-system)
7. [Historical Metrics](#historical-metrics)
8. [Client-Specific Metrics](#client-specific-metrics)
9. [Consensus Health](#consensus-health)
10. [Anomaly Detection](#anomaly-detection)
11. [API Reference](#api-reference)
12. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

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
└──────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Nodes** send heartbeats via the API (every 30s)
2. **API Gateway** validates requests and applies rate limiting
3. **Services** process data and trigger alerts if needed
4. **Data Layer** stores metrics, metadata, and time-series data
5. **Dashboard** queries data for visualization
6. **Notifications** sent via configured channels

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- PostgreSQL 14+ database
- Redis (optional, for rate limiting)

### Installation

```bash
# Clone repository
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

## Multi-Client View

### Supported Clients

| Client | Badge | Metrics Available |
|--------|-------|-------------------|
| Geth-XDC | 🔷 Geth | Full |
| Geth-PR5 | 🟢 PR5 | Full |
| Erigon-XDC | 🔶 Erigon | Full |
| Nethermind-XDC | ⚡ Nethermind | Full |
| Reth-XDC | 🔷 Reth | Partial |

### Client Comparison Dashboard

The Fleet page shows side-by-side comparison:

```
┌─────────────────────────────────────────────────────────────────┐
│ Client Comparison                                               │
├──────────┬──────────┬──────────┬──────────┬─────────────────────┤
│ Metric   │ Geth     │ Erigon   │ Nethermind│ Reth               │
├──────────┼──────────┼──────────┼──────────┼─────────────────────┤
│ Version  │ v2.6.8   │ v2.60.8  │ v1.25.0  │ v0.1.0-alpha       │
│ Height   │ 89234567 │ 89234567 │ 89234567 │ 89234567           │
│ Peers    │ 25       │ 30       │ 22       │ 18                 │
│ CPU      │ 45%      │ 38%      │ 42%      │ 35%                │
│ Memory   │ 12GB     │ 8GB      │ 10GB     │ 6GB                │
│ DB Size  │ 520GB    │ 410GB    │ 350GB    │ 290GB              │
│ Sync     │ 100%     │ 100%     │ 100%     │ 100%               │
└──────────┴──────────┴──────────┴──────────┴─────────────────────┘
```

### Cross-Client Divergence Detection

```typescript
// Detects when different clients report different block hashes
async function detectDivergence(blockNumber: number): Promise<DivergenceAlert | null> {
  const hashes = await Promise.all(
    clients.map(client => 
      getBlockHash(client, blockNumber)
    )
  );
  
  const uniqueHashes = new Set(hashes);
  if (uniqueHashes.size > 1) {
    return {
      blockNumber,
      divergentClients: clients.filter((_, i) => 
        hashes[i] !== majorityHash
      ),
      severity: 'critical'
    };
  }
  
  return null;
}
```

---

## Masternode Monitoring

### Epoch Tracking

```sql
-- Masternode snapshots for historical tracking
CREATE TABLE skynet.masternode_snapshots (
  id BIGSERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('active','standby','penalized')),
  owner VARCHAR(42),
  stake_xdc NUMERIC(30,2),
  voter_count INT DEFAULT 0,
  ethstats_name VARCHAR(200),
  epoch INT,
  round INT,
  block_number BIGINT,
  collected_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Vote Participation

```typescript
interface VoteParticipation {
  masternode: string;
  epoch: number;
  totalBlocks: number;
  votesCast: number;
  participationRate: number;
  missedBlocks: number[];
  avgVoteLatency: number;
}

// Track vote participation per masternode per epoch
async function trackVoteParticipation(
  epoch: number
): Promise<VoteParticipation[]> {
  // Query vote data from nodes
  // Calculate participation metrics
  // Store for historical analysis
}
```

### Missed Block Detection

```typescript
// Detect when a masternode misses their turn to produce a block
async function detectMissedBlocks(
  masternode: string,
  expectedBlocks: number[]
): Promise<number[]> {
  const missed: number[] = [];
  
  for (const blockNumber of expectedBlocks) {
    const producer = await getBlockProducer(blockNumber);
    if (producer !== masternode) {
      missed.push(blockNumber);
    }
  }
  
  return missed;
}
```

### Masternode Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│ Masternode Performance                                          │
├──────────────┬────────┬──────────┬──────────┬───────────────────┤
│ Masternode   │ Status │ Epoch    │ Votes    │ Missed Blocks     │
├──────────────┼────────┼──────────┼──────────┼───────────────────┤
│ 0x1234...    │ Active │ 99234    │ 98%      │ 2                 │
│ 0x5678...    │ Active │ 99234    │ 100%     │ 0                 │
│ 0x9abc...    │ Standby│ 99234    │ N/A      │ N/A               │
│ 0xdef0...    │ Active │ 99234    │ 95%      │ 5                 │
└──────────────┴────────┴──────────┴──────────┴───────────────────┘
```

---

## Network Topology

### Peer Network Visualization

```
┌─────────────────────────────────────────────────────────────────┐
│ Network Topology                                                │
│                                                                 │
│                    ┌──────────┐                                 │
│                    │  Node A  │                                 │
│                    │ (US-East)│                                 │
│                    └────┬─────┘                                 │
│                         │                                       │
│           ┌─────────────┼─────────────┐                        │
│           │             │             │                        │
│     ┌─────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐                 │
│     │  Node B   │ │  Node C   │ │  Node D   │                 │
│     │ (EU-West) │ │ (AP-South)│ │ (US-West) │                 │
│     └───────────┘ └───────────┘ └───────────┘                 │
│                                                                 │
│ Geographic Distribution:                                        │
│ 🇺🇸 US: 45%  🇪🇺 EU: 30%  🇸🇬 APAC: 20%  🌍 Other: 5%          │
└─────────────────────────────────────────────────────────────────┘
```

### Peer Intelligence

```typescript
interface PeerInfo {
  enode: string;
  ip: string;
  port: number;
  clientVersion: string;
  latency: number;
  country: string;
  city: string;
  asn: string;
  direction: 'inbound' | 'outbound';
  score: number;
}

// Geographic distribution analysis
async function analyzeGeographicDistribution(
  peers: PeerInfo[]
): Promise<GeoDistribution> {
  const distribution = {};
  
  for (const peer of peers) {
    const country = peer.country;
    distribution[country] = (distribution[country] || 0) + 1;
  }
  
  return {
    totalPeers: peers.length,
    byCountry: distribution,
    diversity: calculateDiversityScore(distribution)
  };
}
```

---

## Alert System

### Alert Types

| Type | Severity | Description | Auto-Detect |
|------|----------|-------------|-------------|
| `sync_stall` | warning/high | Block sync has stopped | ✅ |
| `peer_drop` | critical/high | Peer count dropped critically | ✅ |
| `disk_critical` | critical/high | Disk usage exceeded threshold | ✅ |
| `rpc_error` | high/medium | RPC endpoint not responding | ✅ |
| `bad_block` | critical | BAD BLOCK detected | ✅ |
| `container_crash` | critical | Node container crashed | ✅ |
| `fork_detected` | critical | Consensus fork detected | ✅ |
| `epoch_transition_failed` | critical | Epoch transition error | ✅ |
| `vote_latency_high` | warning | Vote latency above threshold | ✅ |

### Alert Configuration

```yaml
# Alert thresholds
alerts:
  sync_stall:
    warning_threshold_minutes: 10
    critical_threshold_minutes: 30
    
  peer_drop:
    warning_threshold: 10
    critical_threshold: 5
    
  disk_usage:
    warning_percent: 80
    critical_percent: 90
    
  vote_latency:
    warning_ms: 500
    critical_ms: 1000
    
  qc_formation:
    warning_ms: 2000
    critical_ms: 5000
```

### Notification Channels

```typescript
// Supported notification channels
interface NotificationConfig {
  email?: {
    smtp: string;
    from: string;
    to: string[];
  };
  telegram?: {
    botToken: string;
    chatId: string;
  };
  slack?: {
    webhookUrl: string;
    channel: string;
  };
  pagerduty?: {
    serviceKey: string;
  };
  webhook?: {
    url: string;
    headers: Record<string, string>;
  };
}
```

---

## Historical Metrics

### Data Retention

```sql
-- Automated retention policy
CREATE OR REPLACE FUNCTION skynet.apply_retention_policy()
RETURNS void AS $$
BEGIN
  -- Retain node_metrics for 90 days
  DELETE FROM skynet.node_metrics
  WHERE collected_at < NOW() - INTERVAL '90 days';
  
  -- Retain peer_snapshots for 30 days
  DELETE FROM skynet.peer_snapshots
  WHERE collected_at < NOW() - INTERVAL '30 days';
  
  -- Retain vote_latency for 60 days
  DELETE FROM skynet.vote_latency
  WHERE received_at < NOW() - INTERVAL '60 days';
END;
$$ LANGUAGE plpgsql;

-- Run daily
SELECT cron.schedule('retention-policy', '0 0 * * *', 
  'SELECT skynet.apply_retention_policy()');
```

### Aggregation

```sql
-- Hourly aggregation
CREATE TABLE skynet.node_metrics_hourly (
  hour TIMESTAMPTZ NOT NULL,
  node_id UUID REFERENCES skynet.nodes(id),
  avg_block_height BIGINT,
  max_block_height BIGINT,
  avg_peer_count REAL,
  avg_cpu_percent REAL,
  avg_memory_percent REAL,
  avg_disk_percent REAL,
  PRIMARY KEY (hour, node_id)
);

-- Daily aggregation
CREATE TABLE skynet.node_metrics_daily (
  day DATE NOT NULL,
  node_id UUID REFERENCES skynet.nodes(id),
  avg_block_height BIGINT,
  max_block_height BIGINT,
  avg_peer_count REAL,
  avg_cpu_percent REAL,
  avg_memory_percent REAL,
  avg_disk_percent REAL,
  PRIMARY KEY (day, node_id)
);
```

### Reporting API

```bash
# Get historical metrics for a node
curl "http://localhost:3000/api/v1/nodes/{id}/metrics?from=2026-01-01&to=2026-02-01&granularity=hourly" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Get fleet report
curl "http://localhost:3000/api/v1/fleet/report?period=monthly" \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## Client-Specific Metrics

### Geth-XDC Metrics

```typescript
interface GethMetrics {
  // Database
  chainDataSize: number;
  databaseSize: number;
  ancientDataSize: number;
  
  // Trie
  trieCacheHits: number;
  trieCacheMisses: number;
  
  // P2P
  ingressTraffic: number;
  egressTraffic: number;
  
  // RPC
  rpcRequestsTotal: number;
  rpcRequestsFailed: number;
  rpcDuration: number;
}
```

### Erigon-XDC Metrics

```typescript
interface ErigonMetrics {
  // Stage sync
  stageProgress: Record<string, number>;
  
  // Database (MDBX)
  dbSize: number;
  dbReads: number;
  dbWrites: number;
  
  // Execution
  executionSpeed: number;
  commitTime: number;
}
```

### Nethermind-XDC Metrics

```typescript
interface NethermindMetrics {
  // Database
  dbSize: number;
  stateDbSize: number;
  blocksDbSize: number;
  receiptsDbSize: number;
  
  // Sync
  fastSyncProgress: number;
  pivotNumber: number;
  
  // JSON RPC
  rpcCalls: number;
  rpcErrors: number;
}
```

---

## Consensus Health

### Consensus Health Score

```typescript
// Calculate consensus health score (0-100)
interface ConsensusHealthMetrics {
  avgVoteLatency: number;      // ms
  avgQCFormationTime: number;  // ms
  timeoutRate: number;         // 0-1
  voteParticipation: number;   // 0-1
}

function calculateConsensusHealth(metrics: ConsensusHealthMetrics): number {
  const weights = {
    avgVoteLatency: 0.3,
    avgQCFormationTime: 0.3,
    timeoutRate: 0.25,
    voteParticipation: 0.15
  };
  
  // Lower is better for latency
  const latencyScore = Math.max(0, 100 - (metrics.avgVoteLatency / 10));
  
  // Lower is better for QC formation
  const qcScore = Math.max(0, 100 - (metrics.avgQCFormationTime / 50));
  
  // Lower is better for timeout rate
  const timeoutScore = Math.max(0, 100 - (metrics.timeoutRate * 100));
  
  // Higher is better for participation
  const participationScore = metrics.voteParticipation * 100;
  
  return Math.round(
    latencyScore * weights.avgVoteLatency +
    qcScore * weights.avgQCFormationTime +
    timeoutScore * weights.timeoutRate +
    participationScore * weights.voteParticipation
  );
}
```

### Vote Latency Tracking

```sql
-- Vote latency tracking
CREATE TABLE skynet.vote_latency (
  id BIGSERIAL PRIMARY KEY,
  block_number BIGINT NOT NULL,
  round INT NOT NULL,
  masternode VARCHAR(42) NOT NULL,
  latency_ms INT NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(block_number, masternode)
);

-- QC formation tracking
CREATE TABLE skynet.qc_formation (
  id BIGSERIAL PRIMARY KEY,
  block_number BIGINT NOT NULL,
  round INT NOT NULL,
  formation_time_ms INT NOT NULL,
  votes_count INT NOT NULL,
  timeout_occurred BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Anomaly Detection

### Static Thresholds

```typescript
// Rule-based anomaly detection
const anomalyRules = [
  {
    name: 'sync_stall',
    condition: (metrics) => 
      metrics.blockHeight === metrics.previousBlockHeight &&
      metrics.timeSinceLastBlock > 600, // 10 minutes
    severity: 'high'
  },
  {
    name: 'peer_drop',
    condition: (metrics) => 
      metrics.peerCount < 5,
    severity: 'critical'
  },
  {
    name: 'disk_pressure',
    condition: (metrics) => 
      metrics.diskPercent > 90,
    severity: 'critical'
  }
];
```

### ML-Based Detection (Future)

```typescript
// Time-series anomaly detection using statistical methods
interface AnomalyDetector {
  // Z-score based detection
  detectOutliers(values: number[], threshold: number = 3): number[];
  
  // Seasonal decomposition
  detectSeasonalAnomalies(
    values: number[], 
    period: number
  ): AnomalyPoint[];
  
  // Change point detection
  detectChangePoints(values: number[]): number[];
}
```

---

## API Reference

### Authentication

```http
Authorization: Bearer YOUR_API_KEY
```

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/nodes/register` | POST | Register new node |
| `/api/v1/nodes/heartbeat` | POST | Send heartbeat |
| `/api/v1/nodes/{id}/status` | GET | Get node status |
| `/api/v1/fleet/status` | GET | Get fleet overview |
| `/api/v1/issues/report` | POST | Report issue |
| `/api/v1/issues` | GET | List issues |

### Heartbeat API

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
      "diskPercent": 78.0
    },
    "clientType": "geth",
    "clientVersion": "v2.6.8-stable"
  }'
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

## Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
# Check PostgreSQL connection
psql $DATABASE_URL -c "SELECT 1"

# Check migration status
npm run db:status

# Run pending migrations
npm run db:migrate
```

#### High Memory Usage

```bash
# Check query performance
npm run db:analyze

# Enable query logging
LOG_LEVEL=debug npm run dev
```

#### Slow Dashboard

```bash
# Enable caching
REDIS_URL=redis://localhost:6379 npm run dev

# Check slow queries
npm run db:slow-queries
```

### Diagnostic Commands

```bash
# Health check
curl http://localhost:3000/api/health

# Database status
npm run db:status

# Cache statistics
npm run cache:stats
```

---

## Support

- **Documentation**: https://docs.xdc.network
- **Discord**: https://discord.gg/xdc
- **GitHub Issues**: https://github.com/AnilChinchawale/XDCNetOwn/issues

---

## License

MIT License - see LICENSE file for details.
