-- Migration: Add consensus health scoring tables
-- Issue: #600 - XDPoS 2.0 Consensus Health Scoring System
-- Issue: #577 - Masternode Performance Scoring System

-- Create consensus health scores table
CREATE TABLE IF NOT EXISTS skynet.consensus_health_scores (
    id SERIAL PRIMARY KEY,
    network_id VARCHAR(50) NOT NULL,
    overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
    epoch_participation_score INTEGER NOT NULL,
    vote_propagation_score INTEGER NOT NULL,
    masternode_stability_score INTEGER NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(network_id, recorded_at)
);

-- Create masternode scores table
CREATE TABLE IF NOT EXISTS skynet.masternode_scores (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) NOT NULL,
    epoch INTEGER NOT NULL,
    network_id VARCHAR(50) NOT NULL DEFAULT 'mainnet',
    total_score DECIMAL(4,1) NOT NULL,
    tier VARCHAR(20) NOT NULL CHECK (tier IN ('gold', 'silver', 'bronze', 'needs-improvement')),
    uptime DECIMAL(5,2),
    block_production DECIMAL(5,2),
    vote_latency DECIMAL(5,2),
    qc_participation DECIMAL(5,2),
    peer_connectivity DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(address, epoch, network_id)
);

-- Create masternode metrics table
CREATE TABLE IF NOT EXISTS skynet.masternode_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address VARCHAR(42) NOT NULL,
    epoch INTEGER NOT NULL,
    network_id VARCHAR(50) NOT NULL DEFAULT 'mainnet',
    uptime_percentage DECIMAL(5,2),
    blocks_signed INTEGER DEFAULT 0,
    block_opportunities INTEGER DEFAULT 0,
    avg_vote_latency_ms INTEGER,
    qc_participation_rate DECIMAL(5,4),
    avg_peer_count DECIMAL(6,2),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create consensus metrics table
CREATE TABLE IF NOT EXISTS skynet.consensus_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id VARCHAR(50) NOT NULL DEFAULT 'mainnet',
    epoch INTEGER NOT NULL,
    round INTEGER,
    metrics JSONB NOT NULL DEFAULT '{}',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create masternode history table for tracking changes
CREATE TABLE IF NOT EXISTS skynet.masternode_history (
    id SERIAL PRIMARY KEY,
    network_id VARCHAR(50) NOT NULL DEFAULT 'mainnet',
    epoch INTEGER NOT NULL,
    masternode_set JSONB NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_consensus_health_network_time 
ON skynet.consensus_health_scores(network_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_masternode_scores_epoch 
ON skynet.masternode_scores(epoch);

CREATE INDEX IF NOT EXISTS idx_masternode_scores_address 
ON skynet.masternode_scores(address);

CREATE INDEX IF NOT EXISTS idx_masternode_scores_tier 
ON skynet.masternode_scores(tier);

CREATE INDEX IF NOT EXISTS idx_masternode_metrics_address_epoch 
ON skynet.masternode_metrics(address, epoch);

CREATE INDEX IF NOT EXISTS idx_consensus_metrics_network_epoch 
ON skynet.consensus_metrics(network_id, epoch);

CREATE INDEX IF NOT EXISTS idx_masternode_history_network_epoch 
ON skynet.masternode_history(network_id, epoch);

-- Add comments for documentation
COMMENT ON TABLE skynet.consensus_health_scores IS 'Stores XDPoS 2.0 consensus health scores over time';
COMMENT ON TABLE skynet.masternode_scores IS 'Stores individual masternode performance scores per epoch';
COMMENT ON TABLE skynet.masternode_metrics IS 'Stores detailed masternode performance metrics';
COMMENT ON TABLE skynet.consensus_metrics IS 'Stores consensus-level metrics for health calculation';
COMMENT ON TABLE skynet.masternode_history IS 'Tracks masternode set changes between epochs';
