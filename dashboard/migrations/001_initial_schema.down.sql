-- Migration 1: Initial Schema
-- Down: Drop all tables

DROP TABLE IF EXISTS skynet.masternode_snapshots CASCADE;
DROP TABLE IF EXISTS skynet.command_queue CASCADE;
DROP TABLE IF EXISTS skynet.api_keys CASCADE;
DROP TABLE IF EXISTS skynet.upgrade_plans CASCADE;
DROP TABLE IF EXISTS skynet.banned_peers CASCADE;
DROP TABLE IF EXISTS skynet.network_health CASCADE;
DROP TABLE IF EXISTS skynet.incidents CASCADE;
DROP TABLE IF EXISTS skynet.peer_snapshots CASCADE;
DROP TABLE IF EXISTS skynet.node_metrics CASCADE;
DROP TABLE IF EXISTS skynet.nodes CASCADE;
DROP FUNCTION IF EXISTS skynet.update_updated_at_column() CASCADE;
DROP SCHEMA IF EXISTS skynet CASCADE;
