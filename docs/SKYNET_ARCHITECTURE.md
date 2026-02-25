# XDC SkyNet - Architecture Overview

**Version:** 1.0  
**Date:** February 25, 2026  
**Project:** XDC SkyNet (XDCNetOwn)

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Data Model](#2-data-model)
3. [API Design](#3-api-design)
4. [Real-time Updates](#4-real-time-updates)
5. [Alert System](#5-alert-system)
6. [Security Architecture](#6-security-architecture)
7. [Scalability](#7-scalability)

---

## 1. System Architecture

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

---

## 2. Data Model

### 2.1 Core Tables

```sql
-- Registered nodes (fleet)
CREATE TABLE skynet.nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  host VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('masternode','fullnode','archive','rpc')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Time-series metrics (collected every 30s)
CREATE TABLE skynet.node_metrics (
  id BIGSERIAL PRIMARY KEY,
  node_id UUID REFERENCES skynet.nodes(id) ON DELETE CASCADE,
  block_height BIGINT,
  sync_percent REAL,
  peer_count INT,
  cpu_percent REAL,
  memory_percent REAL,
  disk_percent REAL,
  client_type VARCHAR(50),
  client_version VARCHAR(200),
  chain_data_size BIGINT,
  database_size BIGINT,
  collected_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_metrics_node_time ON skynet.node_metrics(node_id, collected_at DESC);

-- Incidents (auto-detected + manual)
CREATE TABLE skynet.incidents (
  id BIGSERIAL PRIMARY KEY,
  node_id UUID REFERENCES skynet.nodes(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('critical','warning','info')),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active',
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Masternode snapshots
CREATE TABLE skynet.masternode_snapshots (
  id BIGSERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL,
  status VARCHAR(20) NOT NULL,
  stake_xdc NUMERIC(30,2),
  voter_count INT DEFAULT 0,
  epoch INT,
  round INT,
  block_number BIGINT,
  collected_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.2 Entity Relationships

```
┌─────────────┐       ┌─────────────────┐       ┌──────────────┐
│    nodes    │◄──────┤  node_metrics   │       │  incidents   │
├─────────────┤       ├─────────────────┤       ├──────────────┤
│ id (PK)     │       │ id (PK)         │       │ id (PK)      │
│ name        │       │ node_id (FK)    │       │ node_id (FK) │
│ host        │       │ block_height    │       │ type         │
│ role        │       │ peer_count      │       │ severity     │
│ is_active   │       │ cpu_percent     │       │ status       │
└─────────────┘       │ collected_at    │       └──────────────┘
                      └─────────────────┘
                              │
                              ▼
                      ┌─────────────────┐
                      │ peer_snapshots  │
                      ├─────────────────┤
                      │ id (PK)         │
                      │ node_id (FK)    │
                      │ peer_enode      │
                      │ remote_ip       │
                      │ collected_at    │
                      └─────────────────┘
```

---

## 3. API Design

### 3.1 V1 API (Authenticated)

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/v1/nodes/register` | POST | Register new node | Bearer |
| `/api/v1/nodes/heartbeat` | POST | Metrics push | Bearer |
| `/api/v1/nodes/{id}/status` | GET | Node status | Bearer |
| `/api/v1/fleet/status` | GET | Fleet overview | Bearer |
| `/api/v1/masternodes` | GET | Masternode list | Bearer |
| `/api/v1/network/epoch` | GET | Epoch info | Bearer |
| `/api/v1/issues/report` | POST | Report issue | Bearer |

### 3.2 Request/Response Examples

```bash
# Register node
POST /api/v1/nodes/register
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "name": "xdc-node-01",
  "host": "https://rpc.my-node.example.com",
  "role": "masternode"
}

# Response
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "xdc-node-01",
    "apiKey": "xdc_abc123..."
  }
}
```

```bash
# Heartbeat
POST /api/v1/nodes/heartbeat
Authorization: Bearer NODE_API_KEY
Content-Type: application/json

{
  "nodeId": "550e8400-e29b-41d4-a716-446655440000",
  "blockHeight": 89234567,
  "syncing": false,
  "peerCount": 25,
  "system": {
    "cpuPercent": 45.2,
    "memoryPercent": 62.1,
    "diskPercent": 78.0
  },
  "clientType": "geth",
  "clientVersion": "v2.6.8-stable"
}

# Response
{
  "success": true,
  "data": {
    "ok": true,
    "commands": []
  }
}
```

---

## 4. Real-time Updates

### 4.1 WebSocket Architecture

```
┌───────────┐     WebSocket      ┌───────────┐
│  Browser  │◄──────────────────►│  WS Server│
│ Dashboard │                    │  (Node.js)│
└───────────┘                    └─────┬─────┘
                                       │
                              ┌────────┴────────┐
                              │  Redis Pub/Sub  │
                              │  (Optional)     │
                              └─────────────────┘
```

### 4.2 Event Types

| Event | Payload | Description |
|-------|---------|-------------|
| `node.update` | Node metrics | Real-time node status |
| `incident.new` | Incident | New incident detected |
| `incident.resolved` | Incident ID | Incident resolved |
| `epoch.change` | Epoch info | New epoch started |

### 4.3 Client Connection

```typescript
// lib/hooks/useWebSocket.ts
import { useEffect, useState } from 'react';

export function useWebSocket(url: string) {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [lastMessage, setLastMessage] = useState<any>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    
    ws.onmessage = (event) => {
      setLastMessage(JSON.parse(event.data));
    };
    
    setSocket(ws);
    
    return () => ws.close();
  }, [url]);

  return { socket, lastMessage };
}
```

---

## 5. Alert System

### 5.1 Alert Engine

```typescript
// lib/alert-engine.ts
interface AlertRule {
  id: number;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  channels: AlertChannel[];
  cooldown_minutes: number;
}

async function evaluateAndNotify(
  incident: Incident
): Promise<void> {
  // Find matching rules
  const rules = await getMatchingRules(incident);
  
  for (const rule of rules) {
    // Check cooldown
    if (await isOnCooldown(rule)) continue;
    
    // Send notifications
    await sendAlert(incident, rule.channels);
    
    // Update cooldown
    await updateCooldown(rule);
  }
}
```

### 5.2 Incident Types

| Type | Severity | Description |
|------|----------|-------------|
| `sync_stall` | warning/high | Block sync stopped |
| `peer_drop` | critical/high | Peer count dropped |
| `disk_critical` | critical | Disk usage > 90% |
| `node_down` | critical | No heartbeat 5+ min |
| `fork_detected` | critical | Block hash divergence |

### 5.3 Notification Channels

- Telegram
- Email (SMTP)
- Slack webhook
- PagerDuty
- Custom webhook

---

## 6. Security Architecture

### 6.1 Authentication

```typescript
// lib/auth.ts
interface AuthResult {
  valid: boolean;
  nodeId?: string;
  permissions?: string[];
  error?: string;
}

async function authenticateRequest(
  req: NextRequest
): Promise<AuthResult> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return { valid: false, error: 'Missing token' };
  }
  
  // Timing-safe comparison
  const apiKey = await lookupApiKey(token);
  if (!apiKey || !timingSafeEqual(token, apiKey.key)) {
    return { valid: false, error: 'Invalid token' };
  }
  
  return {
    valid: true,
    nodeId: apiKey.node_id,
    permissions: apiKey.permissions
  };
}
```

### 6.2 Rate Limiting

| Tier | Limit | Window |
|------|-------|--------|
| Public | 60 req | 1 min |
| Authenticated | 120 req | 1 min |
| Heartbeat | 120 req | 1 min |
| Admin | 300 req | 1 min |

### 6.3 Security Headers

```typescript
// middleware.ts
export function middleware(req: NextRequest) {
  const response = NextResponse.next();
  
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Content-Security-Policy', 'default-src \'self\'');
  
  return response;
}
```

---

## 7. Scalability

### 7.1 Horizontal Scaling

```
┌─────────────────────────────────────────────────────────────┐
│                        Load Balancer                         │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │ API     │  │ API     │  │ API     │
   │ Instance│  │ Instance│  │ Instance│
   │   1     │  │   2     │  │   N     │
   └────┬────┘  └────┬────┘  └────┬────┘
        │            │            │
        └────────────┼────────────┘
                     ▼
            ┌─────────────────┐
            │  Redis Cluster  │
            │  (Pub/Sub)      │
            └─────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
   ┌─────────┐  ┌─────────┐  ┌─────────┐
   │ Primary │  │ Replica │  │ Replica │
   │   PG    │  │   PG    │  │   PG    │
   └─────────┘  └─────────┘  └─────────┘
```

### 7.2 Caching Strategy

| Data | Cache | TTL |
|------|-------|-----|
| Fleet status | Redis | 5s |
| Node metrics | Redis | 10s |
| Masternode list | Redis | 60s |
| API responses | CDN | 300s |

### 7.3 Database Optimization

```sql
-- Partitioning for time-series data
CREATE TABLE node_metrics_y2024m01 PARTITION OF node_metrics
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- Retention policy
DELETE FROM node_metrics WHERE collected_at < NOW() - INTERVAL '90 days';
```

---

## References

- [API Documentation](./API.md)
- [Integration Guide](./INTEGRATION.md)
- [XDPoS Consensus Guide](./XDPOS_CONSENSUS_GUIDE.md)
- [Security Audit](./XDC_EVM_SECURITY_AUDIT.md)

---

*Document maintained by XDC EVM Expert Agent*
