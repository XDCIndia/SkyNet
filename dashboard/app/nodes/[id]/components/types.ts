// Types for node detail components

export interface NodeDetail {
  id: string;
  name: string;
  host: string;
  role: 'masternode' | 'fullnode' | 'archive' | 'rpc';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  location: {
    city: string;
    country: string;
    lat: number;
    lng: number;
  } | null;
  tags: string[];
  ipv4?: string;
  ipv6?: string;
  os_info?: {
    type?: string;
    release?: string;
    arch?: string;
    kernel?: string;
  };
  client_type?: string;
  client_version?: string;
  node_type?: string;
  sync_mode?: string;
  security_score?: number;
  security_issues?: string;
}

export interface NodeStatus {
  blockHeight: number;
  networkHeight: number;
  isSyncing: boolean;
  syncPercent: number;
  peerCount: number;
  activePeers: number;
  txPoolPending: number;
  txPoolQueued: number;
  gasPrice: string;
  clientVersion: string;
  clientType?: string;
  nodeType?: string;
  syncMode?: string;
  coinbase: string;
  chainId?: string;
  uptime?: number;
  highestBlock?: number;
  system: {
    cpuPercent: number;
    memoryPercent: number;
    diskPercent: number;
    diskUsedGb: number;
    diskTotalGb: number;
  } | null;
  storage?: {
    chainDataSize?: number;
    databaseSize?: number;
    storageType?: string;
    storageModel?: string;
    iopsEstimate?: number;
    mountPoint?: string;
    mountPercent?: number;
  };
  os?: {
    type?: string;
    release?: string;
    arch?: string;
    kernel?: string;
  };
  ipv4?: string;
  ipv6?: string;
  rpcLatencyMs: number;
  lastSeen: string;
  security?: {
    score?: number;
    issues?: string;
  };
  sentries?: SentryInfo[];
}

export interface SentryInfo {
  port: number;
  protocol: string;
  peers: number;
}

export interface Peer {
  id: string;
  enode: string;
  name: string;
  ip: string;
  port: number;
  clientVersion: string;
  protocols: string[];
  direction: 'inbound' | 'outbound';
  country: string;
  city: string;
}

export interface MetricHistory {
  timestamp: string;
  block_height: number;
  peer_count: number;
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  sync_percent: number;
  rpc_latency_ms?: number;
  chain_data_size?: number;
  database_size?: number;
  sentries?: SentryInfo[];
}

export interface Incident {
  id: number;
  node_id: string;
  node_name: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  status: 'active' | 'acknowledged' | 'resolved';
  detected_at: string;
  resolved_at: string | null;
  auto_detected: boolean;
}

// Consensus data for masternode nodes
export interface ConsensusData {
  epoch: number;
  epochProgress: number;
  masternodeStatus: 'Active' | 'Inactive' | 'Slashed' | 'Not Configured';
  coinbase?: string;
  blockTime?: number;
  signingRate: number;
  stakeAmount: number;
  totalRewards: number;
  penalties: number;
}

// TxPool data
export interface TxPoolData {
  pending: number;
  queued: number;
  slots: number;
  valid: number;
  invalid: number;
  underpriced: number;
  isSyncing?: boolean;
  available?: boolean;
}
