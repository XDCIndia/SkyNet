-- Add stall tracking columns to node_metrics
ALTER TABLE skynet.node_metrics 
ADD COLUMN IF NOT EXISTS stall_hours REAL DEFAULT 0,
ADD COLUMN IF NOT EXISTS stalled_at_block BIGINT DEFAULT 0;

-- Add index for queries filtering by stall
CREATE INDEX IF NOT EXISTS idx_metrics_stall 
ON skynet.node_metrics(node_id, stall_hours DESC) 
WHERE stall_hours > 0;

COMMENT ON COLUMN skynet.node_metrics.stall_hours IS 'Hours the node has been stuck on the same block';
COMMENT ON COLUMN skynet.node_metrics.stalled_at_block IS 'Block number where the node got stuck';
