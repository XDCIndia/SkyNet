-- Migration: Add divergence events table for fork detection
-- Issue: #679 - Network Fork Detection System
-- Issue: #452 - Network Fork Detection System

-- Create divergence events table
CREATE TABLE IF NOT EXISTS skynet.divergence_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_number BIGINT NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
    affected_clients TEXT[] NOT NULL,
    expected_hash VARCHAR(66),
    divergent_hashes JSONB NOT NULL DEFAULT '{}',
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_divergence_block ON skynet.divergence_events(block_number);
CREATE INDEX IF NOT EXISTS idx_divergence_detected ON skynet.divergence_events(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_divergence_severity ON skynet.divergence_events(severity);
CREATE INDEX IF NOT EXISTS idx_divergence_unresolved ON skynet.divergence_events(resolved_at) WHERE resolved_at IS NULL;

-- Add comment for documentation
COMMENT ON TABLE skynet.divergence_events IS 'Stores network consensus fork detection events';
COMMENT ON COLUMN skynet.divergence_events.block_number IS 'Block number where divergence was detected';
COMMENT ON COLUMN skynet.divergence_events.severity IS 'Alert severity: critical, warning, or info';
COMMENT ON COLUMN skynet.divergence_events.expected_hash IS 'Hash reported by majority of nodes';
COMMENT ON COLUMN skynet.divergence_events.divergent_hashes IS 'JSON map of hash to endpoint names reporting that hash';
