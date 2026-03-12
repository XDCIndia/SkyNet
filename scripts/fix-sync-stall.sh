#!/bin/bash
# Fix for Issues #697, #698: Sync stalled
# Nodes: xdc04-apo-nm, xdc04-apo-erigon

echo "=== Sync Stall Fix ==="
echo "Node: ${NODE_NAME:-unknown}"
echo "Client: ${CLIENT_TYPE:-unknown}"

# Client-specific fixes
case "${CLIENT_TYPE}" in
    "nethermind")
        rm -rf /xdcdata/xdc/chaindata/bad-blocks 2>/dev/null || true
        ;;
    "erigon")
        docker-compose down
        sleep 10
        docker-compose up -d
        ;;
    *)
        docker-compose restart xdc 2>/dev/null || true
        ;;
esac

echo "Fix applied. Check sync status in 5 minutes."
