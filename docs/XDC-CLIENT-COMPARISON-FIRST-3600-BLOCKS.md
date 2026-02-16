# XDC Blockchain Client Comparison: First 3600 Blocks Analysis

## Executive Summary

This document provides a detailed technical comparison of how four XDC blockchain clients handle the first 3600 blocks (blocks 0-3600) on XDC mainnet. The clients analyzed are:

1. **XDC Stable (v2.6.8)** - Reference implementation at `/root/xdposchain-ref`
2. **Geth PR5** - Branch `feature/xdpos-consensus` at `/root/workspace/go-ethereum-pr5`
3. **Erigon-XDC** - At `/root/erigon-xdc`
4. **Nethermind-XDC** - Branch `build/xdc-net9-stable` at `/root/.openclaw/workspace/nethermind`

## Table of Contents

1. [Genesis Block Handling](#1-genesis-block-handling)
2. [Block Processing Pipeline](#2-block-processing-pipeline)
3. [Transaction Processing](#3-transaction-processing)
4. [Coinbase/Author Resolution](#4-coinbaseauthor-resolution)
5. [EVM Execution](#5-evm-execution)
6. [Checkpoint Reward Handling](#6-checkpoint-reward-handling)
7. [Epoch Handling](#7-epoch-handling)
8. [EIP-158/161 Handling](#8-eip-158161-handling)
9. [State Root Computation](#9-state-root-computation)
10. [P2P Protocol](#10-p2p-protocol)

---

## 1. Genesis Block Handling

### Genesis Hash Computation

| Client | Genesis Hash | Implementation |
|--------|--------------|----------------|
| XDC Stable | `0x4a9d748bd78a8d0385b67788c2435dcdb914f98a96250b68863a1f8b7642d6b1` | `params.MainnetGenesisHash` |
| Geth PR5 | `0x4a9d748bd78a8d0385b67788c2435dcdb914f98a96250b68863a1f8b7642d6b1` | Same as reference |
| Erigon-XDC | `0x4a9d748bd78a8d0385b67788c2435dcdb914f98a96250b68863a1f8b7642d6b1` | Ported from geth |
| Nethermind-XDC | `0x4a9d748bd78a8d0385b67788c2435dcdb914f98a96250b68863a1f8b7642d6b1` | Chainspec-defined |

### Genesis Contracts Deployment

All four clients deploy the same four critical genesis contracts:

| Address | Contract | Purpose |
|---------|----------|---------|
| `0x0000000000000000000000000000000000000088` | Validator/MasternodeVoting | Stores masternode state, candidates, owners, cap |
| `0x0000000000000000000000000000000000000089` | BlockSigner | Records block signing transactions |
| `0x0000000000000000000000000000000000000090` | Randomize | Manages masternode randomization for M2 selection |
| `0x0000000000000000000000000000000000000099` | Multisig | Foundation multisig wallet |

### XDC Stable Genesis Configuration

```go
// From /root/xdposchain-ref/core/genesis.go
func DefaultGenesisBlock() *Genesis {
    return &Genesis{
        Config:     params.XDCMainnetChainConfig,
        Nonce:      0,
        ExtraData:  hexutil.MustDecode("0x000000000000000000000000000000000000000000000000000000000000000025c65b4b379ac37cf78357c4915f73677022eaffc7d49d0a2cf198deebd6ce581af465944ec8b2bbcfccdea1006a5cfa7d9484b5b293b46964c265c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
        GasLimit:   4700000,
        Difficulty: big.NewInt(1),
        Alloc:      DecodeAllocJson(MainnetAllocData),
        Timestamp:  1559211559,
    }
}
```

### Geth PR5 Genesis Configuration

```go
// From /root/workspace/go-ethereum-pr5/core/genesis_xdc.go
func DefaultXDCMainnetGenesisBlock() *Genesis {
    return &Genesis{
        Config:     params.XDCMainnetChainConfig,
        Nonce:      0x0,
        Timestamp:  0x5cefae27, // May 30, 2019
        ExtraData:  hexutil.MustDecode("0x000000000000000000000000000000000000000000000000000000000000000025c65b4b379ac37cf78357c4915f73677022eaffc7d49d0a2cf198deebd6ce581af465944ec8b2bbcfccdea1006a5cfa7d9484b5b293b46964c265c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"),
        GasLimit:   0x47b760,
        Difficulty: big.NewInt(1),
        Alloc:      xdcMainnetAllocData(),
    }
}
```

### Header Encoding Differences (XDC Extra Fields)

The XDC protocol extends the Ethereum header with three additional fields in ExtraData:

| Field | Offset | Size | Description |
|-------|--------|------|-------------|
| Vanity | 0 | 32 bytes | Reserved for future use |
| Validators (checkpoint) | 32 | N*20 bytes | List of masternode addresses (only at epoch blocks) |
| Seal/Signature | len(Extra)-65 | 65 bytes | Block signature |

**Note**: Block hash computation varies between clients - XDC Stable includes XDC-specific fields in the hash, while some implementations may exclude them, leading to hash mismatches.

---

## 2. Block Processing Pipeline

### Block Validation Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Block Validation Pipeline                        │
├─────────────────────────────────────────────────────────────────────┤
│ 1. VerifyHeader() - Basic header validation                         │
│    ├── Extra data length check (>= 32+65 bytes)                     │
│    ├── Checkpoint block coinbase = 0x0                              │
│    ├── Nonce validation (0x00...0 or 0xff...f)                      │
│    ├── Timestamp > parent.Time + Period                             │
│    └── Difficulty validation (Inturn vs NoTurn)                     │
│                                                                      │
│ 2. VerifyUncles() - XDPoS: Always rejects uncles                    │
│                                                                      │
│ 3. ValidateBody() - Transaction/Uncle root verification             │
│    ├── TxHash matches derived transactions trie                     │
│    └── UncleHash = CalcUncleHash(nil)                               │
│                                                                      │
│ 4. ExecuteTransactions() - EVM execution                            │
│                                                                      │
│ 5. ValidateState() - Post-execution validation                      │
│    ├── Gas used matches                                             │
│    ├── Receipt root matches                                         │
│    └── State root matches                                           │
└─────────────────────────────────────────────────────────────────────┘
```

### State Root Computation Timing

| Client | When State Root is Recalculated |
|--------|--------------------------------|
| XDC Stable | After each transaction, final at block end via `statedb.IntermediateRoot()` |
| Geth PR5 | Uses path-based state with `statedb.Commit()` at block boundaries |
| Erigon-XDC | Uses Erigon's commitment-based state with batched updates |
| Nethermind-XDC | Uses Patricia Trie with `Commit()` at block finalization |

### Block Hash Computation Differences

**Critical Issue**: Block hash differences exist between clients due to RLP encoding of XDC-specific extra fields.

| Client | Hash Includes Validators/Penalties | Notes |
|--------|-----------------------------------|-------|
| XDC Stable | Yes | Full XDC extra fields in hash |
| Geth PR5 | Yes | Matches reference |
| Erigon-XDC | Partial | Uses Erigon's encoding |
| Nethermind-XDC | Configurable | Uses geth RPC for hash lookup at checkpoints |

---

## 3. Transaction Processing

### Normal Transaction Handling

All clients follow standard Ethereum transaction processing with XDC-specific modifications:

1. **Nonce validation** per account
2. **Gas limit** checking (4,700,000 per block)
3. **Balance** sufficiency verification
4. **EVM execution** with XDC-specific precompiles

### Special Transaction Handling

Special transactions are sent to genesis contracts:

| To Address | Purpose | When |
|------------|---------|------|
| `0x0000000000000000000000000000000000000089` (BlockSigner) | Sign block validation | Every block by masternode |
| `0x0000000000000000000000000000000000000090` (Randomize) | Set secret key | During epoch preparation |
| `0x0000000000000000000000000000000000000090` (Randomize) | Reveal opening | During epoch transition |

### IsSpecialTx() Equivalent

**XDC Stable** (via tx type detection):
```go
// No explicit IsSpecialTx, but detected by destination address
if tx.To() != nil && *tx.To() == common.BlockSignersBinary {
    // This is a signing transaction
}
```

**Geth PR5**:
```go
// Similar approach with additional transaction types
func (tx *Transaction) IsSigningTransaction() bool {
    return tx.To() != nil && *tx.To() == BlockSignerContractAddress
}
```

**Erigon-XDC**:
```go
// Uses transaction categorization in execution layer
func IsXdcSpecialTransaction(tx *types.Transaction) bool {
    to := tx.GetTo()
    if to == nil {
        return false
    }
    switch *to {
    case BlockSignerContractAddress, RandomizeContractAddress:
        return true
    }
    return false
}
```

**Nethermind-XDC**:
```csharp
// XdcTransactionProcessor.cs
private bool IsSpecialTransaction(Transaction tx)
{
    var to = tx.To?.ToString()?.ToLowerInvariant();
    return to == BlockSignersContract.ToString().ToLowerInvariant() ||
           to == RandomizeContract.ToString().ToLowerInvariant();
}
```

### Fee Payment: Coinbase Resolution

Transaction fees in XDPoS go to the masternode owner, not the block beneficiary (which is always 0x0).

| Client | Fee Recipient Resolution |
|--------|-------------------------|
| XDC Stable | `ecrecover` header → lookup owner in 0x88 |
| Geth PR5 | Same as reference |
| Erigon-XDC | Uses syscall to resolve owner |
| Nethermind-XDC | `XdcCoinbaseResolver.RecoverSigner()` → `GetValidatorOwner()` |

---

## 4. Coinbase/Author Resolution

### Block Author Recovery Process

```
┌──────────────────────────────────────────────────────────────┐
│              Block Author Resolution Flow                     │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Header.ExtraData format:                                     │
│  [32 bytes vanity][N*20 validators (checkpoint)][65 seal]    │
│                                                               │
│  1. Extract last 65 bytes = signature (seal)                 │
│  2. Compute sigHash = keccak256(RLP(header without seal))    │
│  3. signer = ecrecover(sigHash, signature)                   │
│  4. owner = validatorsState[signer].owner (from 0x88)        │
│  5. coinbase = owner (for fee recipient)                     │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### Implementation Comparison

**XDC Stable** (`consensus/XDPoS/engines/engine_v1/engine.go`):
```go
func (x *XDPoS_v1) Author(header *types.Header) (common.Address, error) {
    return ecrecover(header, x.signatures)
}

func ecrecover(header *types.Header, sigcache *lru.Cache[common.Hash, common.Address]) (common.Address, error) {
    signature := header.Extra[len(header.Extra)-ExtraSeal:]
    pubkey, err := crypto.Ecrecover(sigHash(header).Bytes(), signature)
    // ... derive address from pubkey
}
```

**Nethermind-XDC** (`XdcCoinbaseResolver.cs`):
```csharp
public Address RecoverSigner(BlockHeader header)
{
    byte[] signature = new byte[ExtraSeal];
    Buffer.BlockCopy(extraData, extraData.Length - ExtraSeal, signature, 0, ExtraSeal);
    
    ValueHash256 hash = ComputeSigHash(header, extraData);
    return RecoverAddress(signature, hash);
}

private Address? RecoverAddress(byte[] signature, ValueHash256 hash)
{
    // Extract r, s, v and perform ecrecover
    Span<byte> r = signature.AsSpan(0, 32);
    Span<byte> s = signature.AsSpan(32, 32);
    byte v = signature[64];
    byte recoveryId = v >= 27 ? (byte)(v - 27) : v;
    // ... recover public key using SpanSecP256k1
}
```

### TIPSigning Transition (Block 3,000,000)

At block 3,000,000, the `IsTIPSigning` fork activates, changing penalty handling:

| Before TIPSigning | After TIPSigning |
|-------------------|------------------|
| `HookPenalty(chain, number)` | `HookPenaltyTIPSigning(chain, header, candidates)` |
| Penalties computed at checkpoint | Penalties include recent missed blocks |

### TIPTRC21Fee Transition (Block 38,383,838)

Enables TRC21 token fee handling (outside first 3600 blocks scope).

---

## 5. EVM Execution

### EVM Calls to Genesis Contracts

All clients use the standard EVM with these considerations for genesis contracts:

**CALL with value=0 Behavior**:
- Ethereum: Does not mark account as "touched" if call fails
- XDC: Account is "touched" (affects state root for empty accounts)

### State Trie Dirty Tracking

| Client | Dirty Account Tracking | Notes |
|--------|----------------------|-------|
| XDC Stable | Uses `state.StateDB` with `dirtyStorage` map | Includes EIP-158 logic |
| Geth PR5 | Uses path-based state with `state.Account` | Different journal system |
| Erigon-XDC | Uses `IntraBlockState` with dirty list | Optimized for parallel execution |
| Nethermind-XDC | Uses `WorldState` with change tracking | Patricia Trie-based |

### Account Touching Differences

**Known Issue**: AddToBalance(0) on existing accounts

```go
// XDC Stable - AddBalance(0) marks account dirty
func (s *StateDB) AddBalance(addr common.Address, amount *big.Int) {
    stateObject := s.GetOrNewStateObject(addr)
    if stateObject != nil {
        stateObject.AddBalance(amount) // Even if amount=0, object is touched
    }
}
```

This affects EIP-158 empty account cleanup - accounts that receive 0 value may be retained instead of deleted.

---

## 6. Checkpoint Reward Handling

### Checkpoint Blocks (900, 1800, 2700, 3600)

Rewards are distributed at every 900-block checkpoint **EXCEPT** block 900 (first checkpoint has no rewards).

### Reward Calculation Algorithm

```
┌────────────────────────────────────────────────────────────────────┐
│              Checkpoint Reward Calculation                          │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. Calculate chainReward:                                          │
│     - Base: 250 XDC                                                 │
│     - Apply inflation halving:                                      │
│       * After 2 years: 125 XDC                                      │
│       * After 5 years: 62.5 XDC                                     │
│                                                                     │
│  2. Get masternodes from previous checkpoint header                 │
│     - Extract from header.Extra[32:len-65]                          │
│                                                                     │
│  3. Count signing transactions:                                     │
│     - For blocks (checkpoint - 900*2) to (checkpoint - 900)         │
│     - Only count blocks where block % MergeSignRange == 0           │
│     - Match tx.Data[len-32:] with block hash                        │
│                                                                     │
│  4. Calculate per-signer reward:                                    │
│     - calcReward = (chainReward / totalSigner) * signCount          │
│                                                                     │
│  5. Distribute rewards:                                             │
│     - 90% to owner (from validatorsState[signer].owner)            │
│     - 10% to foundation wallet                                      │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### GetRewardForCheckpoint Implementation

**XDC Stable** (`contracts/utils.go`):
```go
func GetRewardForCheckpoint(c *XDPoS.XDPoS, chain consensus.ChainReader, 
    header *types.Header, rCheckpoint uint64, totalSigner *uint64) 
    (map[common.Address]*RewardLog, error) {
    
    number := header.Number.Uint64()
    prevCheckpoint := number - (rCheckpoint * 2)
    startBlockNumber := prevCheckpoint + 1
    endBlockNumber := startBlockNumber + rCheckpoint - 1
    signers := make(map[common.Address]*RewardLog)
    
    // Iterate backwards from prevCheckpoint + rCheckpoint*2 - 1 down to startBlock
    for i := prevCheckpoint + (rCheckpoint * 2) - 1; i >= startBlockNumber; i-- {
        header = chain.GetHeader(header.ParentHash, i)
        // Get signing transactions from cache or block
        signingTxs := c.GetCachedSigningTxs(header.Hash())
        // ... process signing transactions
    }
    // ... count signers and calculate rewards
}
```

**Nethermind-XDC** (`XdcRewardCalculator.cs`):
```csharp
private BlockReward[] CalculateCheckpointRewards(Block block)
{
    long number = block.Number;
    UInt256 chainReward = RewardInflation((UInt256)250 * 1_000_000_000_000_000_000, (ulong)number);
    
    // Get masternodes from prev checkpoint header
    long prevCheckpoint = number - RewardCheckpoint;
    Address[] masternodes = GetMasternodesFromCheckpoint(prevCheckpoint);
    
    // Count signing transactions
    long prevCheckpoint2 = number - (RewardCheckpoint * 2);
    long startBlock = prevCheckpoint2 + 1;
    long endBlock = startBlock + RewardCheckpoint - 1;
    
    // Iterate and count signers
    for (long i = prevCheckpoint2 + (RewardCheckpoint * 2) - 1; i >= startBlock; i--)
    {
        // Match signing transactions to blocks
        // Only count if block % MergeSignRange == 0
    }
    
    // Distribute rewards
    foreach (var (signer, calcReward) in signerRewards)
    {
        Address owner = GetCandidateOwner(signer);
        UInt256 ownerReward = calcReward * 90 / 100;
        UInt256 foundationReward = calcReward * 10 / 100;
        // Add to reward list
    }
}
```

### AddBalance Behavior for Reward Recipients

**Critical Difference**: How AddBalance(0) is handled for new vs existing accounts affects state root.

| Client | AddBalance(0) on New Account | AddBalance(0) on Existing Account |
|--------|------------------------------|-----------------------------------|
| XDC Stable | Creates account | Marks dirty, may affect cleanup |
| Geth PR5 | Creates account | Marks dirty with tracing |
| Erigon-XDC | Creates account | Uses IntraBlockState logic |
| Nethermind-XDC | Creates account | Uses WorldState tracking |

### Known Issue: Nethermind State Root Mismatch at Block 1800+

```
Computed state root: 0xdfd5b0cc...
Expected state root: 0xd3a3ec14...
```

Root cause: Difference in account dirty tracking during reward distribution. When AddBalance(0) is called on accounts that already exist, some clients mark them as dirty while others don't, affecting EIP-158 cleanup.

---

## 7. Epoch Handling

### Epoch Boundaries (Every 450 Blocks)

XDPoS has two relevant periods:
- **Epoch**: 900 blocks (validator set update)
- **Gap**: 450 blocks (preparation for next epoch)

| Block | Type | Action |
|-------|------|--------|
| 0 | Genesis | Initial validator set in ExtraData |
| 450 | Gap | Masternode preparation starts |
| 900 | Checkpoint | Validator set update, NO rewards |
| 1350 | Gap | Masternode preparation |
| 1800 | Checkpoint | Validator set update + rewards |
| 2250 | Gap | Masternode preparation |
| 2700 | Checkpoint | Validator set update + rewards |
| 3150 | Gap | Masternode preparation |
| 3600 | Checkpoint | Validator set update + rewards |

### Masternode Selection/Rotation

```go
// At checkpoint block, validators are extracted from header.Extra
func GetMasternodesFromCheckpointHeader(header *types.Header) []common.Address {
    extraSuffix := len(header.Extra) - utils.ExtraSeal
    masternodesFromCheckpointHeader := common.ExtractAddressFromBytes(
        header.Extra[utils.ExtraVanity:extraSuffix])
    return masternodesFromCheckpointHeader
}
```

### Validator Set Updates

At each checkpoint:
1. **Penalties applied**: Masternodes that missed blocks are removed
2. **New candidates**: New masternodes waiting in queue are promoted
3. **Randomize**: M2 list is shuffled using random values from 0x90 contract

---

## 8. EIP-158/161 Handling

### EIP-158 Empty Account Cleanup

EIP-158 (Spurious Dragon) introduces empty account cleanup. Activation at block 3 for XDC mainnet.

| Client | EIP-158 Block | Behavior |
|--------|---------------|----------|
| XDC Stable | 3 | `IsEIP158(header.Number)` checks |
| Geth PR5 | 3 | Uses rules.IsEIP158 |
| Erigon-XDC | 3 | Uses config.IsEIP158 |
| Nethermind-XDC | 3 | Spec-driven activation |

### Empty Account Definition

```go
// Empty account: nonce=0, balance=0, codeHash=empty, storage empty
func (so *stateObject) empty() bool {
    return so.data.Nonce == 0 && so.data.Balance.Sign() == 0 && so.data.CodeHash == emptyCodeHash
}
```

### AddBalance(0) on Existing Accounts - The Key Difference

```go
// XDC Stable (state/state_object.go)
func (c *stateObject) AddBalance(amount *big.Int) {
    if amount.Sign() == 0 {
        // Still marks as dirty even if amount is 0!
        c.setBalance(new(big.Int).Add(c.Balance(), amount))
        return
    }
    // ...
}
```

This causes accounts that receive 0-value rewards to be marked dirty and potentially retained when they should be cleaned up under EIP-158 rules.

---

## 9. State Root Computation

### Trie Structure Differences

| Client | Trie Type | Root Computation |
|--------|-----------|------------------|
| XDC Stable | Merkle Patricia Trie | `statedb.IntermediateRoot(bool)` |
| Geth PR5 | Verkle + Patricia (hybrid) | `statedb.Commit(block, bool, bool)` |
| Erigon-XDC | Committed State + Patricia | Commitment-based |
| Nethermind-XDC | Patricia Trie | `WorldState.Commit(releaseSpec)` |

### Account Serialization

```go
// Ethereum account RLP encoding
 type Account struct {
     Nonce    uint64
     Balance  *big.Int
     Root     common.Hash // storage trie root
     CodeHash []byte
 }
```

### Storage Trie Handling

All clients use separate storage tries per account, but commit timing differs:

| Client | Storage Commit Timing |
|--------|----------------------|
| XDC Stable | Lazy commit, flush at block end |
| Geth PR5 | Batch commit with path DB |
| Erigon-XDC | Parallel commitment with aggregator |
| Nethermind-XDC | Synchronous commit at block end |

### Erigon State Root Bypass

Commit `a8f4fb1` in Erigon-XDC adds a bypass mechanism:

```go
// From Erigon-XDC consensus/xdpos/xdpos.go
func (c *XDPoS) Finalize(...) {
    // Skip state root verification for known blocks
    if isKnownBlock(header.Hash()) {
        return nil, nil
    }
    // ... normal finalization
}
```

This allows Erigon to skip state root validation for blocks where the state root is known to differ due to implementation differences.

---

## 10. P2P Protocol

### Protocol Support Matrix

| Client | eth/62 | eth/63 | eth/100 (XDC) | Notes |
|--------|--------|--------|---------------|-------|
| XDC Stable | Yes | Yes | Yes (V2) | Native XDC support |
| Geth PR5 | Yes | Yes | Partial | Standard eth + XDC extensions |
| Erigon-XDC | Yes | Yes | Yes | Dedicated XDC protocol handler |
| Nethermind-XDC | Yes | Yes | Yes | `Eth100ProtocolHandler.cs` |

### eth/100 (XDC Protocol)

XDC extends the Ethereum protocol with additional message types for BFT consensus:

| Message Code | Name | Purpose |
|--------------|------|---------|
| 0x20 | Vote | Masternode vote for block |
| 0x21 | QuorumCertificate | Aggregated QC for block |
| 0x22 | SyncInfo | Synchronization information |
| 0x23 | Timeout | Timeout messages for BFT |

### Handshake Differences (ForkID)

```go
// ForkID computation includes XDC-specific forks
func (c *ChainConfig) forkID() forkid.ID {
    // Standard Ethereum forks
    forks := []uint64{
        c.HomesteadBlock.Uint64(),
        c.EIP150Block.Uint64(),
        c.EIP155Block.Uint64(),
        c.EIP158Block.Uint64(),
        // ... XDC-specific forks
        common.TIPSigning.Uint64(),
        common.TIPRandomize.Uint64(),
        common.MainnetConstant.TIPV2SwitchBlock.Uint64(),
    }
    return forkid.NewID(forks, genesisHash, headNumber)
}
```

### Message Encoding

All clients use standard RLP encoding with XDC-specific message structures:

```go
// XDC Vote message
type Vote struct {
    BlockHash   common.Hash
    BlockNumber uint64
    Round       uint64
    Signature   []byte
}
```

---

## Critical Blocks Detailed Analysis

### Block 0 (Genesis)

All clients must produce identical genesis:
- Hash: `0x4a9d748bd78a8d0385b67788c2435dcdb914f98a96250b68863a1f8b7642d6b1`
- State root: Computed from genesis allocations
- ExtraData: Contains initial validator set

### Block 1 (First Block)

- First non-genesis block
- EVM starts executing
- No rewards (not a checkpoint)
- EIP-158 NOT active (block < 3)

### Block 3 (EIP-161 Activation)

- EIP-158/EIP-161 activate at block 3
- Empty account cleanup begins
- First block where AddBalance(0) behavior affects state

### Block 16 (First Block with Special Transactions)

- First block with transactions to 0x89 (BlockSigner)
- Tests special transaction handling
- Validates coinbase resolution

### Block 450 (First Epoch Boundary - Gap)

- Gap block (450 = 900/2)
- Masternode preparation phase starts
- Randomize secret setting begins

### Block 900 (First Checkpoint - NO Rewards)

- First checkpoint block
- Validator set update
- **NO rewards** (number <= rCheckpoint)
- M2 list shuffled

### Block 1395 (Block with Fee-Paying Transactions)

- Tests fee payment logic
- Validates coinbase receives fees

### Block 1800 (First Checkpoint WITH Rewards)

- First checkpoint with reward distribution
- **Known issue**: State root mismatch in Nethermind
- Tests full reward calculation pipeline

### Block 2700 (Second Checkpoint with Rewards)

- Second reward checkpoint
- Validates reward consistency

### Block 3000000 (TIPSigning)

- Mentioned for context, outside 0-3600 range
- Changes penalty calculation

---

## Known Issues Summary

| Issue | Affected Client | Block Range | Workaround |
|-------|----------------|-------------|------------|
| State root mismatch | Nethermind-XDC | 1800+ | Geth RPC hash lookup |
| Block hash differences | All | Various | Hash translation layer |
| EIP-158 cleanup diff | Nethermind vs others | 3+ | Account touch tracking |
| AddToBalance(0) diff | All | All | Implementation-specific |
| State root bypass | Erigon-XDC | All | Known block validation skip |

---

## Conclusion

The four XDC clients show strong consensus in core protocol handling but diverge in implementation details:

1. **Genesis handling**: All clients produce identical genesis blocks
2. **Block processing**: Minor differences in state root computation timing
3. **Reward calculation**: Algorithm identical, but AddBalance(0) handling differs
4. **State management**: Different trie implementations cause state root mismatches
5. **P2P**: All support eth/62, eth/63, with varying eth/100 completeness

For full compatibility, clients need to align on:
- Account dirty tracking during AddBalance(0)
- State root computation timing
- Block hash encoding for XDC extra fields

---

*Document generated: February 2026*
*Based on code analysis of XDC Stable v2.6.8, Geth PR5, Erigon-XDC, and Nethermind-XDC*
