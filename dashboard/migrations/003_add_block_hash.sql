-- Migration: Add block_hash column to node_metrics table
-- Issue #452 - Network Fork Detection System

ALTER TABLE skynet.node_metrics 
ADD COLUMN IF NOT EXISTS block_hash VARCHAR(66);

-- Add index for efficient fork detection queries
CREATE INDEX IF NOT EXISTS idx_metrics_block_hash 
ON skynet.node_metrics(block_hash) 
WHERE block_hash IS NOT NULL;

-- Add index for block height + hash combination queries
CREATE INDEX IF NOT EXISTS idx_metrics_height_hash 
ON skynet.node_metrics(block_height, block_hash) 
WHERE block_hash IS NOT NULL;
