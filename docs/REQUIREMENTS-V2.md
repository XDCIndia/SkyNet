# XDCNetOwn V2 — Complete Requirements

> From the perspective of: Network Owner, CTO, CEO, Enterprise Banks, Masternode Operators, DevOps Teams

## Live Network Data (from XDPoS RPC)

### Masternode Data (108 active + 133 standby + 5 penalized)
- **Source**: `XDPoS_getMasternodesByNumber("latest")` returns:
  - `Masternodes[]` — 108 active validator addresses
  - `Standbynodes[]` — 133 standby candidates
  - `Penalty[]` — 5 penalized nodes
  - `MasternodesLen`, `StandbynodesLen`, `PenaltyLen`
  - `Number` (block), `Round` (epoch round)
- **XDCValidator Contract** (`0x0000000000000000000000000000000000000088`):
  - `getCandidates()` → all registered candidates
  - `getCandidateOwner(address)` → owner of masternode
  - `getCandidateCap(address)` → total staked XDC
  - `getVoters(address)` → list of voters/delegators
  - `getVoterCap(address, voter)` → individual voter stake
  - `isCandidate(address)` → bool
  - `candidateCount()` → total candidates
- **Ethstats**: If node runs ethstats client, `admin_nodeInfo` returns `name` field

## Dashboard Views

### 1. 🏢 CEO / Board View
**Purpose**: Present to investors, board members, media. Must be screenshot-worthy.

- **Network Health Score** (0-100, large gauge)
- **Key Metrics Strip**: Total Masternodes (108), Standby (133), TPS, Total Staked XDC, Market Cap
- **Decentralization Index**: Nakamoto coefficient, geographic spread, ISP diversity
- **Growth Chart**: 12-month trend of masternodes, transactions, unique addresses
- **Comparison Table**: XDC vs Polygon vs Ethereum vs Solana (TPS, finality, cost, validators)
- **Social Export**: One-click PNG/PDF for board presentations
- **Uptime Streak**: "247 days continuous operation" style metric

### 2. 🔧 CTO / Technical View
**Purpose**: Deep technical health for CTO making architecture decisions.

- **Masternode Leaderboard**: All 108 active masternodes ranked by:
  - Uptime %, blocks produced, blocks missed
  - Stake amount, number of voters
  - Owner address, penalty history
  - Ethstats name (if available)
- **Standby Queue**: 133 standbys sorted by stake, ready to be promoted
- **Penalty Board**: 5 penalized nodes with reason, duration, stake at risk
- **Consensus Health**: Current epoch, round number, block time distribution
- **Protocol Distribution**: How many peers on eth/62, eth/63, eth/100
- **Block Propagation**: Time for block to reach 50%, 90%, 95% of network
- **Fork Monitor**: Detect chain splits, uncle blocks

### 3. 🏦 Enterprise / Bank View
**Purpose**: Compliance, SLA, risk assessment for banks using XDC.

- **SLA Dashboard**: Uptime %, response time, availability by region
- **Compliance Metrics**: Validator KYC status, geographic jurisdiction
- **Transaction Finality**: Average and P99 finality times
- **Risk Indicators**: Centralization risk, single-entity control %
- **Audit Trail**: Validator set changes, stake movements, penalty events
- **RPC Health**: Endpoint availability, latency by region

### 4. 🌍 Masternode Operator View
**Purpose**: Individual masternode owner managing their node(s).

- **My Masternodes**: List of owned masternodes with status
- **Rewards Tracker**: XDC earned per epoch, daily, monthly, yearly projection
- **Stake Management**: Current stake, voters, delegation history
- **Performance Score**: Blocks produced vs expected, penalty risk assessment
- **Peer Quality**: Connected peers quality, geographic distribution
- **Alert Config**: Custom alerts for their specific nodes

### 5. 🔴 DevOps War Room
**Purpose**: Real-time ops for the team running the infrastructure.

- **Fleet Matrix**: ALL nodes (owned + monitored) with live metrics
- **Log Viewer**: Fetch and display node logs in real-time
- **Incident Board**: Active incidents, MTTR, resolution status
- **Diagnostic Tools**: One-click health checks, peer discovery, sync analysis
- **Upgrade Planner**: Current versions, available updates, rolling upgrade scheduler
- **Resource Alerts**: CPU/Memory/Disk thresholds with auto-notification

## API Endpoints Needed

### Masternode Data APIs
```
GET  /api/v1/masternodes                    — All 108 active masternodes with details
GET  /api/v1/masternodes/:address           — Single masternode detail (stake, voters, blocks)
GET  /api/v1/masternodes/standby            — 133 standby nodes
GET  /api/v1/masternodes/penalized          — 5 penalized nodes
GET  /api/v1/masternodes/stats              — Aggregate stats (total stake, avg blocks, etc.)
GET  /api/v1/masternodes/:address/rewards   — Rewards history
GET  /api/v1/masternodes/:address/voters    — Voter/delegator list
```

### Contract Integration
```
GET  /api/v1/contract/candidates            — From XDCValidator.getCandidates()
GET  /api/v1/contract/candidate/:address    — Owner, cap, voters from contract
GET  /api/v1/contract/stats                 — Total candidates, total staked
```

### Network Intelligence
```
GET  /api/v1/network/epoch                  — Current epoch, round, block time stats
GET  /api/v1/network/consensus              — Consensus participation rate
GET  /api/v1/network/decentralization       — Nakamoto coefficient, geographic distribution
GET  /api/v1/network/comparison             — XDC vs other L1s benchmark data
```

### Ethstats Integration
```
GET  /api/v1/ethstats/nodes                 — All nodes reporting to ethstats
GET  /api/v1/ethstats/node/:name            — Single ethstats node detail
```

## DB Tables Needed

```sql
-- Masternode snapshots (collected every epoch ~30min)
CREATE TABLE netown.masternode_snapshots (
  id BIGSERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL,
  status VARCHAR(20) NOT NULL, -- active, standby, penalized
  owner VARCHAR(42),
  stake NUMERIC(30,0),
  voter_count INT,
  blocks_produced INT,
  blocks_missed INT,
  penalty_count INT,
  ethstats_name VARCHAR(200),
  epoch INT,
  round INT,
  collected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Masternode rewards tracking
CREATE TABLE netown.masternode_rewards (
  id BIGSERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL,
  epoch INT NOT NULL,
  reward_xdc NUMERIC(30,18),
  block_number BIGINT,
  collected_at TIMESTAMPTZ DEFAULT NOW()
);
```
