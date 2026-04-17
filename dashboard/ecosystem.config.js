module.exports = {
  apps: [
    {
      name: 'skynet-dashboard',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3005',
      cwd: '/root/.openclaw/workspace/SkyNet/dashboard',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://gateway:xdc_news_2025_secure@127.0.0.1:5433/xdc_gateway?schema=skynet',
        API_KEYS: 'skynet-api-key-2025-secure',
        ADMIN_SECRET: 'skynet-admin-secret-2025',
        ADMIN_API_KEY: 'skynet-admin-api-key-2025',
        DASHBOARD_API_KEY: 'skynet-dashboard-key-2025',
        JWT_SECRET: 'skynet-jwt-secret-2025-change-in-production',
        WS_PORT: 3006,
        PORT: 3005
      }
    },
    {
      name: 'skynet-ws',
      script: 'node_modules/.bin/tsx',
      args: 'ws-server.ts',
      cwd: '/root/.openclaw/workspace/SkyNet/dashboard',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://gateway:xdc_news_2025_secure@127.0.0.1:5433/xdc_gateway?schema=skynet',
        API_KEYS: 'skynet-api-key-2025-secure',
        JWT_SECRET: 'skynet-jwt-secret-2025-change-in-production',
        WS_PORT: 3006,
        WS_AUTH_REQUIRED: 'false'
      }
    }
  ]
}
