# XDC SkyNet - Architecture Overview

## System Architecture

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
│  ┌─────────────────────────────────────────────────────────────┐        │
│  │                    External Integrations                     │        │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │        │
│  │  │  XDC Nodes  │  │ XDC Network │  │   Notification      │  │        │
│  │  │  (Heartbeat)│  │  (RPC/API)  │  │   (Email/SMS/Slack) │  │        │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │        │
│  └─────────────────────────────────────────────────────────────┘        │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Heartbeat Flow

```
XDC Node (SkyOne Agent)
    ↓ POST /api/v1/nodes/heartbeat
API Gateway (Auth + Rate Limit)
    ↓
Node Service (Validation)
    ↓
PostgreSQL (Store metrics)
    ↓
Alert Service (Check thresholds)
    ↓
Notification Service (Send alerts)
```

### Dashboard Flow

```
User Browser
    ↓ GET /api/v1/fleet/status
API Gateway (Auth)
    ↓
Node Service (Query)
    ↓
PostgreSQL (Fetch data)
    ↓
Dashboard (Render)
```

## Database Schema

### Core Tables

```sql
-- Node registry
CREATE TABLE skynet.nodes (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  role VARCHAR(50),
  client_type VARCHAR(50),
  created_at TIMESTAMP,
  last_seen TIMESTAMP
);

-- Time-series metrics
CREATE TABLE skynet.node_metrics (
  id BIGSERIAL PRIMARY KEY,
  node_id UUID REFERENCES nodes(id),
  block_height BIGINT,
  peer_count INT,
  cpu_percent FLOAT,
  memory_percent FLOAT,
  disk_percent FLOAT,
  collected_at TIMESTAMP
);

-- Incidents
CREATE TABLE skynet.incidents (
  id SERIAL PRIMARY KEY,
  node_id UUID REFERENCES nodes(id),
  type VARCHAR(50),
  severity VARCHAR(20),
  title VARCHAR(255),
  status VARCHAR(20),
  created_at TIMESTAMP
);
```

### Indexing Strategy

```sql
-- Time-series queries
CREATE INDEX idx_metrics_node_time ON node_metrics(node_id, collected_at DESC);

-- Incident queries
CREATE INDEX idx_incidents_node_status ON incidents(node_id, status);

-- Fleet queries
CREATE INDEX idx_nodes_active ON nodes(is_active) WHERE is_active = true;
```

## Authentication Architecture

### API Key Types

1. **Master API Keys**: Full access, configured via environment
2. **Node API Keys**: Per-node access, stored in database
3. **Dashboard Keys**: Read-only access for dashboard

### Authentication Flow

```
Request → Authorization Header
    ↓
Extract Bearer Token
    ↓
Validate against:
  - Master keys (env)
  - Node keys (database)
    ↓
Return permissions
```

## Alert System Architecture

### Alert Pipeline

```
Heartbeat Received
    ↓
Check Thresholds
    ↓
Create Incident (if triggered)
    ↓
Evaluate Alert Rules
    ↓
Send Notifications
    ↓
Update Alert History
```

### Notification Channels

- **Email**: SMTP integration
- **Telegram**: Bot API
- **Slack**: Webhook
- **PagerDuty**: Integration API
- **Webhook**: Custom endpoints

## Masternode Monitoring

### Data Collection

```
XDC Network (RPC)
    ↓
XDPoS_getMasternodesByNumber
    ↓
Fetch Candidate Details
    ↓
Store in masternode_snapshots
```

### Metrics Tracked

- Epoch transitions
- Vote participation
- Blocks produced/missed
- Stake amounts
- Nakamoto coefficient

## Multi-Client Support

### Client Detection

```typescript
// From heartbeat
interface ClientInfo {
  clientType: 'geth' | 'erigon' | 'nethermind' | 'reth';
  clientVersion: string;
  nodeType: 'full' | 'archive' | 'fast' | 'snap';
  syncMode: 'full' | 'fast' | 'snap';
}
```

### Client Comparison

- Side-by-side metrics
- Performance benchmarking
- Resource usage comparison
- Sync speed analysis

## Scalability Architecture

### Current Limitations

1. **Single PostgreSQL instance**: Read replicas needed for scale
2. **Unbounded metrics growth**: Retention policy required
3. **Single WebSocket server**: Redis pub/sub for horizontal scaling

### Scaling Path

```
Phase 1: Read Replicas
  - PostgreSQL read replicas for dashboard queries
  - Connection pooling optimization

Phase 2: Time-Series Optimization
  - TimescaleDB for metrics
  - Automated partitioning

Phase 3: Horizontal Scaling
  - Redis for session/cache
  - WebSocket clustering
  - Load balancer
```

## Security Architecture

### Network Security

- TLS termination at reverse proxy
- Internal Docker network
- No direct database exposure

### API Security

- Bearer token authentication
- Rate limiting per tier
- Input validation (Zod schemas)
- SQL injection prevention (parameterized queries)

### Data Security

- API keys hashed in database
- Connection pooling with limits
- Audit logging for mutations

## Integration Points

### SkyOne Agent Integration

```
SkyOne Agent (per node)
    ↓ HTTPS
SkyNet API
    - Registration
    - Heartbeat
    - Issue reporting
```

### External Notifications

```
Alert Triggered
    ↓
Notification Service
    ↓
Email/SMS/Slack/PagerDuty
```

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | Node.js, Express |
| Database | PostgreSQL 14+ |
| Cache | Redis |
| WebSocket | ws library |
| Validation | Zod |
| Testing | Jest, Playwright |

## Deployment Architecture

### Docker Compose

```yaml
services:
  dashboard:
    build: ./dashboard
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL
      - API_KEYS
  
  postgres:
    image: postgres:14
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
```

### Production Considerations

- PostgreSQL connection pooling
- Redis for distributed rate limiting
- nginx reverse proxy with TLS
- Log aggregation
- Monitoring (Prometheus/Grafana)

## Future Enhancements

### Planned Features

1. **AI Diagnostics**: Machine learning for anomaly detection
2. **Mobile App**: iOS/Android companion
3. **Validator Leaderboard**: Real-time rankings
4. **Cross-Client Testing**: Automated divergence detection
5. **Consensus Health Scoring**: XDPoS 2.0 analysis

## References

- [API Documentation](API.md)
- [Database Schema](docs/ARCHITECTURE.md)
- [Integration Guide](docs/INTEGRATION.md)
- [XDPoS Monitoring](docs/XDPOS-MONITORING.md)
