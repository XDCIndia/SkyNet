-- XDPoS 2.0 Consensus Dashboard Migration
-- Adds XDPoS-specific metrics to support epoch tracking, QC validation, and validator performance

-- Add XDPoS consensus columns to node_metrics
ALTER TABLE skynet.node_metrics 
ADD COLUMN IF NOT EXISTS qc_valid BOOLEAN DEFAULT NULL,
ADD COLUMN IF NOT EXISTS qc_signatures INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS qc_threshold INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS vote_count INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS vote_participation_percent REAL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS epoch_number INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS round_number INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS validator_index INT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS block_producer VARCHAR(42) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS expected_block_producer VARCHAR(42) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS gap_block_detected BOOLEAN DEFAULT FALSE;

-- Create consensus_health table for historical health scores
CREATE TABLE IF NOT EXISTS skynet.consensus_health (
  id BIGSERIAL PRIMARY KEY,
  health_score INT NOT NULL CHECK (health_score >= 0 AND health_score <= 100),
  participation_percent REAL,
  qc_validity_percent REAL,
  gap_rate_percent REAL,
  active_validators INT,
  total_validators INT,
  epoch_number INT,
  block_number BIGINT,
  details JSONB DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_consensus_health_time ON skynet.consensus_health(calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_consensus_health_epoch ON skynet.consensus_health(epoch_number);

-- Create validator_performance table for per-validator metrics
CREATE TABLE IF NOT EXISTS skynet.validator_performance (
  id BIGSERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL,
  epoch_number INT NOT NULL,
  uptime_percent REAL,
  blocks_produced INT DEFAULT 0,
  blocks_expected INT DEFAULT 0,
  block_production_rate REAL,
  votes_participated INT DEFAULT 0,
  votes_expected INT DEFAULT 0,
  vote_participation_percent REAL,
  qc_contributions INT DEFAULT 0,
  qc_contribution_percent REAL,
  missed_blocks INT DEFAULT 0,
  gap_blocks_created INT DEFAULT 0,
  overall_score INT CHECK (overall_score >= 0 AND overall_score <= 100),
  calculated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_validator_perf_addr ON skynet.validator_performance(address, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_validator_perf_epoch ON skynet.validator_performance(epoch_number);
CREATE INDEX IF NOT EXISTS idx_validator_perf_addr_epoch ON skynet.validator_performance(address, epoch_number);

-- Create gap_blocks table for tracking missed turns
CREATE TABLE IF NOT EXISTS skynet.gap_blocks (
  id BIGSERIAL PRIMARY KEY,
  block_number BIGINT NOT NULL,
  epoch_number INT NOT NULL,
  round_number INT,
  expected_producer VARCHAR(42) NOT NULL,
  actual_producer VARCHAR(42),
  gap_type VARCHAR(20) CHECK (gap_type IN ('missed_turn', 'late_block', 'forked')),
  time_to_next_block_ms INT,
  detected_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gap_blocks_block ON skynet.gap_blocks(block_number);
CREATE INDEX IF NOT EXISTS idx_gap_blocks_epoch ON skynet.gap_blocks(epoch_number);
CREATE INDEX IF NOT EXISTS idx_gap_blocks_producer ON skynet.gap_blocks(expected_producer);
CREATE INDEX IF NOT EXISTS idx_gap_blocks_detected ON skynet.gap_blocks(detected_at DESC);

-- Create QC metrics table for tracking quorum certificates
CREATE TABLE IF NOT EXISTS skynet.qc_metrics (
  id BIGSERIAL PRIMARY KEY,
  block_number BIGINT NOT NULL,
  block_hash VARCHAR(66),
  epoch_number INT NOT NULL,
  round_number INT,
  qc_valid BOOLEAN DEFAULT FALSE,
  signature_count INT DEFAULT 0,
  threshold_required INT DEFAULT 0,
  time_to_qc_ms INT,
  first_vote_time TIMESTAMPTZ,
  qc_formed_at TIMESTAMPTZ,
  validators_signed TEXT[],
  collected_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_qc_metrics_block ON skynet.qc_metrics(block_number);
CREATE INDEX IF NOT EXISTS idx_qc_metrics_epoch ON skynet.qc_metrics(epoch_number);
CREATE INDEX IF NOT EXISTS idx_qc_metrics_collected ON skynet.qc_metrics(collected_at DESC);

-- Create view for current consensus state
CREATE OR REPLACE VIEW skynet.v_current_consensus AS
SELECT 
  nm.block_height,
  nm.epoch_number,
  nm.round_number,
  nm.qc_valid,
  nm.qc_signatures,
  nm.qc_threshold,
  nm.vote_count,
  nm.vote_participation_percent,
  nm.gap_block_detected,
  nm.block_producer,
  nm.expected_block_producer,
  nm.collected_at
FROM skynet.node_metrics nm
WHERE nm.collected_at = (
  SELECT MAX(collected_at) FROM skynet.node_metrics WHERE block_height IS NOT NULL
);

-- Record migration
INSERT INTO skynet.migrations (name) VALUES ('004_xdpos_consensus_metrics')
ON CONFLICT (name) DO NOTHING;
