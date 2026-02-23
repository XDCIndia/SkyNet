'use client';

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { 
  Server, 
  Activity, 
  RefreshCw, 
  Filter,
  Grid3X3,
  List,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  HardDrive,
  MemoryStick,
  Globe,
  Square,
  MoreHorizontal,
  RotateCcw,
  Terminal,
  Edit3,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
  Database,
  Zap,
  Layers,
  FileBox,
  PieChart
} from 'lucide-react';
import ClientDiversityChart from './ClientDiversityChart';
import NetworkFilter from './NetworkFilter';

// Types
interface FleetNode {
  id: string;
  name: string;
  role: 'validator' | 'rpc' | 'archive' | 'bootnode' | 'fullnode' | 'masternode';
  region: string;
  status: 'healthy' | 'warning' | 'critical' | 'offline';
  version: string;
  blockHeight: number;
  peers: number;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  uptime: number;
  tags: string[];
  lastSeen: string;
  ip: string;
  syncPercent?: number;
  syncColor?: string;
  isSyncing?: boolean;
  fleetMaxBlock?: number;
  // Client diversity fields (Issue #68)
  clientType?: string;
  clientIcon?: string;
  clientColor?: string;
  nodeType?: string;
  syncMode?: string;
  chainDataSize?: number;
  databaseSize?: number;
  storageType?: string;
  iopsEstimate?: number;
  clientVersion?: string;
  // Network fields (Issue #68)
  network?: string;
  chainId?: number;
  // OS field for compact display
  os?: {
    type?: string;
    release?: string;
    arch?: string;
    kernel?: string;
  };
}

// Client distribution for diversity chart
interface ClientDistributionItem {
  type: string;
  count: number;
  color: string;
  icon?: string;
  percentage?: number;
}

// Network distribution
interface NetworkDistributionItem {
  network: string;
  count: number;
  percentage?: number;
}

interface FleetData {
  nodes: FleetNode[];
  incidents: {
    critical: number;
    warning: number;
    info: number;
    total: number;
  };
}

interface NetworkHealthData {
  totalNodes: number;
  healthyNodes: number;
  avgBlockHeight: number;
  maxBlockHeight: number;
  avgSyncPercent: number;
  avgRpcLatencyMs: number;
  totalPeers: number;
  nakamotoCoefficient: number;
  timestamp: string;
}

interface BlockHeightHistory {
  [nodeId: string]: number[];
}

interface PreviousBlockData {
  [nodeId: string]: { height: number; timestamp: number };
}

// Map API status to UI status
const mapStatus = (apiStatus: string): 'healthy' | 'warning' | 'critical' | 'offline' => {
  switch (apiStatus) {
    case 'healthy':
      return 'healthy';
    case 'syncing':
    case 'degraded':
      return 'warning';
    case 'offline':
      return 'offline';
    default:
      return 'offline';
  }
};

// Format time ago
const formatTimeAgo = (timestamp: string): string => {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
};

// Format bytes to human readable
const formatBytes = (bytes?: number): string => {
  if (!bytes || bytes === 0) return '—';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

// Format duration
const formatDuration = (minutes: number): string => {
  if (minutes < 1) return '< 1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
};

// Get resource usage color (green <50%, yellow 50-80%, red >80%)
const getResourceColor = (value: number): string => {
  if (value < 50) return '#10B981';
  if (value < 80) return '#F59E0B';
  return '#EF4444';
};

// Get OS icon based on OS type
const getOSIcon = (osType?: string): string => {
  if (!osType) return '🐧';
  const os = osType.toLowerCase();
  if (os.includes('darwin') || os.includes('mac')) return '🍎';
  if (os.includes('win')) return '🪟';
  return '🐧'; // Default to Linux
};

// Client badge component
function ClientBadge({ clientType }: { clientType?: string }) {
  const styles: Record<string, { bg: string; text: string; icon: string; label: string }> = {
    geth: { 
      bg: 'bg-blue-500/15', 
      text: 'text-blue-400',
      icon: '🔷',
      label: 'Geth'
    },
    erigon: { 
      bg: 'bg-orange-500/15', 
      text: 'text-orange-400',
      icon: '🔶',
      label: 'Erigon'
    },
    'geth-pr5': { 
      bg: 'bg-green-500/15', 
      text: 'text-green-400',
      icon: '🟢',
      label: 'Geth PR5'
    },
    nethermind: { 
      bg: 'bg-purple-500/15', 
      text: 'text-purple-400',
      icon: '🟣',
      label: 'Nethermind'
    },
    XDC: { 
      bg: 'bg-[#1E90FF]/15', 
      text: 'text-[#1E90FF]',
      icon: '⚡',
      label: 'XDC'
    },
  };
  
  const style = styles[clientType?.toLowerCase() || ''] || { 
    bg: 'bg-gray-500/15', 
    text: 'text-gray-400',
    icon: '⚪',
    label: clientType || 'Unknown'
  };
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
      <span>{style.icon}</span>
      {style.label}
    </span>
  );
}

// Node type badge
function NodeTypeBadge({ nodeType, syncMode }: { nodeType?: string; syncMode?: string }) {
  const getLabel = () => {
    if (nodeType === 'archive') return 'Archive';
    if (nodeType === 'full' || nodeType === 'fullnode') {
      if (syncMode === 'fast') return 'Fast Sync';
      if (syncMode === 'snap') return 'Snap Sync';
      return 'Full Node';
    }
    if (nodeType === 'masternode') return 'Masternode';
    if (nodeType === 'standby') return 'Standby';
    return nodeType || 'Full Node';
  };
  
  return (
    <span className="text-xs text-[#6B7280] bg-[rgba(255,255,255,0.05)] px-2 py-0.5 rounded">
      {getLabel()}
    </span>
  );
}

// Sparkline Component (Pure SVG)
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) {
    return <div className="h-6 flex items-center justify-center text-[12px] text-[#6B7280]">—</div>;
  }
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 100" className="w-full h-6" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke="#1E90FF"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

const regions = ['all'];
const roles = ['all', 'validator', 'rpc', 'archive', 'bootnode', 'fullnode', 'masternode'];
const statuses = ['all', 'healthy', 'warning', 'critical', 'offline'];

export default function FleetOverview() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [filterRegion, setFilterRegion] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTag, setFilterTag] = useState('');
  const [showActions, setShowActions] = useState<string | null>(null);
  
  // API state
  const [nodes, setNodes] = useState<FleetNode[]>([]);
  const [incidents, setIncidents] = useState({ critical: 0, warning: 0, info: 0, total: 0 });
  const [networkHealth, setNetworkHealth] = useState<NetworkHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Client diversity state (Issue #68)
  const [clientDistribution, setClientDistribution] = useState<ClientDistributionItem[]>([]);
  const [networkDistribution, setNetworkDistribution] = useState<NetworkDistributionItem[]>([]);
  const [filterNetwork, setFilterNetwork] = useState('all');
  const [fleetMaxBlock, setFleetMaxBlock] = useState(0);
  
  // Block height history for sparklines (rolling buffer of last 10 readings per node)
  const [blockHeightHistory, setBlockHeightHistory] = useState<BlockHeightHistory>({});
  
  // Previous block heights for calculating blocks/min and block increase
  const prevBlockDataRef = useRef<PreviousBlockData>({});
  const [blockIncreases, setBlockIncreases] = useState<{ [nodeId: string]: number }>({});

  // Fetch nodes from API with network filter (Issue #68)
  const fetchNodes = useCallback(async () => {
    try {
      setError(null);
      // Use the new overview endpoint with network filter
      const networkParam = filterNetwork !== 'all' ? `?network=${filterNetwork}` : '';
      const res = await fetch(`/api/v1/fleet/overview${networkParam}`, { cache: 'no-store' });
      
      if (!res.ok) {
        // Fallback to old endpoint if new one doesn't exist yet
        const fallbackRes = await fetch('/api/v1/fleet/status', { cache: 'no-store' });
        if (!fallbackRes.ok) {
          throw new Error(`Failed to fetch: ${fallbackRes.status} ${fallbackRes.statusText}`);
        }
        const fallbackData = await fallbackRes.json();
        const apiNodes = fallbackData.data?.nodes || [];
        const apiIncidents = fallbackData.data?.incidents || { critical: 0, warning: 0, info: 0, total: 0 };
        setIncidents(apiIncidents);
        // Process nodes with old format...
        const mappedNodes: FleetNode[] = apiNodes.map((node: any) => ({
          id: node.id || '',
          name: node.name || 'Unknown',
          role: (node.role || 'fullnode') as FleetNode['role'],
          region: node.region || 'unknown',
          status: mapStatus(node.status),
          version: node.clientVersion || node.client_version || 'Unknown',
          blockHeight: node.blockHeight || 0,
          peers: node.peerCount || 0,
          cpuUsage: node.cpuPercent !== null ? node.cpuPercent : 0,
          memoryUsage: node.memoryPercent !== null ? node.memoryPercent : 0,
          diskUsage: node.diskPercent !== null ? node.diskPercent : 0,
          uptime: node.uptime || 0,
          tags: node.tags || [],
          lastSeen: node.lastSeen || '',
          ip: node.host || node.ipv4 || '',
          syncPercent: node.syncPercent ?? 0,
          isSyncing: node.status === 'syncing',
          clientType: node.clientType || node.client_type || 'unknown',
          nodeType: node.nodeType || node.node_type,
          syncMode: node.syncMode || node.sync_mode,
          chainDataSize: node.chainDataSize || node.chain_data_size,
          databaseSize: node.databaseSize || node.database_size,
          storageType: node.storageType || node.storage_type,
          iopsEstimate: node.iopsEstimate || node.iops_estimate || 0,
          clientVersion: node.clientVersion || node.client_version,
        }));
        setNodes(mappedNodes);
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      const apiNodes = data.data?.nodes || [];
      const apiIncidents = data.data?.incidents || { critical: 0, warning: 0, info: 0, total: 0 };
      
      // Set client diversity data (Issue #68)
      setClientDistribution(data.data?.clientDistribution || []);
      setNetworkDistribution(data.data?.networkDistribution || []);
      setFleetMaxBlock(data.data?.fleetMaxBlock || 0);
      setIncidents(apiIncidents);
      
      const now = Date.now();
      
      // Calculate block increases since last fetch
      const newBlockIncreases: { [nodeId: string]: number } = {};
      
      // Map API response to FleetNode interface
      const mappedNodes: FleetNode[] = apiNodes.map((node: any) => {
        const prevData = prevBlockDataRef.current[node.id];
        if (prevData) {
          const increase = (node.blockHeight || 0) - prevData.height;
          if (increase > 0) {
            newBlockIncreases[node.id] = increase;
          }
        }
        
        return {
          id: node.id || '',
          name: node.name || 'Unknown',
          role: (node.role || 'fullnode') as FleetNode['role'],
          region: node.region || 'unknown',
          status: mapStatus(node.status),
          version: node.clientVersion || node.client_version || 'Unknown',
          blockHeight: node.blockHeight || 0,
          fleetMaxBlock: node.fleetMaxBlock || data.data?.fleetMaxBlock || 0,
          peers: node.peerCount || 0,
          cpuUsage: node.cpuPercent !== null ? node.cpuPercent : 0,
          memoryUsage: node.memoryPercent !== null ? node.memoryPercent : 0,
          diskUsage: node.diskPercent !== null ? node.diskPercent : 0,
          uptime: node.uptime || 0,
          tags: node.tags || [],
          lastSeen: node.lastSeen || '',
          ip: node.host || node.ipv4 || '',
          syncPercent: node.syncPercent ?? 0,
          syncColor: node.syncColor || (node.syncPercent > 99 ? 'green' : node.syncPercent >= 90 ? 'yellow' : 'red'),
          isSyncing: node.status === 'syncing',
          // Client diversity fields (Issue #68)
          clientType: node.clientType || node.client_type || 'unknown',
          clientIcon: node.clientIcon || '⚪',
          clientColor: node.clientColor || '#6B7280',
          nodeType: node.nodeType || node.node_type,
          syncMode: node.syncMode || node.sync_mode,
          chainDataSize: node.chainDataSize || node.chain_data_size,
          databaseSize: node.databaseSize || node.database_size,
          storageType: node.storageType || node.storage_type,
          iopsEstimate: node.iopsEstimate || node.iops_estimate || 0,
          clientVersion: node.clientVersion || node.client_version,
          // Network fields (Issue #68)
          network: node.network || 'mainnet',
          chainId: node.chainId,
        };
      });
      
      setNodes(mappedNodes);
      setBlockIncreases(newBlockIncreases);
      
      // Update previous block data for next comparison
      prevBlockDataRef.current = mappedNodes.reduce((acc, node) => {
        acc[node.id] = { height: node.blockHeight, timestamp: now };
        return acc;
      }, {} as PreviousBlockData);
      
      // Update block height history (keep last 10 readings)
      setBlockHeightHistory(prev => {
        const updated = { ...prev };
        mappedNodes.forEach(node => {
          if (!updated[node.id]) {
            updated[node.id] = [];
          }
          updated[node.id] = [...updated[node.id], node.blockHeight].slice(-10);
        });
        return updated;
      });
    } catch (err) {
      console.error('Error fetching nodes:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch nodes');
      setNodes([]);
    } finally {
      setLoading(false);
    }
  }, [filterNetwork]);

  // Fetch network health
  const fetchNetworkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/network/health', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNetworkHealth(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching network health:', err);
    }
  }, []);

  // Calculate max block height for blocks behind calculation
  const maxFleetBlock = useMemo(() => {
    return Math.max(...nodes.map(n => n.blockHeight), 0);
  }, [nodes]);
  const calculateBlocksPerMin = (nodeId: string, currentHeight: number): number | null => {
    const prev = prevBlockDataRef.current[nodeId];
    if (!prev) return null;
    
    const timeDiffMs = Date.now() - prev.timestamp;
    const timeDiffMin = timeDiffMs / (1000 * 60);
    
    if (timeDiffMin < 0.5) return null; // Not enough time passed
    
    const blockDiff = currentHeight - prev.height;
    return blockDiff / timeDiffMin;
  };

  // Calculate sync ETA with blocks behind
  const calculateSyncETA = (node: FleetNode, blocksPerMin: number | null): { eta: string | null; blocksBehind: number } | null => {
    const blocksBehind = maxFleetBlock - node.blockHeight;
    
    if (!node.isSyncing || (node.syncPercent ?? 0) >= 100) {
      return blocksBehind > 100 ? { eta: null, blocksBehind } : null;
    }
    
    if (!blocksPerMin || blocksPerMin <= 0) {
      return { eta: null, blocksBehind };
    }
    
    // Calculate ETA based on blocks behind
    const minutesRemaining = blocksBehind / blocksPerMin;
    
    return {
      eta: formatDuration(minutesRemaining),
      blocksBehind
    };
  };

  // Initial fetch
  useEffect(() => {
    fetchNodes();
    fetchNetworkHealth();
  }, [fetchNodes, fetchNetworkHealth]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNodes();
      fetchNetworkHealth();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchNodes, fetchNetworkHealth]);

  // Filter nodes
  const filteredNodes = useMemo(() => {
    return nodes.filter(node => {
      if (filterRegion !== 'all' && node.region !== filterRegion) return false;
      if (filterRole !== 'all' && node.role !== filterRole) return false;
      if (filterStatus !== 'all' && node.status !== filterStatus) return false;
      if (filterTag && !node.tags.some(t => t.toLowerCase().includes(filterTag.toLowerCase()))) return false;
      return true;
    });
  }, [nodes, filterRegion, filterRole, filterStatus, filterTag]);

  // Stats
  const stats = useMemo(() => {
    const total = filteredNodes.length;
    const healthy = filteredNodes.filter(n => n.status === 'healthy').length;
    const warning = filteredNodes.filter(n => n.status === 'warning').length;
    const critical = filteredNodes.filter(n => n.status === 'critical').length;
    const offline = filteredNodes.filter(n => n.status === 'offline').length;
    return { total, healthy, warning, critical, offline };
  }, [filteredNodes]);

  const handleSelectAll = () => {
    if (selectedNodes.size === filteredNodes.length) {
      setSelectedNodes(new Set());
    } else {
      setSelectedNodes(new Set(filteredNodes.map(n => n.id)));
    }
  };

  const handleSelectNode = (nodeId: string) => {
    const newSelected = new Set(selectedNodes);
    if (newSelected.has(nodeId)) {
      newSelected.delete(nodeId);
    } else {
      newSelected.add(nodeId);
    }
    setSelectedNodes(newSelected);
  };

  const handleBulkAction = (action: string) => {
    console.log(`Bulk ${action} for nodes:`, Array.from(selectedNodes));
    setSelectedNodes(new Set());
  };

  const handleNodeAction = (nodeId: string, action: string) => {
    console.log(`${action} node:`, nodeId);
    setShowActions(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return { bg: 'bg-[rgba(16,185,129,0.15)]', text: 'text-[var(--success)]', border: 'border-[rgba(16,185,129,0.3)]', icon: CheckCircle2 };
      case 'warning': return { bg: 'bg-[rgba(245,158,11,0.15)]', text: 'text-[var(--warning)]', border: 'border-[rgba(245,158,11,0.3)]', icon: AlertTriangle };
      case 'critical': return { bg: 'bg-[rgba(239,68,68,0.15)]', text: 'text-[var(--critical)]', border: 'border-[rgba(239,68,68,0.3)]', icon: AlertTriangle };
      case 'offline': return { bg: 'bg-[rgba(107,114,128,0.15)]', text: 'text-[#6B7280]', border: 'border-[rgba(107,114,128,0.3)]', icon: Square };
      default: return { bg: 'bg-[rgba(107,114,128,0.15)]', text: 'text-[#6B7280]', border: 'border-[rgba(107,114,128,0.3)]', icon: Activity };
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'validator': return '🏆';
      case 'rpc': return '🔌';
      case 'archive': return '📚';
      case 'bootnode': return '🚀';
      default: return '🖥️';
    }
  };

  const getUsageColor = (value: number) => {
    if (value < 50) return '#10B981';
    if (value < 80) return '#F59E0B';
    return '#EF4444';
  };
  
  const getPeerColor = (peers: number) => {
    if (peers >= 5) return 'text-[#10B981]';
    if (peers >= 1) return 'text-[#F59E0B]';
    return 'text-[#EF4444]';
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="card-xdc">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E90FF]/20 to-[#1E90FF]/10 flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-[var(--accent-blue)] animate-spin" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#F9FAFB]">Fleet Overview</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#6B7280]">Loading nodes...</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Loading skeleton grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="p-4 rounded-xl border bg-[var(--bg-card)] border-[rgba(255,255,255,0.06)]">
                <div className="h-4 bg-[rgba(255,255,255,0.1)] rounded mb-3 w-2/3"></div>
                <div className="h-3 bg-[rgba(255,255,255,0.1)] rounded mb-2"></div>
                <div className="h-3 bg-[rgba(255,255,255,0.1)] rounded mb-4 w-1/2"></div>
                <div className="space-y-2">
                  <div className="h-2 bg-[rgba(255,255,255,0.1)] rounded"></div>
                  <div className="h-2 bg-[rgba(255,255,255,0.1)] rounded"></div>
                  <div className="h-2 bg-[rgba(255,255,255,0.1)] rounded"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="card-xdc">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-xl bg-[rgba(239,68,68,0.15)] flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-[var(--critical)]" />
          </div>
          <h3 className="text-lg font-semibold text-[#F9FAFB] mb-2">Failed to Load Nodes</h3>
          <p className="text-sm text-[#6B7280] mb-4 text-center max-w-md">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              fetchNodes();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue)]/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty state
  if (nodes.length === 0 && !loading && !error) {
    return (
      <div className="card-xdc">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-xl bg-[rgba(107,114,128,0.15)] flex items-center justify-center mb-4">
            <Server className="w-8 h-8 text-[#6B7280]" />
          </div>
          <h3 className="text-lg font-semibold text-[#F9FAFB] mb-2">No Nodes Registered</h3>
          <p className="text-sm text-[#6B7280] mb-4 text-center max-w-md">
            No nodes have been registered to your fleet yet. Add a node to start monitoring.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-xdc">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E90FF]/20 to-[#1E90FF]/10 flex items-center justify-center">
            <Server className="w-5 h-5 text-[var(--accent-blue)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#F9FAFB]">Fleet Overview</h2>
            <div className="flex items-center gap-2">
              <span className="status-dot active" />
              <span className="text-sm text-[#6B7280]">{stats.total} nodes monitored</span>
            </div>
          </div>
        </div>

        {/* Stats Summary with Incidents */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-[rgba(16,185,129,0.15)] border border-[rgba(16,185,129,0.3)]">
            <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
            <span className="text-xs sm:text-sm font-medium text-[var(--success)]"><span className="sm:hidden">{stats.healthy}</span><span className="hidden sm:inline">{stats.healthy} Healthy</span></span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-[rgba(245,158,11,0.15)] border border-[rgba(245,158,11,0.3)]">
            <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />
            <span className="text-xs sm:text-sm font-medium text-[var(--warning)]"><span className="sm:hidden">{stats.warning}</span><span className="hidden sm:inline">{stats.warning} Warning</span></span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.3)]">
            <AlertTriangle className="w-4 h-4 text-[var(--critical)]" />
            <span className="text-xs sm:text-sm font-medium text-[var(--critical)]"><span className="sm:hidden">{stats.critical}</span><span className="hidden sm:inline">{stats.critical} Critical</span></span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-[rgba(107,114,128,0.15)] border border-[rgba(107,114,128,0.3)]">
            <Square className="w-4 h-4 text-[#6B7280]" />
            <span className="text-xs sm:text-sm font-medium text-[#6B7280]"><span className="sm:hidden">{stats.offline}</span><span className="hidden sm:inline">{stats.offline} Offline</span></span>
          </div>
        </div>
      </div>

      {/* Incidents Section */}
      {incidents.total > 0 && (
        <div className="mb-6 p-4 rounded-xl border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.05)]">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-[var(--critical)]" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-[#F9FAFB] mb-1">Active Incidents</h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-[var(--critical)]">{incidents.critical} Critical</span>
                <span className="text-[var(--warning)]">{incidents.warning} Warning</span>
                <span className="text-[#1E90FF]">{incidents.info} Info</span>
              </div>
            </div>
            <a 
              href="/incidents" 
              className="px-3 py-1.5 rounded-lg bg-[var(--accent-blue)] text-white text-sm hover:bg-[var(--accent-blue)]/90 transition-colors"
            >
              View All
            </a>
          </div>
        </div>
      )}

      {/* Network Health Card */}
      {networkHealth && (
        <div className="mb-6 p-4 rounded-xl border border-[rgba(30,144,255,0.3)] bg-[rgba(30,144,255,0.05)]">
          <div className="flex items-center gap-3 mb-3">
            <Globe className="w-5 h-5 text-[var(--accent-blue)]" />
            <h3 className="text-sm font-semibold text-[#F9FAFB]">Network Health</h3>
            <span className="text-xs text-[#6B7280] ml-auto">
              Updated {formatTimeAgo(networkHealth.timestamp)}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="text-center">
              <div className="text-xs text-[#6B7280] mb-1">Avg Block</div>
              <div className="text-lg font-bold font-mono text-[#1E90FF]">{networkHealth.avgBlockHeight.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-[#6B7280] mb-1">Max Block</div>
              <div className="text-lg font-bold font-mono text-[#10B981]">{networkHealth.maxBlockHeight.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-[#6B7280] mb-1">Nakamoto</div>
              <div className="text-lg font-bold font-mono text-[#8B5CF6]">{networkHealth.nakamotoCoefficient}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-[#6B7280] mb-1">Avg Latency</div>
              <div className="text-lg font-bold font-mono text-[#F59E0B]">{networkHealth.avgRpcLatencyMs.toFixed(1)}ms</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-[#6B7280] mb-1">Total Peers</div>
              <div className="text-lg font-bold font-mono text-[#EC4899]">{networkHealth.totalPeers.toLocaleString()}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-[#6B7280] mb-1">Health Score</div>
              <div className="text-lg font-bold font-mono text-[#10B981]">{Math.round((networkHealth.healthyNodes / networkHealth.totalNodes) * 100)}%</div>
            </div>
          </div>
        </div>
      )}

      {/* Client Diversity Section (Issue #68) */}
      {clientDistribution.length > 0 && (
        <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Client Diversity Chart */}
          <div className="p-4 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[var(--bg-card)]">
            <div className="flex items-center gap-3 mb-4">
              <PieChart className="w-5 h-5 text-[var(--accent-blue)]" />
              <h3 className="text-sm font-semibold text-[#F9FAFB]">Client Diversity</h3>
            </div>
            <ClientDiversityChart
              data={clientDistribution}
              total={nodes.length}
            />
          </div>

          {/* Network Distribution */}
          <div className="p-4 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[var(--bg-card)]">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="w-5 h-5 text-[var(--accent-blue)]" />
              <h3 className="text-sm font-semibold text-[#F9FAFB]">Network Distribution</h3>
            </div>
            <div className="space-y-3">
              {networkDistribution.map((item) => (
                <div
                  key={item.network}
                  className="flex items-center justify-between p-3 rounded-lg bg-[rgba(255,255,255,0.03)]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">
                      {item.network === 'mainnet' ? '🔷' : item.network === 'apothem' ? '🧪' : '⚙️'}
                    </span>
                    <span className="text-sm text-[#F9FAFB] capitalize">
                      {item.network === 'mainnet' ? 'XDC Mainnet' :
                       item.network === 'apothem' ? 'Apothem Testnet' :
                       item.network === 'devnet' ? 'Devnet' : item.network}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-[#F9FAFB]">{item.count}</span>
                    <span className="text-xs text-[#6B7280]">
                      {item.percentage?.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
              {networkDistribution.length === 0 && (
                <div className="text-center py-4 text-[#6B7280] text-sm">
                  No network data available
                </div>
              )}
            </div>
            
            {/* Fleet Max Block */}
            {fleetMaxBlock > 0 && (
              <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.06)]">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#6B7280]">Fleet Max Block</span>
                  <span className="text-sm font-bold font-mono text-[#10B981]">
                    {fleetMaxBlock.toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-6 p-3 sm:p-4 rounded-xl bg-[var(--bg-card)] border border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-2 text-[#6B7280]">
          <Filter className="w-4 h-4" />
          <span className="text-sm">Filters:</span>
        </div>
        
        <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-lg bg-[var(--bg-body)] border border-[rgba(255,255,255,0.1)] text-sm text-[#F9FAFB] focus:outline-none focus:border-[var(--accent-blue)] min-h-[44px]"
          >
            <option value="all">All Regions</option>
            {regions.filter(r => r !== 'all').map(r => (
              <option key={r} value={r}>{r.replace('-', ' ').toUpperCase()}</option>
            ))}
          </select>
          
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-lg bg-[var(--bg-body)] border border-[rgba(255,255,255,0.1)] text-sm text-[#F9FAFB] focus:outline-none focus:border-[var(--accent-blue)] min-h-[44px]"
          >
            <option value="all">All Roles</option>
            {roles.filter(r => r !== 'all').map(r => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-lg bg-[var(--bg-body)] border border-[rgba(255,255,255,0.1)] text-sm text-[#F9FAFB] focus:outline-none focus:border-[var(--accent-blue)] min-h-[44px]"
          >
            <option value="all">All Statuses</option>
            {statuses.filter(s => s !== 'all').map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          
          <input
            type="text"
            placeholder="Filter by tag..."
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-lg bg-[var(--bg-body)] border border-[rgba(255,255,255,0.1)] text-sm text-[#F9FAFB] placeholder-[#6B7280] focus:outline-none focus:border-[var(--accent-blue)] min-h-[44px]"
          />
          
          {/* Network Filter (Issue #68) */}
          <NetworkFilter
            value={filterNetwork}
            onChange={setFilterNetwork}
            className="w-full sm:w-auto"
          />
          
          <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => fetchNodes()}
            className="p-2 rounded-lg transition-colors text-[#6B7280] hover:text-[#F9FAFB] hover:bg-[rgba(255,255,255,0.05)]"
            title="Refresh nodes"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-[rgba(30,144,255,0.25)] text-[var(--accent-blue)]' : 'text-[#6B7280] hover:text-[#F9FAFB]'}`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-[rgba(30,144,255,0.25)] text-[var(--accent-blue)]' : 'text-[#6B7280] hover:text-[#F9FAFB]'}`}
          >
            <List className="w-4 h-4" />
          </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedNodes.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-[rgba(30,144,255,0.1)] border border-[rgba(30,144,255,0.3)]">
          <span className="text-sm text-[#F9FAFB]">{selectedNodes.size} nodes selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <button 
              onClick={() => handleBulkAction('restart')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(245,158,11,0.15)] text-[var(--warning)] hover:bg-[rgba(245,158,11,0.25)] transition-colors text-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restart
            </button>
            <button 
              onClick={() => handleBulkAction('update')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(30,144,255,0.15)] text-[var(--accent-blue)] hover:bg-[rgba(30,144,255,0.25)] transition-colors text-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Update
            </button>
            <button 
              onClick={() => setSelectedNodes(new Set())}
              className="px-3 py-1.5 rounded-lg text-[#6B7280] hover:text-[#F9FAFB] transition-colors text-sm"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4">
          {filteredNodes.map((node) => {
            const statusStyle = getStatusColor(node.status);
            const StatusIcon = statusStyle.icon;
            const isSelected = selectedNodes.has(node.id);
            const blocksPerMin = calculateBlocksPerMin(node.id, node.blockHeight);
            const historyData = blockHeightHistory[node.id] || [];
            const blockIncrease = blockIncreases[node.id] || 0;
            const syncInfo = calculateSyncETA(node, blocksPerMin);
            const blocksBehind = maxFleetBlock - node.blockHeight;
            const isStalled = node.isSyncing && blocksPerMin !== null && blocksPerMin < 0.5;
            
            return (
              <div 
                key={node.id}
                className={`relative p-3 sm:p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-[rgba(30,144,255,0.15)] border-[var(--accent-blue)]' 
                    : 'bg-[var(--bg-card)] border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]'
                }`}
                onClick={() => handleSelectNode(node.id)}
              >
                {/* Selection checkbox */}
                <div className="absolute top-3 left-3">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                    isSelected ? 'bg-[var(--accent-blue)] border-[var(--accent-blue)]' : 'border-[#6B7280]'
                  }`}>
                    {isSelected && <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                  </div>
                </div>
                
                {/* Actions menu */}
                <div className="absolute top-3 right-3">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowActions(showActions === node.id ? null : node.id);
                    }}
                    className="p-1 rounded hover:bg-[rgba(255,255,255,0.1)] text-[#6B7280] hover:text-[#F9FAFB] transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  
                  {showActions === node.id && (
                    <div className="absolute right-0 top-8 w-40 rounded-lg bg-[#1a2234] border border-[rgba(255,255,255,0.1)] shadow-lg z-10">
                      <Link href={`/nodes/${node.id}`} onClick={(e) => e.stopPropagation()}>
                        <button className="w-full px-3 py-2 text-left text-sm text-[#F9FAFB] hover:bg-[rgba(255,255,255,0.05)] flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5" /> Details
                        </button>
                      </Link>
                      <button onClick={(e) => { e.stopPropagation(); handleNodeAction(node.id, 'restart'); }} className="w-full px-3 py-2 text-left text-sm text-[#F9FAFB] hover:bg-[rgba(255,255,255,0.05)] flex items-center gap-2">
                        <RotateCcw className="w-3.5 h-3.5" /> Restart
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleNodeAction(node.id, 'logs'); }} className="w-full px-3 py-2 text-left text-sm text-[#F9FAFB] hover:bg-[rgba(255,255,255,0.05)] flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5" /> View Logs
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleNodeAction(node.id, 'edit'); }} className="w-full px-3 py-2 text-left text-sm text-[#F9FAFB] hover:bg-[rgba(255,255,255,0.05)] flex items-center gap-2">
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Node header */}
                <div className="flex items-start gap-3 mb-3 pt-6">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${statusStyle.bg}`}>
                    {getRoleIcon(node.role)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-[#F9FAFB] truncate">{node.name}</h3>
                    <p className="text-xs text-[#6B7280]">{node.id.slice(0, 8)} • {node.ip}</p>
                  </div>
                </div>
                
                {/* Client Badge + Node Type */}
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <ClientBadge clientType={node.clientType} />
                  <NodeTypeBadge nodeType={node.nodeType} syncMode={node.syncMode} />
                </div>
                
                {/* Status badge */}
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${statusStyle.bg} ${statusStyle.text} text-xs font-medium mb-3`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {node.status.charAt(0).toUpperCase() + node.status.slice(1)}
                </div>
                
                {/* Block Height Section - PROMINENT */}
                <div className="mb-3 p-3 rounded-lg bg-[rgba(30,144,255,0.1)] border border-[rgba(30,144,255,0.2)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#6B7280]">Block Height</span>
                    <div className="flex items-center gap-2">
                      {blockIncrease > 0 && (
                        <span className="text-xs text-[#10B981] font-medium">
                          +{blockIncrease}
                        </span>
                      )}
                      {blocksPerMin !== null && blocksPerMin > 0 && (
                        <span className="text-xs text-[#1E90FF] flex items-center gap-0.5">
                          <Zap className="w-3 h-3" />
                          {blocksPerMin.toFixed(1)}/min
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-lg font-bold font-mono text-[#1E90FF]">
                    {node.blockHeight.toLocaleString()}
                  </div>
                  {historyData.length > 1 && (
                    <div className="mt-2">
                      <Sparkline data={historyData} />
                    </div>
                  )}
                </div>
                
                {/* Sync Progress with ETA and Blocks Behind */}
                {/* Sync Progress Bar - Always visible with color coding (Issue #68) */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#6B7280]">Sync Progress</span>
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${
                        (node.syncPercent || 0) > 99 ? 'text-[#10B981]' :
                        (node.syncPercent || 0) >= 90 ? 'text-[#F59E0B]' : 'text-[#EF4444]'
                      }`}>{node.syncPercent?.toFixed(1)}%</span>
                      {blocksBehind > 0 && (
                        <span className="text-[#6B7280]">{blocksBehind.toLocaleString()} behind</span>
                      )}
                      {node.isSyncing && syncInfo?.eta && (
                        <span className="text-[#10B981]">~{syncInfo.eta} left</span>
                      )}
                      {isStalled && (
                        <span className="text-[#EF4444]">Stalled</span>
                      )}
                    </div>
                  </div>
                  <div className="w-full h-2 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all ${
                        (node.syncPercent || 0) > 99 ? 'bg-[#10B981]' :
                        (node.syncPercent || 0) >= 90 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
                      }`}
                      style={{ width: `${Math.min(node.syncPercent || 0, 100)}%` }} 
                    />
                  </div>
                  {node.isSyncing && blocksPerMin !== null && blocksPerMin > 0 && (
                    <div className="text-xs text-[#6B7280] mt-1 text-right">
                      {blocksPerMin.toFixed(0)} blocks/min
                    </div>
                  )}
                </div>
                
                {/* Connected Peers - VISIBLE */}
                <div className="mb-3 flex items-center justify-between p-2 rounded-lg bg-[rgba(255,255,255,0.02)]">
                  <div className="flex items-center gap-2">
                    <Users className={`w-4 h-4 ${getPeerColor(node.peers)}`} />
                    <span className="text-xs text-[#6B7280]">Peers</span>
                  </div>
                  <span className={`text-sm font-bold ${getPeerColor(node.peers)}`}>
                    {node.peers}
                  </span>
                </div>
                
                {/* Storage */}
                {(node.chainDataSize || node.databaseSize || node.storageType) ? (
                  <div className="mb-3 flex items-center justify-between p-2 rounded-lg bg-[rgba(255,255,255,0.02)]">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-[#6B7280]" />
                      <span className="text-xs text-[#6B7280]">Storage</span>
                      {node.storageType && node.storageType !== 'unknown' && (
                        <span className={`px-1.5 py-0.5 rounded text-[12px] font-medium ${
                          node.storageType.includes('NVMe') ? 'bg-[#10B981]/10 text-[#10B981]' :
                          node.storageType.includes('SSD') ? 'bg-[#3B82F6]/10 text-[#3B82F6]' :
                          'bg-[#F59E0B]/10 text-[#F59E0B]'
                        }`}>
                          {node.storageType}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {(node.iopsEstimate || 0) > 0 && (
                        <span className="text-[12px] text-[#6B7280]">~{((node.iopsEstimate || 0) / 1000).toFixed(1)}K IOPS</span>
                      )}
                      <span className="text-sm font-medium text-[#F9FAFB]">
                        {(node.chainDataSize || node.databaseSize) ? formatBytes(node.chainDataSize || node.databaseSize) : '—'}
                      </span>
                    </div>
                  </div>
                ) : null}
                
                {/* Compact Resource Display with OS Icon */}
                <div className="mb-3 p-2 rounded-lg bg-[rgba(255,255,255,0.03)]">
                  <div className="flex items-center gap-3">
                    {/* CPU */}
                    <div className="flex-1" title={`CPU: ${node.cpuUsage.toFixed(1)}%`}>
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <Cpu className="w-3 h-3 text-[#6B7280]" />
                        <span style={{ color: getResourceColor(node.cpuUsage) }}>
                          {node.cpuUsage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full h-1 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ 
                            width: `${Math.min(node.cpuUsage, 100)}%`,
                            backgroundColor: getResourceColor(node.cpuUsage)
                          }}
                        />
                      </div>
                    </div>
                    
                    {/* Memory */}
                    <div className="flex-1" title={`Memory: ${node.memoryUsage.toFixed(1)}%`}>
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <MemoryStick className="w-3 h-3 text-[#6B7280]" />
                        <span style={{ color: getResourceColor(node.memoryUsage) }}>
                          {node.memoryUsage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full h-1 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ 
                            width: `${Math.min(node.memoryUsage, 100)}%`,
                            backgroundColor: getResourceColor(node.memoryUsage)
                          }}
                        />
                      </div>
                    </div>
                    
                    {/* Disk */}
                    <div className="flex-1" title={`Disk: ${node.diskUsage.toFixed(1)}%`}>
                      <div className="flex items-center justify-between text-[10px] mb-0.5">
                        <HardDrive className="w-3 h-3 text-[#6B7280]" />
                        <span style={{ color: getResourceColor(node.diskUsage) }}>
                          {node.diskUsage.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full h-1 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ 
                            width: `${Math.min(node.diskUsage, 100)}%`,
                            backgroundColor: getResourceColor(node.diskUsage)
                          }}
                        />
                      </div>
                    </div>
                    
                    {/* OS Icon */}
                    <div className="flex-shrink-0" title={node.os?.type || 'Linux'}>
                      <span className="text-lg">{getOSIcon(node.os?.type)}</span>
                    </div>
                  </div>
                </div>
                
                {/* Footer info with Last Seen */}
                <div className="flex items-center justify-between text-xs text-[#6B7280] pt-3 border-t border-[rgba(255,255,255,0.06)]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo(node.lastSeen)}
                  </span>
                  <span className="truncate max-w-[100px]" title={node.version}>v{node.version?.slice(0, 15)}</span>
                </div>
                
                {/* Tags */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {node.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="px-1.5 py-0.5 rounded text-[12px] bg-[rgba(255,255,255,0.05)] text-[#6B7280]">
                      {tag}
                    </span>
                  ))}
                  {node.tags.length > 3 && (
                    <span className="px-1.5 py-0.5 rounded text-[12px] bg-[rgba(255,255,255,0.05)] text-[#6B7280]">+{node.tags.length - 3}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="overflow-x-auto rounded-xl border border-[rgba(255,255,255,0.06)]">
          <table className="w-full min-w-[1400px]">
            <thead className="bg-[var(--bg-card)]">
              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                <th className="text-left py-3 px-4">
                  <button onClick={handleSelectAll} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      selectedNodes.size === filteredNodes.length && filteredNodes.length > 0
                        ? 'bg-[var(--accent-blue)] border-[var(--accent-blue)]' 
                        : 'border-[#6B7280]'
                    }`}>
                      {selectedNodes.size === filteredNodes.length && filteredNodes.length > 0 && <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                    </div>
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Node</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Client</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Status</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Block Height</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Sync</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Peers</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Storage</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Resources</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Last Seen</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-[#6B7280]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.03)]">
              {filteredNodes.map((node) => {
                const statusStyle = getStatusColor(node.status);
                const StatusIcon = statusStyle.icon;
                const isSelected = selectedNodes.has(node.id);
                const blocksPerMin = calculateBlocksPerMin(node.id, node.blockHeight);
                const blockIncrease = blockIncreases[node.id] || 0;
                const syncInfo = calculateSyncETA(node, blocksPerMin);
                const blocksBehind = maxFleetBlock - node.blockHeight;
                const isStalled = node.isSyncing && blocksPerMin !== null && blocksPerMin < 0.5;
                
                return (
                  <tr key={node.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="py-3 px-4">
                      <div 
                        className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${
                          isSelected ? 'bg-[var(--accent-blue)] border-[var(--accent-blue)]' : 'border-[#6B7280]'
                        }`}
                        onClick={() => handleSelectNode(node.id)}
                      >
                        {isSelected && <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${statusStyle.bg}`}>
                          {getRoleIcon(node.role)}
                        </div>
                        <div>
                          <div className="font-medium text-[#F9FAFB]">{node.name}</div>
                          <div className="text-xs text-[#6B7280]">{node.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col gap-1">
                        <ClientBadge clientType={node.clientType} />
                        <span className="text-xs text-[#6B7280]">{node.nodeType || 'fullnode'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${statusStyle.bg} ${statusStyle.text} text-xs font-medium`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {node.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-[#1E90FF] font-semibold">{node.blockHeight.toLocaleString()}</div>
                      <div className="flex items-center gap-2 text-xs">
                        {blockIncrease > 0 && (
                          <span className="text-[#10B981]">+{blockIncrease}</span>
                        )}
                        {blocksPerMin !== null && blocksPerMin > 0 && (
                          <span className="text-[#6B7280]">{blocksPerMin.toFixed(1)}/min</span>
                        )}
                      </div>
                    </td>
                    {/* Sync Progress with color coding (Issue #68) */}
                    <td className="py-3 px-4">
                      <div className="w-28">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className={`font-semibold ${
                            (node.syncPercent || 0) > 99 ? 'text-[#10B981]' :
                            (node.syncPercent || 0) >= 90 ? 'text-[#F59E0B]' : 'text-[#EF4444]'
                          }`}>{node.syncPercent?.toFixed(1)}%</span>
                          {node.isSyncing && isStalled ? (
                            <span className="text-[#EF4444] text-[12px]">Stalled</span>
                          ) : node.isSyncing && syncInfo?.eta ? (
                            <span className="text-[#10B981] text-[12px]">~{syncInfo.eta}</span>
                          ) : (node.syncPercent || 0) > 99 ? (
                            <span className="text-[#10B981] text-[12px]">✓</span>
                          ) : null}
                        </div>
                        <div className="w-full h-1.5 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden mb-1">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              (node.syncPercent || 0) > 99 ? 'bg-[#10B981]' :
                              (node.syncPercent || 0) >= 90 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
                            }`}
                            style={{ width: `${Math.min(node.syncPercent || 0, 100)}%` }} 
                          />
                        </div>
                        {blocksBehind > 0 && (
                          <div className="text-[12px] text-[#6B7280]">{blocksBehind.toLocaleString()} behind</div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Users className={`w-4 h-4 ${getPeerColor(node.peers)}`} />
                        <span className={`font-semibold ${getPeerColor(node.peers)}`}>{node.peers}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-[#F9FAFB]">
                        {formatBytes(node.chainDataSize || node.databaseSize)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5" title={`CPU: ${node.cpuUsage.toFixed(1)}%`}>
                          <Cpu className="w-3.5 h-3.5" style={{ color: getResourceColor(node.cpuUsage) }} />
                          <span className="text-xs" style={{ color: getResourceColor(node.cpuUsage) }}>{node.cpuUsage.toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center gap-1.5" title={`Memory: ${node.memoryUsage.toFixed(1)}%`}>
                          <MemoryStick className="w-3.5 h-3.5" style={{ color: getResourceColor(node.memoryUsage) }} />
                          <span className="text-xs" style={{ color: getResourceColor(node.memoryUsage) }}>{node.memoryUsage.toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center gap-1.5" title={`Disk: ${node.diskUsage.toFixed(1)}%`}>
                          <HardDrive className="w-3.5 h-3.5" style={{ color: getResourceColor(node.diskUsage) }} />
                          <span className="text-xs" style={{ color: getResourceColor(node.diskUsage) }}>{node.diskUsage.toFixed(0)}%</span>
                        </div>
                        
                        <span className="text-lg ml-1" title={node.os?.type || 'Linux'}>{getOSIcon(node.os?.type)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-[#9CA3AF]">{formatTimeAgo(node.lastSeen)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/nodes/${node.id}`}>
                          <button 
                            className="p-1.5 rounded hover:bg-[rgba(30,144,255,0.15)] text-[#6B7280] hover:text-[var(--accent-blue)] transition-colors"
                            title="Details"
                          >
                            <Activity className="w-4 h-4" />
                          </button>
                        </Link>
                        <button 
                          onClick={() => handleNodeAction(node.id, 'restart')}
                          className="p-1.5 rounded hover:bg-[rgba(245,158,11,0.15)] text-[#6B7280] hover:text-[var(--warning)] transition-colors"
                          title="Restart"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleNodeAction(node.id, 'logs')}
                          className="p-1.5 rounded hover:bg-[rgba(30,144,255,0.15)] text-[#6B7280] hover:text-[var(--accent-blue)] transition-colors"
                          title="Logs"
                        >
                          <Terminal className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty state */}
      {filteredNodes.length === 0 && (
        <div className="text-center py-12">
          <Server className="w-12 h-12 text-[#6B7280] mx-auto mb-4" />
          <p className="text-[#6B7280]">No nodes match the selected filters</p>
          <button 
            onClick={() => {
              setFilterRegion('all');
              setFilterRole('all');
              setFilterStatus('all');
              setFilterTag('');
            }}
            className="mt-4 text-[var(--accent-blue)] hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
