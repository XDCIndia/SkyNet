# XDC Node Infrastructure - Troubleshooting Guide

## Table of Contents
1. [Installation Issues](#installation-issues)
2. [Sync Problems](#sync-problems)
3. [Network Connectivity](#network-connectivity)
4. [Performance Issues](#performance-issues)
5. [Security Issues](#security-issues)
6. [SkyNet Integration](#skynet-integration)

---

## Installation Issues

### Docker Not Found
```bash
# Error: docker: command not found
# Solution: Install Docker
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
```

### Permission Denied
```bash
# Error: permission denied while trying to connect to Docker daemon
# Solution: Add user to docker group
sudo usermod -aG docker $USER
# Log out and log back in
```

### Port Already in Use
```bash
# Error: bind: address already in use
# Solution: Find and kill process using port
sudo lsof -i :8545
sudo kill -9 <PID>
# Or use setup.sh which auto-detects free ports
```

---

## Sync Problems

### Sync Stalled
```bash
# Check sync status
curl -s http://localhost:8545 -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_syncing","params":[],"id":1}'

# Check peer count
curl -s http://localhost:8545 -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}'

# If peers = 0, add bootnodes manually
curl -s http://localhost:8545 -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "method":"admin_addPeer",
    "params":["enode://..."],
    "id":1
  }'
```

### Slow Sync
```bash
# Check hardware resources
htop
iostat -x 1

# Check disk I/O
iotop -o

# If disk is bottleneck, consider:
# 1. Upgrading to SSD/NVMe
# 2. Using snap sync mode
# 3. Restoring from snapshot
```

### Bad Block Error
```bash
# Check logs for bad block
docker logs xdc-node | grep -i "bad block"

# Solution: Remove chain data and re-sync
# WARNING: This will delete all chain data!
docker-compose down
rm -rf ./mainnet/xdcchain/XDC/chaindata
rm -rf ./mainnet/xdcchain/XDC/nodes
docker-compose up -d
```

---

## Network Connectivity

### No Peers
```bash
# Check network configuration
docker exec xdc-node netstat -tlnp

# Check firewall rules
sudo ufw status

# Add peers manually
for enode in $(cat docker/mainnet/bootnodes.list); do
  curl -s http://localhost:8545 -X POST \
    -H "Content-Type: application/json" \
    -d "{\"jsonrpc\":\"2.0\",\"method\":\"admin_addPeer\",\"params\":[\"$enode\"],\"id\":1}"
done
```

### Port Not Accessible
```bash
# Check if port is listening
sudo ss -tlnp | grep 30303

# Check firewall
sudo iptables -L -n | grep 30303

# Open port if needed
sudo ufw allow 30303/tcp
sudo ufw allow 30303/udp
```

### NAT/Firewall Issues
```bash
# Check NAT configuration
docker exec xdc-node curl -s https://api.ipify.org

# If behind NAT, ensure port forwarding is configured
# Check UPnP status
docker exec xdc-node XDC --nat extip:$(curl -s https://api.ipify.org)
```

---

## Performance Issues

### High CPU Usage
```bash
# Check CPU usage by process
top -p $(pgrep -d',' XDC)

# If high CPU during sync, this is normal
# If high CPU after sync:
# 1. Check for stuck transactions
# 2. Reduce peer count
# 3. Enable pruning if not already enabled
```

### High Memory Usage
```bash
# Check memory usage
free -h
docker stats xdc-node

# If OOM kills:
# 1. Increase Docker memory limit
# 2. Reduce cache size in config
# 3. Add swap space
```

### Disk Space Issues
```bash
# Check disk usage
df -h
du -sh ./mainnet/xdcchain/*

# Clean up old logs
find ./mainnet/xdcchain/logs -name "*.log" -mtime +7 -delete

# Enable log rotation
xdc logs --rotate
```

---

## Security Issues

### RPC Exposed to Internet
```bash
# Check RPC binding
sudo ss -tlnp | grep 8545

# If 0.0.0.0:8545, secure it:
# 1. Edit docker-compose.yml
# 2. Change to 127.0.0.1:8545:8545
# 3. Restart container
docker-compose down
docker-compose up -d
```

### Unauthorized Access
```bash
# Check access logs
docker logs xdc-node | grep -i "unauthorized"

# If unauthorized access detected:
# 1. Change RPC port
# 2. Enable firewall rules
# 3. Use nginx reverse proxy with auth
```

### Container Escape
```bash
# Check container privileges
docker inspect xdc-node | grep -i privileged

# If privileged: true, remove it:
# Edit docker-compose.yml
# Remove privileged: true
# Add specific capabilities if needed
```

---

## SkyNet Integration

### Heartbeat Not Received
```bash
# Check SkyNet agent logs
docker logs xdc-monitoring

# Check configuration
cat mainnet/.xdc-node/skynet.conf

# Verify API key is set
# Re-register if needed
xdc node --register-skynet
```

### Node Not Showing in Dashboard
```bash
# Check node registration
curl -s https://xdc.openscan.ai/api/v1/nodes/$(cat mainnet/.xdc-node/skynet.conf | grep SKYNET_NODE_ID | cut -d= -f2)

# If not found, re-register
xdc node --register-skynet --email your@email.com
```

### Alerts Not Working
```bash
# Check alert configuration
cat mainnet/.xdc-node/skynet.conf | grep -E "(EMAIL|TELEGRAM)"

# Test alert delivery
curl -X POST https://xdc.openscan.ai/api/v1/alerts/test \
  -H "Authorization: Bearer $(cat mainnet/.xdc-node/skynet.conf | grep API_KEY | cut -d= -f2)"
```

---

## Common Error Messages

### "Fatal: Error starting protocol stack"
```bash
# Cause: Database corruption or lock file
# Solution:
docker-compose down
rm -f ./mainnet/xdcchain/XDC/LOCK
rm -rf ./mainnet/xdcchain/XDC/nodekey
docker-compose up -d
```

### "Failed to write to database"
```bash
# Cause: Disk full or permission issues
# Solution:
df -h  # Check disk space
ls -la ./mainnet/xdcchain/  # Check permissions
sudo chown -R $(whoami):$(whoami) ./mainnet/xdcchain/
```

### "Genesis block mismatch"
```bash
# Cause: Wrong network configuration
# Solution:
docker-compose down
rm -rf ./mainnet/xdcchain/XDC/chaindata
# Verify genesis.json is correct
docker-compose up -d
```

---

## Diagnostic Commands

### Node Health Check
```bash
#!/bin/bash
# health-check.sh

RPC_URL="http://localhost:8545"

# Check if node is responding
if ! curl -s $RPC_URL -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' > /dev/null; then
  echo "ERROR: Node not responding"
  exit 1
fi

# Check sync status
SYNCING=$(curl -s $RPC_URL -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_syncing","params":[],"id":1}' | jq -r '.result')

if [ "$SYNCING" != "false" ]; then
  echo "WARNING: Node is still syncing"
fi

# Check peer count
PEERS=$(curl -s $RPC_URL -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' | jq -r '.result')
PEERS_DEC=$((16#$PEERS))

if [ $PEERS_DEC -lt 5 ]; then
  echo "WARNING: Low peer count: $PEERS_DEC"
fi

echo "Node health check complete"
```

### Performance Monitor
```bash
#!/bin/bash
# monitor.sh

while true; do
  # Get current block
  CURRENT=$(curl -s http://localhost:8545 -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' | jq -r '.result')
  CURRENT_DEC=$((16#$CURRENT))
  
  # Get peer count
  PEERS=$(curl -s http://localhost:8545 -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' | jq -r '.result')
  PEERS_DEC=$((16#$PEERS))
  
  echo "$(date): Block=$CURRENT_DEC, Peers=$PEERS_DEC"
  
  sleep 30
done
```

---

## Getting Help

### Logs Collection
```bash
# Collect all relevant logs
mkdir -p xdc-debug-logs
docker logs xdc-node > xdc-debug-logs/xdc-node.log 2>&1
docker logs xdc-monitoring > xdc-debug-logs/skynet-agent.log 2>&1
cp mainnet/.xdc-node/*.conf xdc-debug-logs/
cp docker/docker-compose.yml xdc-debug-logs/
tar czf xdc-debug-logs-$(date +%Y%m%d).tar.gz xdc-debug-logs/
```

### Community Resources
- **GitHub Issues:** https://github.com/AnilChinchawale/xdc-node-setup/issues
- **SkyNet Dashboard:** https://xdc.openscan.ai
- **XDC Documentation:** https://docs.xdc.network

---

*Troubleshooting Guide - XDC EVM Expert Agent*
