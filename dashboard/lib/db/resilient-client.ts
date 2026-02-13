/**
 * XDC SkyNet - Enhanced Database Client
 * Provides connection pooling, circuit breaker, retry logic, and graceful degradation
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { logger } from '../logger';
import { getCircuitBreaker, CircuitBreaker } from '../circuit-breaker';
import { getCurrentRequestId as getRequestId } from '../request-context';

// =============================================================================
// Configuration
// =============================================================================

const DATABASE_URL = process.env.DATABASE_URL;
const DB_SCHEMA = process.env.DB_SCHEMA || 'skynet';

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// =============================================================================
// Pool Configuration
// =============================================================================

interface PoolMetrics {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

const POOL_CONFIG = {
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  min: parseInt(process.env.DB_POOL_MIN || '5'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '10000'),
  acquireTimeoutMillis: parseInt(process.env.DB_ACQUIRE_TIMEOUT || '10000'),
  statement_timeout: parseInt(process.env.DB_STATEMENT_TIMEOUT || '30000'),
};

// =============================================================================
// Connection Pool Singleton
// =============================================================================

let pool: Pool | null = null;
let circuitBreaker: CircuitBreaker | null = null;
let isPoolHealthy = true;
let lastPoolError: Error | null = null;
let lastPoolErrorTime: number | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ...POOL_CONFIG,
    });

    // Handle pool errors
    pool.on('error', (err) => {
      logger.error('Unexpected error on idle PostgreSQL client', err, {
        requestId: getRequestId(),
      });
      isPoolHealthy = false;
      lastPoolError = err;
      lastPoolErrorTime = Date.now();
    });

    pool.on('connect', (client) => {
      // Set search_path on each connection
      client.query(`SET search_path TO ${DB_SCHEMA}, public`)
        .catch(err => logger.error('Failed to set search_path', err));
    });

    pool.on('acquire', () => {
      isPoolHealthy = true;
    });

    // Initialize circuit breaker
    circuitBreaker = getCircuitBreaker('database', {
      failureThreshold: 5,
      resetTimeoutMs: 30000,
      halfOpenMaxCalls: 3,
      successThreshold: 2,
    });

    logger.info('Database pool initialized', POOL_CONFIG);
  }
  return pool;
}

// =============================================================================
// Retry Logic
// =============================================================================

const RETRYABLE_ERROR_CODES = new Set([
  'ECONNREFUSED',     // Connection refused
  'ECONNRESET',       // Connection reset
  'ETIMEDOUT',        // Connection timeout
  '57P01',            // admin_shutdown
  '57P02',            // crash_shutdown  
  '57P03',            // cannot_connect_now
  '08006',            // connection_failure
  '08001',            // sqlclient_unable_to_establish_sqlconnection
  '08004',            // sqlserver_rejected_establishment_of_sqlconnection
  '40001',            // serialization_failure (deadlock)
]);

function isRetryableError(error: unknown): boolean {
  const code = (error as any)?.code;
  return RETRYABLE_ERROR_CODES.has(code);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// Enhanced Query Functions
// =============================================================================

/**
 * Execute a query with automatic connection management, retry logic, and circuit breaker
 */
export async function queryWithResilience<T extends QueryResultRow = any>(
  text: string,
  params?: any[],
  options: {
    maxRetries?: number;
    baseDelay?: number;
    timeout?: number;
  } = {}
): Promise<QueryResult<T>> {
  const {
    maxRetries = 3,
    baseDelay = 100,
    timeout = POOL_CONFIG.statement_timeout,
  } = options;

  const cb = circuitBreaker || getCircuitBreaker('database');

  return cb.execute(async () => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const pool = getPool();
        const client = await pool.connect();
        
        try {
          // Set statement timeout for this query
          await client.query(`SET statement_timeout = ${timeout}`);
          
          const result = await client.query<T>(text, params);
          
          logger.debug('Query executed', {
            requestId: getRequestId(),
            rows: result.rowCount,
            attempt,
          });
          
          return result;
        } finally {
          client.release();
        }
      } catch (error) {
        lastError = error as Error;

        if (!isRetryableError(error) || attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 100;
        
        logger.warn(`Query attempt ${attempt} failed, retrying in ${delay.toFixed(0)}ms`, {
          requestId: getRequestId(),
          error: (error as Error).message,
        });
        
        await sleep(delay);
      }
    }

    throw lastError;
  });
}

/**
 * Execute a query and return the first row or null
 */
export async function queryOne<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const result = await queryWithResilience<T>(text, params);
  return result.rows[0] || null;
}

/**
 * Execute a query and return all rows
 */
export async function queryAll<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await queryWithResilience<T>(text, params);
  return result.rows;
}

/**
 * Execute multiple queries in a transaction with automatic rollback on error
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
  options: {
    maxRetries?: number;
    isolationLevel?: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE';
  } = {}
): Promise<T> {
  const { maxRetries = 3, isolationLevel = 'READ COMMITTED' } = options;
  const cb = circuitBreaker || getCircuitBreaker('database');

  return cb.execute(async () => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const pool = getPool();
      const client = await pool.connect();

      try {
        await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        lastError = error as Error;

        // Retry on serialization failures (deadlocks)
        if ((error as any)?.code === '40001' && attempt < maxRetries) {
          const delay = 100 * Math.pow(2, attempt - 1);
          logger.warn(`Transaction deadlock, retrying in ${delay}ms`, {
            requestId: getRequestId(),
            attempt,
          });
          await sleep(delay);
          continue;
        }

        throw error;
      } finally {
        client.release();
      }
    }

    throw lastError;
  });
}

// =============================================================================
// Legacy Aliases for Backward Compatibility
// =============================================================================

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  return queryWithResilience<T>(text, params);
}

// =============================================================================
// Graceful Shutdown
// =============================================================================

export async function closePool(): Promise<void> {
  if (pool) {
    logger.info('Closing database pool...');
    await pool.end();
    pool = null;
    circuitBreaker = null;
    logger.info('Database pool closed');
  }
}

// =============================================================================
// Health Check
// =============================================================================

export interface DatabaseHealth {
  connected: boolean;
  healthy: boolean;
  latencyMs: number;
  poolSize: number;
  idleConnections: number;
  waitingClients: number;
  circuitBreakerState: string;
  lastError: string | null;
  lastErrorTime: string | null;
}

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  if (!pool) {
    return {
      connected: false,
      healthy: false,
      latencyMs: -1,
      poolSize: 0,
      idleConnections: 0,
      waitingClients: 0,
      circuitBreakerState: 'unknown',
      lastError: lastPoolError?.message || null,
      lastErrorTime: lastPoolErrorTime ? new Date(lastPoolErrorTime).toISOString() : null,
    };
  }

  const start = Date.now();
  let connected = false;
  let latencyMs = -1;

  try {
    await pool.query('SELECT 1');
    connected = true;
    latencyMs = Date.now() - start;
    isPoolHealthy = true;
  } catch (error) {
    isPoolHealthy = false;
    lastPoolError = error as Error;
    lastPoolErrorTime = Date.now();
  }

  return {
    connected,
    healthy: connected && isPoolHealthy,
    latencyMs,
    poolSize: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingClients: pool.waitingCount,
    circuitBreakerState: circuitBreaker?.getState() || 'unknown',
    lastError: lastPoolError?.message || null,
    lastErrorTime: lastPoolErrorTime ? new Date(lastPoolErrorTime).toISOString() : null,
  };
}

// =============================================================================
// Pool Metrics
// =============================================================================

export function getPoolMetrics(): PoolMetrics {
  if (!pool) {
    return { totalCount: 0, idleCount: 0, waitingCount: 0 };
  }
  
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

// =============================================================================
// Type Exports
// =============================================================================

export type { Node, NodeMetric, PeerSnapshot, Incident, NetworkHealth, BannedPeer, UpgradePlan, ApiKey, CommandQueue } from './client';
export { queryWithRetry, closePool as closePoolLegacy } from './client';
