# SkyOne Agent

The SkyOne agent (`agent.sh`) runs on each XDC node and reports heartbeat data to the SkyNet dashboard.

## What it does

- Collects node metrics (block height, peer count, sync status, CPU/memory/disk)
- Queries the XDC node's JSON-RPC endpoint
- Sends periodic heartbeat POSTs to the SkyNet API (`/api/v1/nodes/heartbeat`)
- Reports consensus info, tx pool stats, client version, and OS details

## Installation

```bash
# Copy to your XDC node
cp agent.sh /path/to/your/node/

# Make executable
chmod +x agent.sh

# Configure environment
export SKYNET_API="https://your-skynet-dashboard.com"
export NODE_ID="your-unique-node-id"
export RPC_PORT=8545  # or your node's RPC port

# Run (typically via cron or systemd)
./agent.sh
```

## Ports by Client

| Client       | RPC Port |
|-------------|----------|
| Geth XDC    | 7070     |
| Erigon XDC  | 7071     |
| Nethermind  | 7072     |
| Reth XDC    | 8588     |

## Source

Originally from [XDC-Node-Setup](https://github.com/XDCIndia/XDC-Node-Setup/blob/main/docker/skynet-agent.sh).
Canonical copy now lives in this repo under `agents/skyone/agent.sh`.

## Related Issues

- [#25](https://github.com/XDCIndia/SkyNet/issues/25) — SkyOne agent source missing from repo
- [#27](https://github.com/XDCIndia/SkyNet/issues/27) — Agent code availability
