# XDC Node Troubleshooting Guide

## Auto-Detected Issue Resolution

This guide addresses the common auto-detected issues reported by XDC SkyNet monitoring.

### Issue #699: Peer Count Dropped to 0

**Symptoms:**
- Peer count shows 0
- Block synchronization stalled
- Node isolated from network

**Root Causes:**
1. Firewall blocking port 30303
2. Bootstrap peers unreachable
3. NAT configuration issues
4. Container network issues

**Resolution Steps:**

```bash
# 1. Check firewall status
sudo ufw status
sudo ufw allow 30303/tcp
sudo ufw allow 30303/udp

# 2. Verify network connectivity
curl -v telnet://194.163.156.211:30303

# 3. Restart node container
docker-compose restart xdc

# 4. Check peer count after restart
sleep 60
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}'
```

### Issue #698/#697: Sync Stall

**Symptoms:**
- Block height not increasing
- Sync percentage stuck
- High CPU but no progress

**Client-Specific Fixes:**

#### Nethermind
```bash
# Clear bad block cache
rm -rf /xdcdata/xdc/chaindata/bad-blocks
docker-compose restart xdc
```

#### Erigon
```bash
# Restart with clean state
docker-compose down
sleep 10
docker-compose up -d
```

#### Geth/XDC
```bash
# Remove static nodes and let discovery work
rm -rf /xdcdata/xdc/geth/nodes/
docker-compose restart xdc
```

### Automated Remediation Script

Run the automated fix script:

```bash
# For peer drop issues
export ISSUE_TYPE=peer_drop
export NODE_NAME=xdc04-apo-nm
export NODE_IP=194.163.156.211
export CLIENT_TYPE=nethermind
./scripts/fix-auto-detected-issues.sh

# For sync stall issues
export ISSUE_TYPE=sync_stall
export NODE_NAME=xdc04-apo-erigon
export NODE_IP=194.163.156.211
export CLIENT_TYPE=erigon
export BLOCK_HEIGHT=15592510
./scripts/fix-auto-detected-issues.sh
```

### Prevention

1. **Monitoring**: Enable SkyNet monitoring for early detection
2. **Alerts**: Configure alerts for peer count < 5
3. **Automation**: Use the remediation script in cron jobs
4. **Backups**: Maintain regular chaindata backups
