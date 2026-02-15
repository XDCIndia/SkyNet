# TimescaleDB Migration Guide

This guide covers migrating XDCNetOwn's metrics storage from plain PostgreSQL to TimescaleDB for better time-series performance.

## Why TimescaleDB?

- **10-100x faster** queries on time-range data
- **Automatic partitioning** (chunking) by time
- **Compression** reduces storage by 90%+
- **Continuous aggregates** for real-time rollups
- **Drop-in** PostgreSQL extension — no app changes needed

## Prerequisites

```bash
# Install TimescaleDB extension (Ubuntu/Debian)
sudo apt install timescaledb-2-postgresql-15

# Enable the extension
sudo timescaledb-tune  # accept defaults
sudo systemctl restart postgresql
```

## Migration Steps

### 1. Enable the Extension

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

### 2. Run the Migration

```bash
psql -U xdcnet -d xdcnet_dashboard -f dashboard/migrations/timescaledb.sql
```

### 3. Verify

```sql
-- Check hypertable was created
SELECT * FROM timescaledb_information.hypertables;

-- Check continuous aggregates
SELECT * FROM timescaledb_information.continuous_aggregates;

-- Check policies
SELECT * FROM timescaledb_information.jobs;
```

## What the Migration Creates

| Object | Description |
|--------|-------------|
| `node_metrics` hypertable | Raw metrics, chunked by day |
| `node_metrics_5m` | 5-minute rollup aggregate |
| `node_metrics_1h` | 1-hour rollup aggregate |
| Compression policy | Compress chunks > 7 days old |
| Retention policy | Drop raw data > 90 days old |

## Querying Aggregates

```sql
-- Last 24h, 5-minute resolution
SELECT * FROM node_metrics_5m
WHERE bucket > NOW() - INTERVAL '24 hours'
  AND node_id = 'my-node'
ORDER BY bucket DESC;

-- Last 30 days, hourly resolution
SELECT * FROM node_metrics_1h
WHERE bucket > NOW() - INTERVAL '30 days'
  AND node_id = 'my-node'
ORDER BY bucket DESC;
```

## Docker Compose

```yaml
services:
  timescaledb:
    image: timescale/timescaledb:latest-pg15
    environment:
      POSTGRES_DB: xdcnet_dashboard
      POSTGRES_USER: xdcnet
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - tsdb_data:/var/lib/postgresql/data
```

## Rollback

```sql
-- Remove policies and aggregates (data preserved)
SELECT remove_retention_policy('node_metrics');
SELECT remove_compression_policy('node_metrics');
DROP MATERIALIZED VIEW IF EXISTS node_metrics_1h;
DROP MATERIALIZED VIEW IF EXISTS node_metrics_5m;
```
