import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create a singleton pool instance
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });
  }
  return pool;
}

// Generic query function
export async function query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    return await client.query<T>(text, params);
  } finally {
    client.release();
  }
}

// Transaction helper
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
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

// Graceful shutdown helper
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// Types for database entities
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
