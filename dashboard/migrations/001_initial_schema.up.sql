-- Migration 1: Initial Schema
-- Up: Create initial database schema

CREATE SCHEMA IF NOT EXISTS skynet;

-- Registered nodes (fleet)
CREATE TABLE IF NOT EXISTS skynet.nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  host VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('masternode','fullnode','archive','rpc')),
  location_city VARCHAR(100),
  location_country VARCHAR(5),
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  tags TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Time-series node metrics
CREATE TABLE IF NOT EXISTS skynet.node_metrics (
  id BIGSERIAL PRIMARY KEY,
  node_id UUID REFERENCES skynet.nodes(id) ON DELETE CASCADE,
  block_height BIGINT,
  sync_percent REAL,
  peer_count INT,
  cpu_percent REAL,
  memory_percent REAL,
  disk_percent REAL,
  disk_used_gb REAL,
  disk_total_gb REAL,
  tx_pool_pending INT,
  tx_pool_queued INT,
  gas_price BIGINT,
  tps REAL,
  rpc_latency_ms INT,
  is_syncing BOOLEAN,
  client_version VARCHAR(200),
  protocol_version VARCHAR(20),
  coinbase VARCHAR(50),
  collected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Peer snapshots
CREATE TABLE IF NOT EXISTS skynet.peer_snapshots (
  id BIGSERIAL PRIMARY KEY,
  node_id UUID REFERENCES skynet.nodes(id) ON DELETE CASCADE,
  peer_enode TEXT NOT NULL,
  peer_name VARCHAR(200),
  remote_ip VARCHAR(45),
  remote_port INT,
  client_version VARCHAR(200),
  protocols TEXT[],
  direction VARCHAR(10),
  latency_ms INT,
  country VARCHAR(5),
  city VARCHAR(100),
  asn VARCHAR(50),
  score INT DEFAULT 50,
  collected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Incidents
CREATE TABLE IF NOT EXISTS skynet.incidents (
  id BIGSERIAL PRIMARY KEY,
  node_id UUID REFERENCES skynet.nodes(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('critical','warning','info')),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  suggested_fix TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','acknowledged','resolved')),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  auto_detected BOOLEAN DEFAULT true
);

-- Network health snapshots
CREATE TABLE IF NOT EXISTS skynet.network_health (
  id BIGSERIAL PRIMARY KEY,
  health_score INT,
  total_nodes INT,
  healthy_nodes INT,
  degraded_nodes INT,
  offline_nodes INT,
  total_peers INT,
  avg_block_height BIGINT,
  max_block_height BIGINT,
  nakamoto_coefficient INT,
  avg_sync_percent REAL,
  avg_rpc_latency_ms INT,
  collected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Banned peers
CREATE TABLE IF NOT EXISTS skynet.banned_peers (
  id SERIAL PRIMARY KEY,
  enode TEXT NOT NULL UNIQUE,
  remote_ip VARCHAR(45),
  reason VARCHAR(200),
  banned_at TIMESTAMPTZ DEFAULT NOW(),
  banned_by VARCHAR(100) DEFAULT 'auto'
);

-- Upgrade plans
CREATE TABLE IF NOT EXISTS skynet.upgrade_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  target_version VARCHAR(50),
  strategy VARCHAR(20) DEFAULT 'rolling',
  node_ids UUID[],
  status VARCHAR(20) DEFAULT 'planned',
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API keys
CREATE TABLE IF NOT EXISTS skynet.api_keys (
  id SERIAL PRIMARY KEY,
  key VARCHAR(64) NOT NULL UNIQUE,
  node_id UUID REFERENCES skynet.nodes(id),
  name VARCHAR(100),
  permissions TEXT[] DEFAULT '{heartbeat,metrics,notifications}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Command queue
CREATE TABLE IF NOT EXISTS skynet.command_queue (
  id SERIAL PRIMARY KEY,
  node_id UUID REFERENCES skynet.nodes(id) ON DELETE CASCADE,
  command VARCHAR(50) NOT NULL,
  params JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result JSONB
);

-- Masternode snapshots
CREATE TABLE IF NOT EXISTS skynet.masternode_snapshots (
  id BIGSERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL,
  status VARCHAR(20) NOT NULL,
  owner VARCHAR(42),
  stake_xdc NUMERIC(30,2),
  voter_count INT DEFAULT 0,
  ethstats_name VARCHAR(200),
  epoch INT,
  round INT,
  block_number BIGINT,
  collected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Updated at function
CREATE OR REPLACE FUNCTION skynet.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for nodes
CREATE TRIGGER update_nodes_updated_at
    BEFORE UPDATE ON skynet.nodes
    FOR EACH ROW
    EXECUTE FUNCTION skynet.update_updated_at_column();
