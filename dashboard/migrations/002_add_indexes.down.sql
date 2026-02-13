-- Migration 2: Add Indexes
-- Down: Drop indexes

DROP INDEX IF EXISTS skynet.idx_metrics_node_time;
DROP INDEX IF EXISTS skynet.idx_peers_node_time;
DROP INDEX IF EXISTS skynet.idx_incidents_status;
DROP INDEX IF EXISTS skynet.idx_health_time;
DROP INDEX IF EXISTS skynet.idx_api_keys_key;
DROP INDEX IF EXISTS skynet.idx_api_keys_node;
DROP INDEX IF EXISTS skynet.idx_commands_node_status;
DROP INDEX IF EXISTS skynet.idx_commands_pending;
DROP INDEX IF EXISTS skynet.idx_mn_addr_time;
DROP INDEX IF EXISTS skynet.idx_mn_epoch;
DROP INDEX IF EXISTS skynet.idx_nodes_active;
DROP INDEX IF EXISTS skynet.idx_nodes_role;
DROP INDEX IF EXISTS skynet.idx_incidents_node;
DROP INDEX IF EXISTS skynet.idx_incidents_type;
DROP INDEX IF EXISTS skynet.idx_metrics_collected_at;
