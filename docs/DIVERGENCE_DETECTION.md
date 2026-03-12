# Multi-Client Block Divergence Detection

## Overview

This document describes the multi-client block divergence detection system for XDC SkyNet, which monitors multiple XDC clients and detects consensus issues.

## What is Block Divergence?

Block divergence occurs when different XDC clients produce different block hashes for the same block number, indicating a consensus failure or chain split.

## Supported Clients

| Client | RPC Port | Status |
|--------|----------|--------|
| XDC Geth | 8545 | Production |
| Erigon-XDC | 8547 | Experimental |
| Nethermind-XDC | 8558 | Beta |
| Reth-XDC | 7073 | Alpha |

## How It Works

### 1. Configuration

```typescript
import { DivergenceDetector } from '@/lib/divergence-detector';

const detector = new DivergenceDetector({
  checkIntervalMs: 30000,  // Check every 30 seconds
  confirmationDepth: 6,    // Wait for 6 confirmations
  alertThreshold: 3,       // Alert after 3 divergent blocks
  clients: [
    {
      name: 'geth-main',
      type: 'geth',
      rpcUrl: 'http://localhost:8545',
      enabled: true,
    },
    {
      name: 'erigon-main',
      type: 'erigon',
      rpcUrl: 'http://localhost:8547',
      enabled: true,
    },
  ],
});

detector.start();
```

### 2. Detection Process

1. **Fetch blocks** from all enabled clients
2. **Compare hashes** at the same block number
3. **Identify majority** hash (if any)
4. **Report divergence** if clients disagree

### 3. Severity Levels

| Level | Condition | Action |
|-------|-----------|--------|
| Critical | No clear majority (>2 different hashes) | Immediate alert |
| Critical | Multiple clients diverged | Immediate alert |
| Warning | Single client diverged | Log and monitor |
| Info | Minor discrepancy | Log only |

## API Usage

### Check Specific Block

```typescript
import { divergenceDetector } from '@/lib/divergence-detector';

// Force check at specific block
const report = await divergenceDetector.forceCheck(89234567);

if (report) {
  console.error(`Divergence detected:`, report);
  // {
  //   blockNumber: 89234567,
  //   severity: 'critical',
  //   affectedClients: ['erigon-main'],
  //   expectedHash: '0xabc...',
  //   divergentBlocks: Map { 'erigon-main' => '0xdef...' }
  // }
}
```

### Compare Blocks

```typescript
import { compareBlocks } from '@/lib/divergence-detector';

const comparison = await compareBlocks(config, 89234567);

console.log(comparison);
// {
//   blockNumber: 89234567,
//   comparisons: [
//     { client: 'geth-main', hash: '0xabc...', stateRoot: '0x123...' },
//     { client: 'erigon-main', hash: '0xabc...', stateRoot: '0x123...' }
//   ],
//   matches: true
// }
```

### Get Status

```typescript
const status = detector.getStatus();

console.log(status);
// {
//   running: true,
//   lastCheckedBlock: 89234567,
//   consecutiveDivergences: 0,
//   totalDivergences: 2
// }
```

## Dashboard Integration

### Real-time Alerts

Divergence alerts appear in the SkyNet dashboard:

```typescript
// Alert format
{
  type: 'divergence',
  severity: 'critical',
  message: 'Block divergence detected at #89234567',
  metadata: {
    blockNumber: 89234567,
    affectedClients: ['erigon-main'],
    expectedHash: '0xabc...',
  },
}
```

### Historical View

View divergence history:

```typescript
const history = detector.getHistory();

// Display in dashboard
history.forEach(report => {
  console.log(`Block ${report.blockNumber}: ${report.severity}`);
});
```

## Environment Configuration

```bash
# .env

# Client RPC URLs
GETH_RPC_URL=http://localhost:8545
ERIGON_RPC_URL=http://localhost:8547
NETHERMIND_RPC_URL=http://localhost:8558
RETH_RPC_URL=http://localhost:7073

# Divergence detection
DIVERGENCE_CHECK_INTERVAL=30000
DIVERGENCE_CONFIRMATION_DEPTH=6
DIVERGENCE_ALERT_THRESHOLD=3
```

## Troubleshooting

### False Positives

If divergence is detected but clients are healthy:

1. **Check sync status** - Clients may be at different heights
2. **Verify RPC connectivity** - Ensure all endpoints are accessible
3. **Increase confirmation depth** - Wait for more confirmations

```typescript
const detector = new DivergenceDetector({
  confirmationDepth: 12,  // Increase from 6 to 12
});
```

### Client Unavailable

If a client is temporarily offline:

```typescript
{
  name: 'erigon-main',
  type: 'erigon',
  rpcUrl: 'http://localhost:8547',
  enabled: false,  // Disable temporarily
}
```

## Best Practices

1. **Run multiple clients** - At least 2 for divergence detection
2. **Use confirmation depth** - Wait for 6+ confirmations
3. **Monitor all clients** - Don't rely on single client
4. **Alert immediately** - Divergence indicates serious issue
5. **Investigate root cause** - Check client versions, config

## XDPoS 2.0 Considerations

### Epoch Boundaries

At epoch boundaries (every 900 blocks), gap blocks may cause temporary divergence:

```typescript
import { isEpochBoundary } from '@/lib/consensus';

// Gap blocks at epoch boundaries are expected
if (isEpochBoundary(blockNum + 1)) {
  // May see temporary divergence
}
```

### QC Validation

Ensure QC is valid before declaring divergence:

```typescript
import { validateQC } from '@/lib/consensus';

const validation = await validateQC(blockNum);
if (!validation.valid) {
  // QC issues, not necessarily client divergence
}
```

## References

- [XDPoS 2.0 Monitoring](XDPOS2_MONITORING.md)
- [Consensus Library](lib/consensus.ts)
- [Divergence Detector](lib/divergence-detector.ts)

---

**Last Updated:** 2026-02-27  
**Version:** 1.0.0
