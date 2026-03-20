/**
 * XDC SkyNet - Application Configuration
 * Centralized configuration with environment validation
 */

import { z } from 'zod';

// =============================================================================
// Environment Schema
// =============================================================================

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().describe('PostgreSQL connection string'),
  
  // API Authentication
  API_KEYS: z.string().min(1).describe('Comma-separated list of master API keys'),
  
  // Optional configurations
  NEXT_PUBLIC_API_URL: z.string().url().optional(),
  WEBSOCKET_URL: z.string().url().optional(),
  
  // Redis (for rate limiting - optional)
  REDIS_URL: z.string().url().optional(),
  
  // Notifications
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  
  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  
  // Feature flags
  ENABLE_WEBSOCKET: z.coerce.boolean().optional().default(true),
  ENABLE_METRICS_COLLECTION: z.coerce.boolean().optional().default(true),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().optional().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().optional().default(120),
  
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// =============================================================================
// Configuration Type
// =============================================================================

export type EnvConfig = z.infer<typeof envSchema>;

// =============================================================================
// Configuration Loader
// =============================================================================

function loadConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    const missingVars = result.error.issues
      .filter((issue) => issue.code === 'invalid_type' && issue.received === 'undefined')
      .map((issue) => issue.path.join('.'));
    
    const invalidVars = result.error.issues
      .filter((issue) => issue.code !== 'invalid_type' || issue.received !== 'undefined')
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    
    console.error('❌ Configuration Error:');
    
    if (missingVars.length > 0) {
      console.error('Missing required environment variables:', missingVars.join(', '));
    }
    
    if (invalidVars.length > 0) {
      console.error('Invalid environment variables:', invalidVars.join('; '));
    }
    
    // In development, continue with defaults; in production, throw
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Invalid configuration');
    }
    
    console.warn('⚠️  Running with partial configuration in development mode');
    
    // Return partial config with defaults
    return {
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/skynet',
      API_KEYS: process.env.API_KEYS || 'dev_key_not_for_production',
      NODE_ENV: 'development',
      RATE_LIMIT_WINDOW_MS: 60000,
      RATE_LIMIT_MAX_REQUESTS: 120,
      ENABLE_WEBSOCKET: true,
      ENABLE_METRICS_COLLECTION: true,
    } as EnvConfig;
  }
  
  return result.data;
}

// =============================================================================
// Exported Configuration
// =============================================================================

export const config = loadConfig();

// =============================================================================
// Branding Configuration
// =============================================================================

export const branding = {
  name: 'XDC SkyNet',
  shortName: 'SkyNet',
  tagline: 'Own Your Network',
  description: 'The definitive dashboard and API platform for XDC Network owners and operators',
  url: 'https://xdc.openscan.ai',
  repository: 'https://github.com/AnilChinchawale/XDCSkyNet',
  
  colors: {
    primary: '#1E90FF',
    secondary: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    background: '#0A0E1A',
    card: '#111827',
    text: '#F0F0F0',
    textMuted: '#64748B',
  },
  
  social: {
    twitter: '@XDCNetwork',
    discord: 'https://discord.gg/xdc',
    telegram: 'https://t.me/xdc_network',
  },
} as const;

// =============================================================================
// Feature Flags
// =============================================================================

export const features = {
  websocket: config.ENABLE_WEBSOCKET,
  metricsCollection: config.ENABLE_METRICS_COLLECTION,
  aiDiagnostics: false, // Phase 5
  socialExport: false, // Phase 2
  consensusMonitor: false, // Phase 2
} as const;

// =============================================================================
// API Configuration
// =============================================================================

export const apiConfig = {
  version: 'v1',
  basePath: '/api/v1',
  
  rateLimit: {
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
  },
  
  pagination: {
    defaultLimit: 50,
    maxLimit: 100,
  },
  
  timeouts: {
    default: 30000,
    long: 60000,
    external: 10000,
  },
} as const;
