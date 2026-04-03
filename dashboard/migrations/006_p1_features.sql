-- Migration: P1 Feature additions
-- Issue #24: Direct WS Bridge — ws_url column for node WS endpoints
-- Issue #33: Block hash divergence events table
-- Issue #36: Reth FCU status columns
-- Issue #60: API key rate-limit tracking (per-key counters)

-- #24: ws_url for direct WS subscription
ALTER TABLE skynet.nodes
  ADD COLUMN IF NOT EXISTS ws_url TEXT;

-- #36: Reth FCU monitor columns
ALTER TABLE skynet.nodes
  ADD COLUMN IF NOT EXISTS fcu_status    TEXT,
  ADD COLUMN IF NOT EXISTS fcu_checked_at TIMESTAMPTZ;

-- #33: Block hash divergence events
CREATE TABLE IF NOT EXISTS skynet.block_divergence_events (
  id            BIGSERIAL PRIMARY KEY,
  block_height  BIGINT       NOT NULL,
  node_a_id     TEXT         NOT NULL REFERENCES skynet.nodes(id) ON DELETE CASCADE,
  node_a_hash   TEXT         NOT NULL,
  node_b_id     TEXT         NOT NULL REFERENCES skynet.nodes(id) ON DELETE CASCADE,
  node_b_hash   TEXT         NOT NULL,
  detected_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_divergence_block_height
  ON skynet.block_divergence_events (block_height DESC);

CREATE INDEX IF NOT EXISTS idx_divergence_detected_at
  ON skynet.block_divergence_events (detected_at DESC);

-- #33: alerts table fingerprint column (for idempotent inserts)
ALTER TABLE skynet.alerts
  ADD COLUMN IF NOT EXISTS fingerprint TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_fingerprint
  ON skynet.alerts (fingerprint)
  WHERE fingerprint IS NOT NULL;

-- #60: API key request counters (optional, rate-limiter is in-memory by default)
ALTER TABLE skynet.api_keys
  ADD COLUMN IF NOT EXISTS rate_limit_rpm   INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS requests_this_min INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rate_window_start TIMESTAMPTZ DEFAULT NOW();
