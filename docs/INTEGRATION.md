# XDCNetOwn Integration Guide

This guide explains how to integrate your XDC node with XDCNetOwn platform using the `xdc-node-setup` toolkit.

## Overview

XDCNetOwn is a **dashboard + API platform** for XDC Network owners. It provides:
- Real-time node monitoring and metrics
- Fleet management across multiple nodes
- Incident detection and alerting
- Remote command execution
- Network health analytics

The `xdc-node-setup` toolkit (separate repository) handles node deployment and local management. This guide shows how to connect your deployed nodes to XDCNetOwn.

## Prerequisites

- A deployed XDC node using `xdc-node-setup`
- An API key from your XDCNetOwn dashboard
- Network access between your node and the XDCNetOwn API

## Configuration

### 1. Get Your API Key

Log in to your XDCNetOwn dashboard and generate an API key:

1. Navigate to **Settings → API Keys**
2. Click **Generate New Key**
3. Copy the key (it starts with `xdc_`)

### 2. Register Your Node

Use the following curl command to register your node:

```bash
curl -X POST https://net.xdc.network/api/v1/nodes/register \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-xdc-node-01",
    "host": "https://rpc.my-node.example.com",
    "role": "masternode",
    "rpcUrl": "https://rpc.my-node.example.com",
    "location": {
      "city": "Singapore",
      "country": "SG",
      "lat": 1.3521,
      "lng": 103.8198
    },
    "tags": ["production", "apac"],
    "version": "v2.6.8"
  }'
```

**Response:**
```json
{
  "nodeId": "550e8400-e29b-41d4-a716-446655440000",
  "apiKey": "xdc_a1b2c3d4e5f6...",
  "message": "Node registered successfully"
}
```

Save the returned `apiKey` - this is used for all subsequent node communication.

### 3. Configure Node Environment

Edit your node's configuration file at `/etc/xdc-node/notify.conf`:

```bash
# XDCNetOwn Platform API Configuration
NOTIFY_PLATFORM_URL=https://net.xdc.network/api/v1/notifications
NOTIFY_PLATFORM_API_KEY=xdc_a1b2c3d4e5f6...
```

### 4. Configure Heartbeat

The `xdc-node-setup` scripts automatically send heartbeats. Enable metrics collection by configuring the health check:

```bash
# Edit /opt/xdc-node-setup/config/health.conf
HEARTBEAT_INTERVAL=30
HEARTBEAT_URL=https://net.xdc.network/api/v1/nodes/heartbeat
METRICS_ENABLED=true
```

### 5. Enable Metrics Push

Add a cron job to push metrics every minute:

```bash
# Add to crontab (crontab -e)
*/1 * * * * /opt/xdc-node-setup/scripts/push-metrics.sh
```

Or use the systemd timer if available:

```bash
sudo systemctl enable xdc-metrics.timer
sudo systemctl start xdc-metrics.timer
```

## API Endpoints Reference

### Node Registration
- **POST** `/api/v1/nodes/register` - Register a new node
- **POST** `/api/v1/nodes/heartbeat` - Send node heartbeat + metrics
- **POST** `/api/v1/nodes/metrics` - Push batch metrics

### Fleet Management
- **GET** `/api/v1/fleet/status` - Get fleet overview
- **GET** `/api/v1/nodes/{id}/status` - Get specific node status
- **POST** `/api/v1/nodes/{id}/commands` - Queue remote commands
- **GET** `/api/v1/nodes/{id}/commands` - Check pending commands

### Alerts & Monitoring
- **POST** `/api/v1/notifications` - Send alert/notification
- **GET** `/api/v1/upgrades/check` - Check for available upgrades

## Troubleshooting

### Authentication Errors

If you see `401 Unauthorized`:
- Verify your API key is correct
- Check the `Authorization` header format: `Bearer xdc_...`
- Ensure the API key hasn't been revoked

### Node Not Appearing in Dashboard

- Verify heartbeat is being sent: check `/var/log/xdc-node/heartbeat.log`
- Confirm the nodeId matches between registration and heartbeat
- Check network connectivity to the XDCNetOwn API

### Metrics Not Showing

- Verify the metrics cron job is running: `crontab -l`
- Check metrics endpoint is configured correctly
- Review metrics log: `/var/log/xdc-node/metrics.log`

## Security Considerations

1. **Keep API keys secret** - Store them in environment variables or secure files
2. **Use HTTPS only** - Never send API keys over HTTP
3. **Rotate keys periodically** - Generate new keys and update configuration
4. **Restrict key permissions** - Use node-specific keys when possible
5. **Monitor key usage** - Check the dashboard for unusual activity

## Support

For issues with `xdc-node-setup`:
- GitHub: https://github.com/AnilChinchawale/xdc-node-setup
- Documentation: See README in the repository

For issues with XDCNetOwn platform:
- Dashboard: https://net.xdc.network
- API Documentation: https://net.xdc.network/docs/api

## Example Scripts

### Quick Health Check

```bash
#!/bin/bash
API_KEY="xdc_your_key_here"
NODE_ID="your-node-id"

curl -s -H "Authorization: Bearer $API_KEY" \
  "https://net.xdc.network/api/v1/nodes/$NODE_ID/status" | jq
```

### Fleet Overview

```bash
#!/bin/bash
API_KEY="xdc_your_key_here"

curl -s -H "Authorization: Bearer $API_KEY" \
  "https://net.xdc.network/api/v1/fleet/status" | jq '.fleet'
```

### Queue Restart Command

```bash
#!/bin/bash
API_KEY="xdc_your_key_here"
NODE_ID="your-node-id"

curl -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"command":"restart"}' \
  "https://net.xdc.network/api/v1/nodes/$NODE_ID/commands"
```
