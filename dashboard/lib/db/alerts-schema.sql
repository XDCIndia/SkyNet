-- Alert system tables for multi-channel notifications

-- Alert rules
CREATE TABLE IF NOT EXISTS netown.alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  node_id UUID REFERENCES netown.nodes(id) ON DELETE CASCADE,
  condition_type VARCHAR(50) NOT NULL CHECK (condition_type IN ('node_offline', 'sync_behind', 'disk_usage', 'peer_count', 'cpu_usage', 'memory_usage')),
  threshold_value NUMERIC(10,2) NOT NULL,
  duration_minutes INT DEFAULT 5,
  severity VARCHAR(10) NOT NULL DEFAULT 'warning' CHECK (severity IN ('critical', 'warning', 'info')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alert_rules_node ON netown.alert_rules(node_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_active ON netown.alert_rules(is_active);

-- Alert notification channels
CREATE TABLE IF NOT EXISTS netown.alert_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  channel_type VARCHAR(20) NOT NULL CHECK (channel_type IN ('telegram', 'email', 'webhook')),
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table: rules to channels (many-to-many)
CREATE TABLE IF NOT EXISTS netown.alert_rule_channels (
  rule_id UUID REFERENCES netown.alert_rules(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES netown.alert_channels(id) ON DELETE CASCADE,
  PRIMARY KEY (rule_id, channel_id)
);

-- Alert history
CREATE TABLE IF NOT EXISTS netown.alert_history (
  id BIGSERIAL PRIMARY KEY,
  rule_id UUID REFERENCES netown.alert_rules(id) ON DELETE SET NULL,
  node_id UUID REFERENCES netown.nodes(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES netown.alert_channels(id) ON DELETE SET NULL,
  severity VARCHAR(10) NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT,
  status VARCHAR(20) DEFAULT 'firing' CHECK (status IN ('firing', 'acknowledged', 'resolved')),
  fired_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  acknowledged_by VARCHAR(100),
  metadata JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_alert_history_node ON netown.alert_history(node_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_status ON netown.alert_history(status, fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_history_fired ON netown.alert_history(fired_at DESC);

-- Update trigger for alert_rules
DROP TRIGGER IF EXISTS update_alert_rules_updated_at ON netown.alert_rules;
CREATE TRIGGER update_alert_rules_updated_at
    BEFORE UPDATE ON netown.alert_rules
    FOR EACH ROW
    EXECUTE FUNCTION netown.update_updated_at_column();

-- Update trigger for alert_channels
DROP TRIGGER IF EXISTS update_alert_channels_updated_at ON netown.alert_channels;
CREATE TRIGGER update_alert_channels_updated_at
    BEFORE UPDATE ON netown.alert_channels
    FOR EACH ROW
    EXECUTE FUNCTION netown.update_updated_at_column();
