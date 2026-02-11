-- Migration: Add IPv4/IPv6, OS info, client type, node type columns
-- Run with: PGPASSWORD=gateway_secret_2026 psql -h localhost -p 5443 -U gateway -d xdc_gateway -f migration_add_node_metadata.sql

-- Add columns to netown.node_metrics table
ALTER TABLE netown.node_metrics 
    ADD COLUMN IF NOT EXISTS ipv4 VARCHAR(45),
    ADD COLUMN IF NOT EXISTS ipv6 VARCHAR(45),
    ADD COLUMN IF NOT EXISTS os_type VARCHAR(100),
    ADD COLUMN IF NOT EXISTS os_release VARCHAR(200),
    ADD COLUMN IF NOT EXISTS os_arch VARCHAR(20),
    ADD COLUMN IF NOT EXISTS kernel_version VARCHAR(100),
    ADD COLUMN IF NOT EXISTS client_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS node_type VARCHAR(20);

-- Add columns to netown.nodes table
ALTER TABLE netown.nodes 
    ADD COLUMN IF NOT EXISTS ipv4 VARCHAR(45),
    ADD COLUMN IF NOT EXISTS ipv6 VARCHAR(45),
    ADD COLUMN IF NOT EXISTS os_info JSONB,
    ADD COLUMN IF NOT EXISTS client_type VARCHAR(20),
    ADD COLUMN IF NOT EXISTS node_type VARCHAR(20);

-- Create indexes for common lookups
CREATE INDEX IF NOT EXISTS idx_node_metrics_client_type ON netown.node_metrics(client_type);
CREATE INDEX IF NOT EXISTS idx_node_metrics_node_type ON netown.node_metrics(node_type);
CREATE INDEX IF NOT EXISTS idx_nodes_client_type ON netown.nodes(client_type);
CREATE INDEX IF NOT EXISTS idx_nodes_node_type ON netown.nodes(node_type);
