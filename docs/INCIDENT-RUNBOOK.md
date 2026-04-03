# Incident Response Runbook

**SkyNet — XDC Multi-Client Fleet**  
Version 1.0 | Issue #50

---

## Table of Contents

1. [Sync Stall](#1-sync-stall)
2. [Peer Loss](#2-peer-loss)
3. [Consensus Divergence](#3-consensus-divergence)
4. [Out-of-Memory (OOM)](#4-out-of-memory-oom)
5. [Disk Full](#5-disk-full)
6. [Container Crash / Restart Loop](#6-container-crash--restart-loop)

---

## 1. Sync Stall

**Symptoms:** Block height frozen for >5 min. Sync % not advancing. SkyNet shows 🔴 sync stall alert.

### Diagnosis

```bash
# Check current block height
curl -s http://localhost:8989 -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Check peers
curl -s http://localhost:8989 -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}'

# Check sync status
curl -s http://localhost:8989 -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_syncing","params":[],"id":1}'

# View container logs (last 200 lines)
docker logs xdc-node --tail 200 -f
```

### Resolution Steps

1. **Check peers first** — if peer count = 0, go to [Peer Loss](#2-peer-loss)
2. **Restart the container:**
   ```bash
   docker restart xdc-node
   # Wait 30 seconds, then check block height again
   ```
3. **If still stalled after restart:**
   ```bash
   # Check for disk space (sync stall often caused by disk full)
   df -h /data
   ```
4. **For Erigon** — check stage sync progress:
   ```bash
   curl -s http://localhost:8090/metrics | grep erigon_stages
   ```
5. **For GP5/Geth** — check for bad block:
   ```bash
   docker logs xdc-node 2>&1 | grep -i "bad block\|reorg\|chain split"
   ```
6. **Last resort** — resync from snapshot (contact XDCIndia for latest snapshot URL)

---

## 2. Peer Loss

**Symptoms:** Peer count drops to 0. Node can't sync. SkyNet shows peer count alert.

### Diagnosis

```bash
# Check admin peers
curl -s http://localhost:8989 -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"admin_peers","params":[],"id":1}'

# Check node listening
curl -s http://localhost:8989 -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"net_listening","params":[],"id":1}'

# Check if port 30303 is open
ss -tlnp | grep 30303
nc -zv bootstrap1.xinfin.network 20301
```

### Resolution Steps

1. **Inject bootnodes manually:**
   ```bash
   # XDC mainnet bootnodes
   BOOTNODES=(
     "enode://3d3a...@45.76.12.34:20301"
     "enode://4aaf...@95.179.130.90:20301"
   )
   for enode in "${BOOTNODES[@]}"; do
     curl -s http://localhost:8989 -X POST \
       -H "Content-Type: application/json" \
       -d "{\"jsonrpc\":\"2.0\",\"method\":\"admin_addPeer\",\"params\":[\"$enode\"],\"id\":1}"
   done
   ```

2. **Inject fleet peers via SkyOne:**
   ```bash
   curl -X POST http://localhost:7070/api/peers/inject \
     -H "Authorization: Bearer $SKYONE_KEY" \
     -H "Content-Type: application/json" \
     -d '{"peers": ["enode://...@fleet-node-2:30303"]}'
   ```

3. **Check firewall:**
   ```bash
   ufw status | grep 30303
   # Open if blocked:
   ufw allow 30303/tcp
   ufw allow 30303/udp
   ```

4. **Restart with static peers:**
   ```bash
   # Add to docker compose static-nodes.json or --bootnodes flag
   docker restart xdc-node
   ```

---

## 3. Consensus Divergence

**Symptoms:** Two nodes disagree on block hash at same height. SkyNet fires 🔴 divergence alert.

### Diagnosis

```bash
# Check which hash each node reports
for PORT in 8989 8990 8991; do
  echo "Port $PORT:"
  curl -s http://localhost:$PORT -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["latest",false],"id":1}' \
    | python3 -c "import sys,json; d=json.load(sys.stdin)['result']; print(f'  Block #{int(d[\"number\"],16)} hash={d[\"hash\"][:16]}...')"
done

# Check SkyNet divergence events
curl http://localhost:3005/api/v1/network/block-comparison
```

### Resolution Steps

1. **Identify minority node** (SkyNet auto-detects via divergence resolver — see dashboard incident)
2. **Verify majority hash against XDC explorer:**
   ```bash
   # Check https://explorer.xinfin.network for the canonical hash
   ```
3. **Stop the minority node:**
   ```bash
   docker stop xdc-node-minority
   ```
4. **Resync from last good block:**
   ```bash
   # Find the last agreed block (before divergence)
   LAST_GOOD=12345678
   
   # For GP5/Geth — rollback using debug_setHead
   curl -s http://localhost:PORT -X POST \
     -H "Content-Type: application/json" \
     -d "{\"jsonrpc\":\"2.0\",\"method\":\"debug_setHead\",\"params\":[\"0x$(printf '%x' $LAST_GOOD)\"],\"id\":1}"
   
   # Then restart
   docker start xdc-node-minority
   ```
5. **For Erigon divergence** — use erigon snapshots to roll back stage sync
6. **Post-incident** — resolve alert in SkyNet dashboard and document root cause

---

## 4. Out-of-Memory (OOM)

**Symptoms:** Container exits with code 137. `dmesg` shows OOM kill. Node restarts repeatedly.

### Diagnosis

```bash
# Check OOM kills
dmesg -T | grep -i "oom kill"
journalctl -k | grep -i "oom kill"

# Check container memory usage
docker stats xdc-node --no-stream

# Check swap
free -h
swapon --show
```

### Resolution Steps

1. **Add/increase swap (emergency fix):**
   ```bash
   fallocate -l 8G /swapfile
   chmod 600 /swapfile
   mkswap /swapfile
   swapon /swapfile
   echo '/swapfile none swap sw 0 0' >> /etc/fstab
   ```

2. **Reduce memory usage:**
   ```bash
   # GP5/Geth: reduce cache
   # Add to docker run: --cache 1024
   
   # Erigon: reduce batch size
   # Add: --batchSize 512M
   
   # Nethermind: reduce cache settings
   # Update nethermind.cfg: "CacheMb": 512
   ```

3. **Set Docker memory limit:**
   ```yaml
   # In docker-compose.yml
   services:
     xdc-node:
       mem_limit: 8g
       memswap_limit: 12g
   ```

4. **Upgrade RAM** if consistently hitting limits (minimum 16 GB recommended for archive nodes)

---

## 5. Disk Full

**Symptoms:** Container exits. Logs show "no space left on device". Block height frozen.

### Diagnosis

```bash
# Check disk usage
df -h
du -sh /data/* 2>/dev/null | sort -hr | head -20

# Check Docker disk usage
docker system df

# Check node data dir
du -sh /data/xdc 2>/dev/null
```

### Resolution Steps

1. **Immediate: free space**
   ```bash
   # Remove old Docker images
   docker image prune -a -f
   
   # Remove stopped containers
   docker container prune -f
   
   # Clear unused volumes
   docker volume prune -f
   
   # Truncate old logs
   journalctl --vacuum-size=500M
   find /var/log -name "*.log" -mtime +7 -exec truncate -s 0 {} \;
   ```

2. **For archive nodes** — add additional disk or mount new volume:
   ```bash
   # Mount new volume at /data2
   mount /dev/sdb1 /data2
   # Symlink or move chaindata
   ```

3. **Enable pruning** (non-archive nodes):
   ```bash
   # GP5/Geth: add --gcmode full to startup params
   # This enables state trie pruning
   ```

4. **Configure SkyNet disk alerts** (alert before 90% full):
   - Dashboard → Alerts → Add Rule → `disk_percent > 85` → Warning
   - `disk_percent > 90` → Critical

---

## 6. Container Crash / Restart Loop

**Symptoms:** Container restarts every few seconds. `docker ps` shows "Restarting". SkyNet shows container health alert.

### Diagnosis

```bash
# Check exit code and restart count
docker inspect xdc-node | python3 -c \
  "import sys,json; s=json.load(sys.stdin)[0]['State']; \
   print(f'Status: {s[\"Status\"]} ExitCode: {s[\"ExitCode\"]} Restarts: {s[\"RestartCount\"]}')"

# View crash logs
docker logs xdc-node --tail 100 2>&1

# Check for port conflicts
ss -tlnp | grep -E '30303|8989|8988'
```

### Common Causes and Fixes

| Exit Code | Likely Cause | Fix |
|-----------|-------------|-----|
| 1 | Config error / bad flag | Check startup params |
| 137 | OOM kill | See [OOM section](#4-out-of-memory-oom) |
| 139 | Segfault | Update client image |
| 2 | Invalid arguments | Check docker-compose command |

```bash
# Fix 1: Config error — check startup params
docker inspect xdc-node | python3 -c \
  "import sys,json; print(json.load(sys.stdin)[0]['Config']['Cmd'])"

# Fix 2: Update to latest stable image
docker pull xdcindia/xdc-geth:latest
docker-compose up -d xdc-node

# Fix 3: Corrupted database — delete and resync
docker stop xdc-node
rm -rf /data/xdc/geth/chaindata
docker start xdc-node
# (Will resync from genesis — slow. Use snapshot instead.)

# Fix 4: Port conflict
fuser -k 30303/tcp
docker restart xdc-node
```

---

## Quick Reference

| Issue | First Command | Dashboard View |
|-------|-------------|----------------|
| Sync stall | `docker logs xdc-node --tail 50` | Nodes → Sync Progress |
| Peer loss | `admin_peers` JSON-RPC | Nodes → Peers |
| Divergence | `eth_getBlockByNumber` on all nodes | Fleet → Incidents |
| OOM | `dmesg \| grep oom` | Nodes → System |
| Disk full | `df -h` | Nodes → Storage |
| Crash loop | `docker inspect xdc-node` | Nodes → Container |

---

*Maintained by XDCIndia. Report runbook gaps as GitHub issues.*
