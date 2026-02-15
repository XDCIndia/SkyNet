-- TimescaleDB Migration for XDCNetOwn
-- Converts node_metrics to a hypertable and adds continuous aggregates.
--
-- Prerequisites:
--   CREATE EXTENSION IF NOT EXISTS timescaledb;

BEGIN;

-- 1. Ensure the node_metrics table exists with a proper timestamp column
CREATE TABLE IF NOT EXISTS node_metrics (
    time        TIMESTAMPTZ NOT NULL,
    node_id     TEXT        NOT NULL,
    cpu_pct     DOUBLE PRECISION,
    mem_pct     DOUBLE PRECISION,
    disk_pct    DOUBLE PRECISION,
    block_height BIGINT,
    peer_count  INTEGER,
    is_healthy  BOOLEAN DEFAULT TRUE
);

-- 2. Convert to hypertable (chunk interval: 1 day)
-- NOTE: Table must be empty OR use migrate_data => true for existing data
SELECT create_hypertable(
    'node_metrics',
    'time',
    if_not_exists => TRUE,
    migrate_data  => TRUE
);

-- 3. Add compression policy (compress chunks older than 7 days)
ALTER TABLE node_metrics SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'node_id',
    timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('node_metrics', INTERVAL '7 days', if_not_exists => TRUE);

-- 4. Continuous aggregate: 5-minute rollups
CREATE MATERIALIZED VIEW IF NOT EXISTS node_metrics_5m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', time) AS bucket,
    node_id,
    AVG(cpu_pct)    AS avg_cpu,
    MAX(cpu_pct)    AS max_cpu,
    AVG(mem_pct)    AS avg_mem,
    MAX(mem_pct)    AS max_mem,
    AVG(disk_pct)   AS avg_disk,
    MAX(block_height) AS max_block_height,
    AVG(peer_count) AS avg_peers,
    COUNT(*)        AS sample_count
FROM node_metrics
GROUP BY bucket, node_id
WITH NO DATA;

-- 5. Continuous aggregate: 1-hour rollups
CREATE MATERIALIZED VIEW IF NOT EXISTS node_metrics_1h
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    node_id,
    AVG(cpu_pct)    AS avg_cpu,
    MAX(cpu_pct)    AS max_cpu,
    AVG(mem_pct)    AS avg_mem,
    MAX(mem_pct)    AS max_mem,
    AVG(disk_pct)   AS avg_disk,
    MAX(block_height) AS max_block_height,
    AVG(peer_count) AS avg_peers,
    COUNT(*)        AS sample_count
FROM node_metrics
GROUP BY bucket, node_id
WITH NO DATA;

-- 6. Refresh policies for continuous aggregates
SELECT add_continuous_aggregate_policy('node_metrics_5m',
    start_offset    => INTERVAL '1 hour',
    end_offset      => INTERVAL '5 minutes',
    schedule_interval => INTERVAL '5 minutes',
    if_not_exists   => TRUE
);

SELECT add_continuous_aggregate_policy('node_metrics_1h',
    start_offset    => INTERVAL '3 hours',
    end_offset      => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists   => TRUE
);

-- 7. Retention policy: drop raw data older than 90 days
SELECT add_retention_policy('node_metrics', INTERVAL '90 days', if_not_exists => TRUE);

-- 8. Useful indexes
CREATE INDEX IF NOT EXISTS idx_node_metrics_node_time ON node_metrics (node_id, time DESC);

COMMIT;
