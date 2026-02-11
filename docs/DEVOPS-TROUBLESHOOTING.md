# XDCNetOwn — DevOps Troubleshooting Guide

> **The definitive field manual for XDC node operators.**  
> Exact commands. Proven solutions. 60-second diagnosis.

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│  SYMPTOM → FIRST CHECK → QUICK FIX                              │
├─────────────────────────────────────────────────────────────────┤
│  Won't start     → docker logs --tail 50 xdc       → Fix port   │
│  Sync stuck      → xdc sync-status                 → Check peers│
│  Zero peers      → xdc peers | wc -l               → Add static │
│  High CPU        → top / docker stats              → Restart    │
│  Disk full       → df -h /data/xdcnode             → Prune      │
│  Merkle error    → grep "merkle" logs              → Wipe data  │
│  RPC down        → curl http://localhost:8545      → Check port │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Node Won't Start

### 1.1 Docker Deployment

**Symptoms:** Container exits immediately, `docker ps` shows `Exited (1)`

**Diagnosis Commands:**
```bash
# Check container logs
sudo docker logs --tail 100 xdc 2>&1 | head -50

# Check if port 30303 is already in use
sudo netstat -tlnp | grep 30303
sudo lsof -i :30303

# Verify data directory permissions
ls -la /data/xdcnode/XDC/
sudo chown -R 1000:1000 /data/xdcnode/XDC/

# Check Docker resource limits
docker system df
docker stats --no-stream
```

**Common Fixes:**
```bash
# Fix 1: Kill process using port 30303
sudo kill -9 $(sudo lsof -t -i:30303)

# Fix 2: Fix permissions
sudo chown -R $(id -u):$(id -g) /data/xdcnode/XDC/
sudo chmod -R 755 /data/xdcnode/XDC/

# Fix 3: Remove conflicting container
sudo docker rm -f xdc
sudo docker run -d \
  --name xdc \
  --network host \
  -v /data/xdcnode/XDC:/work/xdcchain \
  -v /data/xdcnode/.pwd:/work/.pwd \
  xinfinorg/xdposchain:v2.6.8 \
  --datadir /work/xdcchain \
  --syncmode full \
  --gcmode archive

# Fix 4: Clear Docker cache if disk full
docker system prune -a --volumes -f
```

### 1.2 systemd Deployment

**Symptoms:** `systemctl status xdc` shows `failed`

**Diagnosis Commands:**
```bash
# Check service status
sudo systemctl status xdc --no-pager -l

# View service logs
sudo journalctl -u xdc -n 100 --no-pager

# Check binary exists and is executable
which XDC
ls -la /usr/local/bin/XDC
file /usr/local/bin/XDC

# Verify config file syntax
cat /etc/xdc/config.toml | grep -v "^#" | grep -v "^$"
```

**Common Fixes:**
```bash
# Fix 1: Reload systemd after config changes
sudo systemctl daemon-reload

# Fix 2: Reset failed state
sudo systemctl reset-failed xdc
sudo systemctl start xdc

# Fix 3: Check for missing libraries
ldd /usr/local/bin/XDC 2>&1 | grep "not found"

# Fix 4: Recreate service file
sudo tee /etc/systemd/system/xdc.service > /dev/null <<EOF
[Unit]
Description=XDC Network Node
After=network.target

[Service]
Type=simple
User=xdcd
Group=xdcd
WorkingDirectory=/data/xdcnode
ExecStart=/usr/local/bin/XDC --config /etc/xdc/config.toml
Restart=always
RestartSec=5
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable xdc
sudo systemctl start xdc
```

### 1.3 Binary Deployment

**Symptoms:** `./XDC` exits with error, core dump, or permission denied

**Diagnosis Commands:**
```bash
# Check architecture compatibility
uname -m  # Should be x86_64
file ./XDC  # Should match architecture

# Test with strace for system call failures
strace -f ./XDC --datadir ./data 2>&1 | grep -i error | head -20

# Check for missing genesis
ls -la ./data/XDC/chaindata/ 2>/dev/null || echo "No chaindata found"
```

**Common Fixes:**
```bash
# Fix 1: Download correct binary for architecture
wget https://github.com/XinFinOrg/XDPoSChain/releases/download/v2.6.8/XDC-linux-amd64
chmod +x XDC-linux-amd64
mv XDC-linux-amd64 XDC

# Fix 2: Initialize with correct genesis
./XDC --datadir ./data init /path/to/genesis.json

# Fix 3: Clear corrupted state
rm -rf ./data/XDC/chaindata/*
rm -rf ./data/XDC/trie_nodes/*
./XDC --datadir ./data init /path/to/genesis.json
```

---

## 2. Sync Stuck / Slow Sync

### 2.1 Diagnosis Commands

```bash
# Check current sync status
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_syncing","params":[],"id":1}' | jq

# Expected response when syncing:
# {"jsonrpc":"2.0","id":1,"result":{"currentBlock":"0x1234","highestBlock":"0x99999999"}}

# Check peer count
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' | jq

# Check block number progression (run twice, 10s apart)
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq

# Check sync logs
grep -E "(Importing|sync|Sync)" /var/log/xdc/xdc.log | tail -50

# Check disk I/O (should be <50% util for SSD)
iostat -x 1 5 | grep -E "(Device|xdc)"

# Check network connectivity to peers
ss -tn | grep 30303 | wc -l
```

### 2.2 Common Causes & Fixes

**Cause A: Insufficient Peers (<10)**
```bash
# Add bootstrap peers
xdc add-peers --enode "enode://pubkey@ip:30303"

# Or add multiple at once
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"admin_addPeer",
    "params":["enode://pubkey@13.251.30.28:30303"],
    "id":1
  }'

# Verify peer count increased
sleep 5 && xdc peers | wc -l
```

**Cause B: Slow Disk I/O (HDD instead of SSD)**
```bash
# Test disk speed (should be >500MB/s sequential)
dd if=/dev/zero of=/data/xdcnode/testfile bs=1G count=1 oflag=direct
rm /data/xdcnode/testfile

# Monitor I/O wait during sync
vmstat 1 10 | awk '{print $16}'  # Check 'wa' column

# Fix: Move to NVMe SSD
# No command fix - requires hardware migration
```

**Cause C: Network Throttling**
```bash
# Check current bandwidth usage
nload eth0  # or iftop -i eth0

# Check for dropped packets
netstat -i | grep eth0

# Fix: Increase peer count limit in config
# Add to config.toml:
# [Node.P2P]
# MaxPeers = 100
```

**Cause D: Corrupt Chaindata**
```bash
# Check for errors in logs
grep -i "error\|fail\|corrupt" /var/log/xdc/xdc.log | tail -20

# Fix: Clear chaindata and resync (see section 5 for merkle root errors)
sudo systemctl stop xdc
sudo rm -rf /data/xdcnode/XDC/chaindata/*
sudo rm -rf /data/xdcnode/XDC/trie_nodes/*
sudo systemctl start xdc
```

---

## 3. Zero Peers / Peer Drops

### 3.1 Diagnosis Commands

```bash
# Get peer count
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' | jq '.result'

# List connected peers with details
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"admin_peers","params":[],"id":1}' | jq '.result | length'

# Check listening status
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"net_listening","params":[],"id":1}' | jq '.result'

# Check node info
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"admin_nodeInfo","params":[],"id":1}' | jq '.result.enode'

# Check firewall status
sudo ufw status
sudo iptables -L -n | grep 30303

# Check if port is actually listening
sudo netstat -tlnp | grep 30303
sudo ss -tlnp | grep 30303

# Test external connectivity
curl -4 ifconfig.co  # Get public IP
curl -6 ifconfig.co  # Get IPv6 (if applicable)

# Check port reachability from outside
# From another server:
nmap -p 30303 <your_public_ip>
```

### 3.2 Firewall & Network Fixes

```bash
# Fix UFW (Ubuntu)
sudo ufw allow 30303/tcp
sudo ufw allow 30303/udp
sudo ufw reload

# Fix iptables
sudo iptables -A INPUT -p tcp --dport 30303 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 30303 -j ACCEPT
sudo iptables-save > /etc/iptables/rules.v4

# Fix firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-port=30303/tcp
sudo firewall-cmd --permanent --add-port=30303/udp
sudo firewall-cmd --reload

# Check AWS/GCP/Azure security groups
# Ensure inbound 30303/tcp and 30303/udp are allowed from 0.0.0.0/0

# Test with netcat
# On node:
nc -l -p 30303
# From remote:
echo "test" | nc <node_ip> 30303
```

### 3.3 Bootstrap Peer List

```bash
# Add official XDC bootstrap nodes
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"admin_addPeer",
    "params":["enode://2e7cad2d55699693e22d32d852e10a244b2e72492b5c14060fc751b28f8c9ef0e53e68e70e1a9e81e95e2e2d07c87926b97071e1436c10e4ec3ab2e950250f16@18.136.15.201:30303"],
    "id":1
  }'

# Add multiple peers via script
#!/bin/bash
BOOTNODES=(
  "enode://pubkey1@18.136.15.201:30303"
  "enode://pubkey2@13.251.30.28:30303"
  "enode://pubkey3@34.204.159.8:30303"
)

for node in "${BOOTNODES[@]}"; do
  curl -s -X POST http://localhost:8545 \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"admin_addPeer\",\"params\":[\"$node\"],\"id\":1}"
done
```

---

## 4. High CPU / Memory / Disk

### 4.1 High CPU Diagnosis

```bash
# Check CPU usage by process
top -bn1 | grep XDC

# Check CPU usage over time
pidstat -u 1 10 | grep XDC

# Profile CPU usage (if pprof enabled)
curl -s http://localhost:6060/debug/pprof/profile?seconds=30 > cpu.prof

# Check for stuck goroutines
curl -s http://localhost:6060/debug/pprof/goroutine?debug=1 | head -100

# Common CPU causes
grep -E "(block inserted|Transaction|txpool)" /var/log/xdc/xdc.log | tail -50
```

**Fixes:**
```bash
# Fix 1: Limit CPU cores if oversubscribed
# In docker run, add:
--cpus="4"

# Fix 2: Restart to clear memory pressure
sudo systemctl restart xdc

# Fix 3: Reduce peer count
# In config.toml:
# [Node.P2P]
# MaxPeers = 25  # Down from 50

# Fix 4: Enable single-core optimization for archive nodes
# Add flag: --gcmode archive --cache 2048
```

### 4.2 High Memory Diagnosis

```bash
# Check memory usage
free -h
ps aux | grep XDC | grep -v grep | awk '{print $6/1024 " MB RSS"}'

# Check for memory leaks over time
while true; do
  ps aux | grep XDC | grep -v grep | awk '{print strftime("%H:%M:%S"), $6/1024 "MB"}'
  sleep 60
done

# Check heap profile
curl -s http://localhost:6060/debug/pprof/heap > heap.prof
go tool pprof heap.prof

# Check for too many peers
xdc peers | wc -l  # Should be <100
```

**Fixes:**
```bash
# Fix 1: Increase swap (temporary)
sudo fallocate -l 8G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Fix 2: Limit cache size
# Add to flags: --cache 2048 (reduce from default 4096)

# Fix 3: Restart with memory limit
# In docker:
--memory="16g" --memory-swap="16g"

# Fix 4: Prune old state (full nodes only)
# Archive nodes cannot prune
./XDC --datadir /data/xdcnode/XDC prune-state
```

### 4.3 Disk Full Diagnosis

```bash
# Check disk usage
df -h | grep -E "(Filesystem|xdc|data)"
du -sh /data/xdcnode/XDC/* | sort -hr | head -20

# Check growth rate
while true; do
  du -sb /data/xdcnode/XDC/chaindata
  sleep 3600
done

# Find largest files
find /data/xdcnode/XDC -type f -exec ls -lh {} \; | sort -k5 -hr | head -20
```

**Fixes:**
```bash
# Fix 1: Prune ancient data (full node)
./XDC --datadir /data/xdcnode/XDC removedb -- ancient

# Fix 2: Enable automatic ancient data pruning
# Add to config:
# [Eth]
# NoPruning = false
# NoPrefetch = false

# Fix 3: Move ancient data to cheaper storage
mkdir -p /mnt/cold-storage/ancient
ln -sf /mnt/cold-storage/ancient /data/xdcnode/XDC/chaindata/ancient

# Fix 4: Expand volume (cloud)
# AWS:
aws ec2 modify-volume --volume-id vol-xxx --size 2000
sudo growpart /dev/nvme0n1 1
sudo resize2fs /dev/nvme0n1p1
```

---

## 5. Merkle Root Mismatch (CRITICAL)

> ⚠️ **This error requires wiping chaindata. No exceptions.**

### 5.1 Diagnosis

```bash
# Confirm the error
grep -i "merkle root mismatch\|invalid merkle root" /var/log/xdc/xdc.log | tail -20

# Check for state corruption markers
grep -iE "(trie|state|corrupt|invalid)" /var/log/xdc/xdc.log | tail -50

# Verify it's not a temporary fork
xdc status | grep -E "(block|sync)"
```

### 5.2 The Fix (Exact Commands)

```bash
# Step 1: STOP the node
sudo systemctl stop xdc
# OR
sudo docker stop xdc

# Step 2: Verify stopped
ps aux | grep XDC | grep -v grep  # Should return nothing

# Step 3: BACKUP critical data (not chaindata)
mkdir -p /backup/xdc-emergency-$(date +%Y%m%d-%H%M%S)
cp /data/xdcnode/.pwd/* /backup/xdc-emergency-*/ 2>/dev/null || true
cp /data/xdcnode/XDC/nodekey /backup/xdc-emergency-*/ 2>/dev/null || true
cp /data/xdcnode/XDC/keystore/* /backup/xdc-emergency-*/ 2>/dev/null || true

# Step 4: WIPE chaindata (THIS DELETES BLOCK DATA)
sudo rm -rf /data/xdcnode/XDC/chaindata/*
sudo rm -rf /data/xdcnode/XDC/trie_nodes/*
sudo rm -rf /data/xdcnode/XDC/ethash/*

# Step 5: Verify deletion
ls -la /data/xdcnode/XDC/chaindata/  # Should be empty or nearly empty

# Step 6: RESTART (will trigger full resync)
sudo systemctl start xdc
# OR
sudo docker start xdc

# Step 7: Monitor resync
watch -n 10 'xdc status | grep -E "(block|sync|peer)"'
```

### 5.3 Docker-Specific Wipe

```bash
# Stop and remove container
sudo docker stop xdc
sudo docker rm xdc

# Wipe data volume
sudo rm -rf /data/xdcnode/XDC/chaindata/*
sudo rm -rf /data/xdcnode/XDC/trie_nodes/*

# Recreate container
sudo docker run -d \
  --name xdc \
  --network host \
  --restart unless-stopped \
  -v /data/xdcnode/XDC:/work/xdcchain \
  -v /data/xdcnode/.pwd:/work/.pwd \
  xinfinorg/xdposchain:v2.6.8 \
  --datadir /work/xdcchain \
  --syncmode full \
  --gcmode archive \
  --rpc \
  --rpcaddr 0.0.0.0 \
  --rpcport 8545

# Monitor logs
sudo docker logs -f xdc | grep -E "(sync|import|peer|error)"
```

### 5.4 Recovery Time Estimation

| Network | Blocks | Est. Sync Time | Disk Required |
|---------|--------|----------------|---------------|
| Mainnet | ~99.2M | 24-72 hours | ~2TB |
| Testnet | ~45M | 12-24 hours | ~800GB |
| Devnet | <1M | 1-2 hours | ~50GB |

---

## 6. Fork Detection

### 6.1 Diagnosis Commands

```bash
# Check if local head matches network
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq '.result'

# Compare with public RPC
curl -s -X POST https://rpc.xdc.org \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq '.result'

# Get block hash at specific height
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["0x5F5E100",false],"id":1}' | jq '.result.hash'

# Check for fork warnings
grep -iE "(fork|sidechain|reorg)" /var/log/xdc/xdc.log | tail -30
```

### 6.2 Response Playbook

```bash
# If on shorter fork (<12 blocks behind):
# 1. Wait - XDPoS should resolve automatically
# 2. Monitor
watch -n 5 'echo "Local: $(xdc block-number), Network: $(curl -s -X POST https://rpc.xdc.org -H "Content-Type: application/json" -d '\''{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'\'' | jq -r '\''.result'\'' | xargs printf "%d\n")"'

# If stuck on fork for >30 minutes:
# 1. Add more bootstrap peers
# 2. Restart node
# 3. If still stuck: merkle root wipe (see section 5)
```

---

## 7. Consensus Failures / Missed Blocks

### 7.1 Diagnosis (Masternodes Only)

```bash
# Check if node is in masternode list
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getMasternodes","params":[],"id":1}' | jq

# Check epoch and round
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"XDPoS_getEpochNumber","params":[],"id":1}' | jq

# Check missed Rounds
grep -iE "(timeout|missed|consensus|round)" /var/log/xdc/xdc.log | tail -50

# Check if signing correctly
grep "Successfully sealed" /var/log/xdc/xdc.log | tail -20
```

### 7.2 Common Fixes

```bash
# Fix 1: Ensure coinbase is set correctly
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_coinbase","params":[],"id":1}' | jq '.result'

# Should match your masternode address

# Fix 2: Check if node is synced to head
xdc sync-status

# Must be "synced" not "syncing" to participate in consensus

# Fix 3: Restart to clear any stuck consensus state
sudo systemctl restart xdc

# Fix 4: Verify sufficient peers (need >25 for good propagation)
xdc peers | wc -l
```

---

## 8. RPC Not Responding

### 8.1 Diagnosis

```bash
# Test basic connectivity
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"net_version","params":[],"id":1}' -w "HTTP %{http_code}\n"

# Test with verbose output
curl -v -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' 2>&1 | grep -E "(Connected|HTTP|error)"

# Check if port is listening
sudo netstat -tlnp | grep 8545
sudo ss -tlnp | grep 8545

# Check firewall
sudo iptables -L -n | grep 8545
```

### 8.2 Fixes

```bash
# Fix 1: Restart RPC server (if HTTP module crashed)
sudo systemctl restart xdc

# Fix 2: Check RPC configuration
grep -A5 "\[Node.HTTP\]" /data/xdcnode/XDC/config.toml

# Should show:
# Host = "0.0.0.0"
# Port = 8545

# Fix 3: Temporarily enable all RPC (SECURITY RISK - use only for debugging)
# Add flags:
# --rpc --rpcaddr 0.0.0.0 --rpcapi eth,net,web3,admin,debug

# Fix 4: Check for rate limiting
# Look for "429 Too Many Requests" in logs
grep "429" /var/log/xdc/xdc.log | tail -10
```

---

## 9. Port Conflicts

### 9.1 Diagnosis

```bash
# Check what's using each port
sudo netstat -tlnp | grep -E "(30303|8545|6060)"
sudo lsof -i :30303
sudo lsof -i :8545
sudo lsof -i :6060

# Check for multiple XDC processes
ps aux | grep XDC

# Check Docker port mappings
sudo docker ps --format "table {{.Names}}\t{{.Ports}}" | grep -E "(xdc|30303|8545)"
```

### 9.2 Resolution

```bash
# Option 1: Kill conflicting process
sudo kill -9 $(sudo lsof -t -i:30303)

# Option 2: Change XDC ports
# In config.toml or flags:
# --port 30304  # P2P port
# --rpcport 8546  # RPC port

# Option 3: Remove conflicting container
sudo docker rm -f conflicting-container

# Option 4: Use different IP binding
# --rpcaddr 127.0.0.1  # Local only
# --rpcaddr 10.0.1.5   # Specific interface
```

---

## 10. Docker Networking Issues

### 10.1 Bridge vs Host Mode

```bash
# Check current network mode
sudo docker inspect xdc --format='{{.HostConfig.NetworkMode}}'

# Bridge mode issues (port not exposed externally)
sudo docker run -d \
  --name xdc-bridge \
  -p 30303:30303 \
  -p 30303:30303/udp \
  -p 8545:8545 \
  -v /data/xdcnode/XDC:/work/xdcchain \
  xinfinorg/xdposchain:v2.6.8

# Host mode (recommended for P2P)
sudo docker run -d \
  --name xdc-host \
  --network host \
  -v /data/xdcnode/XDC:/work/xdcchain \
  xinfinorg/xdposchain:v2.6.8
```

### 10.2 Docker DNS Issues

```bash
# Test DNS resolution inside container
sudo docker exec xdc nslookup rpc.xdc.org

# Fix DNS
sudo docker run -d \
  --dns 8.8.8.8 \
  --dns 8.8.4.4 \
  --name xdc \
  --network host \
  xinfinorg/xdposchain:v2.6.8

# Or fix daemon-wide
cat /etc/docker/daemon.json
{
  "dns": ["8.8.8.8", "8.8.4.4"]
}
sudo systemctl restart docker
```

### 10.3 Container Cannot Reach Peers

```bash
# Test connectivity from inside container
sudo docker exec -it xdc /bin/sh
ping 8.8.8.8
ping rpc.xdc.org
exit

# Check if host has internet but container doesn't
# Usually indicates firewall or NAT issue

# Fix: Ensure MASQUERADE is enabled
sudo iptables -t nat -L -n | grep MASQUERADE
sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
```

---

## 11. Log Patterns to Grep

### 11.1 Critical Errors (Immediate Action Required)

```bash
# Merkle root mismatch (Wipe chaindata!)
grep -i "merkle root mismatch" /var/log/xdc/xdc.log

# Database corruption
grep -iE "(leveldb|corrupt|repair)" /var/log/xdc/xdc.log

# Consensus failure
grep -iE "(consensus failed|invalid header|timeout)" /var/log/xdc/xdc.log

# Out of memory
grep -i "fatal error: runtime: out of memory" /var/log/xdc/xdc.log

# Panic
grep -i "panic:" /var/log/xdc/xdc.log
```

### 11.2 Warning Patterns (Monitor)

```bash
# Peer drops
grep -i "dropped peer" /var/log/xdc/xdc.log | tail -50

# Slow import
grep -i "slow" /var/log/xdc/xdc.log | tail -30

# High block processing time
grep -E "Importing.*took" /var/log/xdc/xdc.log | awk '{if ($NF > 1) print}' | tail -20

# Fork detection
grep -i "fork" /var/log/xdc/xdc.log | tail -20
```

### 11.3 Normal Operation Patterns

```bash
# Block import (normal)
grep "Imported new chain segment" /var/log/xdc/xdc.log | tail -10

# Successful seal (masternodes only)
grep "Successfully sealed" /var/log/xdc/xdc.log | tail -10

# Peer connections
grep "Adding p2p peer" /var/log/xdc/xdc.log | tail -10
```

### 11.4 One-Line Log Monitors

```bash
# Real-time critical errors
sudo tail -f /var/log/xdc/xdc.log | grep -iE "(error|fatal|panic|merkle|corrupt)"

# Real-time block import with timing
sudo tail -f /var/log/xdc/xdc.log | grep "Importing"

# Peer count over time
while true; do echo "$(date '+%H:%M:%S') Peers: $(xdc peers 2>/dev/null | wc -l)"; sleep 30; done
```

---

## 12. Emergency Procedures

### 12.1 Chain Halt Response

```bash
# 1. Confirm it's a network-wide halt, not just your node
# Compare block numbers across multiple sources
for rpc in "http://localhost:8545" "https://rpc.xdc.org" "https://rpc.xinfin.network"; do
  echo "$rpc: $(curl -s -X POST $rpc -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq -r '.result' | xargs printf '%d\n')"
done

# 2. If network halted: WAIT for official announcement
# Do NOT restart randomly - may miss recovery blocks

# 3. Monitor logs for consensus activity
tail -f /var/log/xdc/xdc.log | grep -iE "(consensus|round|timeout)"

# 4. If instructed to restart:
sudo systemctl restart xdc
```

### 12.2 Rollback Procedure (Advanced)

```bash
# WARNING: Only use if instructed by XDC core team

# 1. Stop node
sudo systemctl stop xdc

# 2. Backup current state
cp -r /data/xdcnode/XDC/chaindata /data/xdcnode/XDC/chaindata-backup-$(date +%Y%m%d)

# 3. Set rollback target (example: 100 blocks back)
# Requires custom build or admin API

# 4. Restart with rollback
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"debug_setHead","params":["0xTARGET_BLOCK_HEX"],"id":1}'

# 5. Monitor resync
xdc sync-status
```

### 12.3 Snapshot Restore

```bash
# 1. Download official snapshot
wget https://snapshot.xdc.org/mainnet-$(date +%Y%m%d).tar.gz

# 2. Stop node
sudo systemctl stop xdc

# 3. Backup keys
mkdir -p /backup/keys
cp /data/xdcnode/XDC/nodekey /backup/keys/
cp -r /data/xdcnode/XDC/keystore /backup/keys/

# 4. Clear chaindata
sudo rm -rf /data/xdcnode/XDC/chaindata/*

# 5. Extract snapshot
sudo tar -xzf mainnet-*.tar.gz -C /data/xdcnode/XDC/

# 6. Restore keys
sudo cp /backup/keys/nodekey /data/xdcnode/XDC/
sudo cp -r /backup/keys/keystore /data/xdcnode/XDC/

# 7. Fix permissions
sudo chown -R $(id -u):$(id -g) /data/xdcnode/XDC/

# 8. Start node
sudo systemctl start xdc

# 9. Verify
xdc status
```

---

## 13. Performance Tuning

### 13.1 OS sysctl Settings

```bash
# /etc/sysctl.conf for XDC nodes

# Increase file descriptor limits
fs.file-max = 2097152
fs.nr_open = 2097152

# Network optimizations
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65536
net.ipv4.tcp_max_syn_backlog = 65536
net.ipv4.tcp_fin_timeout = 10
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_tw_reuse = 1

# Memory for networking
net.core.rmem_max = 134217728
net.core.wmem_max = 134217728
net.ipv4.tcp_rmem = 4096 87380 134217728
net.ipv4.tcp_wmem = 4096 65536 134217728

# VM settings
vm.swappiness = 10
vm.dirty_ratio = 40
vm.dirty_background_ratio = 10

# Apply
sudo sysctl -p
```

### 13.2 Disk I/O Optimization

```bash
# Check current I/O scheduler
cat /sys/block/nvme0n1/queue/scheduler

# Set to mq-deadline for NVMe (best for blockchain)
echo mq-deadline | sudo tee /sys/block/nvme0n1/queue/scheduler

# Make persistent
echo 'ACTION=="add|change", KERNEL=="nvme[0-9]*", ATTR{queue/scheduler}="mq-deadline"' | sudo tee /etc/udev/rules.d/60-ioscheduler.rules

# Enable noatime for data partition
# Add to /etc/fstab:
# /dev/nvme0n1p1 /data ext4 noatime,nodiratime 0 2

# Mount with optimizations
sudo mount -o remount,noatime,nodiratime /data
```

### 13.3 Go GC Tuning

```bash
# Environment variables for XDC binary
export GOGC=100          # Default, increase if memory available
export GOMEMLIMIT=14GiB  # Set if running on 16GB+ machine

# In systemd service:
# Environment="GOGC=100"
# Environment="GOMEMLIMIT=14GiB"

# In Docker:
# -e GOGC=100 -e GOMEMLIMIT=14GiB
```

### 13.4 XDC-Specific Flags

```bash
# High-performance node configuration
./XDC \
  --datadir /data/xdcnode/XDC \
  --syncmode full \
  --gcmode archive \
  --cache 8192 \
  --rpc \
  --rpcaddr 0.0.0.0 \
  --rpcport 8545 \
  --rpccorsdomain "*" \
  --rpcapi eth,net,web3,admin,debug \
  --ws \
  --wsaddr 0.0.0.0 \
  --wsport 8546 \
  --maxpeers 100 \
  --light.maxpeers 50
```

---

## 14. Monitoring Alert Response Playbook

### 14.1 Alert: Node Down

```
ALERT: XDC node mn-001 is DOWN
Duration: >2 minutes
Severity: CRITICAL
```

**Response:**
```bash
# 1. Check if process exists
ps aux | grep XDC | grep -v grep

# 2. If not running, check why
sudo systemctl status xdc
sudo journalctl -u xdc -n 50 --no-pager

# 3. Check for OOM
sudo dmesg | grep -i "out of memory"

# 4. Restart
sudo systemctl restart xdc

# 5. Verify
sleep 10 && xdc status
```

### 14.2 Alert: Sync Lag

```
ALERT: XDC node mn-001 sync lag >100 blocks
Current: 99234567, Network: 99234680
Severity: WARNING
```

**Response:**
```bash
# 1. Check peer count
xdc peers | wc -l  # Should be >25

# 2. Check disk space
df -h /data

# 3. Check for errors
grep -i error /var/log/xdc/xdc.log | tail -10

# 4. If peers low: add bootstrap nodes
xdc add-peers --bootstrap

# 5. If disk full: see section 4.3

# 6. If errors: identify and remediate
```

### 14.3 Alert: High CPU

```
ALERT: XDC node mn-001 CPU >90% for 10 minutes
Current: 94%
Severity: WARNING
```

**Response:**
```bash
# 1. Check what's consuming CPU
pidstat -u 1 5 | grep XDC

# 2. Check if during sync
xdc sync-status

# 3. If not syncing, check for stuck goroutines
curl -s http://localhost:6060/debug/pprof/goroutine?debug=1 | grep -c "goroutine"

# 4. If goroutines >10000, restart
sudo systemctl restart xdc

# 5. Consider limiting cores if oversubscribed
```

### 14.4 Alert: Disk Full

```
ALERT: XDC node mn-001 disk >95% full
Current: 97%
Severity: CRITICAL
```

**Response:**
```bash
# 1. Check what's consuming space
du -sh /data/xdcnode/XDC/* | sort -hr

# 2. If chaindata: prune ancient
./XDC --datadir /data/xdcnode/XDC removedb --ancient

# 3. If logs: rotate and compress
sudo logrotate -f /etc/logrotate.d/xdc
find /var/log/xdc -name "*.log.*" -exec gzip {} \;

# 4. Emergency: expand volume
# (Cloud-specific commands)
```

### 14.5 Alert: Consensus Missed

```
ALERT: Masternode mn-001 missed 3 consecutive rounds
Epoch: 110234, Severity: CRITICAL
```

**Response:**
```bash
# 1. Check if node is in masternode list
curl -s -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getMasternodes","params":[],"id":1}' | jq '.result[] | select(.address == "YOUR_COINBASE")'

# 2. Check if synced
xdc sync-status

# 3. Check peer count
xdc peers | wc -l

# 4. Check for consensus errors
grep -iE "(consensus|timeout|round)" /var/log/xdc/xdc.log | tail -20

# 5. Restart if necessary
sudo systemctl restart xdc
```

---

## Quick Reference: Common Commands

```bash
# Status
xdc status
xdc sync-status
xdc peers | wc -l

# Logs
sudo tail -f /var/log/xdc/xdc.log
sudo docker logs -f xdc 2>&1 | grep -i error

# RPC Tests
curl -s -X POST http://localhost:8545 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq

# Restart
sudo systemctl restart xdc
sudo docker restart xdc

# Emergency Wipe (CAUTION!)
sudo systemctl stop xdc
sudo rm -rf /data/xdcnode/XDC/chaindata/*
sudo rm -rf /data/xdcnode/XDC/trie_nodes/*
sudo systemctl start xdc
```

---

*When in doubt: check logs, check peers, check disk.*  
**XDCNetOwn DevOps Team**
