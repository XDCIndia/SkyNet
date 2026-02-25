-- Data Retention Policy Implementation
-- Issue #281: Unbounded time-series growth

-- Function to cleanup old metrics (keep 90 days)
CREATE OR REPLACE FUNCTION skynet.cleanup_old_metrics()
RETURNS TABLE (
  metrics_deleted BIGINT,
  peers_deleted BIGINT,
  incidents_archived BIGINT
) AS $$
DECLARE
  v_metrics_deleted BIGINT;
  v_peers_deleted BIGINT;
  v_incidents_archived BIGINT;
BEGIN
  -- Delete metrics older than 90 days
  DELETE FROM skynet.node_metrics
  WHERE collected_at < NOW() - INTERVAL '90 days';
  GET DIAGNOSTICS v_metrics_deleted = ROW_COUNT;
  
  -- Delete peer snapshots older than 30 days
  DELETE FROM skynet.peer_snapshots
  WHERE collected_at < NOW() - INTERVAL '30 days';
  GET DIAGNOSTICS v_peers_deleted = ROW_COUNT;
  
  -- Archive old incidents (mark as archived instead of delete)
  UPDATE skynet.incidents
  SET status = 'archived'
  WHERE status != 'archived'
    AND created_at < NOW() - INTERVAL '180 days';
  GET DIAGNOSTICS v_incidents_archived = ROW_COUNT;
  
  -- Vacuum to reclaim space
  VACUUM ANALYZE skynet.node_metrics;
  VACUUM ANALYZE skynet.peer_snapshots;
  
  RETURN QUERY SELECT v_metrics_deleted, v_peers_deleted, v_incidents_archived;
END;
$$ LANGUAGE plpgsql;

-- Create maintenance log table
CREATE TABLE IF NOT EXISTS skynet.maintenance_log (
  id SERIAL PRIMARY KEY,
  operation VARCHAR(50) NOT NULL,
  metrics_deleted BIGINT,
  peers_deleted BIGINT,
  incidents_archived BIGINT,
  executed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comment on function
COMMENT ON FUNCTION skynet.cleanup_old_metrics() IS 
'Cleanup function for data retention policy: 
- Metrics: 90 days
- Peer snapshots: 30 days  
- Incidents: 180 days (archived)
Run daily via cron or pg_cron';
