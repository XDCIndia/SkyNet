# SkyNet XDPoS 2.0 Integration Guide

## Overview

This guide covers integrating XDPoS 2.0 consensus monitoring into SkyNet for comprehensive masternode fleet management.

## XDPoS 2.0 Concepts

### Consensus Participants

| Role | Description | Count |
|------|-------------|-------|
| Masternodes | Active validators producing blocks | 108 |
| Standby Nodes | Waiting to become masternodes | Variable |
| Penalized Nodes | Temporarily removed from set | Variable |

### Epoch Lifecycle

```
Epoch N (blocks 1-900)
├── Blocks 1-449: Normal operation
├── Blocks 450-899: Vote collection for Epoch N+1
│   └── Masternodes vote on next epoch's validator set
└── Block 900: Epoch transition
    └── New masternode set takes effect

Epoch N+1 (blocks 901-1800)
└── ... repeats
```

## SkyNet Integration Architecture

### Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ XDC Nodes   │────▶│ SkyNet API  │────▶│ PostgreSQL  │
│ (Masternodes)│     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ Dashboard   │
                    │ (Next.js)   │
                    └─────────────┘
```

### Consensus Data Collection

#### Heartbeat Extension

```typescript
interface XDPoSHeartbeat {
  nodeId: string;
  blockHeight: number;
  epoch: number;
  round: number;
  
  // XDPoS-specific metrics
  consensus: {
    isMasternode: boolean;
    masternodeAddress?: string;
    voteParticipation: number;
    blocksProducedThisEpoch: number;
    blocksMissedThisEpoch: number;
    lastVoteTimestamp?: string;
    qcFormationTime: number;
  };
  
  // Penalty status
  penalties: {
    currentStatus: 'active' | 'penalized' | 'standby';
    totalPenalties: number;
    lastPenaltyReason?: string;
  };
}
```

#### API Endpoints

```typescript
// Register masternode
POST /api/v1/masternodes/register
{
  "nodeId": "uuid",
  "masternodeAddress": "xdc...",
  "stakeAmount": "10000000000"
}

// Submit consensus metrics
POST /api/v1/masternodes/consensus-metrics
{
  "nodeId": "uuid",
  "epoch": 6171,
  "metrics": {
    "votesCast": 850,
    "votesMissed": 5,
    "blocksProduced": 8,
    "avgQcFormationTime": 450
  }
}

// Get epoch status
GET /api/v1/network/epoch
{
  "epoch": 6171,
  "blockNumber": 5553900,
  "blocksUntilNextEpoch": 300,
  "voteCollectionActive": true,
  "masternodeCount": 108,
  "totalStake": "1080000000000"
}
```

## Dashboard Features

### 1. Epoch Monitor

```typescript
// components/EpochMonitor.tsx
interface EpochMonitorProps {
  currentEpoch: number;
  blocksUntilNext: number;
  voteCollectionActive: boolean;
  qcStatus: 'forming' | 'formed' | 'timeout';
}

export function EpochMonitor(props: EpochMonitorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Epoch {props.currentEpoch}</CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={(900 - props.blocksUntilNext) / 9} />
        <div className="flex justify-between">
          <span>Blocks until epoch: {props.blocksUntilNext}</span>
          <Badge variant={props.voteCollectionActive ? "default" : "secondary"}>
            Vote Collection {props.voteCollectionActive ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 2. Masternode Leaderboard

```typescript
// components/MasternodeLeaderboard.tsx
interface MasternodeStats {
  address: string;
  rank: number;
  stake: string;
  performance: {
    voteParticipation: number;
    blocksProduced: number;
    avgQcTime: number;
  };
  penalties: number;
  healthScore: number;
}

export function MasternodeLeaderboard({ masternodes }: { masternodes: MasternodeStats[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Rank</TableHead>
          <TableHead>Address</TableHead>
          <TableHead>Stake</TableHead>
          <TableHead>Vote %</TableHead>
          <TableHead>Health</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {masternodes.map((m) => (
          <TableRow key={m.address}>
            <TableCell>{m.rank}</TableCell>
            <TableCell>{m.address}</TableCell>
            <TableCell>{formatXdc(m.stake)}</TableCell>
            <TableCell>{m.performance.voteParticipation}%</TableCell>
            <TableCell>
              <HealthScoreBadge score={m.healthScore} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

### 3. Consensus Health Score

```typescript
// lib/consensus-health.ts
interface ConsensusHealthComponents {
  voteParticipation: number;  // 0-100
  qcFormation: number;        // 0-100
  roundStability: number;     // 0-100
  blockProduction: number;    // 0-100
}

function calculateHealthScore(components: ConsensusHealthComponents): number {
  const weights = {
    voteParticipation: 0.3,
    qcFormation: 0.3,
    roundStability: 0.2,
    blockProduction: 0.2
  };
  
  return Math.round(
    components.voteParticipation * weights.voteParticipation +
    components.qcFormation * weights.qcFormation +
    components.roundStability * weights.roundStability +
    components.blockProduction * weights.blockProduction
  );
}

function getHealthGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
```

## Database Schema

### Masternode Table

```sql
CREATE TABLE netown.masternodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address VARCHAR(42) UNIQUE NOT NULL,
    node_id UUID REFERENCES netown.nodes(id),
    stake_amount NUMERIC(30, 0),
    status VARCHAR(20) DEFAULT 'active',
    first_epoch INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_masternodes_status ON netown.masternodes(status);
CREATE INDEX idx_masternodes_node ON netown.masternodes(node_id);
```

### Consensus Metrics Table

```sql
CREATE TABLE netown.consensus_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID REFERENCES netown.nodes(id),
    epoch INTEGER NOT NULL,
    round INTEGER,
    block_height INTEGER NOT NULL,
    
    -- Vote metrics
    votes_cast INTEGER DEFAULT 0,
    votes_missed INTEGER DEFAULT 0,
    vote_participation_rate DECIMAL(5, 2),
    avg_vote_latency_ms INTEGER,
    
    -- Block metrics
    blocks_produced INTEGER DEFAULT 0,
    blocks_missed INTEGER DEFAULT 0,
    
    -- QC metrics
    qc_formation_time_ms INTEGER,
    round_changes INTEGER DEFAULT 0,
    timeout_certificates INTEGER DEFAULT 0,
    
    collected_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_consensus_metrics_node_epoch ON netown.consensus_metrics(node_id, epoch);
CREATE INDEX idx_consensus_metrics_collected ON netown.consensus_metrics(collected_at);
```

### Epoch History Table

```sql
CREATE TABLE netown.epoch_history (
    epoch INTEGER PRIMARY KEY,
    start_block INTEGER NOT NULL,
    end_block INTEGER NOT NULL,
    masternode_count INTEGER,
    total_stake NUMERIC(30, 0),
    avg_vote_participation DECIMAL(5, 2),
    avg_qc_formation_time_ms INTEGER,
    completed_at TIMESTAMP
);
```

## Alerting Rules

### Critical Alerts

```yaml
# alerts/consensus.yml
groups:
  - name: xdpos-critical
    rules:
      - alert: LowVoteParticipation
        expr: |
          (
            SELECT AVG(vote_participation_rate) 
            FROM netown.consensus_metrics 
            WHERE collected_at > NOW() - INTERVAL '5 minutes'
          ) < 0.90
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Vote participation below 90%"
          
      - alert: MasternodePenaltyRisk
        expr: |
          SELECT COUNT(*) FROM netown.consensus_metrics cm
          JOIN netown.masternodes m ON cm.node_id = m.node_id
          WHERE cm.votes_missed > 50 
          AND cm.collected_at > NOW() - INTERVAL '1 hour'
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Masternode at risk of penalty"
```

## Implementation Checklist

### Phase 1: Data Collection
- [ ] Extend heartbeat payload with XDPoS metrics
- [ ] Create consensus metrics API endpoints
- [ ] Implement epoch tracking
- [ ] Add masternode registration

### Phase 2: Dashboard
- [ ] Build epoch monitor component
- [ ] Create masternode leaderboard
- [ ] Implement health scoring display
- [ ] Add consensus metrics charts

### Phase 3: Alerting
- [ ] Configure vote participation alerts
- [ ] Add penalty risk alerts
- [ ] Set up epoch transition notifications
- [ ] Create consensus health alerts

### Phase 4: Analytics
- [ ] Build performance trend analysis
- [ ] Implement penalty prediction
- [ ] Create epoch comparison reports
- [ ] Add masternode profitability tracking

## References

- [XDPoS 2.0 Whitepaper](https://docs.xdc.network)
- [XDC Network Consensus](https://docs.xdc.network/consensus)
- [SkyNet API Documentation](API.md)
- [XDC EVM Expert Validation Report](../XDC_VALIDATION_REPORT.md)
