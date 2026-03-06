// SkyNet API Monitor PM2 Configuration
// Usage: pm2 start skynet-monitor.config.js

module.exports = {
  apps: [{
    name: 'skynet-monitor',
    script: '/root/.openclaw/workspace/XDCNetOwn/scripts/skynet-monitor.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '100M',
    env: {
      NODE_ENV: 'production',
      SKYNET_API_URL: 'http://localhost:3005/api/v1/nodes?limit=1',
      SKYNET_PM2_APP: 'xdcnetown',
      SKYNET_MONITOR_LOG: '/var/log/skynet-monitor.log'
    },
    log_file: '/var/log/skynet-monitor-pm2.log',
    out_file: '/var/log/skynet-monitor-out.log',
    error_file: '/var/log/skynet-monitor-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};