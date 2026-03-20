# XDC Multi-Client Integration Testing Guide

**Version:** 1.0.0  
**Date:** February 26, 2026  
**Scope:** xdc-node-setup, XDCNetOwn  

---

## Overview

This document provides comprehensive integration testing procedures for validating XDC node setups with multiple clients (Geth-XDC, Erigon-XDC, Nethermind-XDC, Reth-XDC) against XDPoS 2.0 consensus specifications.

---

## Test Categories

### 1. Client Compatibility Tests

#### 1.1 RPC API Compatibility
```bash
#!/bin/bash
# test-rpc-compatibility.sh

CLIENTS=("stable:8545" "erigon:8547" "nethermind:8558" "reth:7073")
METHODS=(
  "eth_blockNumber"
  "eth_getBlockByNumber:latest:false"
  "net_peerCount"
  "web3_clientVersion"
  "XDPoS_getEpochNumber"
  "XDPoS_getMasternodes"
)

for client_port in "${CLIENTS[@]}"; do
  IFS=':' read -r client port <<< "$client_port"
  echo "=== Testing $client on port $port ==="
  
  for method in "${METHODS[@]}"; do
    IFS=':' read -r meth param1 param2 <<< "$method"
    
    if [ -n "$param2" ]; then
      params="[\"$param1\",$param2]"
    elif [ -n "$param1" ]; then
      params="[\"$param1\"]"
    else
      params="[]"
    fi
    
    response=$(curl -sf -X POST "http://localhost:$port" \
      -H "Content-Type: application/json" \
      -d "{\"jsonrpc\":\"2.0\",\"method\":\"$meth\",\"params\":$params,\"id\":1}")
    
    if [ $? -eq 0 ]; then
      echo "✓ $meth: OK"
    else
      echo "✗ $meth: FAIL"
    fi
  done
done
```

#### 1.2 P2P Peer Exchange
```bash
#!/bin/bash
# test-p2p-exchange.sh

# Start multiple clients
xdc start --client stable --p2p-port 30303 &
STABLE_PID=$!
sleep 30

xdc start --client erigon --p2p-port 30304 &
ERIGON_PID=$!
sleep 30

# Get enode IDs
STABLE_ENODE=$(curl -sf -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"admin_nodeInfo","params":[],"id":1}' | jq -r '.result.enode')

ERIGON_ENODE=$(curl -sf -X POST http://localhost:8547 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"admin_nodeInfo","params":[],"id":1}' | jq -r '.result.enode')

# Add as trusted peers
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"admin_addTrustedPeer\",\"params\":[\"$ERIGON_ENODE\"],\"id\":1}"

# Wait for peer connection
sleep 10

# Verify peer count
STABLE_PEERS=$(curl -sf -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' | jq -r '.result')

if [ "$STABLE_PEERS" -gt 0 ]; then
  echo "✓ P2P exchange successful: $STABLE_PEERS peers"
else
  echo "✗ P2P exchange failed"
fi

# Cleanup
kill $STABLE_PID $ERIGON_PID
```

---

### 2. XDPoS 2.0 Consensus Tests

#### 2.1 Epoch Boundary Handling
```bash
#!/bin/bash
# test-epoch-boundaries.sh

monitor_epochs() {
  local duration=${1:-3600}  # Default 1 hour
  local start=$(date +%s)
  local last_epoch=-1
  
  while [ $(($(date +%s) - start)) -lt $duration ]; do
    BLOCK=$(curl -sf -X POST http://localhost:8545 \
      -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq -r '.result' | xargs printf '%d\n')
    
    EPOCH=$((BLOCK / 900))
    EPOCH_BLOCK=$((BLOCK % 900))
    
    if [ $EPOCH -ne $last_epoch ]; then
      echo "$(date): Epoch $EPOCH started at block $BLOCK"
      last_epoch=$EPOCH
      
      # Verify masternode list updated
      MASTERNODES=$(curl -sf -X POST http://localhost:8545 \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"XDPoS_getMasternodes","params":[],"id":1}' | jq '.result | length')
      
      echo "  Active masternodes: $MASTERNODES"
    fi
    
    # Gap block monitoring
    if [ $EPOCH_BLOCK -ge 450 ]; then
      echo "$(date): Gap period - Block $EPOCH_BLOCK/900"
      
      # Verify no block production during gap
      sleep 3
      NEW_BLOCK=$(curl -sf -X POST http://localhost:8545 \
        -H "Content-Type: application/json" \
        -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq -r '.result' | xargs printf '%d\n')
      
      if [ $NEW_BLOCK -eq $BLOCK ]; then
        echo "  ✓ No block production during gap"
      else
        echo "  ✗ Unexpected block production during gap!"
      fi
    fi
    
    sleep 10
  done
}

monitor_epochs 1800  # Monitor for 30 minutes
```

#### 2.2 Vote/Timeout Race Conditions
```bash
#!/bin/bash
# test-vote-timeout.sh

# Monitor vote collection during gap period
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "XDPoS_getRound",
    "params": [],
    "id": 1
  }'

# Expected response should include:
# - round number
# - vote count
# - timeout status
```

#### 2.3 Cross-Client Block Hash Comparison
```bash
#!/bin/bash
# test-block-divergence.sh

CLIENTS=("8545:stable" "8547:erigon" "8558:nethermind" "7073:reth")

compare_blocks() {
  local block_number=$1
  declare -A hashes
  
  for client_info in "${CLIENTS[@]}"; do
    IFS=':' read -r port name <<< "$client_info"
    
    hash=$(curl -sf -X POST "http://localhost:$port" \
      -H "Content-Type: application/json" \
      -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBlockByNumber\",\"params\":[\"$block_number\",false],\"id\":1}" | jq -r '.result.hash')
    
    hashes[$name]=$hash
    echo "$name: $hash"
  done
  
  # Check for divergence
  reference=${hashes[stable]}
  diverged=false
  
  for name in "${!hashes[@]}"; do
    if [ "${hashes[$name]}" != "$reference" ]; then
      echo "✗ DIVERGENCE: $name differs from stable!"
      diverged=true
    fi
  done
  
  if [ "$diverged" = false ]; then
    echo "✓ All clients agree on block hash"
  fi
}

# Compare latest 10 blocks
for i in $(seq 1 10); do
  echo "=== Block -$i ==="
  compare_blocks "-$i"
  sleep 2
done
```

---

### 3. Performance Tests

#### 3.1 Sync Speed Comparison
```bash
#!/bin/bash
# test-sync-speed.sh

CLIENTS=("stable" "erigon" "nethermind" "reth")

for client in "${CLIENTS[@]}"; do
  echo "=== Testing $client sync speed ==="
  
  # Clean start
  rm -rf "/tmp/test-$client"
  
  start_time=$(date +%s)
  start_block=0
  
  # Start client
  xdc start --client "$client" --data-dir "/tmp/test-$client" --network testnet &
  PID=$!
  
  # Monitor sync for 10 minutes
  for i in $(seq 1 60); do
    sleep 10
    
    current_block=$(curl -sf -X POST http://localhost:8545 \
      -H "Content-Type: application/json" \
      -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' 2>/dev/null | jq -r '.result' | xargs printf '%d\n' 2>/dev/null || echo 0)
    
    elapsed=$(( $(date +%s) - start_time ))
    blocks_synced=$(( current_block - start_block ))
    bps=$(echo "scale=2; $blocks_synced / $elapsed" | bc)
    
    echo "  Elapsed: ${elapsed}s, Blocks: $current_block, Speed: ${bps} blocks/sec"
  done
  
  kill $PID 2>/dev/null
  wait $PID 2>/dev/null
done
```

#### 3.2 RPC Load Testing
```bash
#!/bin/bash
# test-rpc-load.sh

CONCURRENT_REQUESTS=100
DURATION=60

run_load_test() {
  local port=$1
  local name=$2
  
  echo "=== Load testing $name on port $port ==="
  
  # Generate requests
  for i in $(seq 1 $CONCURRENT_REQUESTS); do
    (
      for j in $(seq 1 $((DURATION * 10))); do
        curl -sf -X POST "http://localhost:$port" \
          -H "Content-Type: application/json" \
          -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' > /dev/null
        sleep 0.1
      done
    ) &
  done
  
  wait
  echo "Completed load test for $name"
}

run_load_test 8545 "stable"
run_load_test 8547 "erigon"
run_load_test 8558 "nethermind"
run_load_test 7073 "reth"
```

---

### 4. Security Tests

#### 4.1 RPC Security Validation
```bash
#!/bin/bash
# test-rpc-security.sh

echo "=== RPC Security Tests ==="

# Test 1: RPC should not be exposed on 0.0.0.0
if ss -tlnp | grep -q "0.0.0.0:8545"; then
  echo "✗ FAIL: RPC exposed on all interfaces"
else
  echo "✓ PASS: RPC bound to specific interface"
fi

# Test 2: CORS should not be wildcard
CORS=$(curl -sf -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -H "Origin: https://evil.com" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  -v 2>&1 | grep -i "access-control-allow-origin")

if echo "$CORS" | grep -q "*"; then
  echo "✗ FAIL: CORS allows wildcard"
else
  echo "✓ PASS: CORS restricted"
fi

# Test 3: Admin methods should be restricted
ADMIN_RESPONSE=$(curl -sf -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"admin_peers","params":[],"id":1}')

if echo "$ADMIN_RESPONSE" | grep -q "error"; then
  echo "✓ PASS: Admin methods restricted"
else
  echo "⚠ WARN: Admin methods accessible"
fi
```

#### 4.2 Docker Security Scan
```bash
#!/bin/bash
# test-docker-security.sh

echo "=== Docker Security Tests ==="

# Check for privileged containers
if docker ps --format "table {{.Names}}\t{{.Privileged}}" | grep -q "true"; then
  echo "✗ FAIL: Privileged containers found"
else
  echo "✓ PASS: No privileged containers"
fi

# Check for docker socket mounts
if docker inspect xdc-node 2>/dev/null | grep -q "/var/run/docker.sock"; then
  echo "✗ FAIL: Docker socket mounted"
else
  echo "✓ PASS: No docker socket mount"
fi

# Check security options
SECURITY_OPTS=$(docker inspect xdc-node 2>/dev/null | jq -r '.[0].HostConfig.SecurityOpt[]')
if echo "$SECURITY_OPTS" | grep -q "no-new-privileges"; then
  echo "✓ PASS: no-new-privileges enabled"
else
  echo "✗ FAIL: no-new-privileges not enabled"
fi
```

---

### 5. Chaos Engineering Tests

#### 5.1 Network Partition Simulation
```bash
#!/bin/bash
# test-network-partition.sh

# Simulate network partition between clients
iptables -A INPUT -p tcp --dport 30304 -j DROP
echo "Blocked Erigon P2P port (30304)"

sleep 60

# Check if node continues syncing via other peers
xdc sync

# Restore connectivity
iptables -D INPUT -p tcp --dport 30304 -j DROP
echo "Restored Erigon P2P connectivity"
```

#### 5.2 Resource Exhaustion
```bash
#!/bin/bash
# test-resource-exhaustion.sh

# Test disk pressure response
fallocate -l 990G /tmp/fill-disk.tmp

# Monitor node response
for i in $(seq 1 10); do
  xdc health | grep -i "disk"
  sleep 5
done

# Cleanup
rm /tmp/fill-disk.tmp
```

---

### 6. SkyNet Integration Tests

#### 6.1 Heartbeat Validation
```bash
#!/bin/bash
# test-skynet-heartbeat.sh

API_KEY="your-api-key"
SKYNET_URL="https://xdc.openscan.ai"

# Test heartbeat payload
heartbeat_payload='{
  "nodeId": "test-node-001",
  "blockHeight": 89234567,
  "syncing": false,
  "syncProgress": 99.8,
  "peerCount": 25,
  "system": {
    "cpuPercent": 45.2,
    "memoryPercent": 62.1,
    "diskPercent": 78.0
  },
  "clientType": "geth",
  "clientVersion": "v2.6.8-stable"
}'

response=$(curl -sf -X POST "$SKYNET_URL/api/v1/nodes/heartbeat" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$heartbeat_payload")

if echo "$response" | grep -q '"ok":true'; then
  echo "✓ Heartbeat accepted"
else
  echo "✗ Heartbeat rejected: $response"
fi
```

#### 6.2 Alert Generation
```bash
#!/bin/bash
# test-skynet-alerts.sh

# Simulate sync stall alert
alert_payload='{
  "nodeId": "test-node-001",
  "nodeName": "xdc-test-node",
  "type": "sync_stall",
  "severity": "high",
  "title": "Block sync stalled at height 89234567",
  "description": "Node has not progressed for over 10 minutes",
  "diagnostics": {
    "blockHeight": 89234567,
    "peerCount": 5,
    "clientVersion": "v2.6.8-stable"
  }
}'

curl -X POST "$SKYNET_URL/api/v1/issues/report" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$alert_payload"
```

---

## Test Execution Matrix

| Test Category | Frequency | Automated | Priority |
|---------------|-----------|-----------|----------|
| RPC Compatibility | Every PR | Yes | P0 |
| P2P Exchange | Daily | Yes | P0 |
| Epoch Boundaries | Weekly | Yes | P0 |
| Block Divergence | Every PR | Yes | P0 |
| Sync Speed | Weekly | No | P1 |
| RPC Load | Weekly | Yes | P1 |
| Security Scan | Every PR | Yes | P0 |
| Chaos Engineering | Monthly | No | P2 |
| SkyNet Integration | Every PR | Yes | P0 |

---

## CI/CD Integration

```yaml
# .github/workflows/integration-tests.yml
name: Integration Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  multi-client-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        client: [stable, erigon, nethermind, reth]
    steps:
      - uses: actions/checkout@v3
      
      - name: Start XDC Node
        run: |
          ./setup.sh --client ${{ matrix.client }} --quick
          xdc start
          sleep 60
      
      - name: RPC Compatibility Tests
        run: ./tests/integration/test-rpc-compatibility.sh
      
      - name: P2P Tests
        run: ./tests/integration/test-p2p-exchange.sh
      
      - name: Security Scan
        run: ./tests/integration/test-rpc-security.sh
      
      - name: SkyNet Integration
        run: ./tests/integration/test-skynet-heartbeat.sh
```

---

## Success Criteria

| Metric | Target | Critical |
|--------|--------|----------|
| RPC Response Time | < 100ms | < 500ms |
| P2P Connection Time | < 30s | < 120s |
| Sync Speed | > 10 blocks/sec | > 1 block/sec |
| Cross-Client Block Hash Match | 100% | > 99% |
| Epoch Transition Success | 100% | > 99% |
| Security Scan Pass Rate | 100% | > 95% |

---

*Document Version: 1.0.0*  
*Last Updated: February 26, 2026*
