# SkyNet - XDPoS 2.0 Integration Guide

## Overview

This guide covers integrating XDPoS 2.0 consensus monitoring into SkyNet for comprehensive validator and network health tracking.

## XDPoS 2.0 Concepts

### Epochs and Rounds

XDPoS 2.0 organizes consensus into:
- **Epochs**: 900 blocks (approximately 30 minutes)
- **Rounds**: Within each epoch for QC formation
- **Gap Blocks**: Special blocks at epoch boundaries

### Masternode Lifecycle

```
Candidate → Standby → Active Masternode → Penalized
                ↑___________________________|
```

States:
- **Candidate**: Registered but not in standby
- **Standby**: Eligible to join active set
- **Active**: Participating in consensus
- **Penalized**: Removed due to misbehavior

## Data Collection

### Extended Heartbeat API

Nodes should report XDPoS 2.0 metrics:

```json
{
  "nodeId": "550e8400-e29b-41d4-a716-446655440000",
  "blockHeight": 89234567,
  "consensus": {
    "epoch": 99150,
    "round": 5,
    "epochProgress": 45.2,
    "isMasternode": true,
    "inActiveSet": true,
    "voteParticipation": 0.98,
    "qcFormationTime": 1200,
    "timeoutCount": 0,
    "masternodesInEpoch": 108,
    "standbynodes": 25
  },
  "timestamp": "2026-02-26T12:00:00Z"
}
```

### Database Schema

```sql
-- Consensus metrics table
CREATE TABLE consensus_metrics (
  id SERIAL PRIMARY KEY,
  node_id UUID REFERENCES nodes(id),
  epoch INTEGER NOT NULL,
  round INTEGER NOT NULL,
  epoch_progress DECIMAL(5,2),
  is_masternode BOOLEAN,
  in_active_set BOOLEAN,
  vote_participation DECIMAL(5,4),
  qc_formation_time_ms INTEGER,
  timeout_count INTEGER,
  masternode_count INTEGER,
  standby_count INTEGER,
  collected_at TIMESTAMP DEFAULT NOW()
);

-- Create hypertable for time-series data
SELECT create_hypertable('consensus_metrics', 'collected_at');

-- Validator performance table
CREATE TABLE validator_performance (
  id SERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL,
  epoch INTEGER NOT NULL,
  blocks_produced INTEGER DEFAULT 0,
  blocks_missed INTEGER DEFAULT 0,
  votes_participated INTEGER DEFAULT 0,
  votes_missed INTEGER DEFAULT 0,
  avg_vote_latency_ms INTEGER,
  penalties INTEGER DEFAULT 0,
  stake_amount DECIMAL(30,0),
  UNIQUE(address, epoch)
);
```

## API Implementation

### Consensus Data Endpoint

```typescript
// app/api/v1/consensus/route.ts
import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const epoch = searchParams.get('epoch');
  
  try {
    const result = await query(`
      SELECT 
        epoch,
        AVG(vote_participation) as avg_participation,
        AVG(qc_formation_time_ms) as avg_qc_time,
        SUM(timeout_count) as total_timeouts,
        COUNT(DISTINCT node_id) as reporting_nodes
      FROM consensus_metrics
      WHERE epoch = $1
      GROUP BY epoch
    `, [epoch]);
    
    return Response.json({
      success: true,
      data: result.rows[0]
    });
  } catch (err) {
    return Response.json(
      { success: false, error: 'Failed to fetch consensus data' },
      { status: 500 }
    );
  }
}
```

### Masternode API

```typescript
// app/api/v1/masternodes/route.ts
export async function GET() {
  const result = await query(`
    SELECT 
      n.id,
      n.name,
      n.address,
      cm.epoch,
      cm.in_active_set,
      cm.vote_participation,
      vp.blocks_produced,
      vp.blocks_missed,
      vp.stake_amount
    FROM nodes n
    JOIN consensus_metrics cm ON n.id = cm.node_id
    LEFT JOIN validator_performance vp ON n.address = vp.address
    WHERE cm.is_masternode = true
    AND cm.collected_at > NOW() - INTERVAL '1 hour'
    ORDER BY vp.stake_amount DESC
  `);
  
  return Response.json({
    success: true,
    data: result.rows
  });
}
```

## Dashboard Components

### Epoch Monitor

```tsx
// components/EpochMonitor.tsx
'use client';

import { useEffect, useState } from 'react';

interface EpochData {
  epoch: number;
  round: number;
  progress: number;
  masternodes: number;
  standby: number;
}

export function EpochMonitor() {
  const [data, setData] = useState<EpochData | null>(null);
  
  useEffect(() => {
    const fetchEpoch = async () => {
      const res = await fetch('/api/v1/consensus/latest');
      const json = await res.json();
      setData(json.data);
    };
    
    fetchEpoch();
    const interval = setInterval(fetchEpoch, 30000);
    return () => clearInterval(interval);
  }, []);
  
  if (!data) return <div>Loading...</div>;
  
  return (
    <div className="epoch-monitor">
      <div className="epoch-number">Epoch {data.epoch}</div>
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${data.progress}%` }}
        />
      </div>
      <div className="epoch-stats">
        <span>Round: {data.round}</span>
        <span>Masternodes: {data.masternodes}</span>
        <span>Standby: {data.standby}</span>
      </div>
    </div>
  );
}
```

### Validator Leaderboard

```tsx
// components/ValidatorLeaderboard.tsx
interface Validator {
  address: string;
  name: string;
  stake: string;
  signingRate: number;
  blocksProduced: number;
  blocksMissed: number;
  rank: number;
}

export function ValidatorLeaderboard({ validators }: { validators: Validator[] }) {
  return (
    <table className="validator-table">
      <thead>
        <tr>
          <th>Rank</th>
          <th>Validator</th>
          <th>Stake</th>
          <th>Signing Rate</th>
          <th>Blocks</th>
        </tr>
      </thead>
      <tbody>
        {validators.map((v) => (
          <tr key={v.address}>
            <td>{v.rank}</td>
            <td>{v.name || v.address.slice(0, 20)}...</td>
            <td>{v.stake} XDC</td>
            <td>{(v.signingRate * 100).toFixed(2)}%</td>
            <td>{v.blocksProduced} / {v.blocksMissed}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## Alerting

### Consensus Alert Rules

```typescript
// lib/alert-rules/consensus.ts
export const consensusAlertRules = [
  {
    name: 'low_vote_participation',
    condition: (metrics: ConsensusMetrics) => 
      metrics.voteParticipation < 0.67,
    severity: 'critical',
    message: 'Vote participation below 67%'
  },
  {
    name: 'high_qc_formation_time',
    condition: (metrics: ConsensusMetrics) =>
      metrics.qcFormationTime > 5000,
    severity: 'warning',
    message: 'QC formation time exceeds 5 seconds'
  },
  {
    name: 'epoch_transition_delayed',
    condition: (metrics: ConsensusMetrics, blockHeight: number) =>
      blockHeight % 900 === 0 && metrics.round > 10,
    severity: 'critical',
    message: 'Epoch transition delayed'
  }
];
```

## Consensus Health Score

Calculate network-wide consensus health:

```typescript
// lib/consensus-health.ts
export function calculateConsensusHealth(
  metrics: ConsensusMetrics[]
): ConsensusHealth {
  const scores = {
    voteParticipation: calculateVoteScore(metrics),
    qcFormation: calculateQCScore(metrics),
    timeoutRate: calculateTimeoutScore(metrics),
    masternodeUptime: calculateUptimeScore(metrics)
  };
  
  const overall = Math.round(
    (scores.voteParticipation * 0.4) +
    (scores.qcFormation * 0.3) +
    (scores.timeoutRate * 0.2) +
    (scores.masternodeUptime * 0.1)
  );
  
  return {
    overallScore: overall,
    components: scores,
    status: overall >= 90 ? 'healthy' : overall >= 70 ? 'degraded' : 'critical'
  };
}
```

## Testing

### Local Testing

1. Start local XDC devnet:
```bash
docker-compose -f docker-compose.devnet.yml up -d
```

2. Run consensus data collector:
```bash
npm run test:consensus
```

3. Verify database entries:
```sql
SELECT * FROM consensus_metrics ORDER BY collected_at DESC LIMIT 10;
```

## References

- [XDPoS 2.0 Whitepaper](https://www.xdc.dev/xdc-foundation/xdpos-2-0-a-new-era-in-blockchain-consensus-4k9b)
- [XDPoSChain RPC Documentation](https://github.com/XinFinOrg/XDPoSChain/wiki/RPC-API)
- [TimescaleDB Documentation](https://docs.timescale.com/)

---
*Document Version: 1.0*
*Last Updated: February 26, 2026*
