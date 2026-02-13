/**
 * XDC SkyNet Database Module
 * Provides connection pooling, query helpers, and type-safe database access
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

// =============================================================================
// Database Configuration
// =============================================================================

const DATABASE_URL = process.env.DATABASE_URL;
const DB_SCHEMA = process.env.DB_SCHEMA || 'skynet';

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// =============================================================================
// Connection Pool Singleton
// =============================================================================

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });
    
    // Set search_path on each connection
    pool.on('connect', (client) => {
      client.query(`SET search_path TO ${DB_SCHEMA}, public`);
    });
  }
  return pool;
}

// =============================================================================
// Query Helpers
// =============================================================================

/**
 * Execute a query with automatic connection management
 */
export async function query<T extends QueryResultRow = any>(
  text: string, 
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}

/**
 * Execute a query and return the first row or null
 */
export async function queryOne<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] || null;
}

/**
 * Execute a query and return all rows
 */
export async function queryAll<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await query<T>(text, params);
  return result.rows;
}

/**
 * Execute multiple queries in a transaction
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Execute a query with retry logic for transient errors
 */
export async function queryWithRetry<T extends QueryResultRow = any>(
  text: string,
  params?: any[],
  maxRetries = 3,
  baseDelay = 100
): Promise<QueryResult<T>> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await query<T>(text, params);
    } catch (error) {
      lastError = error as Error;
      
      // Check if error is retryable
      const isRetryable = 
        (error as any).code === 'ECONNREFUSED' ||
        (error as any).code === '57P01' || // admin_shutdown
        (error as any).code === '57P02' || // crash_shutdown
        (error as any).code === '57P03';   // cannot_connect_now
      
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 100;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// =============================================================================
// Graceful Shutdown
// =============================================================================

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// =============================================================================
// Health Check
// =============================================================================

export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  latencyMs: number;
  poolSize: number;
  idleConnections: number;
  waitingClients: number;
}> {
  const pool = getPool();
  const start = Date.now();
  
  try {
    await query('SELECT 1');
    const latencyMs = Date.now() - start;
    
    return {
      connected: true,
      latencyMs,
      poolSize: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingClients: pool.waitingCount,
    };
  } catch (error) {
    return {
      connected: false,
      latencyMs: -1,
      poolSize: pool.totalCount,
      idleConnections: pool.idleCount,
      waitingClients: pool.waitingCount,
    };
  }
}

// =============================================================================
// Type Definitions
// =============================================================================

export interface Node {
  id: string;
  name: string;
  host: string;
  role: 'masternode' | 'fullnode' | 'archive' | 'rpc';
  location_city: string | null;
  location_country: string | null;
  location_lat: number | null;
  location_lng: number | null;
  tags: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface NodeMetric {
  id: number;
  node_id: string;
  block_height: number | null;
  sync_percent: number | null;
  peer_count: number | null;
  cpu_percent: number | null;
  memory_percent: number | null;
  disk_percent: number | null;
  disk_used_gb: number | null;
  disk_total_gb: number | null;
  tx_pool_pending: number | null;
  tx_pool_queued: number | null;
  gas_price: bigint | null;
  tps: number | null;
  rpc_latency_ms: number | null;
  is_syncing: boolean | null;
  client_version: string | null;
  protocol_version: string | null;
  coinbase: string | null;
  collected_at: Date;
}

export interface PeerSnapshot {
  id: number;
  node_id: string;
  peer_enode: string;
  peer_name: string | null;
  remote_ip: string | null;
  remote_port: number | null;
  client_version: string | null;
  protocols: string[] | null;
  direction: 'inbound' | 'outbound' | null;
  latency_ms: number | null;
  country: string | null;
  city: string | null;
  asn: string | null;
  score: number;
  collected_at: Date;
}

export interface Incident {
  id: number;
  node_id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string | null;
  suggested_fix: string | null;
  status: 'active' | 'acknowledged' | 'resolved';
  detected_at: Date;
  resolved_at: Date | null;
  auto_detected: boolean;
}

export interface NetworkHealth {
  id: number;
  health_score: number | null;
  total_nodes: number | null;
  healthy_nodes: number | null;
  degraded_nodes: number | null;
  offline_nodes: number | null;
  total_peers: number | null;
  avg_block_height: bigint | null;
  max_block_height: bigint | null;
  nakamoto_coefficient: number | null;
  avg_sync_percent: number | null;
  avg_rpc_latency_ms: number | null;
  collected_at: Date;
}

export interface BannedPeer {
  id: number;
  enode: string;
  remote_ip: string | null;
  reason: string | null;
  banned_at: Date;
  banned_by: string;
}

export interface UpgradePlan {
  id: number;
  name: string;
  target_version: string | null;
  strategy: 'rolling' | 'canary' | 'blue-green';
  node_ids: string[];
  status: 'planned' | 'in_progress' | 'completed' | 'failed';
  scheduled_at: Date | null;
  started_at: Date | null;
  completed_at: Date | null;
  notes: string | null;
  created_at: Date;
}

export interface ApiKey {
  id: number;
  key: string;
  node_id: string | null;
  name: string | null;
  permissions: string[];
  is_active: boolean;
  created_at: Date;
  last_used_at: Date | null;
}

export interface CommandQueue {
  id: number;
  node_id: string;
  command: string;
  params: Record<string, unknown>;
  status: 'pending' | 'sent' | 'completed' | 'failed';
  created_at: Date;
  sent_at: Date | null;
  completed_at: Date | null;
  result: Record<string, unknown> | null;
}
