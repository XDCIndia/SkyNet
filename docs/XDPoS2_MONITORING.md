# XDPoS 2.0 Consensus Monitoring Guide

## Overview

XDPoS 2.0 is the consensus mechanism used by the XDC Network. This guide covers monitoring the consensus layer for node operators and network administrators.

## Consensus Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Epoch Length | 900 blocks | Blocks per epoch |
| Gap Blocks | 450 | Blocks before epoch end with no production |
| Masternodes | 108 | Total validator set |
| Quorum | 73 votes | 2/3 + 1 for QC formation |
| Timeout | 10 seconds | Initial timeout period |

## Epoch Structure

```
Epoch N (900 blocks total)
├── Blocks 0-449: Normal block production
├── Blocks 450-899: Gap blocks (no production)
│   └── Vote collection for epoch N+1
└── Block 900: Epoch transition
```

## Consensus Flow

### Normal Operation

```
1. Leader Selection (Round Robin)
   ↓
2. Block Proposal
   ↓
3. Vote Collection (from masternodes)
   ↓
4. QC Formation (2/3 + 1 votes)
   ↓
5. Block Finalization
   ↓
6. Next Round
```

### Timeout Scenario

```
1. Block Proposal
   ↓
2. Timeout (insufficient votes)
   ↓
3. Timeout Certificate Broadcast
   ↓
4. New Round with Exponential Backoff
   ↓
5. Retry
```

## Monitoring Metrics

### Critical Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Vote Latency | < 500ms | > 1000ms |
| QC Formation Time | < 2000ms | > 5000ms |
| Timeout Rate | < 1% | > 5% |
| Vote Participation | > 95% | < 67% |
| Block Production Rate | 2s/block | > 5s/block |

### Epoch Transition Monitoring

```sql
-- Track epoch transitions
CREATE TABLE skynet.epoch_transitions (
  id BIGSERIAL PRIMARY KEY,
  epoch INT NOT NULL,
  transition_block BIGINT NOT NULL,
  transition_time_ms INT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Gap Block Monitoring

Gap blocks (blocks 450-899 of each epoch) are critical for consensus:

- No block production occurs
- Masternodes continue to vote
- Vote collection for next epoch
- Masternode set may change

### Gap Block Alerts

```typescript
// Alert if masternode misses gap block voting
function checkGapBlockParticipation(
  epoch: number,
  masternode: string,
  votes: Vote[]
): Alert | null {
  const gapBlocks = getGapBlocks(epoch);
  const missedVotes = gapBlocks.filter(block => 
    !votes.some(v => v.blockNumber === block)
  );
  
  if (missedVotes.length > gapBlocks.length * 0.1) {
    return {
      type: 'gap_block_missed',
      severity: 'high',
      masternode,
      missedVotes
    };
  }
  
  return null;
}
```

## Vote Propagation

### Vote Message Structure

```go
type Vote struct {
    ProposedBlockInfo *BlockInfo
    Signature         []byte
    GapNumber         uint64
}

type BlockInfo struct {
    Hash        common.Hash
    Number      *big.Int
    Round       int
    Timestamp   uint64
}
```

### Vote Latency Tracking

```sql
-- Track vote latency by masternode
CREATE TABLE skynet.vote_latency (
  id BIGSERIAL PRIMARY KEY,
  block_number BIGINT NOT NULL,
  round INT NOT NULL,
  masternode VARCHAR(42) NOT NULL,
  latency_ms INT NOT NULL,
  received_at TIMESTAMPTZ DEFAULT NOW()
);

-- Query average vote latency by masternode
SELECT 
  masternode,
  AVG(latency_ms) as avg_latency,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms) as p95_latency
FROM skynet.vote_latency
WHERE received_at > NOW() - INTERVAL '1 hour'
GROUP BY masternode
ORDER BY avg_latency DESC;
```

## QC Formation

### QC Structure

```go
type QuorumCert struct {
    ProposedBlockInfo *BlockInfo
    Signatures        []VoteSignature
}

type VoteSignature struct {
    SignedAddress common.Address
    Signature     []byte
}
```

### QC Formation Time

```sql
-- Track QC formation time
CREATE TABLE skynet.qc_formation (
  id BIGSERIAL PRIMARY KEY,
  block_number BIGINT NOT NULL,
  round INT NOT NULL,
  proposal_at TIMESTAMPTZ NOT NULL,
  qc_formed_at TIMESTAMPTZ NOT NULL,
  formation_time_ms INT NOT NULL,
  votes_count INT NOT NULL,
  timeout_occurred BOOLEAN DEFAULT false
);

-- Query average QC formation time
SELECT 
  DATE_TRUNC('hour', proposal_at) as hour,
  AVG(formation_time_ms) as avg_formation_time,
  COUNT(*) FILTER (WHERE timeout_occurred) as timeout_count
FROM skynet.qc_formation
WHERE proposal_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;
```

## Timeout Monitoring

### Timeout Certificate

When a QC cannot be formed within the timeout period:

1. Masternodes broadcast timeout messages
2. Timeout certificate (TC) is formed
3. New round starts with exponential backoff
4. Leader may be penalized

### Timeout Tracking

```sql
-- Track timeout events
CREATE TABLE skynet.timeout_events (
  id BIGSERIAL PRIMARY KEY,
  block_number BIGINT NOT NULL,
  round INT NOT NULL,
  timeout_ms INT NOT NULL,
  votes_received INT NOT NULL,
  masternodes_timeout VARCHAR(42)[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Find masternodes with frequent timeouts
SELECT 
  UNNEST(masternodes_timeout) as masternode,
  COUNT(*) as timeout_count
FROM skynet.timeout_events
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY masternode
ORDER BY timeout_count DESC
LIMIT 10;
```

## Consensus Health Score

### Calculation

```typescript
interface ConsensusHealthMetrics {
  avgVoteLatency: number;
  avgQCFormationTime: number;
  timeoutRate: number;
  voteParticipation: number;
}

function calculateConsensusHealth(metrics: ConsensusHealthMetrics): number {
  const weights = {
    avgVoteLatency: 0.3,
    avgQCFormationTime: 0.3,
    timeoutRate: 0.25,
    voteParticipation: 0.15
  };
  
  // Normalize metrics to 0-100 scale
  const latencyScore = Math.max(0, 100 - (metrics.avgVoteLatency / 10));
  const qcScore = Math.max(0, 100 - (metrics.avgQCFormationTime / 50));
  const timeoutScore = Math.max(0, 100 - (metrics.timeoutRate * 100));
  const participationScore = metrics.voteParticipation * 100;
  
  return Math.round(
    latencyScore * weights.avgVoteLatency +
    qcScore * weights.avgQCFormationTime +
    timeoutScore * weights.timeoutRate +
    participationScore * weights.voteParticipation
  );
}
```

### Health Score Interpretation

| Score | Status | Action |
|-------|--------|--------|
| 90-100 | Excellent | Monitor |
| 70-89 | Good | Monitor |
| 50-69 | Fair | Investigate |
| 30-49 | Poor | Alert |
| 0-29 | Critical | Immediate Action |

## Monitoring Implementation

### Prometheus Metrics

```yaml
# Consensus metrics for Prometheus
consensus_vote_latency_seconds:
  type: histogram
  labels: [masternode, block_number]
  
consensus_qc_formation_seconds:
  type: histogram
  labels: [round]
  
consensus_timeouts_total:
  type: counter
  labels: [round, reason]
  
consensus_vote_participation_ratio:
  type: gauge
  labels: [epoch]
  
consensus_epoch_transition_duration_seconds:
  type: histogram
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "XDPoS 2.0 Consensus Health",
    "panels": [
      {
        "title": "Vote Latency",
        "type": "graph",
        "targets": [
          {
            "expr": "avg(consensus_vote_latency_seconds) by (masternode)"
          }
        ]
      },
      {
        "title": "QC Formation Time",
        "type": "graph",
        "targets": [
          {
            "expr": "avg(consensus_qc_formation_seconds)"
          }
        ]
      },
      {
        "title": "Consensus Health Score",
        "type": "gauge",
        "targets": [
          {
            "expr": "consensus_health_score"
          }
        ]
      }
    ]
  }
}
```

## Troubleshooting

### High Vote Latency

**Symptoms:**
- Vote latency > 1000ms
- QC formation time increasing

**Possible Causes:**
1. Network congestion
2. Geographic distribution
3. Slow masternode hardware
4. P2P connection issues

**Resolution:**
```bash
# Check network latency to peers
xdc network ping --peers

# Check peer geographic distribution
xdc network geo

# Restart P2P connections
xdc network restart-p2p
```

### Frequent Timeouts

**Symptoms:**
- Timeout rate > 5%
- Block production delays

**Possible Causes:**
1. Insufficient masternode participation
2. Network partitions
3. Clock skew
4. Software bugs

**Resolution:**
```bash
# Check masternode participation
xdc consensus participation --epoch current

# Check for network partitions
xdc network partition-check

# Verify system clock
ntpdate -q pool.ntp.org
```

### Epoch Transition Failures

**Symptoms:**
- Epoch transition takes > 30 seconds
- Masternode set not updating

**Possible Causes:**
1. Gap block vote collection failure
2. Smart contract issues
3. Network congestion during transition

**Resolution:**
```bash
# Check epoch transition logs
xdc logs --filter "epoch" --tail 1000

# Verify masternode contract state
xdc contract masternodes --epoch next
```

## References

- [XDPoS 2.0 Specification](https://github.com/XinFinOrg/XDPoSChain/wiki/XDPoS-2.0)
- [Consensus Implementation](https://github.com/XinFinOrg/XDPoSChain/tree/master/consensus/XDPoS)
- [Vote Collection Logic](https://github.com/XinFinOrg/XDPoSChain/blob/master/consensus/XDPoS/engines/engine_v2/vote.go)
