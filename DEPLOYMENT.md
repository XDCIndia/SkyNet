# XDC SkyNet - Complete Deployment Guide

This document provides comprehensive instructions for recreating the entire XDC SkyNet infrastructure from scratch.

**Server:** 95.217.56.168  
**Domain:** xdc.openscan.ai  
**Last Updated:** 2026-02-13

---

## Table of Contents

1. [Server Requirements](#server-requirements)
2. [Software Prerequisites](#software-prerequisites)
3. [Docker Container Setup](#docker-container-setup)
4. [Database Setup](#database-setup)
5. [SkyNet Dashboard Deployment](#skynet-dashboard-deployment)
6. [Nginx Configuration](#nginx-configuration)
7. [SSL Certificates](#ssl-certificates)
8. [PM2 Setup](#pm2-setup)
9. [Monitoring Stack](#monitoring-stack)
10. [Agent Setup](#agent-setup)
11. [Environment Variables](#environment-variables)
12. [Troubleshooting](#troubleshooting)

---

## Server Requirements

### Hardware Specifications (Current)

| Component | Specification |
|-----------|---------------|
| CPU | 16+ cores (AMD EPYC or Intel Xeon recommended) |
| RAM | 64GB+ (128GB recommended for full archive node) |
| Disk | 2TB+ NVMe SSD (XDC mainnet requires ~1TB for full sync) |
| Network | 1Gbps dedicated bandwidth |
| OS | Ubuntu 22.04 LTS Server |

### Resource Usage (Current State)

| Service | CPU | RAM | Disk |
|---------|-----|-----|------|
| xdcnetwork-mainnet-node | ~220% | 12.3GB | 1.5TB+ |
| xdc-full-sync | ~10% | 98MB | 500GB+ |
| xdc-fast-sync | ~0.5% | 51MB | 300GB+ |
| PostgreSQL (gateway) | ~0.01% | 38MB | 1GB+ |
| Grafana | ~0.15% | 283MB | 1GB+ |
| Prometheus | ~0% | 113MB | 5GB+ |

---

## Software Prerequisites

### 1. System Update & Essential Packages

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y \
    curl wget git vim htop tmux \
    build-essential software-properties-common \
    apt-transport-https ca-certificates gnupg \
    lsb-release jq net-tools nginx \
    certbot python3-certbot-nginx \
    postgresql-client redis-tools
```

### 2. Docker & Docker Compose

```bash
# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

### 3. Node.js & PM2

```bash
# Install Node.js 22.x
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # v22.x.x
npm --version   # 10.x.x

# Install PM2 globally
sudo npm install -g pm2

# Setup PM2 startup script
pm2 startup systemd
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME
```

### 4. Git Configuration

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Generate SSH key for GitHub
ssh-keygen -t ed25519 -C "your.email@example.com"
cat ~/.ssh/id_ed25519.pub
# Add this key to GitHub: https://github.com/settings/keys
```

---

## Docker Container Setup

### 1. XDC Mainnet Node

This is the primary XDC network node running the full XDPoS chain client.

```bash
mkdir -p /root/xdc-mainnet-data
docker run -d \
    --name xdcnetwork-mainnet-node \
    --restart unless-stopped \
    -v /root/xdc-mainnet-data:/work/xdcchain \
    -p 30303:30303 \
    -p 8989:8545 \
    -p 8888:8546 \
    xinfinorg/xdposchain:v2.6.8 \
    XDC --syncmode full \
    --networkid 50 \
    --datadir /work/xdcchain \
    --port 30303 \
    --rpc --rpcaddr 0.0.0.0 --rpcport 8545 \
    --rpcapi eth,net,web3,txpool,admin,debug \
    --rpccorsdomain "*" \
    --ws --wsaddr 0.0.0.0 --wsport 8546 \
    --verbosity 3 \
    --maxpeers 50 \
    --nat extip:YOUR_SERVER_IP \
    --bootnodes "enode://e1a69a7d766576e694adc3fc78d801a8a66926cbe8f4fe95b85f3b481444700a5d1b6d440b2715b5bb7cf4824df6a6702740afc8c52b20c72bc8c16f1ccde1f3@149.102.140.32:30303,enode://874589626a2b4fd7c57202533315885815eba51dbc434db88bbbebcec9b22cf2a01eafad2fd61651306fe85321669a30b3f41112eca230137ded24b86e064ba8@5.189.144.192:30303"
```

**Status:** KEEP - This is the main production node actively syncing.

### 2. PostgreSQL for XDC Gateway

```bash
cd /root/.openclaw/workspace/xdc-gateway/infra/docker

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
services:
  postgres:
    image: postgres:15-alpine
    container_name: xdc-gateway-postgres
    environment:
      POSTGRES_USER: gateway
      POSTGRES_PASSWORD: gateway_secret_2026
      POSTGRES_DB: xdc_gateway
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5443:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U gateway -d xdc_gateway"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - xdc-gateway-network
    restart: unless-stopped

  clickhouse:
    image: clickhouse/clickhouse-server:24.1
    container_name: xdc-gateway-clickhouse
    environment:
      CLICKHOUSE_USER: default
      CLICKHOUSE_PASSWORD: clickhouse_secret_2026
      CLICKHOUSE_DEFAULT_ACCESS_MANAGEMENT: 1
    volumes:
      - clickhouse_data:/var/lib/clickhouse
    ports:
      - "8124:8123"
      - "9001:9000"
    healthcheck:
      test: ["CMD", "clickhouse-client", "--query", "SELECT 1"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - xdc-gateway-network
    restart: unless-stopped

networks:
  xdc-gateway-network:
    driver: bridge

volumes:
  postgres_data:
  clickhouse_data:
EOF

docker compose up -d
```

### 3. XDC Canton Privacy Services

```bash
cd /root/xdc-canton-privacy

# docker-compose.yml is already present
docker compose up -d
```

**Services:**
- **postgres** (xdc-privacy-postgres): Port 5434
- **backend** (xdc-privacy-backend): Port 4000
- **frontend** (xdc-privacy-frontend): Port 3001

### 4. XDC Burn Tracker

```bash
cd /root/xdc-burn-tracker

# Build and run
docker build -t xdc-burn-tracker .
docker run -d \
    --name xdc-burn-tracker \
    -p 3002:3000 \
    --restart unless-stopped \
    xdc-burn-tracker
```

### 5. Monitoring Stack (Prometheus + Grafana)

```bash
cd /root/xdc-monitoring

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
services:
  prometheus:
    image: prom/prometheus:latest
    container_name: xdc-prometheus
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.enable-lifecycle'
    ports:
      - '9090:9090'
    restart: unless-stopped
    networks:
      - xdc-monitoring

  xdc-exporter:
    build: ./xdc-exporter
    container_name: xdc-exporter
    environment:
      - XDC_RPC_URL=http://host.docker.internal:8989
      - PORT=9100
    ports:
      - '9100:9100'
    extra_hosts:
      - 'host.docker.internal:host-gateway'
    restart: unless-stopped
    networks:
      - xdc-monitoring

  grafana:
    image: grafana/grafana:latest
    container_name: xdc-grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=xdc-admin-2024
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_SERVER_HTTP_PORT=3000
      - GF_INSTALL_PLUGINS=grafana-worldmap-panel,grafana-piechart-panel
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/var/lib/grafana/dashboards
      - grafana_data:/var/lib/grafana
    ports:
      - '3300:3000'
    depends_on:
      - prometheus
    restart: unless-stopped
    networks:
      - xdc-monitoring

volumes:
  prometheus_data:
  grafana_data:

networks:
  xdc-monitoring:
    driver: bridge
EOF

# Create prometheus config
mkdir -p prometheus
cat > prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'xdc-exporter'
    static_configs:
      - targets: ['xdc-exporter:9100']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
EOF

docker compose up -d
```

---

## Database Setup

### 1. PostgreSQL Schema Setup for SkyNet

After the gateway PostgreSQL container is running, apply the SkyNet schema:

```bash
# Copy schema file to container
docker cp /root/.openclaw/workspace/XDCNetOwn/dashboard/lib/db/schema-skynet.sql xdc-gateway-postgres:/tmp/

# Execute schema
PGPASSWORD=gateway_secret_2026 psql -h localhost -p 5443 -U gateway -d xdc_gateway -f /tmp/schema-skynet.sql
```

Or from the host:

```bash
PGPASSWORD=gateway_secret_2026 psql -h localhost -p 5443 -U gateway -d xdc_gateway -f /root/.openclaw/workspace/XDCNetOwn/dashboard/lib/db/schema-skynet.sql
```

### 2. Schema Verification

```bash
# Check if tables were created
PGPASSWORD=gateway_secret_2026 psql -h localhost -p 5443 -U gateway -d xdc_gateway -c "\dt skynet.*"

# Expected output:
#                     List of relations
#  Schema |        Name        | Type  |  Owner
# --------+--------------------+-------+----------
#  skynet | nodes              | table | gateway
#  skynet | node_metrics       | table | gateway
#  skynet | peer_snapshots     | table | gateway
#  skynet | incidents          | table | gateway
#  skynet | network_health     | table | gateway
#  ...
```

### 3. Database Migration Tracking

The schema includes a migrations table:

```bash
PGPASSWORD=gateway_secret_2026 psql -h localhost -p 5443 -U gateway -d xdc_gateway -c "SELECT * FROM skynet.migrations;"
```

---

## SkyNet Dashboard Deployment

### 1. Clone Repository

```bash
cd /root/.openclaw/workspace
git clone git@github.com:AnilChinchawale/XDCNetOwn.git
cd XDCNetOwn/dashboard
```

### 2. Environment Configuration

Create `.env` file:

```bash
cat > .env << 'EOF'
# Database
DATABASE_URL=postgresql://gateway:gateway_secret_2026@localhost:5443/xdc_gateway

# XDC Node RPC
RPC_URL=http://127.0.0.1:8989

# Prometheus
PROMETHEUS_URL=http://localhost:9090

# WebSocket Server
WS_PORT=3006
NEXT_PUBLIC_WS_URL=ws://localhost:3006

# Dashboard Port
PORT=3005

# App Settings
NEXT_PUBLIC_REFRESH_INTERVAL=10
NODE_NAME=xdc-prod-main

# API Keys (comma-separated)
API_KEYS=xdc-netown-key-2026-prod,xdc-netown-key-2026-test

# Telegram Alerts (optional)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Email Alerts (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=XDC NetOwn <alerts@xdc.network>
ALERT_EMAIL=admin@example.com
EOF
```

### 3. Install Dependencies

```bash
npm install
```

### 4. PM2 Configuration

Start with PM2:

```bash
pm2 start "npx next dev -p 3005" --name xdcnetown

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup
```

Or create an ecosystem file:

```bash
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'xdcnetown',
    script: 'npx',
    args: 'next dev -p 3005',
    cwd: '/root/.openclaw/workspace/XDCNetOwn/dashboard',
    env: {
      NODE_ENV: 'development',
      PORT: 3005
    },
    log_file: '/root/.pm2/logs/xdcnetown-out.log',
    error_file: '/root/.pm2/logs/xdcnetown-error.log',
    autorestart: true,
    watch: false
  }]
};
EOF

pm2 start ecosystem.config.js
```

### 5. Verify Dashboard

```bash
# Check if running
curl http://localhost:3005/api/v1/fleet/status

# Expected output:
# {"success":true,"data":{"healthScore":0,"totalNodes":1,...}}
```

---

## Nginx Configuration

### 1. Create Site Configuration

```bash
sudo nano /etc/nginx/sites-available/xdc.openscan.ai
```

Add configuration:

```nginx
server {
    server_name xdc.openscan.ai;

    location / {
        proxy_pass http://127.0.0.1:3005;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # WebSocket support
        proxy_read_timeout 86400;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}

# HTTP to HTTPS redirect (add after SSL setup)
server {
    listen 80;
    server_name xdc.openscan.ai;
    return 301 https://$host$request_uri;
}
```

### 2. Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/xdc.openscan.ai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 3. Other Nginx Sites (Summary)

| Domain | Port | Service |
|--------|------|---------|
| xdc.openscan.ai | 3005 | SkyNet Dashboard |
| grafana.xdc.network | 3300 | Grafana |
| burn.xdc.network | 3002 | Burn Tracker |
| canton.xdc.network | 3001 | Privacy Frontend |
| api.privacy.xdc.network | 4000 | Privacy Backend |
| xshorts.news | 3336 | XDC News |

---

## SSL Certificates

### 1. Obtain Certificates with Certbot

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d xdc.openscan.ai

# Follow interactive prompts
```

### 2. Auto-Renewal

Certbot automatically sets up a cron job for renewal. Verify:

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

### 3. Certificate Locations

```
/etc/letsencrypt/live/xdc.openscan.ai/fullchain.pem
/etc/letsencrypt/live/xdc.openscan.ai/privkey.pem
```

---

## PM2 Setup

### 1. Current PM2 Processes

| Name | Port | Directory | Command |
|------|------|-----------|---------|
| xdcnetown | 3005 | XDCNetOwn/dashboard | `npx next dev -p 3005` |
| xdcnews | 3336 | XDC-News | `npx next start -p 3336` |

### 2. PM2 Commands

```bash
# List processes
pm2 list

# View logs
pm2 logs xdcnetown --lines 100

# Restart
pm2 restart xdcnetown

# Stop
pm2 stop xdcnetown

# Delete
pm2 delete xdcnetown

# Save configuration
pm2 save

# Setup startup
pm2 startup systemd
```

### 3. Log Locations

```
/root/.pm2/logs/xdcnetown-out.log
/root/.pm2/logs/xdcnetown-error.log
```

---

## Monitoring Stack

### 1. Prometheus

- **URL:** http://95.217.56.168:9090
- **Config:** `/root/xdc-monitoring/prometheus/prometheus.yml`
- **Data:** Docker volume `prometheus_data`

### 2. Grafana

- **URL:** https://grafana.xdc.network (port 3300)
- **Admin Password:** `xdc-admin-2024`
- **Data:** Docker volume `grafana_data`

### 3. XDC Exporter

- **Port:** 9100
- **Metrics:** Custom XDC metrics from RPC
- **Build:** `/root/xdc-monitoring/xdc-exporter/Dockerfile`

### 4. Available Metrics

- Block height
- Peer count
- Sync status
- Gas price
- Transaction pool size
- Network health score

---

## Agent Setup

### Node Heartbeat Agents

**NOTE:** The `netown-agent-*` containers have been removed due to connectivity issues (they couldn't reach localhost:5443 from inside Docker).

For node heartbeat monitoring, use:

1. **Direct API Integration:** Nodes call the SkyNet API directly
2. **Prometheus Metrics:** Node metrics scraped via exporter
3. **Custom Scripts:** Python/Node.js scripts running on host

### Registering a Node

```bash
# API endpoint for node registration
curl -X POST http://localhost:3005/api/v1/nodes/register \
  -H "Content-Type: application/json" \
  -H "X-API-Key: xdc-netown-key-2026-prod" \
  -d '{
    "name": "xdc-node-01",
    "host": "http://node1.example.com:8545",
    "role": "masternode",
    "location_city": "Singapore",
    "location_country": "SG"
  }'
```

---

## Environment Variables Reference

### SkyNet Dashboard

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `RPC_URL` | XDC node RPC endpoint | http://127.0.0.1:8989 |
| `PROMETHEUS_URL` | Prometheus URL | http://localhost:9090 |
| `PORT` | Dashboard port | 3005 |
| `WS_PORT` | WebSocket server port | 3006 |
| `API_KEYS` | Comma-separated valid API keys | Required |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token | Optional |
| `TELEGRAM_CHAT_ID` | Telegram chat ID | Optional |

### XDC Node

| Variable | Description |
|----------|-------------|
| `syncmode` | full/fast/light |
| `networkid` | 50 (mainnet), 51 (apothem) |
| `maxpeers` | Maximum peer connections |
| `verbosity` | Log level (0-5) |

---

## Troubleshooting

### Dashboard Shows 404 / API Returns INTERNAL_ERROR

**Cause:** Missing database schema

**Fix:**
```bash
PGPASSWORD=gateway_secret_2026 psql -h localhost -p 5443 -U gateway -d xdc_gateway -f /root/.openclaw/workspace/XDCNetOwn/dashboard/lib/db/schema-skynet.sql
pm2 restart xdcnetown
```

### PostgreSQL Connection Issues

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check logs
docker logs xdc-gateway-postgres

# Test connection
PGPASSWORD=gateway_secret_2026 psql -h localhost -p 5443 -U gateway -d xdc_gateway -c "SELECT 1;"
```

### XDC Node Not Syncing

```bash
# Check node logs
docker logs xdcnetwork-mainnet-node --tail 100

# Check sync status
curl -X POST http://localhost:8989 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_syncing","params":[],"id":1}'
```

### Nginx Errors

```bash
# Test configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Check access logs
sudo tail -f /var/log/nginx/access.log
```

### PM2 Issues

```bash
# Clear logs
pm2 flush

# Reset restart counter
pm2 reset xdcnetown

# Update PM2
pm2 update

# Debug mode
pm2 start xdcnetown --no-daemon
```

### SSL Certificate Issues

```bash
# Renew manually
sudo certbot renew --force-renewal

# Check certificate status
sudo certbot certificates

# Debug SSL
openssl s_client -connect xdc.openscan.ai:443
```

### Port Conflicts

```bash
# Check port usage
sudo netstat -tlnp | grep 3005
sudo lsof -i :3005

# Kill process on port
sudo kill -9 $(sudo lsof -t -i:3005)
```

---

## Backup & Recovery

### Database Backup

```bash
# Daily backup cron (already configured)
0 3 * * * /usr/local/bin/xdc-gateway-backup --daily

# Manual backup
PGPASSWORD=gateway_secret_2026 pg_dump -h localhost -p 5443 -U gateway xdc_gateway > backup_$(date +%Y%m%d).sql
```

### XDC Node Data Backup

```bash
# Backup chain data (stop node first)
docker stop xdcnetwork-mainnet-node
tar czf xdc-chain-backup.tar.gz /root/xdc-mainnet-data
docker start xdcnetwork-mainnet-node
```

---

## Security Considerations

1. **Firewall:** Only expose necessary ports (80, 443, 30303 for XDC P2P)
2. **API Keys:** Rotate regularly, use strong keys
3. **Database:** Use strong passwords, limit network access
4. **SSH:** Disable password auth, use keys only
5. **Updates:** Keep system and containers updated

---

## Support & Resources

- **GitHub:** https://github.com/AnilChinchawale/XDCNetOwn
- **XDC Documentation:** https://docs.xdc.org
- **XDPoS Chain:** https://github.com/XinFinOrg/XDPoSChain

---

*Document Version: 1.0*  
*Last Updated: 2026-02-13*  
*Maintainer: XDC SkyNet Team*
