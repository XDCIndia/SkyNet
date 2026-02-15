# XDCNet Node Agent v2

Cross-platform heartbeat agent written in Go. Collects system metrics and reports them to the XDCNet dashboard.

## Prerequisites

- Go 1.21+

## Build

```bash
# Native build
cd agent
go build -ldflags "-X main.Version=1.0.0" -o xdcnet-agent .

# Cross-compile examples
GOOS=linux   GOARCH=amd64 go build -ldflags "-X main.Version=1.0.0" -o xdcnet-agent-linux-amd64 .
GOOS=darwin  GOARCH=arm64 go build -ldflags "-X main.Version=1.0.0" -o xdcnet-agent-darwin-arm64 .
GOOS=windows GOARCH=amd64 go build -ldflags "-X main.Version=1.0.0" -o xdcnet-agent-windows-amd64.exe .
```

## Usage

```bash
# Required: specify node ID
./xdcnet-agent --node-id my-node-001

# Custom endpoint and interval
./xdcnet-agent --node-id my-node-001 \
  --endpoint https://dashboard.example.com/api/heartbeat \
  --interval 15s

# Or use environment variable
export XDCNET_NODE_ID=my-node-001
./xdcnet-agent
```

## Configuration

| Flag | Env Var | Default | Description |
|------|---------|---------|-------------|
| `--node-id` | `XDCNET_NODE_ID` | (required) | Unique node identifier |
| `--endpoint` | — | `http://localhost:3000/api/heartbeat` | Dashboard API URL |
| `--interval` | — | `30s` | Heartbeat interval |

## Roadmap

- [ ] Real CPU/memory/disk metrics via gopsutil
- [ ] XDC blockchain node health checks (block height, peer count)
- [ ] Prometheus `/metrics` endpoint
- [ ] Systemd service file
- [ ] Docker image
