module.exports = {
  apps: [{
    name: 'xdcnetown',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3005',
    cwd: '/root/.openclaw/workspace/XDCNetOwn/dashboard',
    env: {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://gateway:gateway@localhost:5433/xdc_gateway',
      API_KEYS: 'skynet-master-key-2026',
      PORT: 3005
    }
  }]
}
