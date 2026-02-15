/**
 * XDC SkyNet - Environment Validation
 * Validates all required environment variables on startup
 */

import { z } from 'zod';
import { logger } from './logger';

// =============================================================================
// Environment Schema
// =============================================================================

const envSchema = z.object({
  // Required
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid PostgreSQL URL'),
  API_KEYS: z.string().min(1, 'API_KEYS must contain at least one key'),

  // Optional with defaults
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3005),
  WS_PORT: z.coerce.number().default(3006),
  DB_SCHEMA: z.string().default('skynet'),
  
  // Optional Redis
  REDIS_URL: z.string().url().optional(),
  
  // Optional rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().optional().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().optional().default(120),
  
  // Optional database pool
  DB_POOL_MAX: z.coerce.number().optional().default(20),
  DB_POOL_MIN: z.coerce.number().optional().default(5),
  DB_CONNECTION_TIMEOUT: z.coerce.number().optional().default(10000),
  
  // Optional notifications
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  
  // Optional features
  ENABLE_WEBSOCKET: z.coerce.boolean().optional().default(true),
  ENABLE_METRICS_COLLECTION: z.coerce.boolean().optional().default(true),
  ENABLE_AUTH: z.enum(['true', 'false']).optional().default('true'),
  ENABLE_RATE_LIMIT: z.enum(['true', 'false']).optional().default('false'),
  REQUIRE_WS_AUTH: z.enum(['true', 'false']).optional().default('true'),
  
  // Optional CORS
  CORS_ALLOWED_ORIGINS: z.string().optional(),
  
  // Optional logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
  
  // Optional shutdown
  SHUTDOWN_TIMEOUT: z.coerce.number().optional().default(30000),
});

export type ValidatedEnv = z.infer<typeof envSchema>;

// =============================================================================
// Validation
// =============================================================================

let validatedEnv: ValidatedEnv | null = null;

export function validateEnvironment(): ValidatedEnv {
  if (validatedEnv) return validatedEnv;
  
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    const issues = result.error.issues;
    
    console.error('\n❌ Environment Validation Failed\n');
    console.error('The following environment variables have issues:\n');
    
    for (const issue of issues) {
      const path = issue.path.join('.');
      console.error(`  • ${path}: ${issue.message}`);
    }
    
    console.error('\nRequired environment variables:');
    console.error('  DATABASE_URL - PostgreSQL connection string');
    console.error('  API_KEYS     - Comma-separated list of API keys\n');
    
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Environment validation failed');
    }
    
    console.warn('⚠️  Running with partial configuration in development mode\n');
    
    // Return defaults for development
    return {
      DATABASE_URL: 'postgresql://localhost:5432/skynet',
      API_KEYS: 'dev_key_not_for_production',
      NODE_ENV: 'development',
      PORT: 3005,
      WS_PORT: 3006,
      DB_SCHEMA: 'skynet',
      RATE_LIMIT_WINDOW_MS: 60000,
      RATE_LIMIT_MAX_REQUESTS: 120,
      DB_POOL_MAX: 20,
      DB_POOL_MIN: 5,
      DB_CONNECTION_TIMEOUT: 10000,
      ENABLE_AUTH: 'true' as const,
      ENABLE_RATE_LIMIT: 'false' as const,
      REQUIRE_WS_AUTH: 'true' as const,
      ENABLE_WEBSOCKET: true,
      ENABLE_METRICS_COLLECTION: true,
      LOG_LEVEL: 'info' as const,
      SHUTDOWN_TIMEOUT: 30000,
    };
  }
  
  validatedEnv = result.data;
  logger.info('Environment validated successfully');
  
  return validatedEnv;
}

// =============================================================================
// Convenience Getters
// =============================================================================

export function getEnv(): ValidatedEnv {
  if (!validatedEnv) {
    return validateEnvironment();
  }
  return validatedEnv;
}

export function isDevelopment(): boolean {
  return getEnv().NODE_ENV === 'development';
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === 'production';
}

export function isTest(): boolean {
  return getEnv().NODE_ENV === 'test';
}
