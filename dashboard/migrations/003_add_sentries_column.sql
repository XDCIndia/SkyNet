-- Migration: Add sentries JSONB column to node_metrics for Erigon dual sentry monitoring
-- Issue #14

ALTER TABLE skynet.node_metrics ADD COLUMN IF NOT EXISTS sentries JSONB;

-- Add comment for documentation
COMMENT ON COLUMN skynet.node_metrics.sentries IS 'Erigon dual sentry P2P data: [{ port, protocol, peers }]';