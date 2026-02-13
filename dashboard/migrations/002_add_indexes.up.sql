-- Migration 2: Add Indexes
-- Up: Create performance indexes

CREATE INDEX IF NOT EXISTS idx_metrics_node_time ON skynet.node_metrics(node_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_peers_node_time ON skynet.peer_snapshots(node_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON skynet.incidents(status, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_time ON skynet.network_health(collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_keys_key ON skynet.api_keys(key);
CREATE INDEX IF NOT EXISTS idx_api_keys_node ON skynet.api_keys(node_id);
CREATE INDEX IF NOT EXISTS idx_commands_node_status ON skynet.command_queue(node_id, status);
CREATE INDEX IF NOT EXISTS idx_commands_pending ON skynet.command_queue(status, created_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_mn_addr_time ON skynet.masternode_snapshots(address, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_mn_epoch ON skynet.masternode_snapshots(epoch);

-- Additional indexes for common queries
CREATE INDEX IF NOT EXISTS idx_nodes_active ON skynet.nodes(is_active);
CREATE INDEX IF NOT EXISTS idx_nodes_role ON skynet.nodes(role);
CREATE INDEX IF NOT EXISTS idx_incidents_node ON skynet.incidents(node_id);
CREATE INDEX IF NOT EXISTS idx_incidents_type ON skynet.incidents(type);
CREATE INDEX IF NOT EXISTS idx_metrics_collected_at ON skynet.node_metrics(collected_at DESC);
