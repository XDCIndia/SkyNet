# XDCNetOwn (SkyNet) - Architecture

## Overview

XDCNetOwn (SkyNet) is a centralized monitoring dashboard for XDC Network nodes. It provides real-time fleet management, health monitoring, and operational intelligence for XDC node operators.

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        XDCNetOwn Architecture                             │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                      Client Layer                                  │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │   │
│  │  │   Web UI    │  │  Mobile App  │  │   External APIs         │  │   │
│  │  │  (Next.js)  │  │  (React Native)│  │   (REST/WebSocket)     │  │   │
│  │  └──────┬──────┘  └──────┬───────┘  └───────────┬─────────────┘  │   │
│  └─────────┼────────────────┼──────────────────────┼────────────────┘   │
│            │                │                      │                     │
│            ▼                ▼                      ▼                     │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                      API Gateway Layer                             │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐  │   │
│  │  │   Auth      │  │   Rate       │  │   Request Router        │  │   │
│  │  │   (JWT)     │  │   Limiting   │  │   & Load Balancer      │  │   │
│  │  └─────────────┘  └──────────────┘  └─────────────────────────┘  │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                              │                                           │
│                              ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                      Service Layer                                 │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────────┐ │   │
│  │  │  Node     │ │  Alert    │ │  Metrics  │ │   Analytics       │ │   │
│  │  │  Service  │ │  Service  │ │  Service  │ │   Service         │ │   │
│  │  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────────┬─────────┘ │   │
│  └────────┼─────────────┼─────────────┼─────────────────┼───────────┘   │
│           │             │             │                 │               │
│           ▼             ▼             ▼                 ▼               │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                      Data Layer                                    │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────────┐ │   │
│  │  │PostgreSQL │ │   Redis   │ │ClickHouse │ │   S3/MinIO        │ │   │
│  │  │(Metadata) │ │  (Cache)  │ │(Time-Series)│  (Snapshots)      │ │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────────────┘ │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │                      Integration Layer                             │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────────┐ │   │
│  │  │  XDC      │ │  GitHub   │ │  PagerDuty│ │   Slack/Discord   │ │   │
│  │  │  Nodes    │ │  Issues   │ │  OpsGenie │ │   Webhooks        │ │   │
│  │  └───────────┘ └───────────┘ └───────────┘ └───────────────────┘ │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Details

### 1. Client Layer

#### Web Dashboard (Next.js 14)
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS with custom design system
- **State Management**: React Query + Zustand
- **Charts**: Custom SVG-based charts (no external libraries)

Key Features:
- Real-time node monitoring
- Fleet management interface
- Alert management
- Historical analytics

#### Mobile App (React Native)
- Cross-platform iOS/Android
- Push notifications for critical alerts
- Offline mode with sync

#### External APIs
- RESTful API for integrations
- WebSocket for real-time updates
- GraphQL (planned)

### 2. API Gateway Layer

#### Authentication (JWT)
```typescript
// JWT token structure
interface JWTPayload {
  sub: string;        // User ID
  nodeId?: string;    // Associated node (for node tokens)
  role: 'admin' | 'operator' | 'viewer';
  iat: number;
  exp: number;
}
```

#### Rate Limiting
| Endpoint Type | Rate Limit | Window |
|---------------|------------|--------|
| Public API | 60 req | 1 min |
| Authenticated | 120 req | 1 min |
| Heartbeat | 120 req | 1 min |
| WebSocket | 10 msg | 1 sec |

### 3. Service Layer

#### Node Service
- Node registration and management
- Heartbeat processing
- Health score calculation
- Status aggregation

```typescript
interface NodeService {
  register(node: NodeRegistration): Promise<Node>;
  heartbeat(nodeId: string, metrics: NodeMetrics): Promise<void>;
  getStatus(nodeId: string): Promise<NodeStatus>;
  listNodes(filters: NodeFilters): Promise<Node[]>;
  calculateHealthScore(nodeId: string): number;
}
```

#### Alert Service
- Alert generation and routing
- Deduplication logic
- Escalation policies
- Notification delivery

```typescript
interface AlertService {
  createAlert(alert: Alert): Promise<Alert>;
  deduplicate(alert: Alert): boolean;
  route(alert: Alert): Promise<void>;
  resolve(alertId: string): Promise<void>;
}
```

#### Metrics Service
- Time-series data ingestion
- Aggregation and rollups
- Query optimization
- Retention management

#### Analytics Service
- Trend analysis
- Anomaly detection
- Performance reporting
- Capacity planning

### 4. Data Layer

#### PostgreSQL (Metadata)
```sql
-- Core tables
CREATE TABLE nodes (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    host INET NOT NULL,
    role VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    client_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE alerts (
    id UUID PRIMARY KEY,
    node_id UUID REFERENCES nodes(id),
    type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    title TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP
);
```

#### Redis (Cache)
- Session storage
- Rate limiting counters
- Real-time pub/sub
- Cache layer

#### ClickHouse (Time-Series)
```sql
-- Metrics table
CREATE TABLE node_metrics (
    timestamp DateTime64(3),
    node_id UUID,
    block_height UInt64,
    peer_count UInt32,
    cpu_percent Float32,
    memory_percent Float32,
    disk_percent Float32,
    client_type LowCardinality(String)
) ENGINE = MergeTree()
ORDER BY (node_id, timestamp);
```

#### S3/MinIO (Snapshots)
- Configuration backups
- Log archives
- Exported reports

## Data Flow

### Heartbeat Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│   XDC    │────▶│   API    │────▶│  Node    │────▶│   DB     │
│   Node   │     │  Gateway │     │  Service │     │  (PG)    │
└──────────┘     └──────────┘     └────┬─────┘     └──────────┘
                                       │
                                       ▼
                                ┌──────────────┐
                                │  ClickHouse  │
                                │  (Metrics)   │
                                └──────────────┘
                                       │
                                       ▼
                                ┌──────────────┐
                                │  Analytics   │
                                │  (Anomaly    │
                                │  Detection)  │
                                └──────────────┘
```

### Alert Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Metric  │────▶│  Alert   │────▶│ Dedupli- │────▶│  Route   │
│  Trigger │     │  Service │     │  cation  │     │          │
└──────────┘     └──────────┘     └────┬─────┘     └────┬─────┘
                                       │                │
                                       ▼                ▼
                                ┌──────────────┐ ┌──────────────┐
                                │   GitHub     │ │ Notification │
                                │   Issues     │ │  (Slack/PD)  │
                                └──────────────┘ └──────────────┘
```

## Multi-Client Dashboard Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Multi-Client Dashboard                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Unified Metrics Aggregation                 │   │
│  │  ┌─────────┐ ┌─────────┐ ┌───────────┐ ┌─────────────┐  │   │
│  │  │  Geth   │ │  Erigon │ │Nethermind │ │    Reth     │  │   │
│  │  │  :8545  │ │  :8547  │ │  :8558    │ │   :7073     │  │   │
│  │  └────┬────┘ └────┬────┘ └─────┬─────┘ └──────┬──────┘  │   │
│  │       └───────────┴────────────┴──────────────┘          │   │
│  │                          │                               │   │
│  │                          ▼                               │   │
│  │              ┌───────────────────────┐                   │   │
│  │              │   Normalization Layer │                   │   │
│  │              │   (Common Schema)     │                   │   │
│  │              └───────────┬───────────┘                   │   │
│  │                          │                               │   │
│  │                          ▼                               │   │
│  │              ┌───────────────────────┐                   │   │
│  │              │   Comparison Engine   │                   │   │
│  │              │   (Divergence Detect) │                   │   │
│  │              └───────────┬───────────┘                   │   │
│  │                          │                               │   │
│  │                          ▼                               │   │
│  │              ┌───────────────────────┐                   │   │
│  │              │   Dashboard UI        │                   │   │
│  │              │   (Unified View)      │                   │   │
│  │              └───────────────────────┘                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## XDPoS 2.0 Monitoring

### Epoch Tracking

```typescript
interface EpochMetrics {
  epochNumber: number;
  startBlock: number;
  endBlock: number;
  masternodes: string[];
  qcFormationTime: number;  // milliseconds
  timeoutCount: number;
  voteParticipation: number;  // percentage
}
```

### Consensus Health Scoring

```typescript
function calculateConsensusHealth(metrics: EpochMetrics): HealthScore {
  const weights = {
    qcTime: 0.3,
    participation: 0.4,
    timeoutRate: 0.3
  };
  
  const qcScore = Math.max(0, 100 - (metrics.qcFormationTime / 100));
  const participationScore = metrics.voteParticipation;
  const timeoutScore = Math.max(0, 100 - (metrics.timeoutCount * 10));
  
  return {
    overall: qcScore * weights.qcTime + 
             participationScore * weights.participation + 
             timeoutScore * weights.timeoutRate,
    components: { qcScore, participationScore, timeoutScore }
  };
}
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Security Layers                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: Network Security                                       │
│  ├── TLS 1.3 for all connections                                 │
│  ├── API key authentication                                      │
│  └── IP whitelisting for node heartbeats                         │
│                                                                  │
│  Layer 2: Application Security                                   │
│  ├── Input validation                                            │
│  ├── SQL injection prevention                                    │
│  ├── XSS protection                                              │
│  └── CSRF tokens                                                 │
│                                                                  │
│  Layer 3: Data Security                                          │
│  ├── Encryption at rest (AES-256)                                │
│  ├── Encrypted backups                                           │
│  └── Secure key management                                       │
│                                                                  │
│  Layer 4: Access Control                                         │
│  ├── Role-based access control (RBAC)                            │
│  ├── Multi-factor authentication                                 │
│  └── Audit logging                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Scalability Design

### Horizontal Scaling

```
┌─────────────────────────────────────────────────────────────────┐
│                      Load Balancer                               │
│                         (Nginx/ALB)                              │
└─────────────────────────────┬───────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   API Node 1  │    │   API Node 2  │    │   API Node N  │
│   (Next.js)   │    │   (Next.js)   │    │   (Next.js)   │
└───────┬───────┘    └───────┬───────┘    └───────┬───────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │   Redis Cluster   │
                    │   (Session/Cache) │
                    └───────────────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  PostgreSQL       │
                    │  (Primary-Replica)│
                    └───────────────────┘
```

### Database Sharding Strategy

```sql
-- Shard by node_id for time-series data
CREATE TABLE node_metrics_shard_0 (...) WHERE node_id % 4 = 0;
CREATE TABLE node_metrics_shard_1 (...) WHERE node_id % 4 = 1;
CREATE TABLE node_metrics_shard_2 (...) WHERE node_id % 4 = 2;
CREATE TABLE node_metrics_shard_3 (...) WHERE node_id % 4 = 3;
```

## Deployment Patterns

### Docker Compose (Development)

```yaml
version: '3.8'
services:
  api:
    build: ./backend
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/skynet
      - REDIS_URL=redis://redis:6379
  
  dashboard:
    build: ./frontend
    ports:
      - "3005:3005"
  
  postgres:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
  
  clickhouse:
    image: clickhouse/clickhouse-server:latest
    volumes:
      - clickhouse_data:/var/lib/clickhouse
```

### Kubernetes (Production)

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: skynet-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: skynet-api
  template:
    metadata:
      labels:
        app: skynet-api
    spec:
      containers:
      - name: api
        image: xdcnetown/api:latest
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: skynet-secrets
              key: database-url
```

## Related Documentation

- [API.md](./API.md) - API reference
- [DASHBOARD.md](./DASHBOARD.md) - Dashboard features
- [ALERTS.md](./ALERTS.md) - Alert configuration
- [METRICS.md](./METRICS.md) - Metrics collection
- [XDPOS2-MONITORING.md](./XDPOS2-MONITORING.md) - XDPoS 2.0 monitoring
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment guide
