# XDCNetOwn (SkyNet) - Metrics Collection and Storage

## Overview

This document describes the metrics collection, storage, and querying systems in XDCNetOwn (SkyNet).

## Metrics Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Metrics Collection Flow                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌────────┐ │
│  │   XDC    │────▶│  Agent   │────▶│   API    │────▶│  DB    │ │
│  │   Node   │     │ (Collect)│     │ (Ingest) │     │(Store) │ │
│  └──────────┘     └──────────┘     └──────────┘     └───┬────┘ │
│                                                          │      │
│                                                          ▼      │
│                                                  ┌────────────┐ │
│                                                  │ ClickHouse │ │
│                                                  │(Time-Series)│ │
│                                                  └────────────┘ │
│                                                          │      │
│                                                          ▼      │
│                                                  ┌────────────┐ │
│                                                  │  Dashboard │ │
│                                                  │   & Alerts │ │
│                                                  └────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Metric Types

### Node Metrics

| Metric | Type | Unit | Collection Interval |
|--------|------|------|---------------------|
| `block_height` | Gauge | blocks | 30s |
| `peer_count` | Gauge | peers | 30s |
| `sync_progress` | Gauge | percent | 30s |
| `cpu_percent` | Gauge | percent | 30s |
| `memory_percent` | Gauge | percent | 30s |
| `disk_percent` | Gauge | percent | 30s |
| `disk_used_gb` | Gauge | GB | 30s |
| `chain_data_size` | Gauge | bytes | 5m |
| `database_size` | Gauge | bytes | 5m |
| `uptime_seconds` | Counter | seconds | 5m |

### XDPoS 2.0 Metrics

| Metric | Type | Unit | Collection Interval |
|--------|------|------|---------------------|
| `xdpos_epoch` | Gauge | epoch | 30s |
| `xdpos_epoch_progress` | Gauge | percent | 30s |
| `xdpos_qc_formation_time` | Histogram | milliseconds | per block |
| `xdpos_vote_participation` | Gauge | percent | per block |
| `xdpos_timeout_count` | Counter | count | per epoch |
| `xdpos_masternode_active` | Gauge | count | 30s |

### Network Metrics

| Metric | Type | Unit | Collection Interval |
|--------|------|------|---------------------|
| `network_latency` | Histogram | milliseconds | 1m |
| `network_bytes_in` | Counter | bytes | 30s |
| `network_bytes_out` | Counter | bytes | 30s |
| `network_connections` | Gauge | count | 30s |

### Client-Specific Metrics

| Metric | Type | Unit | Description |
|--------|------|------|-------------|
| `client_geth_txpool_pending` | Gauge | count | Pending transactions |
| `client_erigon_stages_progress` | Gauge | percent | Sync stage progress |
| `client_nethermind_fast_sync` | Gauge | percent | Fast sync progress |
| `client_reth_pipeline_progress` | Gauge | percent | Pipeline progress |

## Data Collection

### Heartbeat Protocol

Nodes send metrics via heartbeat API:

```json
{
  "nodeId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-02-26T12:00:00.000Z",
  "metrics": {
    "blockHeight": 89234567,
    "peerCount": 25,
    "syncing": false,
    "syncProgress": 100,
    "system": {
      "cpuPercent": 45.2,
      "memoryPercent": 62.1,
      "diskPercent": 78.0,
      "diskUsedGb": 450.5,
      "diskTotalGb": 1000.0
    },
    "client": {
      "type": "geth",
      "version": "v2.6.8-stable",
      "nodeType": "full",
      "syncMode": "full",
      "chainDataSize": 485000000000,
      "databaseSize": 520000000000
    },
    "xdpos": {
      "epoch": 99150,
      "epochProgress": 67,
      "voteParticipation": 98.5,
      "qcFormationTime": 450
    }
  }
}
```

### Prometheus Integration

Nodes can expose Prometheus metrics:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'xdc-nodes'
    static_configs:
      - targets: ['node1:6060', 'node2:6060']
    metrics_path: /debug/metrics/prometheus
    scrape_interval: 30s
```

### Custom Metrics

```typescript
// Custom metric collection
interface CustomMetric {
  name: string;
  value: number;
  timestamp: Date;
  labels: Record<string, string>;
}

// Example: Track specific RPC call latency
const rpcLatency: CustomMetric = {
  name: 'rpc_eth_call_latency_ms',
  value: 45.2,
  timestamp: new Date(),
  labels: {
    method: 'eth_call',
    client: 'geth'
  }
};
```

## Storage Schema

### ClickHouse Schema

```sql
-- Node metrics table
CREATE TABLE node_metrics (
    timestamp DateTime64(3),
    node_id UUID,
    
    -- Block metrics
    block_height UInt64,
    block_hash FixedString(66),
    syncing UInt8,
    sync_progress Float32,
    
    -- Network metrics
    peer_count UInt32,
    
    -- System metrics
    cpu_percent Float32,
    memory_percent Float32,
    disk_percent Float32,
    disk_used_gb Float32,
    disk_total_gb Float32,
    
    -- Client info
    client_type LowCardinality(String),
    client_version LowCardinality(String),
    node_type LowCardinality(String),
    sync_mode LowCardinality(String),
    
    -- Storage metrics
    chain_data_size UInt64,
    database_size UInt64,
    
    -- Network info
    ipv4 IPv4,
    country LowCardinality(String),
    region LowCardinality(String),
    
    INDEX idx_node_time (node_id, timestamp) TYPE minmax GRANULARITY 4
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (node_id, timestamp)
TTL timestamp + INTERVAL 1 YEAR;

-- XDPoS metrics table
CREATE TABLE xdpos_metrics (
    timestamp DateTime64(3),
    node_id UUID,
    
    epoch UInt32,
    epoch_progress UInt8,
    masternode_count UInt8,
    
    qc_formation_time_ms UInt32,
    vote_participation Float32,
    timeout_count UInt8,
    
    INDEX idx_epoch (epoch) TYPE minmax GRANULARITY 4
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (node_id, timestamp)
TTL timestamp + INTERVAL 1 YEAR;

-- Aggregated metrics (materialized view)
CREATE MATERIALIZED VIEW node_metrics_hourly
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(hour)
ORDER BY (node_id, hour)
AS SELECT
    toStartOfHour(timestamp) as hour,
    node_id,
    avg(block_height) as avg_block_height,
    max(block_height) as max_block_height,
    avg(peer_count) as avg_peer_count,
    avg(cpu_percent) as avg_cpu,
    max(cpu_percent) as max_cpu,
    avg(memory_percent) as avg_memory,
    max(memory_percent) as max_memory
FROM node_metrics
GROUP BY node_id, hour;
```

### PostgreSQL Schema

```sql
-- Current node state (fast lookups)
CREATE TABLE node_current_state (
    node_id UUID PRIMARY KEY REFERENCES nodes(id),
    last_heartbeat TIMESTAMP NOT NULL,
    block_height BIGINT NOT NULL,
    peer_count INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL,
    health_score INTEGER NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Metric metadata
CREATE TABLE metric_definitions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,  -- gauge, counter, histogram
    unit VARCHAR(50),
    description TEXT,
    labels JSONB
);
```

## Data Retention

### Retention Policies

| Data Type | Raw Retention | Aggregated Retention |
|-----------|---------------|---------------------|
| Node metrics | 30 days | 1 year (hourly) |
| XDPoS metrics | 90 days | 1 year (per epoch) |
| Alert history | 1 year | 2 years (daily) |
| System events | 90 days | 1 year (hourly) |

### Retention Configuration

```yaml
retention:
  policies:
    - name: "raw_metrics"
      table: "node_metrics"
      ttl: "30d"
      archive_to_s3: true
    
    - name: "aggregated_metrics"
      table: "node_metrics_hourly"
      ttl: "1y"
      downsample_to: "node_metrics_daily"
    
    - name: "daily_metrics"
      table: "node_metrics_daily"
      ttl: "2y"
      archive_to_s3: true
```

## Querying Metrics

### REST API

```bash
# Get latest metrics for a node
curl "https://xdc.openscan.ai/api/v1/nodes/{nodeId}/metrics/latest" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Query historical metrics
curl "https://xdc.openscan.ai/api/v1/nodes/{nodeId}/metrics?metric=blockHeight&from=2026-02-25T00:00:00Z&to=2026-02-26T00:00:00Z&interval=1h" \
  -H "Authorization: Bearer YOUR_API_KEY"

# Query multiple metrics
curl -X POST "https://xdc.openscan.ai/api/v1/nodes/{nodeId}/metrics/query" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "metrics": ["blockHeight", "peerCount", "cpuPercent"],
    "from": "2026-02-25T00:00:00Z",
    "to": "2026-02-26T00:00:00Z",
    "interval": "5m"
  }'
```

### GraphQL API

```graphql
query NodeMetrics($nodeId: ID!, $from: DateTime!, $to: DateTime!) {
  node(id: $nodeId) {
    metrics(from: $from, to: $to, interval: FIVE_MINUTES) {
      timestamp
      blockHeight
      peerCount
      system {
        cpuPercent
        memoryPercent
        diskPercent
      }
    }
    
    aggregates(from: $from, to: $to) {
      blockHeight {
        min
        max
        avg
      }
      cpuPercent {
        p95
        p99
      }
    }
  }
}
```

### SQL Queries

```sql
-- Get latest metrics for all nodes
SELECT 
    n.name,
    n.host,
    m.block_height,
    m.peer_count,
    m.cpu_percent,
    m.memory_percent,
    m.timestamp
FROM nodes n
JOIN node_current_state m ON n.id = m.node_id
ORDER BY m.block_height DESC;

-- Get block height trend for a node
SELECT 
    toStartOfHour(timestamp) as hour,
    max(block_height) as max_height,
    min(block_height) as min_height,
    max(block_height) - min(block_height) as blocks_produced
FROM node_metrics
WHERE node_id = '550e8400-e29b-41d4-a716-446655440000'
  AND timestamp > now() - INTERVAL 24 HOUR
GROUP BY hour
ORDER BY hour;

-- Get average metrics by client type
SELECT 
    client_type,
    avg(cpu_percent) as avg_cpu,
    avg(memory_percent) as avg_memory,
    avg(peer_count) as avg_peers
FROM node_metrics
WHERE timestamp > now() - INTERVAL 1 HOUR
GROUP BY client_type;

-- Find nodes with sync issues
SELECT 
    n.name,
    m.block_height,
    max_height - m.block_height as blocks_behind
FROM node_current_state m
JOIN nodes n ON m.node_id = n.id
CROSS JOIN (SELECT max(block_height) as max_height FROM node_current_state) max_h
WHERE m.block_height < max_height - 100
ORDER BY blocks_behind DESC;
```

## Metric Aggregation

### Aggregation Functions

| Function | Description |
|----------|-------------|
| `avg` | Average value |
| `min` / `max` | Minimum / Maximum |
| `sum` | Sum of values |
| `count` | Number of data points |
| `p95` / `p99` | 95th / 99th percentile |
| `rate` | Rate of change |
| `delta` | Difference between first and last |

### Aggregation Intervals

| Interval | Use Case |
|----------|----------|
| Raw (30s) | Real-time monitoring |
| 1 minute | Short-term analysis |
| 5 minutes | Dashboard display |
| 1 hour | Daily reports |
| 1 day | Long-term trends |
| 1 week | Capacity planning |

## Anomaly Detection

### Statistical Methods

```python
# Z-score based anomaly detection
def detect_anomalies(values, threshold=3):
    mean = np.mean(values)
    std = np.std(values)
    z_scores = [(x - mean) / std for x in values]
    return [i for i, z in enumerate(z_scores) if abs(z) > threshold]

# Seasonal decomposition
from statsmodels.tsa.seasonal import seasonal_decompose

def detect_seasonal_anomalies(series, period=24):
    decomposition = seasonal_decompose(series, period=period)
    residual = decomposition.resid
    return detect_anomalies(residual.dropna())
```

### ML-Based Detection

```python
# Isolation Forest for anomaly detection
from sklearn.ensemble import IsolationForest

def train_anomaly_detector(metrics_df):
    model = IsolationForest(contamination=0.01, random_state=42)
    features = ['cpu_percent', 'memory_percent', 'peer_count', 'block_height_diff']
    model.fit(metrics_df[features])
    return model

def predict_anomalies(model, new_metrics):
    return model.predict(new_metrics) == -1  # -1 indicates anomaly
```

## Performance Optimization

### Query Optimization

```sql
-- Use materialized views for common queries
CREATE MATERIALIZED VIEW node_health_summary AS
SELECT 
    node_id,
    max(timestamp) as last_seen,
    max(block_height) as latest_block,
    avg(cpu_percent) as avg_cpu_1h,
    avg(memory_percent) as avg_memory_1h
FROM node_metrics
WHERE timestamp > now() - INTERVAL 1 HOUR
GROUP BY node_id;

-- Create indexes for common filters
CREATE INDEX CONCURRENTLY idx_node_metrics_time 
ON node_metrics(timestamp DESC);

CREATE INDEX CONCURRENTLY idx_node_metrics_node_time 
ON node_metrics(node_id, timestamp DESC);
```

### Caching Strategy

```yaml
caching:
  # Redis cache configuration
  redis:
    ttl:
      latest_metrics: 30s
      node_list: 60s
      fleet_summary: 300s
      historical_query: 3600s
  
  # In-memory cache
  local:
    max_size: 10000
    ttl: 60s
```

## Monitoring the Metrics System

### Health Checks

```yaml
# Metrics system health
health_checks:
  - name: "clickhouse_connection"
    interval: 30s
    timeout: 5s
  
  - name: "ingestion_rate"
    interval: 60s
    alert_if_below: 100  # metrics/minute
  
  - name: "query_latency"
    interval: 60s
    alert_if_above: 1000  # ms
```

### System Metrics

| Metric | Description |
|--------|-------------|
| `skynet_metrics_ingested_total` | Total metrics ingested |
| `skynet_metrics_query_duration` | Query latency histogram |
| `skynet_metrics_storage_bytes` | Storage usage |
| `skynet_metrics_dropped_total` | Dropped metrics count |

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [API.md](./API.md) - API reference
- [DASHBOARD.md](./DASHBOARD.md) - Dashboard features
- [ALERTS.md](./ALERTS.md) - Alert configuration
