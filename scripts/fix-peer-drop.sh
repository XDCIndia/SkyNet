#!/bin/bash
# Fix for Issue #699: Peer count dropped to 0
# Node: xdc04-apo-nm, IP: 194.163.156.211

echo "=== Peer Drop Fix for xdc04-apo-nm ==="

# Check and fix firewall
sudo ufw allow 30303/tcp 2>/dev/null || true
sudo ufw allow 30303/udp 2>/dev/null || true

# Restart node to reconnect to peers
docker-compose restart xdc 2>/dev/null || docker restart xdc-node 2>/dev/null || echo "Manual restart required"

echo "Fix applied. Monitor peer count over next 5 minutes."
