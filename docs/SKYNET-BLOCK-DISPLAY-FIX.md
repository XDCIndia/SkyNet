# SkyNet Node Block Display Fix

## Problem Statement

Nodes were successfully sending heartbeats to SkyNet ("Heartbeat OK" in agent logs) but the SkyNet dashboard showed:
- `block: None` or `block: null`
- `peers: None` or `peers: null`
- `is_syncing: null`

The heartbeat history table was receiving data, but the main nodes table wasn't being updated.

---

## Root Cause Analysis

### 1. Wrong Node ID (APO Reth Case)
The agent was using a node ID from a different server:
```
Agent env: SKYNET_NODE_ID=bfc81f68-aaee-4ee5-a2d3-a38543c7c29a
This ID belonged to: gcx-apothem-reth-v2 (GCX server)
Actual APO Reth needed its own node ID
```

### 2. Missing Database Columns
The `skynet.nodes` table was missing columns to store real-time metrics:
```sql
-- These columns did NOT exist:
- block_height (BIGINT)
- peer_count (INT)
- is_syncing (BOOLEAN)
```

### 3. Missing UPDATE Query
The heartbeat API was inserting to `node_metrics` (history) but NOT updating `nodes` (current state):
```typescript
// BEFORE - Only inserted to history:
await query(
  `INSERT INTO skynet.node_metrics (...block_height...) VALUES (...)`,
  [...]
);

// Nodes table was never updated with current values!
```

---

## Solution Applied

### Step 1: Register Correct Node (if needed)

If the agent is using a wrong node ID, register a new node:

```bash
curl -X POST "https://net.xdc.network/api/v1/nodes/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "apo-reth-185",
    "host": "185.180.220.183",
    "network": "apothem",
    "client": "reth",
    "role": "fullnode"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "nodeId": "1f17c6b2-b21c-48b5-8f48-a1a5dfcb2069",
    "apiKey": "xdc_4dcc29a575654b7edf26594dcdd897e0f2ec3d6e2ab24503fa51efc9ba57340f"
  }
}
```

Update the agent with the new `SKYNET_NODE_ID` and `SKYNET_API_KEY`.

### Step 2: Add Missing Database Columns

Connect to PostgreSQL and add the columns:

```bash
PGPASSWORD=gateway psql -U gateway -h 127.0.0.1 -p 5433 -d xdc_gateway -c "
ALTER TABLE skynet.nodes 
  ADD COLUMN IF NOT EXISTS block_height BIGINT,
  ADD COLUMN IF NOT EXISTS peer_count INT,
  ADD COLUMN IF NOT EXISTS is_syncing BOOLEAN;
"
```

### Step 3: Update Heartbeat API

Edit `dashboard/app/api/v1/nodes/[id]/heartbeat/route.ts`:

**Add to UPDATE query:**
```typescript
await query(
  `UPDATE skynet.nodes 
   SET last_seen = NOW(), 
       is_active = true,
       block_height = COALESCE($2, block_height),
       peer_count = COALESCE($3, peer_count),
       is_syncing = COALESCE($4, is_syncing),
       client_type = COALESCE($5, client_type),
       -- ... rest of columns
   WHERE id = $1`,
  [
    nodeId,
    blockHeight ? Number(blockHeight) : null,  // Convert to number!
    peerCount ? Number(peerCount) : null,
    isSyncing ?? null,
    // ... rest of params
  ]
);
```

**Key fixes:**
- Use `Number(blockHeight)` to prevent `pg_strtoint32_safe` error
- Use `Number(peerCount)` for same reason
- Place these params at positions $2, $3, $4 (shift others accordingly)

### Step 4: Rebuild and Restart

```bash
cd dashboard
npm run build
pm2 restart xdcnetown
```

### Step 5: Verify

1. **Check agent logs:**
```bash
docker logs agent-reth-apo | grep heartbeat
# Should show: "[SkyNet] ✅ Heartbeat OK"
```

2. **Check API response:**
```bash
curl -s "https://net.xdc.network/api/nodes/{NODE_ID}" | jq '.node.block_height'
# Should show: 6260262 (not null)
```

3. **Check dashboard:**
Visit https://net.xdc.network - node should show block, peers, and sync status.

---

## Quick Recreation Script

If you need to apply this fix to a new server or after a fresh install:

```bash
#!/bin/bash
# skynet-fix-block-display.sh

set -e

echo "=== SkyNet Block Display Fix ==="

# 1. Database columns
echo "Adding database columns..."
PGPASSWORD=gateway psql -U gateway -h 127.0.0.1 -p 5433 -d xdc_gateway << 'EOF'
ALTER TABLE skynet.nodes 
  ADD COLUMN IF NOT EXISTS block_height BIGINT,
  ADD COLUMN IF NOT EXISTS peer_count INT,
  ADD COLUMN IF NOT EXISTS is_syncing BOOLEAN;
EOF

# 2. Rebuild dashboard
echo "Rebuilding SkyNet dashboard..."
cd /root/.openclaw/workspace/XDCNetOwn/dashboard
npm run build

# 3. Restart PM2
echo "Restarting xdcnetown..."
pm2 restart xdcnetown

echo "=== Fix applied. Verify with: ==="
echo "curl -s https://net.xdc.network/api/nodes/{NODE_ID} | jq '.node.block_height'"
```

---

## Commits

- `b51df84` - fix: Add block_height, peer_count, is_syncing to nodes table UPDATE
- `b6ceef2` - fix: Number() conversion for blockHeight and peerCount params

---

## Verification Checklist

- [ ] Database columns exist: `\d skynet.nodes` shows block_height, peer_count, is_syncing
- [ ] Agent using correct node ID (not another server's ID)
- [ ] Agent logs show "✅ Heartbeat OK" not "❌ Heartbeat failed"
- [ ] API returns block_height: `curl /api/nodes/{id} | jq .node.block_height`
- [ ] Dashboard shows block number (not "—" or "None")

---

## Related Issues

- This fix applies to ALL client types (reth, geth, erigon, nethermind)
- The root cause was architectural: history table vs. current state table
- Future improvement: Consider triggers to auto-update nodes table from node_metrics
