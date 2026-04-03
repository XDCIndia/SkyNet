-- Phase 3: AI & Automation tables

CREATE TABLE IF NOT EXISTS optimization_history (
  id SERIAL PRIMARY KEY,
  node_id VARCHAR(64) NOT NULL,
  config_hash VARCHAR(64),
  sync_speed REAL DEFAULT 0,
  peer_health REAL DEFAULT 0,
  resource_use REAL DEFAULT 0,
  composite REAL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_opt_node ON optimization_history(node_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_nodes (
  id SERIAL PRIMARY KEY,
  ip VARCHAR(45) NOT NULL,
  node_name VARCHAR(128),
  client_type VARCHAR(32),
  chain_id INTEGER NOT NULL,
  block_number BIGINT DEFAULT 0,
  peer_count INTEGER DEFAULT 0,
  version VARCHAR(64),
  last_report TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ip, chain_id)
);
CREATE INDEX IF NOT EXISTS idx_community_chain ON community_nodes(chain_id, last_report DESC);
