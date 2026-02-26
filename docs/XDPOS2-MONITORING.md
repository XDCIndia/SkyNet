# XDCNetOwn (SkyNet) - XDPoS 2.0 Monitoring

## Overview

This document describes the specialized monitoring capabilities for XDPoS 2.0 consensus in XDCNetOwn (SkyNet).

## XDPoS 2.0 Monitoring Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    XDPoS 2.0 Monitoring                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌────────┐ │
│  │  XDC     │────▶│  Vote/   │────▶│  SkyNet  │────▶│  DB    │ │
│  │  Node    │     │  Timeout │     │  Agent   │     │(Store) │ │
│  │          │     │  Events  │     │          │     │        │ │
│  └──────────┘     └──────────┘     └──────────┘     └───┬────┘ │
│                                                          │      │
│  ┌──────────┐                                           │      │
│  │  Masternode│◀─────────────────────────────────────────┘      │
│  │  List    │                                                  │
│  └──────────┘                                                  │
│       │                                                        │
│       ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Consensus Analysis Engine                   │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────────────────┐  │   │
│  │  │  Epoch    │ │  QC       │ │  Health               │  │   │
│  │  │  Tracker  │ │  Analyzer │ │  Scoring              │  │   │
│  │  └───────────┘ └───────────┘ └───────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Dashboard & Alerting                        │   │
│  │  ┌───────────┐ ┌───────────┐ ┌───────────────────────┐  │   │
│  │  │  Epoch    │ │  Masternode│ │  Consensus            │  │   │
│  │  │  View     │ │  Dashboard │ │  Health               │  │   │
│  │  └───────────┘ └───────────┘ └───────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Monitored Metrics

### Epoch Metrics

| Metric | Description | Collection Frequency |
|--------|-------------|---------------------|
| `xdpos_epoch_number` | Current epoch number | Every block |
| `xdpos_epoch_start_block` | First block of epoch | Epoch change |
| `xdpos_epoch_end_block` | Last block of epoch | Epoch change |
| `xdpos_epoch_progress` | Percentage through epoch | Every block |
| `xdpos_epoch_duration` | Time to complete epoch | Epoch end |

### Quorum Certificate (QC) Metrics

| Metric | Description | Collection Frequency |
|--------|-------------|---------------------|
| `xdpos_qc_formation_time_ms` | Time to form QC | Per QC |
| `xdpos_qc_vote_count` | Number of votes in QC | Per QC |
| `xdpos_qc_timeout_count` | Timeouts before QC | Per block |
| `xdpos_qc_failed_count` | Failed QC formations | Per epoch |

### Vote Metrics

| Metric | Description | Collection Frequency |
|--------|-------------|---------------------|
| `xdpos_vote_participation_percent` | % of masternodes voting | Per block |
| `xdpos_vote_latency_ms` | Time to receive votes | Per vote |
| `xdpos_vote_by_masternode` | Vote count per masternode | Per epoch |
| `xdpos_missed_votes` | Masternodes not voting | Per block |

### Timeout Metrics

| Metric | Description | Collection Frequency |
|--------|-------------|---------------------|
| `xdpos_timeout_count` | Total timeouts in epoch | Per epoch |
| `xdpos_timeout_certificate_time_ms` | Time to form TC | Per TC |
| `xdpos_consecutive_timeouts` | Max consecutive timeouts | Per epoch |
| `xdpos_timeout_by_masternode` | Timeouts per masternode | Per epoch |

### Masternode Metrics

| Metric | Description | Collection Frequency |
|--------|-------------|---------------------|
| `xdpos_masternode_active` | Active masternodes | Every block |
| `xdpos_masternode_offline` | Offline masternodes | Every block |
| `xdpos_masternode_penalty` | Penalized masternodes | Per epoch |
| `xdpos_masternode_stake` | Stake per masternode | Per epoch |

## Data Collection

### Vote Collection

```typescript
interface VoteEvent {
  blockHash: string;
  blockNumber: bigint;
  epoch: number;
  round: number;
  masternode: string;  // Address
  signature: string;
  timestamp: Date;
  latencyMs: number;   // Time from proposal to vote
}

async function collectVote(vote: VoteEvent): Promise<void> {
  await db.votes.insert({
    ...vote,
    receivedAt: new Date()
  });
  
  // Update real-time metrics
  metrics.xdposVoteLatency.observe(vote.latencyMs);
  metrics.xdposVoteParticipation.inc();
}
```

### QC Formation Tracking

```typescript
interface QCEvent {
  blockHash: string;
  blockNumber: bigint;
  epoch: number;
  round: number;
  votes: string[];  // Masternode addresses
  formationTimeMs: number;
  timestamp: Date;
}

async function trackQCFormation(qc: QCEvent): Promise<void> {
  await db.qcEvents.insert(qc);
  
  // Calculate and store QC metrics
  const metric: QCMetric = {
    blockNumber: qc.blockNumber,
    epoch: qc.epoch,
    formationTimeMs: qc.formationTimeMs,
    voteCount: qc.votes.length,
    voteParticipation: (qc.votes.length / 108) * 100
  };
  
  await db.qcMetrics.insert(metric);
}
```

### Timeout Tracking

```typescript
interface TimeoutEvent {
  epoch: number;
  round: number;
  masternode: string;
  timestamp: Date;
  consecutiveCount: number;
}

async function trackTimeout(timeout: TimeoutEvent): Promise<void> {
  await db.timeoutEvents.insert(timeout);
  
  // Check for timeout storms
  const recentTimeouts = await db.timeoutEvents.count({
    epoch: timeout.epoch,
    timestamp: { $gt: new Date(Date.now() - 60000) }
  });
  
  if (recentTimeouts > 10) {
    await alertService.create({
      type: 'timeout_storm',
      severity: 'critical',
      message: `High timeout rate detected: ${recentTimeouts} in last minute`
    });
  }
}
```

## Consensus Health Scoring

### Health Score Components

```typescript
interface ConsensusHealthScore {
  overall: number;  // 0-100
  components: {
    qcFormation: number;      // 0-30
    voteParticipation: number; // 0-40
    timeoutRate: number;      // 0-30
  };
  epoch: number;
  timestamp: Date;
}

function calculateConsensusHealth(metrics: EpochMetrics): ConsensusHealthScore {
  // QC Formation Score (0-30)
  const qcScore = Math.max(0, 30 - (metrics.avgQCFormationTime / 500));
  
  // Vote Participation Score (0-40)
  const participationScore = (metrics.avgVoteParticipation / 100) * 40;
  
  // Timeout Rate Score (0-30)
  const timeoutRate = metrics.timeoutCount / 900;  // per epoch
  const timeoutScore = Math.max(0, 30 - (timeoutRate * 300));
  
  return {
    overall: qcScore + participationScore + timeoutScore,
    components: {
      qcFormation: qcScore,
      voteParticipation: participationScore,
      timeoutRate: timeoutScore
    },
    epoch: metrics.epoch,
    timestamp: new Date()
  };
}
```

### Health Score Interpretation

| Score | Status | Description |
|-------|--------|-------------|
| 90-100 | 🟢 Excellent | Consensus operating optimally |
| 70-89 | 🟡 Good | Minor issues, monitoring recommended |
| 50-69 | 🟠 Fair | Performance degradation, investigation needed |
| 0-49 | 🔴 Poor | Critical issues, immediate action required |

## Dashboard Views

### Epoch Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│                    XDPoS 2.0 - Epoch 99150                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Progress: [████████████████████░░░░░░░░] 67% (603/900 blocks) │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Start Block    │  │  Current Block  │  │  End Block      │ │
│  │  89,235,000     │  │  89,235,603     │  │  89,235,900     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                  │
│  Consensus Health: 🟢 97/100                                     │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  QC Formation   │  │  Vote Part.     │  │  Timeouts       │ │
│  │  450ms avg      │  │  98.5%          │  │  2 total        │ │
│  │  Score: 28/30   │  │  Score: 39/40   │  │  Score: 30/30   │ │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Masternode Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│                    Masternode Status (108)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Active: 108/108 🟢    Offline: 0    Penalized: 0               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Rank  │ Address              │ Stake    │ Performance  │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │  1     │ 0x1234...5678       │ 10M XDC  │ 99.9% 🟢     │   │
│  │  2     │ 0xabcd...ef01       │ 9.5M XDC │ 99.8% 🟢     │   │
│  │  ...   │ ...                  │ ...      │ ...          │   │
│  │  108   │ 0x9876...5432       │ 1M XDC   │ 95.2% 🟡     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Performance = (Votes Cast / Total Blocks) × 100                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### QC Formation Timeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    QC Formation Timeline                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Block 603: ████████████████████████████████████████ 450ms    │
│  Block 602: ██████████████████████████████ 320ms              │
│  Block 601: ████████████████████████████████████████████ 520ms│
│  Block 600: ██████████████████████████████████ 400ms          │
│  ...                                                            │
│                                                                  │
│  Average: 420ms    Min: 280ms    Max: 650ms                    │
│                                                                  │
│  ⚠️ Blocks 501, 445 had timeouts (>1000ms)                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Alerting

### XDPoS-Specific Alerts

```yaml
alerts:
  xdpos:
    - name: qc_timeout
      condition: qc_formation_time > 5000
      severity: warning
      message: "QC formation taking longer than 5 seconds"
      
    - name: timeout_spike
      condition: timeout_count > 5 in 10 minutes
      severity: critical
      message: "High timeout rate detected"
      
    - name: low_vote_participation
      condition: vote_participation < 90
      severity: warning
      message: "Vote participation below 90%"
      
    - name: masternode_offline
      condition: active_masternodes < 100
      severity: high
      message: "More than 8 masternodes offline"
      
    - name: epoch_stall
      condition: epoch_progress == last_epoch_progress for 5 minutes
      severity: critical
      message: "Epoch transition appears stalled"
      
    - name: fork_detected
      condition: competing_blocks > 0
      severity: critical
      message: "Blockchain fork detected"
```

### Alert Routing

```yaml
routing:
  xdpos_critical:
    match:
      severity: critical
      category: xdpos
    channels:
      - pagerduty
      - slack: "#xdpos-critical"
      - email: "consensus-team@example.com"
    
  xdpos_warnings:
    match:
      severity: [warning, high]
      category: xdpos
    channels:
      - slack: "#xdpos-alerts"
      - email: "ops@example.com"
```

## API Endpoints

### Get Epoch Information

```http
GET /consensus/epoch/{epochNumber}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "epochNumber": 99150,
    "startBlock": 89235000,
    "endBlock": 89235900,
    "masternodes": 108,
    "blocksProduced": 900,
    "avgBlockTime": 2.1,
    "avgQCFormationTime": 450,
    "totalTimeouts": 2,
    "avgVoteParticipation": 98.5,
    "healthScore": 97
  }
}
```

### Get Masternode Performance

```http
GET /consensus/masternodes/{address}/performance?epoch=99150
```

**Response:**

```json
{
  "success": true,
  "data": {
    "address": "0x1234...5678",
    "epoch": 99150,
    "stake": "10000000000000000000000000",
    "blocksProposed": 8,
    "votesCast": 892,
    "votesMissed": 8,
    "participationRate": 99.1,
    "avgVoteLatency": 120,
    "timeouts": 0,
    "penalties": 0,
    "rank": 5
  }
}
```

### Get QC Statistics

```http
GET /consensus/qc/stats?epoch=99150
```

**Response:**

```json
{
  "success": true,
  "data": {
    "epoch": 99150,
    "totalQCs": 898,
    "failedQCs": 2,
    "avgFormationTime": 450,
    "minFormationTime": 280,
    "maxFormationTime": 650,
    "p95FormationTime": 580,
    "p99FormationTime": 620,
    "avgVoteCount": 106.5,
    "avgParticipation": 98.5
  }
}
```

## Historical Analysis

### Epoch Comparison

```sql
-- Compare epoch performance over time
SELECT 
    epoch,
    avg_qc_formation_time,
    total_timeouts,
    avg_vote_participation,
    health_score
FROM epoch_metrics
WHERE epoch > 99000
ORDER BY epoch;

-- Find worst performing epochs
SELECT 
    epoch,
    health_score,
    total_timeouts,
    avg_qc_formation_time
FROM epoch_metrics
WHERE health_score < 70
ORDER BY health_score ASC
LIMIT 10;
```

### Masternode Leaderboard

```sql
-- Top performing masternodes
SELECT 
    masternode_address,
    avg(participation_rate) as avg_participation,
    sum(timeouts) as total_timeouts,
    count(*) as epochs_active
FROM masternode_performance
WHERE epoch > 99000
GROUP BY masternode_address
ORDER BY avg_participation DESC
LIMIT 20;
```

## Integration with SkyNet

### Automatic Issue Creation

```typescript
async function createConsensusIssue(event: ConsensusEvent): Promise<void> {
  if (event.type === 'timeout_storm') {
    await github.createIssue({
      title: `[CRITICAL] Timeout storm in epoch ${event.epoch}`,
      body: `
## Summary
High timeout rate detected in epoch ${event.epoch}

## Details
- Timeouts: ${event.timeoutCount}
- Affected masternodes: ${event.affectedMasternodes.join(', ')}
- Duration: ${event.duration}ms

## Suggested Actions
1. Check network connectivity between masternodes
2. Verify masternode hardware resources
3. Review recent configuration changes
      `,
      labels: ['xdpos', 'critical', 'consensus']
    });
  }
}
```

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [API.md](./API.md) - API reference
- [DASHBOARD.md](./DASHBOARD.md) - Dashboard features
- [METRICS.md](./METRICS.md) - Metrics collection
