import { query, Node, NodeMetric, withTransaction } from './db';
import { queryPrometheus, PROMETHEUS_QUERIES } from './prometheus';

const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8989';
const COLLECTOR_INTERVAL = parseInt(process.env.COLLECTOR_INTERVAL || '30000'); // 30 seconds
const HEALTH_INTERVAL = parseInt(process.env.HEALTH_INTERVAL || '300000'); // 5 minutes

interface RPCResponse {
  jsonrpc: string;
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

interface NodeInfo {
  name: string;
  id: string;
  ip: string;
  ports: { discovery: number; listener: number };
  listenAddr: string;
  protocols: Record<string, unknown>;
}

interface SyncStatus {
  currentBlock: string;
  highestBlock: string;
  startingBlock: string;
  pulledStates: string;
  knownStates: string;
}

interface TxPoolStatus {
  pending: Record<string, unknown>;
  queued: Record<string, unknown>;
}

interface PeerInfo {
  enode: string;
  id: string;
  name: string;
  network: {
    localAddress: string;
    remoteAddress: string;
    inbound: boolean;
    trusted: boolean;
    static: boolean;
  };
  protocols: Record<string, { version: number; name: string }>;
}

// Track previous metrics for incident detection (bounded to prevent memory leaks)
const MAX_TRACKED_NODES = 1000;
const previousMetrics = new Map<string, NodeMetric & { count: number }>();

// Normalise a host/URL value to a full http:// endpoint.
// Handles bare IPs ("1.2.3.4"), IP:port ("1.2.3.4:8545"),
// and already-full URLs ("http://1.2.3.4:8545").
function normalizeRpcUrl(raw: string, defaultPort = 8545): string {
  if (!raw) return raw;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  // bare IP or IP:port — add scheme
  const hasPort = raw.includes(':');
  return `http://${raw}${hasPort ? '' : `:${defaultPort}`}`;
}

async function rpcCall(method: string, params: unknown[] = [], url: string = RPC_URL): Promise<unknown> {
  const normalizedUrl = normalizeRpcUrl(url);
  try {
    const res = await fetch(normalizedUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
      signal: AbortSignal.timeout(5000),
    });
    const data: RPCResponse = await res.json();
    if (data.error) {
      console.error(`RPC error for ${method}:`, data.error.message);
      return null;
    }
    return data.result;
  } catch (error) {
    console.error(`RPC call failed for ${method}:`, error);
    return null;
  }
}

async function getActiveNodes(): Promise<Node[]> {
  // Only poll nodes that have a valid RPC host URL configured.
  // Nodes with empty/null host use SkyOne agent heartbeats exclusively — polling them
  // with a broken URL would insert block_height=0 rows that overwrite real heartbeat data.
  const result = await query<Node>(
    "SELECT * FROM skynet.nodes WHERE is_active = true AND host IS NOT NULL AND host != ''"
  );
  return result.rows;
}

async function collectNodeMetrics(node: Node): Promise<Partial<NodeMetric> | null> {
  const startTime = Date.now();
  
  try {
    // Collect RPC data in parallel
    const [
      blockNumber,
      syncing,
      peers,
      nodeInfo,
      txPool,
      gasPrice,
    ] = await Promise.all([
      rpcCall('eth_blockNumber', [], node.host) as Promise<string | null>,
      rpcCall('eth_syncing', [], node.host) as Promise<SyncStatus | boolean | null>,
      rpcCall('admin_peers', [], node.host) as Promise<PeerInfo[] | null>,
      rpcCall('admin_nodeInfo', [], node.host) as Promise<NodeInfo | null>,
      rpcCall('txpool_status', [], node.host) as Promise<TxPoolStatus | null>,
      rpcCall('eth_gasPrice', [], node.host) as Promise<string | null>,
    ]);

    const rpcLatency = Date.now() - startTime;

    // Parse block height
    const blockHeight = blockNumber ? parseInt(blockNumber, 16) : null;
    
    // Parse sync status
    let syncPercent: number | null = null;
    let isSyncing = false;
    if (typeof syncing === 'boolean') {
      isSyncing = syncing;
      syncPercent = syncing ? 0 : 100;
    } else if (syncing && typeof syncing === 'object') {
      isSyncing = true;
      const current = parseInt(syncing.currentBlock, 16);
      const highest = parseInt(syncing.highestBlock, 16);
      if (highest > 0) {
        syncPercent = Math.min(100, (current / highest) * 100);
      }
    }

    // Parse peer count
    const peerCount = Array.isArray(peers) ? peers.length : null;

    // Parse tx pool
    const txPending = txPool?.pending ? Object.keys(txPool.pending).length : null;
    const txQueued = txPool?.queued ? Object.keys(txPool.queued).length : null;

    // Parse gas price (in wei, convert to gwei)
    const gasPriceGwei = gasPrice ? parseInt(gasPrice, 16) / 1e9 : null;

    // Get Prometheus metrics if available
    const prometheusMetrics = await queryPrometheusNodeMetrics(node);

    return {
      node_id: node.id,
      block_height: blockHeight,
      sync_percent: syncPercent,
      peer_count: peerCount,
      is_syncing: isSyncing,
      rpc_latency_ms: rpcLatency,
      tx_pool_pending: txPending,
      tx_pool_queued: txQueued,
      gas_price: gasPriceGwei ? BigInt(Math.floor(gasPriceGwei * 1e9)) : null,
      client_version: nodeInfo?.name || null,
      protocol_version: nodeInfo?.protocols?.eth ? String(nodeInfo.protocols.eth) : null,
      ...prometheusMetrics,
    };
  } catch (error) {
    console.error(`Failed to collect metrics for node ${node.name}:`, error);
    return null;
  }
}

async function queryPrometheusNodeMetrics(node: Node): Promise<Partial<NodeMetric>> {
  const metrics: Partial<NodeMetric> = {};
  
  try {
    const [
      cpuPercent,
      memoryUsed,
      memoryTotal,
      diskUsed,
      diskTotal,
      txPendingProm,
      txQueuedProm,
    ] = await Promise.all([
      queryPrometheus(PROMETHEUS_QUERIES.cpuUsage),
      queryPrometheus(PROMETHEUS_QUERIES.memoryUsed),
      queryPrometheus(PROMETHEUS_QUERIES.memoryTotal),
      queryPrometheus(PROMETHEUS_QUERIES.diskUsed),
      queryPrometheus(PROMETHEUS_QUERIES.diskTotal),
      queryPrometheus(PROMETHEUS_QUERIES.txPending),
      queryPrometheus(PROMETHEUS_QUERIES.txQueued),
    ]);

    if (cpuPercent !== null) metrics.cpu_percent = cpuPercent;
    if (memoryTotal && memoryTotal > 0) {
      metrics.memory_percent = (memoryUsed || 0) / memoryTotal * 100;
    }
    if (diskTotal && diskTotal > 0) {
      metrics.disk_percent = (diskUsed || 0) / diskTotal * 100;
      metrics.disk_used_gb = (diskUsed || 0) / (1024 * 1024 * 1024);
      metrics.disk_total_gb = diskTotal / (1024 * 1024 * 1024);
    }
    if (txPendingProm !== null) metrics.tx_pool_pending = Math.floor(txPendingProm);
    if (txQueuedProm !== null) metrics.tx_pool_queued = Math.floor(txQueuedProm);
  } catch (error) {
    console.error('Prometheus query error:', error);
  }

  return metrics;
}

async function detectIncidents(node: Node, metric: Partial<NodeMetric>): Promise<void> {
  const incidents: Array<{
    type: string;
    severity: 'critical' | 'warning' | 'info';
    title: string;
    description: string;
    suggested_fix?: string;
  }> = [];

  // Check for peer drop
  if (metric.peer_count !== null && metric.peer_count !== undefined && metric.peer_count < 3) {
    incidents.push({
      type: 'peer_drop',
      severity: 'critical',
      title: 'Peer Count Critical',
      description: `Node has only ${metric.peer_count} peers (threshold: 3)`,
      suggested_fix: 'Check network connectivity and add static peers',
    });
  }

  // Check for disk pressure
  if (metric.disk_percent !== null && metric.disk_percent !== undefined && metric.disk_percent > 85) {
    incidents.push({
      type: 'disk_pressure',
      severity: 'warning',
      title: 'Disk Usage High',
      description: `Disk usage at ${(metric.disk_percent ?? 0).toFixed(1)}% (threshold: 85%)`,
      suggested_fix: 'Run database compaction or prune old state',
    });
  }

  // Check for memory pressure
  if (metric.memory_percent !== null && metric.memory_percent !== undefined && metric.memory_percent > 90) {
    incidents.push({
      type: 'memory_high',
      severity: 'warning',
      title: 'Memory Usage High',
      description: `Memory usage at ${(metric.memory_percent ?? 0).toFixed(1)}% (threshold: 90%)`,
      suggested_fix: 'Consider increasing system memory or restarting node',
    });
  }

  // Check for sync stall (block height unchanged for 3+ checks)
  const prev = previousMetrics.get(node.id);
  if (prev && metric.block_height !== null) {
    if (prev.block_height === metric.block_height && prev.count >= 3) {
      incidents.push({
        type: 'sync_stall',
        severity: 'critical',
        title: 'Sync Stall Detected',
        description: `Block height stuck at #${metric.block_height} for ${prev.count * 30} seconds`,
        suggested_fix: 'Check peer connections and restart sync',
      });
    }
  }

  // Insert incidents if not already active
  for (const incident of incidents) {
    const existing = await query(
      `SELECT id FROM skynet.incidents 
       WHERE node_id = $1 AND type = $2 AND status = 'active'`,
      [node.id, incident.type]
    );

    if (existing.rowCount === 0) {
      await query(
        `INSERT INTO skynet.incidents 
         (node_id, type, severity, title, description, suggested_fix, auto_detected)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [node.id, incident.type, incident.severity, incident.title, incident.description, incident.suggested_fix || null]
      );
      console.log(`[Collector] Created incident: ${incident.title} for ${node.name}`);
    }
  }
}

async function updatePreviousMetrics(nodeId: string, metric: Partial<NodeMetric>): Promise<void> {
  const prev = previousMetrics.get(nodeId);
  const blockHeight = metric.block_height ?? null;
  
  if (prev && blockHeight !== null) {
    if (prev.block_height === blockHeight) {
      prev.count++;
    } else {
      prev.block_height = blockHeight;
      prev.count = 0;
    }
  } else {
    // Evict oldest entries if at capacity to prevent unbounded memory growth
    if (previousMetrics.size >= MAX_TRACKED_NODES) {
      const firstKey = previousMetrics.keys().next().value;
      if (firstKey) previousMetrics.delete(firstKey);
    }
    previousMetrics.set(nodeId, { ...metric as NodeMetric, count: 0 });
  }
}

async function insertMetrics(metric: Partial<NodeMetric>): Promise<void> {
  const columns = Object.keys(metric).filter(k => metric[k as keyof typeof metric] !== undefined);
  const values = columns.map(k => metric[k as keyof typeof metric]);
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

  await query(
    `INSERT INTO skynet.node_metrics (${columns.join(', ')}) VALUES (${placeholders})`,
    values
  );
}

async function collectAndStoreMetrics(): Promise<void> {
  const nodes = await getActiveNodes();
  console.log(`[Collector] Collecting metrics for ${nodes.length} nodes...`);

  for (const node of nodes) {
    const metric = await collectNodeMetrics(node);
    if (metric) {
      await insertMetrics(metric);
      await detectIncidents(node, metric);
      await updatePreviousMetrics(node.id, metric);
      console.log(`[Collector] Metrics collected for ${node.name}: height=${metric.block_height}, peers=${metric.peer_count}`);
    } else {
      console.warn(`[Collector] Failed to collect metrics for ${node.name}`);
    }
  }
}

async function calculateNetworkHealth(): Promise<void> {
  console.log('[Collector] Calculating network health...');
  
  const result = await query(`
    WITH latest_metrics AS (
      SELECT DISTINCT ON (node_id) 
        node_id, block_height, sync_percent, peer_count, rpc_latency_ms
      FROM skynet.node_metrics
      WHERE collected_at > NOW() - INTERVAL '5 minutes'
      ORDER BY node_id, collected_at DESC
    ),
    node_health AS (
      SELECT 
        CASE 
          WHEN sync_percent >= 99 AND peer_count >= 3 AND rpc_latency_ms < 1000 THEN 'healthy'
          WHEN peer_count = 0 OR rpc_latency_ms > 5000 THEN 'offline'
          ELSE 'degraded'
        END as health_status
      FROM latest_metrics
    )
    SELECT 
      COUNT(*) as total_nodes,
      COUNT(*) FILTER (WHERE health_status = 'healthy') as healthy_nodes,
      COUNT(*) FILTER (WHERE health_status = 'degraded') as degraded_nodes,
      COUNT(*) FILTER (WHERE health_status = 'offline') as offline_nodes,
      COALESCE(SUM(peer_count), 0) as total_peers,
      COALESCE(AVG(block_height), 0)::bigint as avg_block_height,
      COALESCE(MAX(block_height), 0)::bigint as max_block_height,
      COALESCE(AVG(sync_percent), 0) as avg_sync_percent,
      COALESCE(AVG(rpc_latency_ms), 0)::int as avg_rpc_latency_ms
    FROM latest_metrics
    CROSS JOIN node_health
  `);

  const row = result.rows[0];
  
  // Calculate health score (0-100)
  if (row.total_nodes > 0) {
    const healthScore = Math.round(
      (row.healthy_nodes / row.total_nodes) * 100
    );

    await query(`
      INSERT INTO skynet.network_health 
        (health_score, total_nodes, healthy_nodes, degraded_nodes, offline_nodes, 
         total_peers, avg_block_height, max_block_height, avg_sync_percent, avg_rpc_latency_ms)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      healthScore,
      row.total_nodes,
      row.healthy_nodes,
      row.degraded_nodes,
      row.offline_nodes,
      row.total_peers,
      row.avg_block_height,
      row.max_block_height,
      row.avg_sync_percent,
      row.avg_rpc_latency_ms,
    ]);

    console.log(`[Collector] Network health: ${healthScore}/100 (${row.healthy_nodes}/${row.total_nodes} healthy)`);
  }
}

// Collector state
let isRunning = false;
let metricsInterval: NodeJS.Timeout | null = null;
let healthInterval: NodeJS.Timeout | null = null;

export function startCollector(): void {
  if (isRunning) {
    console.log('[Collector] Already running');
    return;
  }

  isRunning = true;
  console.log(`[Collector] Starting with ${COLLECTOR_INTERVAL}ms interval`);

  // Initial collection
  collectAndStoreMetrics().catch(console.error);
  calculateNetworkHealth().catch(console.error);

  // Schedule periodic collections
  metricsInterval = setInterval(() => {
    collectAndStoreMetrics().catch(console.error);
  }, COLLECTOR_INTERVAL);

  healthInterval = setInterval(() => {
    calculateNetworkHealth().catch(console.error);
  }, HEALTH_INTERVAL);
}

export function stopCollector(): void {
  if (!isRunning) {
    console.log('[Collector] Not running');
    return;
  }

  isRunning = false;
  if (metricsInterval) { clearInterval(metricsInterval); metricsInterval = null; }
  if (healthInterval) { clearInterval(healthInterval); healthInterval = null; }
  previousMetrics.clear();
  console.log('[Collector] Stopped');
}

export function getCollectorStatus(): {
  running: boolean;
  metricsInterval: number;
  healthInterval: number;
} {
  return {
    running: isRunning,
    metricsInterval: COLLECTOR_INTERVAL,
    healthInterval: HEALTH_INTERVAL,
  };
}

// Export for manual triggering
export { collectAndStoreMetrics, calculateNetworkHealth };
