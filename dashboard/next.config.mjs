/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'standalone', // disabled - causes prerender copy issues
  poweredByHeader: false,
  env: {
    PROMETHEUS_URL: process.env.PROMETHEUS_URL || 'http://127.0.0.1:19090',
    RPC_URL: process.env.RPC_URL || 'http://127.0.0.1:38545',
  },
  // CORS Configuration - Issue #337 fix
  async headers() {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'https://net.xdc.network',
      'https://dashboard.xdc.network',
      'http://localhost:3000',
    ];
    
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: allowedOrigins.join(', '),
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          {
            key: 'Access-Control-Max-Age',
            value: '86400',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
