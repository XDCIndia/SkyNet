export interface BlockchainData {
  blockHeight: number;
  highestBlock: number;
  syncPercent: number;
  isSyncing: boolean;
  peers: number;
  peersInbound: number;
  peersOutbound: number;
  uptime: number;
  chainId: string;
  coinbase: string;
  ethstatsName: string;
  clientVersion: string;
}

export interface ConsensusData {
  epoch: number;
  epochProgress: number;
  masternodeStatus: 'Active' | 'Inactive' | 'Slashed';
  signingRate: number;
  stakeAmount: number;
  walletBalance: number;
  totalRewards: number;
  penalties: number;
}

export interface SyncData {
  syncRate: number;
  reorgsAdd: number;
  reorgsDrop: number;
}

export interface TxPoolData {
  pending: number;
  queued: number;
  slots: number;
  valid: number;
  invalid: number;
  underpriced: number;
}

export interface ServerData {
  cpuUsage: number;
  memoryUsed: number;
  memoryTotal: number;
  diskUsed: number;
  diskTotal: number;
  goroutines: number;
  sysLoad: number;
  procLoad: number;
}

export interface StorageData {
  chainDataSize: number;
  diskReadRate: number;
  diskWriteRate: number;
  compactTime: number;
  trieCacheHitRate: number;
  trieCacheMiss: number;
}

export interface NetworkData {
  totalPeers: number;
  inboundTraffic: number;
  outboundTraffic: number;
  dialSuccess: number;
  dialTotal: number;
  eth100Traffic: number;
  eth63Traffic: number;
  connectionErrors: number;
}

export interface MetricsData {
  blockchain: BlockchainData;
  consensus: ConsensusData;
  sync: SyncData;
  txpool: TxPoolData;
  server: ServerData;
  storage: StorageData;
  network: NetworkData;
  timestamp: string;
}

export interface PeerInfo {
  id: string;
  name: string;
  ip: string;
  port: number;
  country: string;
  countryCode: string;
  city: string;
  lat: number;
  lon: number;
  isp: string;
  inbound: boolean;
}

export interface CountryInfo {
  name: string;
  count: number;
}

export interface PeersData {
  peers: PeerInfo[];
  countries: Record<string, CountryInfo>;
  totalPeers: number;
}

// SkyNet Node Types (Issue #87)
export interface SkyNetNode {
  id: string;
  name: string;
  status: 'healthy' | 'syncing' | 'offline' | 'degraded';
  clientType: string;
  clientVersion: string;
  blockHeight: number;
  peerCount: number;
  syncPercent: number;
  network: string;
  region: string;
  lastSeen: string;
  uptime: number;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  ipv4?: string;
  ipv6?: string;
  networkHeight?: number;
  peakBlock?: number;
  dockerImage?: string;
  startupParams?: string;
  stateScheme?: string;
  prevBlock?: number;
  blockDiff?: number;
  os?: string;
  osType?: string;
  healthScore?: number;
  syncStartedAt?: string;
  syncCompletedAt?: string;
  syncDurationSeconds?: number;
  syncStartBlock?: number;
  syncTargetBlock?: number;
}

export interface ClientDistributionItem {
  type: string;
  count: number;
  color: string;
  icon?: string;
  percentage?: number;
}

export interface FleetStatus {
  totalNodes: number;
  healthyNodes: number;
  syncingNodes: number;
  offlineNodes: number;
  fleetMaxBlock: number;
  clientDistribution: ClientDistributionItem[];
}
