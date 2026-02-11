-- Alert Rules and History Tables
-- Run this against the xdc_gateway database

-- Alert rules table
CREATE TABLE IF NOT EXISTS netown.alert_rules (
  id SERIAL PRIMARY KEY,
  node_id UUID REFERENCES netown.nodes(id) ON DELETE CASCADE, -- null = all nodes
  type VARCHAR(50) NOT NULL, -- node_down, sync_stall, peer_drop, disk_full, block_drift, custom
  condition JSONB NOT NULL, -- {"threshold": 85, "duration_minutes": 5}
  channels JSONB NOT NULL, -- [{"type":"telegram","botToken":"...","chatId":"..."}]
  is_active BOOLEAN DEFAULT true,
  cooldown_minutes INT DEFAULT 30,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_alert_rules_node_id ON netown.alert_rules(node_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_type ON netown.alert_rules(type);
CREATE INDEX IF NOT EXISTS idx_alert_rules_active ON netown.alert_rules(is_active);

-- Alert history table
CREATE TABLE IF NOT EXISTS netown.alert_history (
  id BIGSERIAL PRIMARY KEY,
  rule_id INT REFERENCES netown.alert_rules(id) ON DELETE SET NULL,
  node_id UUID REFERENCES netown.nodes(id) ON DELETE SET NULL,
  incident_id BIGINT REFERENCES netown.incidents(id) ON DELETE SET NULL,
  channels_notified TEXT[],
  message TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for history lookups
CREATE INDEX IF NOT EXISTS idx_alert_history_rule_id ON netown.alert_history(rule_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_node_id ON netown.alert_history(node_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_sent_at ON netown.alert_history(sent_at DESC);

-- Add client_version column to nodes if not exists (for display)
ALTER TABLE netown.nodes ADD COLUMN IF NOT EXISTS client_version VARCHAR(100);

-- Insert some default alert rules (optional)
INSERT INTO netown.alert_rules (node_id, type, condition, channels, is_active, cooldown_minutes)
SELECT 
  NULL, -- applies to all nodes
  'node_down',
  '{"timeout_minutes": 5}'::jsonb,
  '[]'::jsonb, -- no channels configured by default
  true,
  30
WHERE NOT EXISTS (SELECT 1 FROM netown.alert_rules WHERE type = 'node_down' AND node_id IS NULL);

INSERT INTO netown.alert_rules (node_id, type, condition, channels, is_active, cooldown_minutes)
SELECT 
  NULL,
  'disk_full',
  '{"threshold": 85}'::jsonb,
  '[]'::jsonb,
  true,
  60
WHERE NOT EXISTS (SELECT 1 FROM netown.alert_rules WHERE type = 'disk_full' AND node_id IS NULL);

INSERT INTO netown.alert_rules (node_id, type, condition, channels, is_active, cooldown_minutes)
SELECT 
  NULL,
  'peer_drop',
  '{"min_peers": 3}'::jsonb,
  '[]'::jsonb,
  true,
  15
WHERE NOT EXISTS (SELECT 1 FROM netown.alert_rules WHERE type = 'peer_drop' AND node_id IS NULL);

INSERT INTO netown.alert_rules (node_id, type, condition, channels, is_active, cooldown_minutes)
SELECT 
  NULL,
  'sync_stall',
  '{"unchanged_heartbeats": 3}'::jsonb,
  '[]'::jsonb,
  true,
  30
WHERE NOT EXISTS (SELECT 1 FROM netown.alert_rules WHERE type = 'sync_stall' AND node_id IS NULL);

-- Grant permissions
GRANT ALL ON netown.alert_rules TO gateway;
GRANT ALL ON netown.alert_history TO gateway;
GRANT USAGE, SELECT ON SEQUENCE netown.alert_rules_id_seq TO gateway;
GRANT USAGE, SELECT ON SEQUENCE netown.alert_history_id_seq TO gateway;
