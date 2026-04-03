-- Issue #40: Peer Injection Log
-- Tracks when and how many peers were injected into each node.
-- Used by the node detail panel to show "Last peer injection: 5 min ago (+12 peers)".

CREATE TABLE IF NOT EXISTS skynet.peer_injection_log (
  id              BIGSERIAL PRIMARY KEY,
  node_id         TEXT NOT NULL REFERENCES skynet.nodes(id) ON DELETE CASCADE,
  injected_count  INT NOT NULL DEFAULT 0,
  failed_count    INT NOT NULL DEFAULT 0,
  source          TEXT NOT NULL DEFAULT 'manual', -- 'manual' | 'auto' | 'skynet'
  injected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_peer_injection_log_node_time
  ON skynet.peer_injection_log (node_id, injected_at DESC);

COMMENT ON TABLE skynet.peer_injection_log IS
  'Append-only log of peer injection events. Each row records how many peers were injected into a node and from which source.';
