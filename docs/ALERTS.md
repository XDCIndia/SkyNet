# XDCNetOwn (SkyNet) - Alert Configuration

## Overview

This document describes the alerting system in XDCNetOwn (SkyNet), including alert types, severity levels, routing rules, and configuration options.

## Alert Types

### Node Health Alerts

| Alert Type | Description | Default Severity |
|------------|-------------|------------------|
| `node_offline` | Node not reporting heartbeats | Critical |
| `sync_stall` | Block sync stopped progressing | High |
| `peer_drop` | Peer count dropped significantly | High |
| `disk_critical` | Disk usage exceeded threshold | Critical |
| `memory_high` | Memory usage exceeded threshold | Warning |
| `cpu_high` | CPU usage exceeded threshold | Warning |
| `rpc_error` | RPC endpoint not responding | High |

### XDPoS 2.0 Consensus Alerts

| Alert Type | Description | Default Severity |
|------------|-------------|------------------|
| `qc_timeout` | QC formation taking too long | Warning |
| `timeout_spike` | Multiple consecutive timeouts | Critical |
| `masternode_offline` | Masternode not participating | High |
| `epoch_stall` | Epoch transition failed | Critical |
| `fork_detected` | Blockchain fork detected | Critical |
| `vote_participation_low` | Vote participation below threshold | Warning |

### Security Alerts

| Alert Type | Description | Default Severity |
|------------|-------------|------------------|
| `unauthorized_access` | Unauthorized API access attempt | High |
| `privilege_escalation` | Privilege escalation detected | Critical |
| `suspicious_activity` | Anomalous behavior detected | Warning |
| `bad_block` | Invalid block detected | Critical |

## Severity Levels

### Critical (🔴)

- Immediate action required
- PagerDuty/OpsGenie notification
- Phone call for on-call engineer
- Auto-escalation if not acknowledged in 5 minutes

### High (🟠)

- Action required within 1 hour
- Slack/Discord notification
- Email to operations team
- GitHub issue auto-created

### Warning (🟡)

- Monitor situation
- Dashboard notification
- Email digest
- Logged for trend analysis

### Info (🔵)

- Informational only
- Dashboard log
- No notification

## Alert Configuration

### Global Configuration

```yaml
# alerts.yaml
global:
  # Default notification channels
  channels:
    - slack
    - email
  
  # Rate limiting
  rateLimit:
    maxAlertsPerHour: 100
    groupBy: [nodeId, alertType]
    groupWait: 30s
    groupInterval: 5m
    repeatInterval: 4h
  
  # Inhibition rules
  inhibitRules:
    - sourceMatch:
        severity: critical
      targetMatch:
        severity: warning
      equal: [nodeId]
```

### Node-Specific Configuration

```yaml
# Node-specific overrides
nodes:
  - nodeId: "550e8400-e29b-41d4-a716-446655440000"
    name: "xdc-node-01"
    alerts:
      disk_critical:
        threshold: 85  # Override default 90%
        severity: high  # Override default critical
      
      sync_stall:
        threshold: 300  # 5 minutes
        severity: critical
    
    # Custom notification channels
    channels:
      - slack: "#xdc-node-01-alerts"
      - pagerduty: "service-key-123"
```

### Threshold Configuration

```yaml
thresholds:
  disk:
    warning: 70
    critical: 90
  
  memory:
    warning: 80
    critical: 95
  
  cpu:
    warning: 70
    critical: 90
    duration: 5m  # Must exceed for 5 minutes
  
  peers:
    min: 10
    warning: 15
  
  sync:
    stallDuration: 600  # 10 minutes
    maxLag: 100  # blocks
  
  xdpos:
    qcTimeout: 5000  # 5 seconds
    minVoteParticipation: 90  # percentage
    maxTimeoutsPerEpoch: 5
```

## Notification Channels

### Slack

```yaml
channels:
  slack:
    webhookUrl: "https://hooks.slack.com/services/..."
    channel: "#xdc-alerts"
    username: "SkyNet Bot"
    icon: ":warning:"
    
    # Severity routing
    routing:
      critical: "#xdc-critical"
      high: "#xdc-alerts"
      warning: "#xdc-warnings"
```

### PagerDuty

```yaml
channels:
  pagerduty:
    serviceKey: "your-service-key"
    severityMapping:
      critical: critical
      high: error
      warning: warning
```

### Email

```yaml
channels:
  email:
    smtp:
      host: "smtp.example.com"
      port: 587
      username: "alerts@example.com"
      password: "${SMTP_PASSWORD}"
      tls: true
    
    recipients:
      critical: ["oncall@example.com", "manager@example.com"]
      high: ["ops@example.com"]
      warning: ["alerts@example.com"]
```

### Webhook

```yaml
channels:
  webhook:
    url: "https://your-service.com/webhook"
    headers:
      Authorization: "Bearer ${WEBHOOK_TOKEN}"
    
    # Custom payload template
    template: |
      {
        "alert": "{{alert.name}}",
        "node": "{{node.name}}",
        "severity": "{{alert.severity}}",
        "message": "{{alert.message}}",
        "timestamp": "{{alert.timestamp}}"
      }
```

### Discord

```yaml
channels:
  discord:
    webhookUrl: "https://discord.com/api/webhooks/..."
    username: "SkyNet Alerts"
    avatarUrl: "https://..."
```

## Alert Routing

### Routing Rules

```yaml
routing:
  # Route by severity
  - match:
      severity: critical
    channels: [pagerduty, slack-critical, email-critical]
    continue: false
  
  # Route by alert type
  - match:
      alertType: sync_stall
    channels: [slack-alerts, email-ops]
    continue: true
  
  # Route by node role
  - match:
      nodeRole: masternode
    channels: [slack-masternodes]
    continue: true
  
  # Default route
  - match:
      severity: warning
    channels: [slack-warnings]
```

### Time-Based Routing

```yaml
routing:
  businessHours:
    schedule: "mon-fri 09:00-17:00"
    timezone: "America/New_York"
    channels: [slack, email]
  
  afterHours:
    schedule: "mon-fri 17:00-09:00, sat-sun"
    channels: [pagerduty, slack-critical]
```

## Alert Deduplication

### Deduplication Logic

```typescript
interface DeduplicationKey {
  nodeId: string;
  alertType: string;
  fingerprint: string;  // Hash of relevant fields
}

function shouldDeduplicate(newAlert: Alert, existingAlerts: Alert[]): boolean {
  const window = 24 * 60 * 60 * 1000;  // 24 hours
  
  return existingAlerts.some(existing =>
    existing.nodeId === newAlert.nodeId &&
    existing.type === newAlert.type &&
    existing.status === 'open' &&
    (Date.now() - existing.lastSeen.getTime()) < window
  );
}
```

### Deduplication Configuration

```yaml
deduplication:
  enabled: true
  window: 24h
  
  # Fields to match for deduplication
  matchFields:
    - nodeId
    - alertType
    - severity
  
  # Fields that can change without breaking deduplication
  ignoreFields:
    - timestamp
    - message
    - value
```

## Alert Templates

### Message Templates

```yaml
templates:
  default: |
    **{{alert.severity}}**: {{alert.title}}
    
    Node: {{node.name}} ({{node.host}})
    Time: {{alert.timestamp}}
    
    {{alert.description}}
    
    [View Details]({{alert.dashboardUrl}})
  
  slack: |
    {
      "attachments": [{
        "color": "{{alert.color}}",
        "title": "{{alert.title}}",
        "text": "{{alert.description}}",
        "fields": [
          {"title": "Node", "value": "{{node.name}}", "short": true},
          {"title": "Severity", "value": "{{alert.severity}}", "short": true}
        ],
        "footer": "SkyNet",
        "ts": {{alert.unixTimestamp}}
      }]
    }
  
  email: |
    Subject: [{{alert.severity}}] {{alert.title}} - {{node.name}}
    
    Alert Details:
    ==============
    
    Node: {{node.name}} ({{node.host}})
    Severity: {{alert.severity}}
    Type: {{alert.type}}
    Time: {{alert.timestamp}}
    
    Description:
    {{alert.description}}
    
    Diagnostics:
    {{alert.diagnostics}}
    
    ---
    View in Dashboard: {{alert.dashboardUrl}}
```

## Auto-Remediation

### Remediation Actions

```yaml
autoRemediation:
  enabled: true
  
  actions:
    sync_stall:
      - action: restart_node
        delay: 5m
        requireConfirmation: false
        maxExecutionsPerHour: 2
      
    peer_drop:
      - action: refresh_peers
        delay: 2m
        requireConfirmation: false
      
    disk_critical:
      - action: notify_admin
        delay: 0s
        requireConfirmation: true
      - action: clean_logs
        delay: 10m
        requireConfirmation: false
```

### Action Definitions

```typescript
interface RemediationAction {
  name: string;
  description: string;
  execute: (nodeId: string, alert: Alert) => Promise<Result>;
  rollback?: (nodeId: string) => Promise<void>;
}

const actions: Record<string, RemediationAction> = {
  restart_node: {
    name: "Restart Node",
    description: "Restart the XDC node container",
    execute: async (nodeId) => {
      await fetch(`/api/v1/nodes/${nodeId}/restart`, {
        method: 'POST'
      });
    }
  },
  
  refresh_peers: {
    name: "Refresh Peers",
    description: "Clear and rediscover peers",
    execute: async (nodeId) => {
      await fetch(`/api/v1/nodes/${nodeId}/peers/refresh`, {
        method: 'POST'
      });
    }
  }
};
```

## Alert History

### Retention Policy

```yaml
retention:
  critical: 1year
  high: 6months
  warning: 3months
  info: 1month
  
  # Archive to S3 after retention
  archive:
    enabled: true
    bucket: "skynet-alerts-archive"
    prefix: "alerts/"
```

### Alert Analytics

```sql
-- Alert frequency by type
SELECT 
  alert_type,
  severity,
  COUNT(*) as count,
  AVG(resolution_time) as avg_resolution_time
FROM alerts
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY alert_type, severity
ORDER BY count DESC;

-- Alert trends
SELECT 
  DATE_TRUNC('day', created_at) as date,
  COUNT(*) as total_alerts,
  COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical
FROM alerts
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date;
```

## Testing Alerts

### Test Alert Endpoint

```bash
# Send test alert
curl -X POST https://xdc.openscan.ai/api/v1/alerts/test \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "sync_stall",
    "severity": "high",
    "nodeId": "550e8400-e29b-41d4-a716-446655440000"
  }'
```

### Alert Simulation

```yaml
# Simulate alerts for testing
simulation:
  enabled: false  # Set to true for testing
  
  scenarios:
    - name: "High CPU Load"
      nodeId: "test-node-1"
      alertType: "cpu_high"
      severity: warning
      duration: 10m
      interval: 30s
    
    - name: "Sync Stall"
      nodeId: "test-node-2"
      alertType: "sync_stall"
      severity: high
      duration: 15m
```

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [API.md](./API.md) - API reference
- [DASHBOARD.md](./DASHBOARD.md) - Dashboard features
- [METRICS.md](./METRICS.md) - Metrics collection
