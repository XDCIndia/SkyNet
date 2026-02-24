# XDC SkyNet - XDPoS 2.0 Monitoring Guide

## Overview

This guide explains how to monitor XDPoS 2.0 consensus using XDC SkyNet, including epoch tracking, masternode performance, and consensus health metrics.

## XDPoS 2.0 Architecture

### Consensus Parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| Epoch Length | 900 blocks | ~30 minutes per epoch |
| Masternodes | 108 | Active validators per epoch |
| Block Time | ~2 seconds | Target block interval |
| Quorum | 73 votes | 2/3 + 1 of 108 masternodes |
| Penalty Threshold | Missed blocks | Removal from active set |

### Key Components

```
┌─────────────────────────────────────────────────────────┐
│                    XDPoS 2.0 Consensus                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐    ┌──────────────┐                  │
│  │   Masternode │───▶│   Propose    │                  │
│  │   (Round Robin)   │   Block      │                  │
│  └──────────────┘    └──────┬───────┘                  │
│                             │                           │
│                             ▼                           │
│  ┌──────────────┐    ┌──────────────┐                  │
│  │  73+ Votes   │◀───│    Vote      │                  │
│  │  (Quorum)    │    │              │                  │
│  └──────┬───────┘    └──────────────┘                  │
│         │                                               │
│         ▼                                               │
│  ┌──────────────┐                                      │
│  │      QC      │  Quorum Certificate                   │
│  │   (Signed)   │  Block finalized                      │
│  └──────────────┘                                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## SkyNet XDPoS Monitoring Features

### 1. Epoch Dashboard

**Metrics Tracked:**
- Current epoch number
- Epoch progress (blocks / 900)
- Time remaining in epoch
- Masternode set for current epoch

**API Endpoint:**
```bash
GET /api/v1/consensus/epoch

Response:
{
  "epoch": 99150,
  "startBlock": 89235000,
  "currentBlock": 89235456,
  "endBlock": 89235900,
  "progress": 50.7,
  "masternodes": 108,
  "estimatedEndTime": "2026-02-25T07:30:00Z"
}
```

### 2. Masternode Performance

**Per-Masternode Metrics:**
```typescript
interface MasternodeMetrics {
  address: string;           // XDC address
  name?: string;             // Registered name
  epoch: number;             // Current epoch
  
  // Voting metrics
  votesCast: number;         // Successful votes
  votesMissed: number;       // Missed votes
  participationRate: number; // votesCast / (votesCast + votesMissed)
  
  // Performance metrics
  avgVoteLatency: number;    // Average vote latency (ms)
  blocksProposed: number;    // Blocks proposed this epoch
  qcContributions: number;   // QCs this masternode participated in
  
  // Status
  status: 'active' | 'standby' | 'penalty';
  inActiveSet: boolean;
  lastSeen: Date;
}
```

**API Endpoint:**
```bash
GET /api/v1/masternodes?epoch=99150

Response:
{
  "epoch": 99150,
  "total": 108,
  "active": 108,
  "masternodes": [
    {
      "address": "0x9475074f...",
      "name": "XDC Foundation Node 1",
      "participationRate": 98.5,
      "avgVoteLatency": 45,
      "status": "active"
    }
  ]
}
```

### 3. Vote Analysis

**Network-Wide Vote Metrics:**
```bash
GET /api/v1/consensus/votes?epoch=99150

Response:
{
  "epoch": 99150,
  "totalVotes": 892,
  "totalPossible": 900,
  "participationRate": 99.1,
  
  "quorumFormation": {
    "avgTimeMs": 1200,
    "p50": 800,
    "p95": 2500,
    "p99": 4500
  },
  
  "timeoutCertificates": 2,
  "gapBlocks": 0
}
```

### 4. Gap Block Detection

Gap blocks indicate consensus issues. SkyNet tracks:
- Gap block frequency
- Consecutive gap blocks
- Recovery time after gaps

```bash
GET /api/v1/consensus/gap-blocks?hours=24

Response:
{
  "totalGapBlocks": 3,
  "maxConsecutive": 1,
  "avgRecoveryTimeMs": 4500,
  "gaps": [
    {
      "height": 89234567,
      "timestamp": "2026-02-25T06:15:30Z",
      "recoveryTimeMs": 4200,
      "affectedRound": 5
    }
  ]
}
```

## Alerting

### XDPoS-Specific Alerts

```yaml
# alerts/xdpos.yml
alerts:
  - name: epoch_transition_delay
    condition: epoch_duration > 40m
    severity: warning
    message: "Epoch transition taking longer than expected"
    
  - name: low_vote_participation
    condition: participation_rate < 90%
    severity: critical
    message: "Vote participation below 90%"
    
  - name: consecutive_gap_blocks
    condition: consecutive_gaps >= 3
    severity: critical
    message: "Multiple consecutive gap blocks detected"
    
  - name: masternode_penalty
    condition: masternode.status == 'penalty'
    severity: warning
    message: "Masternode entered penalty status"
    
  - name: slow_qc_formation
    condition: qc_formation_time > 5s
    severity: warning
    message: "QC formation is slow, possible network issues"
```

## Database Schema

### XDPoS Tables

```sql
-- Epoch tracking
CREATE TABLE skynet.epochs (
  epoch_number INTEGER PRIMARY KEY,
  start_block INTEGER NOT NULL,
  end_block INTEGER NOT NULL,
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration_seconds INTEGER,
  masternodes TEXT[] NOT NULL,
  total_votes INTEGER DEFAULT 0,
  timeout_certificates INTEGER DEFAULT 0,
  gap_blocks INTEGER DEFAULT 0
);

-- Masternode performance per epoch
CREATE TABLE skynet.masternode_epoch_stats (
  id SERIAL PRIMARY KEY,
  epoch_number INTEGER REFERENCES skynet.epochs(epoch_number),
  address VARCHAR(42) NOT NULL,
  votes_cast INTEGER DEFAULT 0,
  votes_missed INTEGER DEFAULT 0,
  blocks_proposed INTEGER DEFAULT 0,
  avg_vote_latency_ms INTEGER,
  qc_contributions INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(epoch_number, address)
);

-- Gap blocks
CREATE TABLE skynet.gap_blocks (
  block_height INTEGER PRIMARY KEY,
  epoch_number INTEGER REFERENCES skynet.epochs(epoch_number),
  timestamp TIMESTAMP,
  round INTEGER,
  recovery_time_ms INTEGER,
  previous_block_height INTEGER
);

-- Indexes
CREATE INDEX idx_masternode_stats_epoch ON skynet.masternode_epoch_stats(epoch_number);
CREATE INDEX idx_masternode_stats_address ON skynet.masternode_epoch_stats(address);
CREATE INDEX idx_gap_blocks_epoch ON skynet.gap_blocks(epoch_number);
```

## Implementation Guide

### 1. Enable XDPoS Monitoring

```bash
# In skynet-agent.conf
XDPOS_MONITORING_ENABLED=true
XDPOS_RPC_URL=http://localhost:8545
XDPOS_ALERT_GAP_BLOCKS=3
XDPOS_ALERT_EPOCH_DELAY=40m
```

### 2. Collect XDPoS Metrics

```typescript
// lib/xdpos-collector.ts
export async function collectXDPoSMetrics() {
  const currentBlock = await rpc.getBlockNumber();
  const epoch = Math.floor(currentBlock / 900);
  
  // Get masternodes
  const masternodes = await rpc.call('XDPoS_getMasternodesByNumber', ['latest']);
  
  // Get epoch info
  const epochInfo = await rpc.call('XDPoS_getEpochNumber', ['latest']);
  
  // Store in database
  await db.query(`
    INSERT INTO skynet.epochs (epoch_number, start_block, end_block, masternodes)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (epoch_number) DO UPDATE SET
      masternodes = EXCLUDED.masternodes
  `, [epoch, epoch * 900, (epoch + 1) * 900 - 1, masternodes]);
}
```

### 3. Dashboard Widgets

```typescript
// components/XDPoSWidgets.tsx
export function EpochProgressWidget() {
  const { epoch } = useEpoch();
  const progress = ((epoch.currentBlock - epoch.startBlock) / 900) * 100;
  
  return (
    <Widget title="Epoch Progress">
      <ProgressBar value={progress} max={100} />
      <Text>Epoch {epoch.number}: {progress.toFixed(1)}%</Text>
      <Text>~{formatDuration(epoch.estimatedTimeRemaining)} remaining</Text>
    </Widget>
  );
}

export function MasternodeLeaderboard() {
  const { masternodes } = useMasternodes();
  
  return (
    <Widget title="Masternode Performance">
      <Table>
        <thead>
          <tr>
            <th>Node</th>
            <th>Participation</th>
            <th>Latency</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {masternodes.map(mn => (
            <tr key={mn.address}>
              <td>{mn.name || shortenAddress(mn.address)}</td>
              <td>{mn.participationRate}%</td>
              <td>{mn.avgVoteLatency}ms</td>
              <td><StatusBadge status={mn.status} /></td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Widget>
  );
}
```

## Troubleshooting

### High Gap Block Frequency

**Symptoms:**
- Multiple gap blocks per epoch
- Slow block production

**Investigation:**
```bash
# Check masternode participation
SELECT address, votes_missed, status
FROM skynet.masternode_epoch_stats
WHERE epoch_number = (SELECT MAX(epoch_number) FROM skynet.epochs)
ORDER BY votes_missed DESC
LIMIT 10;

# Check network latency between masternodes
# (Requires peer latency data from agents)
```

### Epoch Transition Delays

**Symptoms:**
- Epoch takes > 40 minutes
- Masternode set changes delayed

**Investigation:**
```bash
# Check epoch duration history
SELECT epoch_number, duration_seconds, timeout_certificates
FROM skynet.epochs
ORDER BY epoch_number DESC
LIMIT 10;

# Check for penalty events
SELECT * FROM skynet.masternode_epoch_stats
WHERE status = 'penalty'
ORDER BY created_at DESC
LIMIT 10;
```

## Best Practices

### For SkyNet Operators

1. **Monitor Vote Participation**
   - Alert if < 95% for more than 5 minutes
   - Track trends over multiple epochs

2. **Track Gap Block Patterns**
   - 1-2 gap blocks per epoch is normal
   - > 5 gap blocks indicates issues

3. **Watch Masternode Rotation**
   - Monitor new masternodes joining
   - Track penalty frequency

4. **Set Appropriate Thresholds**
   - Adjust based on network conditions
   - Use historical data for baselines

### For Masternode Operators

1. **Maintain High Availability**
   - Target 99.9%+ uptime
   - Monitor vote participation in SkyNet

2. **Optimize Network Latency**
   - Low latency to other masternodes
   - Stable internet connection

3. **Stay Informed**
   - Watch for penalty warnings
   - Respond to alerts quickly

## Resources

- [XDPoS 2.0 Technical Specification](https://docs.xdc.network/consensus)
- [XDC Masternode Guide](https://docs.xdc.network/masternode)
- [SkyNet API Documentation](./API.md)

---

*Last updated: 2026-02-25*
