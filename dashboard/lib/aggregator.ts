import { registeredNodes, NodeMetrics, ManagedNode } from './node-registry';

export interface FleetStats {
  totalNodes: number;
  healthyCount: number;
  degradedCount: number;
  offlineCount: number;
  avgSyncPercent: number;
  totalPeers: number;
  avgBlockHeight: number;
  maxBlockHeight: number;
  nodes: NodeMetrics[];
}

export interface HealthScore {
  score: number;
  breakdown: {
    nodeUptime: number;
    syncStatus: number;
    peerDiversity: number;
    consensusParticipation: number;
  };
  rating: 'excellent' | 'good' | 'fair' | 'poor';
}

// Generate realistic mock metrics for a node
function generateMockMetrics(node: ManagedNode): NodeMetrics {
  // Deterministic pseudo-random based on node id
  const seed = node.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const baseHeight = 85000000 + (seed % 1000);
  
  // Different health states based on node
  const isDegraded = node.id === 'xdc-dev-local';
  const isOffline = false;
  
  let status: 'online' | 'degraded' | 'offline' = 'online';
  let healthy = true;
  let syncPercent = 99.8 + (seed % 20) / 100;
  let peers = 20 + (seed % 15);
  let cpu = 25 + (seed % 30);
  let memory = 40 + (seed % 25);
  let disk = 45 + (seed % 20);
  
  if (isDegraded) {
    status = 'degraded';
    healthy = false;
    syncPercent = 95.5;
    peers = 2;
    cpu = 85;
    memory = 92;
  }
  
  if (isOffline) {
    status = 'offline';
    healthy = false;
    syncPercent = 0;
    peers = 0;
    cpu = 0;
    memory = 0;
    disk = 0;
  }
  
  return {
    nodeId: node.id,
    healthy,
    status,
    blockHeight: baseHeight,
    syncPercent,
    peers,
    cpu,
    memory,
    disk,
    lastSeen: new Date().toISOString(),
    uptime: isDegraded ? 7200 : 86400 * (5 + seed % 30),
  };
}

// Fetch metrics from all registered nodes in parallel
export async function fetchFleetMetrics(): Promise<FleetStats> {
  // In production, this would make actual RPC calls to each node
  // For demo, we generate mock data
  const nodeMetrics = registeredNodes.map(generateMockMetrics);
  
  const totalNodes = nodeMetrics.length;
  const healthyCount = nodeMetrics.filter(n => n.status === 'online').length;
  const degradedCount = nodeMetrics.filter(n => n.status === 'degraded').length;
  const offlineCount = nodeMetrics.filter(n => n.status === 'offline').length;
  
  const onlineNodes = nodeMetrics.filter(n => n.status !== 'offline');
  const avgSyncPercent = onlineNodes.length > 0 
    ? onlineNodes.reduce((sum, n) => sum + n.syncPercent, 0) / onlineNodes.length 
    : 0;
  
  const totalPeers = nodeMetrics.reduce((sum, n) => sum + n.peers, 0);
  
  const blockHeights = onlineNodes.map(n => n.blockHeight);
  const avgBlockHeight = blockHeights.length > 0 
    ? Math.floor(blockHeights.reduce((sum, h) => sum + h, 0) / blockHeights.length)
    : 0;
  const maxBlockHeight = blockHeights.length > 0 ? Math.max(...blockHeights) : 0;
  
  return {
    totalNodes,
    healthyCount,
    degradedCount,
    offlineCount,
    avgSyncPercent,
    totalPeers,
    avgBlockHeight,
    maxBlockHeight,
    nodes: nodeMetrics,
  };
}

// Calculate network health score
export function calculateHealthScore(stats: FleetStats): HealthScore {
  // Node uptime score (0-25)
  const nodeUptime = Math.round((stats.healthyCount / stats.totalNodes) * 25);
  
  // Sync status score (0-25)
  // Don't penalize actively syncing nodes (block height > 0 means they're catching up)
  const effectiveSyncPercent = Math.max(stats.avgSyncPercent, 
    stats.nodes?.filter(n => n.blockHeight > 0 && n.syncPercent < 100).length > 0 
      ? Math.max(stats.avgSyncPercent, 95) : stats.avgSyncPercent);
  const syncStatus = Math.round((effectiveSyncPercent / 100) * 25);
  
  // Peer diversity score (0-25) - based on peer distribution
  const avgPeersPerNode = stats.totalPeers / stats.totalNodes;
  const peerDiversity = Math.min(25, Math.round((avgPeersPerNode / 25) * 25));
  
  // Consensus participation (0-25) - simulated
  const consensusParticipation = 23; // High participation
  
  const score = nodeUptime + syncStatus + peerDiversity + consensusParticipation;
  
  let rating: 'excellent' | 'good' | 'fair' | 'poor';
  if (score >= 90) rating = 'excellent';
  else if (score >= 75) rating = 'good';
  else if (score >= 50) rating = 'fair';
  else rating = 'poor';
  
  return {
    score,
    breakdown: {
      nodeUptime,
      syncStatus,
      peerDiversity,
      consensusParticipation,
    },
    rating,
  };
}

// Generate growth timeline data (12 months)
export interface GrowthDataPoint {
  month: string;
  activeNodes: number;
  dailyTransactions: number;
  uniqueAddresses: number;
  totalStaked: number;
}

export function getGrowthTimeline(): GrowthDataPoint[] {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return months.map((month, index) => ({
    month,
    activeNodes: 120 + index * 8 + Math.floor(Math.random() * 5),
    dailyTransactions: 50000 + index * 5000 + Math.floor(Math.random() * 2000),
    uniqueAddresses: 150000 + index * 12000 + Math.floor(Math.random() * 5000),
    totalStaked: 2.5 + index * 0.15 + Math.random() * 0.1,
  }));
}
