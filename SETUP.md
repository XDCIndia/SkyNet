# XDC SkyNet - Setup Guide
> Fleet monitoring dashboard for XDC Network

## Table of Contents

1. [Quick Start](#quick-start)
2. [System Requirements](#system-requirements)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Connecting Nodes](#connecting-nodes)
6. [Verification](#verification)

---

## Quick Start

```bash
# Clone repository
git clone https://github.com/AnilChinchawale/XDCNetOwn.git
cd XDCNetOwn/dashboard

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your settings

# Run database migrations
npm run db:init

# Start development server
npm run dev
```

Access the dashboard at `http://localhost:3000`

---

## System Requirements

### Minimum Requirements

| Component | Specification |
|-----------|--------------|
| **OS** | Linux (Ubuntu 20.04+) |
| **Node.js** | 18+ |
| **PostgreSQL** | 14+ |
| **RAM** | 2 GB |
| **Storage** | 20 GB |

### Recommended Requirements

| Component | Specification |
|-----------|--------------|
| **OS** | Linux (Ubuntu 22.04 LTS) |
| **Node.js** | 20 LTS |
| **PostgreSQL** | 15+ |
| **Redis** | 7+ (optional) |
| **RAM** | 4 GB |
| **Storage** | 50 GB SSD |

---

## Installation

### Method 1: Docker Compose (Recommended)

```bash
# Clone repository
git clone https://github.com/AnilChinchawale/XDCNetOwn.git
cd XDCNetOwn

# Configure environment
cp dashboard/.env.example dashboard/.env
nano dashboard/.env

# Start services
docker-compose up -d

# Run migrations
docker-compose exec dashboard npm run db:migrate
```

### Method 2: Manual Installation

#### 1. Install Node.js

```bash
# Using NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify
node --version  # v20.x.x
npm --version   # 10.x.x
```

#### 2. Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Start service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database
sudo -u postgres createdb skynet
sudo -u postgres psql -c "CREATE USER skynet WITH PASSWORD 'your-password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE skynet TO skynet;"
```

#### 3. Install Dependencies

```bash
cd XDCNetOwn/dashboard
npm install
```

#### 4. Configure Environment

```bash
cp .env.example .env.local
nano .env.local
```

Required variables:

```bash
DATABASE_URL=postgresql://skynet:your-password@localhost:5432/skynet
API_KEYS=your-master-api-key
NEXT_PUBLIC_API_URL=http://localhost:3000
```

#### 5. Run Migrations

```bash
npm run db:migrate
```

#### 6. Start Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

---

## Configuration

### Environment Variables

#### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `API_KEYS` | Comma-separated master API keys | `key1,key2` |

#### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | - | Public API base URL |
| `WEBSOCKET_URL` | - | WebSocket server URL |
| `REDIS_URL` | - | Redis URL for rate limiting |
| `LOG_LEVEL` | info | Logging level |
| `CORS_ALLOWED_ORIGINS` | * | Allowed CORS origins |
| `TELEGRAM_BOT_TOKEN` | - | Telegram bot token |
| `GITHUB_TOKEN` | - | GitHub token for issue creation |

### Database Configuration

#### Connection Pool Settings

Add to `.env.local`:

```bash
DB_POOL_SIZE=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=5000
```

#### SSL Configuration

For production PostgreSQL with SSL:

```bash
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
```

### Security Configuration

#### Enable Authentication

```bash
# Require authentication for all endpoints
ENABLE_AUTH=true

# Master API keys (comma-separated)
API_KEYS=your-secure-key-1,your-secure-key-2
```

#### Rate Limiting

```bash
# Enable Redis for distributed rate limiting
REDIS_URL=redis://localhost:6379

# Rate limits (requests per minute)
RATE_LIMIT_PUBLIC=60
RATE_LIMIT_AUTHENTICATED=120
RATE_LIMIT_HEARTBEAT=120
```

---

## Connecting Nodes

### Automatic Registration (SkyOne)

If using [XDC Node Setup](https://github.com/AnilChinchawale/XDC-Node-Setup), nodes auto-register:

```bash
# During node setup
ENABLE_SKYNET=true
SKYNET_API_KEY=your-api-key
SKYNET_NODE_NAME=my-node
```

### Manual Registration

```bash
curl -X POST http://localhost:3000/api/v1/nodes/register \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-xdc-node",
    "host": "https://rpc.my-node.example.com",
    "role": "masternode",
    "rpcUrl": "https://rpc.my-node.example.com"
  }'
```

### Heartbeat Configuration

Nodes should send heartbeats every 30-60 seconds:

```bash
curl -X POST http://localhost:3000/api/v1/nodes/heartbeat \
  -H "Authorization: Bearer NODE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "nodeId": "550e8400-e29b-41d4-a716-446655440000",
    "blockHeight": 89234567,
    "syncing": false,
    "syncProgress": 99.8,
    "peerCount": 25,
    "system": {
      "cpuPercent": 45.2,
      "memoryPercent": 62.1,
      "diskPercent": 78.0
    },
    "clientType": "geth",
    "clientVersion": "v2.6.8-stable"
  }'
```

---

## Verification

### Check Database Connection

```bash
# Using psql
psql $DATABASE_URL -c "SELECT COUNT(*) FROM skynet.nodes;"

# Or using dashboard
npm run db:status
```

### Test API

```bash
# Health check
curl http://localhost:3000/api/health

# List nodes
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/api/v1/fleet/status
```

### Check Logs

```bash
# Docker logs
docker-compose logs -f dashboard

# Or pm2 (if using)
pm2 logs
```

---

## Production Deployment

### Using Docker Compose

```bash
# Production configuration
cp docker-compose.yml docker-compose.prod.yml

# Edit for production
nano docker-compose.prod.yml

# Start
docker-compose -f docker-compose.prod.yml up -d
```

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'skynet',
    script: 'npm',
    args: 'start',
    cwd: './dashboard',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### SSL/TLS Configuration

Using Nginx as reverse proxy:

```nginx
server {
    listen 443 ssl http2;
    server_name net.xdc.network;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# Check PostgreSQL status
sudo systemctl status postgresql

# View logs
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### Node Registration Fails

```bash
# Check API key
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3000/api/v1/fleet/status

# Check logs
npm run logs
```

### High Memory Usage

```bash
# Check Node.js memory
ps aux | grep node

# Restart application
pm2 restart skynet
# or
docker-compose restart dashboard
```

---

## Next Steps

- [Architecture Documentation](docs/ARCHITECTURE.md) - System design
- [Integration Guide](docs/INTEGRATION.md) - Node integration
- [API Documentation](#api-reference) - API endpoints
- [Mobile App](docs/MOBILE-APP.md) - Mobile companion

---

## Support

- [GitHub Issues](https://github.com/AnilChinchawale/XDCNetOwn/issues)
- [XDC Community Discord](https://discord.gg/xdc)
