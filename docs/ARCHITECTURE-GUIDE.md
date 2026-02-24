# XDC SkyNet - Architecture Overview

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Data Flow](#data-flow)
3. [Database Schema](#database-schema)
4. [API Architecture](#api-architecture)
5. [XDPoS 2.0 Integration](#xdpos-20-integration)
6. [Security Architecture](#security-architecture)
7. [Scaling Architecture](#scaling-architecture)

---

## System Architecture

### High-Level Overview

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

### Component Description

| Component | Technology | Purpose |
|-----------|------------|---------|
| Dashboard | Next.js 14, TypeScript, Tailwind | Web UI for fleet management |
| API Gateway | Node.js, Express | Request routing, auth, rate limiting |
| Node Service | PostgreSQL | Node registry, lifecycle management |
| Alert Service | PostgreSQL + WebSocket | Real-time alerting |
| Analytics | PostgreSQL + Redis | Metrics aggregation, caching |
| Database | PostgreSQL 14+ | Persistent storage |
| Cache | Redis | Rate limiting, session cache |

---

## Data Flow

### Heartbeat Flow

```
┌──────────┐     HTTP POST      ┌──────────┐     INSERT      ┌──────────┐
│  Agent   │ ─────────────────► │   API    │ ──────────────► │   DB     │
│  (Node)  │   /nodes/heartbeat │ Gateway  │   metrics       │          │
└──────────┘                    └──────────┘                 └──────────┘
     │                               │                            │
     │                               ▼                            ▼
     │                        ┌──────────┐                 ┌──────────┐
     │                        │  Alert   │                 │  WebSocket│
     │                        │  Engine  │                 │  Broadcast│
     │                        └──────────┘                 └──────────┘
     │                               │                            │
     │                               ▼                            ▼
     │                        ┌──────────┐                 ┌──────────┐
     │                        │  Notify  │                 │ Dashboard│
     └───────────────────────►│  (if     │                 │ Update   │
                              │  needed) │                 │          │
                              └──────────┘                 └──────────┘
```

### Heartbeat Payload

```typescript
interface HeartbeatPayload {
  nodeId: string;
  blockHeight: number;
  syncing: boolean;
  syncProgress?: number;
  peerCount: number;
  peers: PeerInfo[];
  txPool: { pending: number; queued: number };
  gasPrice: string;
  coinbase: string;
  clientVersion: string;
  clientType: 'geth' | 'erigon' | 'nethermind' | 'reth' | 'XDC';
  isMasternode: boolean;
  nodeType: 'fullnode' | 'masternode' | 'standby';
  ipv4: string;
  ipv6?: string;
  os: {
    type: string;
    release: string;
    arch: string;
    kernel: string;
  };
  system: {
    cpuPercent: number;
    memoryPercent: number;
    diskPercent: number;
    diskUsedGb: number;
    diskTotalGb: number;
  };
  security: {
    score: number;
    issues: string;
  };
  rpcLatencyMs: number;
  enode: string;
  timestamp: string;
}
```

---

## Database Schema

### Core Tables

```sql
-- Node registry
CREATE TABLE nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  host VARCHAR(255),
  role VARCHAR(50) DEFAULT 'fullnode',
  status VARCHAR(50) DEFAULT 'offline',
  client_type VARCHAR(50),
  node_type VARCHAR(50),
  sync_mode VARCHAR(50),
  rpc_url VARCHAR(255),
  api_key VARCHAR(255) UNIQUE,
  location_city VARCHAR(100),
  location_country VARCHAR(10),
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8),
  ipv4 INET,
  ipv6 INET,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_heartbeat_at TIMESTAMPTZ,
  UNIQUE(name)
);

-- Time-series metrics
CREATE TABLE node_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  block_height BIGINT,
  syncing BOOLEAN DEFAULT FALSE,
  sync_progress DECIMAL(5, 2),
  peer_count INTEGER,
  cpu_percent DECIMAL(5, 2),
  memory_percent DECIMAL(5, 2),
  disk_percent DECIMAL(5, 2),
  disk_used_gb DECIMAL(10, 2),
  disk_total_gb DECIMAL(10, 2),
  chain_data_size BIGINT,
  database_size BIGINT,
  rpc_latency_ms INTEGER,
  collected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Peer snapshots
CREATE TABLE peer_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  peer_enode TEXT,
  peer_name VARCHAR(255),
  remote_address INET,
  protocols TEXT[],
  direction VARCHAR(20),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Incidents
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'open',
  diagnostics JSONB,
  solution_description TEXT,
  solution_code TEXT,
  github_issue_url VARCHAR(255),
  occurrence_count INTEGER DEFAULT 1,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Masternode participation
CREATE TABLE masternode_participation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  masternode_address VARCHAR(42) NOT NULL,
  epoch INTEGER NOT NULL,
  total_blocks INTEGER NOT NULL,
  signed_blocks INTEGER NOT NULL,
  participation_rate DECIMAL(5, 2) NOT NULL,
  missed_blocks INTEGER[],
  penalties INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(masternode_address, epoch)
);

-- Epoch tracking
CREATE TABLE epochs (
  epoch_number INTEGER PRIMARY KEY,
  start_block BIGINT NOT NULL,
  end_block BIGINT NOT NULL,
  gap_block BIGINT NOT NULL,
  masternode_count INTEGER NOT NULL,
  qc_formation_time INTEGER,
  transition_status VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API keys
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID REFERENCES nodes(id) ON DELETE CASCADE,
  key_hash VARCHAR(255) NOT NULL,
  scopes TEXT[] DEFAULT '{read,write}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_nodes_status ON nodes(status);
CREATE INDEX idx_nodes_last_heartbeat ON nodes(last_heartbeat_at);
CREATE INDEX idx_metrics_node_time ON node_metrics(node_id, collected_at DESC);
CREATE INDEX idx_metrics_collected ON node_metrics(collected_at);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_node ON incidents(node_id);
CREATE INDEX idx_participation_epoch ON masternode_participation(epoch);
```

---

## API Architecture

### V1 API (Authenticated)

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| /api/v1/nodes/register | POST | Register new node | Master Key |
| /api/v1/nodes/heartbeat | POST | Send heartbeat | Node Key |
| /api/v1/nodes/{id}/status | GET | Get node status | Node Key |
| /api/v1/fleet/status | GET | Fleet overview | Master Key |
| /api/v1/masternodes | GET | List masternodes | Master Key |
| /api/v1/issues/report | POST | Report issue | Node Key |

### Authentication

```typescript
// Bearer token authentication
async function requireAuth(request: Request): Promise<ApiKey> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing authorization header');
  }
  
  const token = authHeader.slice(7);
  const apiKey = await validateApiKey(token);
  
  if (!apiKey) {
    throw new UnauthorizedError('Invalid API key');
  }
  
  return apiKey;
}

// API key generation (cryptographically secure)
import crypto from 'crypto';

function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(32);
  return `xdc-${randomBytes.toString('hex')}`;
}
```

### Rate Limiting

```typescript
// Tiered rate limits
const rateLimits = {
  public: { windowMs: 60 * 1000, maxRequests: 60 },
  authenticated: { windowMs: 60 * 1000, maxRequests: 120 },
  heartbeat: { windowMs: 60 * 1000, maxRequests: 60 },
  write: { windowMs: 60 * 1000, maxRequests: 30 },
  admin: { windowMs: 60 * 1000, maxRequests: 300 },
};
```

---

## XDPoS 2.0 Integration

### Consensus Monitoring

```typescript
// XDPoS 2.0 specific metrics
interface ConsensusMetrics {
  epoch: number;
  epochPosition: number;
  isGapBlock: boolean;
  isEpochBoundary: boolean;
  qcFormationTime: number;  // milliseconds
  voteParticipation: number;  // percentage
  timeoutCount: number;
  viewChanges: number;
  masternodesParticipated: number;
  totalMasternodes: number;
}

// Masternode tracking
interface MasternodeStatus {
  address: string;
  name: string;
  epochParticipation: number;
  missedBlocks: number;
  consecutiveMissed: number;
  lastVoteTime: Date;
  penalties: number;
  rewards: bigint;
  status: 'active' | 'standby' | 'penalized';
}
```

### Epoch Tracking

```sql
-- Epoch information
CREATE TABLE epochs (
  epoch_number INTEGER PRIMARY KEY,
  start_block BIGINT NOT NULL,
  end_block BIGINT NOT NULL,
  gap_block BIGINT NOT NULL,
  masternode_count INTEGER NOT NULL,
  qc_formation_time INTEGER,
  transition_status VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Participation tracking
CREATE TABLE masternode_participation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  masternode_address VARCHAR(42) NOT NULL,
  epoch INTEGER NOT NULL,
  total_blocks INTEGER NOT NULL,
  signed_blocks INTEGER NOT NULL,
  participation_rate DECIMAL(5, 2) NOT NULL,
  missed_blocks INTEGER[],
  penalties INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(masternode_address, epoch)
);
```

### Alerting Rules

```yaml
# XDPoS 2.0 specific alerts
alerts:
  - name: MissedBlock
    condition: missed_blocks > 0
    severity: warning
    message: "Masternode {{.Address}} missed block {{.BlockNumber}}"

  - name: LowParticipation
    condition: participation_rate < 95%
    severity: critical
    message: "Masternode {{.Address}} participation below 95%"

  - name: EpochTransitionDelayed
    condition: transition_time > 30s
    severity: warning
    message: "Epoch {{.Epoch}} transition delayed"

  - name: QCFailed
    condition: qc_formation_time IS NULL
    severity: critical
    message: "QC formation failed at gap block"
```

---

## Security Architecture

### Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                    Security Architecture                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: Network Security                                       │
│  ├── TLS/SSL for all endpoints                                  │
│  ├── Rate limiting (DDoS protection)                            │
│  └── IP allowlisting (optional)                                 │
│                                                                  │
│  Layer 2: Application Security                                   │
│  ├── Bearer token authentication                                │
│  ├── API key validation                                         │
│  ├── CORS restrictions                                          │
│  └── Input validation (Zod)                                     │
│                                                                  │
│  Layer 3: Data Security                                          │
│  ├── API key hashing (bcrypt)                                   │
│  ├── Database encryption at rest                                │
│  └── Audit logging                                              │
│                                                                  │
│  Layer 4: Infrastructure Security                                │
│  ├── Non-root container execution                               │
│  ├── Read-only filesystem                                       │
│  └── Security scanning (Trivy)                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
┌──────────┐                    ┌──────────┐                    ┌──────────┐
│  Client  │ ── POST /register ─►│   API    │ ── INSERT node ──►│    DB    │
│          │                    │ Gateway  │                    │          │
│          │ ◄── nodeId, apiKey │          │ ◄── return data    │          │
└──────────┘                    └──────────┘                    └──────────┘
       │                              │                              │
       │ POST /heartbeat              │                              │
       │ Authorization: Bearer {key}  │                              │
       ▼                              ▼                              │
┌──────────┐                    ┌──────────┐                        │
│  Client  │ ─────────────────►│   API    │ ── SELECT api_key ────►│
│          │                    │ Gateway  │                        │
│          │ ◄── 200 OK/401    │          │ ◄── return key data    │
└──────────┘                    └──────────┘                        │
```

---

## Scaling Architecture

### Current Architecture (3-10 Nodes)

- Single API instance
- PostgreSQL for all data
- Direct agent pushes
- Polling-based dashboard

### Target Architecture (400+ Nodes)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    TARGET: 400+ Node Global Architecture                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         GLOBAL VIEW LAYER                        │   │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐     │   │
│  │   │   Grafana    │  │   Dashboard  │  │   Alert Manager  │     │   │
│  │   └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘     │   │
│  │          │                 │                   │                │   │
│  └──────────┼─────────────────┼───────────────────┼────────────────┘   │
│             │                 │                   │                     │
│             └─────────────────┼───────────────────┘                     │
│                               ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      CENTRAL INFRASTRUCTURE                      │   │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │   │
│  │  │   Thanos/Mimir  │    │   Central API   │    │   Alert     │ │   │
│  │  │   (TSDB Query)  │◄──►│   (Next.js v2)  │◄──►│   Rules     │ │   │
│  │  └────────┬────────┘    └────────┬────────┘    └─────────────┘ │   │
│  │           │                      │                             │   │
│  │  ┌────────┴──────────────────────┴────────┐                     │   │
│  │  │  ┌─────────────┐  ┌─────────────────┐  │                     │   │
│  │  │  │  PostgreSQL │  │   TimescaleDB   │  │                     │   │
│  │  │  │  (Fleet DB) │  │   (Metrics)     │  │                     │   │
│  │  │  └─────────────┘  └─────────────────┘  │                     │   │
│  │  └────────────────────────────────────────┘                     │   │
│  │  ┌─────────────────────────────────────────────────────────┐    │   │
│  │  │              MESSAGE QUEUE (NATS Cluster)                │    │   │
│  │  │  Topics: heartbeats.{region} → metrics.{region}         │    │   │
│  │  └─────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    ▲          ▲          ▲             │
│              ┌─────────────────────┘          │          └─────────────┤
│              │                                 │                        │
│  ┌───────────┴───────────┐        ┌───────────┴───────────┐            │
│  │   REGIONAL EU-WEST    │        │   REGIONAL US-EAST    │            │
│  │  ┌─────────────────┐  │        │  ┌─────────────────┐  │            │
│  │  │   Prometheus    │  │        │  │   Prometheus    │  │            │
│  │  │   (Collector)   │  │        │  │   (Collector)   │  │            │
│  │  └────────┬────────┘  │        │  └────────┬────────┘  │            │
│  │           │           │        │           │           │            │
│  │     ┌─────┴─────┐     │        │     ┌─────┴─────┐     │            │
│  │     │Pushgateway│     │        │     │Pushgateway│     │            │
│  │     └─────┬─────┘     │        │     └─────┬─────┘     │            │
│  │           │           │        │           │           │            │
│  └───────────┼───────────┘        └───────────┼───────────┘            │
│              │                                 │                        │
│    ┌─────────┼─────────┐            ┌─────────┼─────────┐              │
│    ▼         ▼         ▼            ▼         ▼         ▼              │
│ ┌──────┐ ┌──────┐ ┌──────┐      ┌──────┐ ┌──────┐ ┌──────┐           │
│ │Node 1│ │Node 2│ │Node 3│      │Node 4│ │Node 5│ │Node 6│           │
│ │(Go)  │ │(Go)  │ │(Go)  │      │(Go)  │ │(Go)  │ │(Go)  │           │
│ └──────┘ └──────┘ └──────┘      └──────┘ └──────┘ └──────┘           │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Scaling Components

| Component | Current | Target | Solution |
|-----------|---------|--------|----------|
| API | Single | Horizontal | Load balancer + stateless API |
| Database | PostgreSQL | Read replicas | Connection pooling |
| Metrics | PostgreSQL | TimescaleDB | Time-series optimization |
| Queue | None | NATS | Message queue for burst handling |
| Cache | None | Redis | Distributed caching |
| Agents | Bash | Go | Binary agents with buffering |

---

## References

- [XDC Network Documentation](https://docs.xdc.network)
- [XDPoS 2.0 Consensus](https://www.xdc.dev/xdc-foundation/xdpos-2-0-consensus-algorithm)
- [Next.js Documentation](https://nextjs.org/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [TimescaleDB Documentation](https://docs.timescale.com/)
- [NATS Documentation](https://docs.nats.io/)
