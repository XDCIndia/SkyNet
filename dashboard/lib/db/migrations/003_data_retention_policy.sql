-- Migration 003: Data retention policy indexes and tracking
-- Issue #23: No data retention policy
-- 
-- Retention policy (enforced by scripts/data-retention.ts):
--   node_metrics: 90 days
--   peer_snapshots: 30 days  
--   system_metrics: 30 days
--   logs: 7 days
--   resolved incidents: 90 days
--
-- Schedule via cron: 0 2 * * * cd /path/to/dashboard && npx tsx scripts/data-retention.ts

-- Indexes to speed up retention cleanup (DELETE by date range)
CREATE INDEX IF NOT EXISTS idx_node_metrics_collected_at 
  ON skynet.node_metrics (collected_at);

CREATE INDEX IF NOT EXISTS idx_peer_snapshots_collected_at 
  ON skynet.peer_snapshots (collected_at);

CREATE INDEX IF NOT EXISTS idx_incidents_resolved_at 
  ON skynet.incidents (resolved_at) 
  WHERE status = 'resolved';

-- Retention run tracking table
CREATE TABLE IF NOT EXISTS skynet.retention_runs (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  total_deleted INTEGER DEFAULT 0,
  details JSONB,
  triggered_by VARCHAR(50) DEFAULT 'manual',
  status VARCHAR(20) DEFAULT 'running'
);

COMMENT ON TABLE skynet.retention_runs IS 
  'Tracks data retention cleanup runs. Policy: node_metrics=90d, peer_snapshots=30d, incidents(resolved)=90d';
