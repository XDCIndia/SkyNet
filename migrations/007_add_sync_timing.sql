-- Migration: Add sync timing tracking columns to skynet.nodes
-- Tracks when a node began syncing, when it reached chain tip,
-- total sync duration, and block range covered during the sync.

ALTER TABLE skynet.nodes
ADD COLUMN IF NOT EXISTS sync_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sync_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sync_duration_seconds BIGINT,
ADD COLUMN IF NOT EXISTS sync_start_block BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS sync_target_block BIGINT;

-- Index for efficiently querying nodes that are actively syncing
CREATE INDEX IF NOT EXISTS idx_nodes_sync_started_at
ON skynet.nodes(sync_started_at)
WHERE sync_started_at IS NOT NULL;

COMMENT ON COLUMN skynet.nodes.sync_started_at IS 'Timestamp when the node began syncing from its start block';
COMMENT ON COLUMN skynet.nodes.sync_completed_at IS 'Timestamp when the node finished syncing and reached chain tip';
COMMENT ON COLUMN skynet.nodes.sync_duration_seconds IS 'Total elapsed seconds from sync_started_at to sync_completed_at';
COMMENT ON COLUMN skynet.nodes.sync_start_block IS 'Block height at which the sync began';
COMMENT ON COLUMN skynet.nodes.sync_target_block IS 'Highest known block height used as the sync target';
