-- Use a separate schema to not conflict with gateway tables
CREATE SCHEMA IF NOT EXISTS netown;

-- Registered nodes (fleet)
CREATE TABLE IF NOT EXISTS netown.nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  host VARCHAR(255) NOT NULL,  -- RPC endpoint URL
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

-- Time-series node metrics (collected every 30s)
CREATE TABLE IF NOT EXISTS netown.node_metrics (
  id BIGSERIAL PRIMARY KEY,
  node_id UUID REFERENCES netown.nodes(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_metrics_node_time ON netown.node_metrics(node_id, collected_at DESC);

-- Peer snapshots
CREATE TABLE IF NOT EXISTS netown.peer_snapshots (
  id BIGSERIAL PRIMARY KEY,
  node_id UUID REFERENCES netown.nodes(id) ON DELETE CASCADE,
  peer_enode TEXT NOT NULL,
  peer_name VARCHAR(200),
  remote_ip VARCHAR(45),
  remote_port INT,
  client_version VARCHAR(200),
  protocols TEXT[], -- e.g. ['eth/62','eth/63','eth/100']
  direction VARCHAR(10), -- 'inbound' or 'outbound'
  latency_ms INT,
  country VARCHAR(5),
  city VARCHAR(100),
  asn VARCHAR(50),
  score INT DEFAULT 50,
  collected_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_peers_node_time ON netown.peer_snapshots(node_id, collected_at DESC);

-- Incidents (auto-detected + manual)
CREATE TABLE IF NOT EXISTS netown.incidents (
  id BIGSERIAL PRIMARY KEY,
  node_id UUID REFERENCES netown.nodes(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- sync_stall, peer_drop, disk_pressure, memory_high, block_drift, fork_detected
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('critical','warning','info')),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  suggested_fix TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','acknowledged','resolved')),
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  auto_detected BOOLEAN DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON netown.incidents(status, detected_at DESC);

-- Network health snapshots (aggregated, every 5 min)
CREATE TABLE IF NOT EXISTS netown.network_health (
  id BIGSERIAL PRIMARY KEY,
  health_score INT, -- 0-100
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
CREATE INDEX IF NOT EXISTS idx_health_time ON netown.network_health(collected_at DESC);

-- Banned peers
CREATE TABLE IF NOT EXISTS netown.banned_peers (
  id SERIAL PRIMARY KEY,
  enode TEXT NOT NULL UNIQUE,
  remote_ip VARCHAR(45),
  reason VARCHAR(200),
  banned_at TIMESTAMPTZ DEFAULT NOW(),
  banned_by VARCHAR(100) DEFAULT 'auto'
);

-- Upgrade plans
CREATE TABLE IF NOT EXISTS netown.upgrade_plans (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  target_version VARCHAR(50),
  strategy VARCHAR(20) DEFAULT 'rolling', -- rolling, canary, blue-green
  node_ids UUID[],
  status VARCHAR(20) DEFAULT 'planned', -- planned, in_progress, completed, failed
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create a function to update updated_at timestamp
CREATE OR REPLACE FUNCTION netown.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for nodes table
DROP TRIGGER IF EXISTS update_nodes_updated_at ON netown.nodes;
CREATE TRIGGER update_nodes_updated_at
    BEFORE UPDATE ON netown.nodes
    FOR EACH ROW
    EXECUTE FUNCTION netown.update_updated_at_column();

-- API keys for node authentication
CREATE TABLE IF NOT EXISTS netown.api_keys (
  id SERIAL PRIMARY KEY,
  key VARCHAR(64) NOT NULL UNIQUE,
  node_id UUID REFERENCES netown.nodes(id),
  name VARCHAR(100),
  permissions TEXT[] DEFAULT '{heartbeat,metrics,notifications}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON netown.api_keys(key);
CREATE INDEX IF NOT EXISTS idx_api_keys_node ON netown.api_keys(node_id);

-- Command queue for remote node control
CREATE TABLE IF NOT EXISTS netown.command_queue (
  id SERIAL PRIMARY KEY,
  node_id UUID REFERENCES netown.nodes(id) ON DELETE CASCADE,
  command VARCHAR(50) NOT NULL,
  params JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','sent','completed','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  result JSONB
);
CREATE INDEX IF NOT EXISTS idx_commands_node_status ON netown.command_queue(node_id, status);
CREATE INDEX IF NOT EXISTS idx_commands_pending ON netown.command_queue(status, created_at) WHERE status = 'pending';
