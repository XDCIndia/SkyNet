'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Server, 
  AlertTriangle, 
  CheckCircle2, 
  X,
  RefreshCw,
  Cpu,
  HardDrive,
  MemoryStick,
  Activity,
  Clock,
  ArrowUp,
  ArrowDown,
  Globe,
  Terminal,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Play,
  Pause,
  Network,
  MapPin,
  Shield,
  Search,
  Download,
  RotateCcw,
  UserPlus,
  Wifi,
  Layers,
  Link2,
  Pickaxe,
  Monitor
} from 'lucide-react';

// Types
interface NodeDetail {
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
  // New fields
  ipv4?: string;
  ipv6?: string;
  os_info?: {
    type?: string;
    release?: string;
    arch?: string;
    kernel?: string;
  };
  client_type?: string;
  node_type?: string;
}

interface NodeStatus {
  blockHeight: number;
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
  coinbase: string;
  system: {
    cpuPercent: number;
    memoryPercent: number;
    diskPercent: number;
    diskUsedGb: number;
    diskTotalGb: number;
  } | null;
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
}

interface Incident {
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

interface Peer {
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

interface MetricHistory {
  timestamp: string;
  block_height: number;
  peer_count: number;
  cpu_percent: number;
  memory_percent: number;
}

function StatusIndicator({ status }: { status: 'healthy' | 'degraded' | 'offline' }) {
  const colors = {
    healthy: 'bg-[#10B981]',
    degraded: 'bg-[#F59E0B]',
    offline: 'bg-[#EF4444]',
  };
  
  return (
    <span className={`inline-flex w-3 h-3 rounded-full ${colors[status]} ${status !== 'healthy' ? 'animate-pulse' : ''}`} />
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    masternode: 'bg-[#1E90FF]/10 text-[#1E90FF] border-[#1E90FF]/20',
    fullnode: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20',
    archive: 'bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20',
    rpc: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20',
  };
  
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${colors[role] || colors.fullnode}`}>
      {role.toUpperCase()}
    </span>
  );
}

// Node Type Badge
function NodeTypeBadge({ nodeType }: { nodeType?: string }) {
  if (!nodeType) return null;
  
  const styles: Record<string, { bg: string; icon: React.ReactNode; label: string }> = {
    masternode: { 
      bg: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20', 
      icon: <Pickaxe className="w-3 h-3" />,
      label: 'Masternode'
    },
    standby: { 
      bg: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20', 
      icon: <Clock className="w-3 h-3" />,
      label: 'Standby'
    },
    fullnode: { 
      bg: 'bg-[#1E90FF]/10 text-[#1E90FF] border-[#1E90FF]/20', 
      icon: <Link2 className="w-3 h-3" />,
      label: 'Full Node'
    },
  };
  
  const style = styles[nodeType.toLowerCase()] || styles.fullnode;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border ${style.bg}`}>
      {style.icon}
      {style.label}
    </span>
  );
}

// Client Type Badge
function ClientTypeBadge({ clientType }: { clientType?: string }) {
  if (!clientType || clientType === 'Unknown') return null;
  
  const styles: Record<string, { bg: string; icon: React.ReactNode }> = {
    XDC: { 
      bg: 'bg-[#1E90FF]/10 text-[#1E90FF] border-[#1E90FF]/20', 
      icon: <Terminal className="w-3 h-3" /> 
    },
    Erigon: { 
      bg: 'bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20', 
      icon: <Layers className="w-3 h-3" /> 
    },
    Geth: { 
      bg: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20', 
      icon: <Globe className="w-3 h-3" /> 
    },
  };
  
  const style = styles[clientType] || { bg: 'bg-white/5 text-[#6B7280] border-white/10', icon: <Terminal className="w-3 h-3" /> };
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border ${style.bg}`}>
      {style.icon}
      {clientType}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: 'critical' | 'warning' | 'info' }) {
  const styles = {
    critical: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20',
    warning: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20',
    info: 'bg-[#1E90FF]/10 text-[#1E90FF] border-[#1E90FF]/20',
  };
  
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${styles[severity]}`}>
      {severity.toUpperCase()}
    </span>
  );
}

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

// Circular Gauge Component
function CircularGauge({ 
  value, 
  max = 100, 
  label, 
  sublabel,
  color = '#1E90FF'
}: { 
  value: number; 
  max?: number; 
  label: string; 
  sublabel?: string;
  color?: string;
}) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(value, max) / max) * circumference;
  
  const getColor = () => {
    if (value > 90) return '#EF4444';
    if (value > 75) return '#F59E0B';
    return color;
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="80" height="80" className="transform -rotate-90">
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="8"
          />
          <circle
            cx="40"
            cy="40"
            r={radius}
            fill="none"
            stroke={getColor()}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold font-mono-nums" style={{ color: getColor() }}>
            {Math.round(value)}%
          </span>
        </div>
      </div>
      <span className="text-xs text-[#6B7280] mt-2">{label}</span>
      {sublabel && <span className="text-xs text-[#6B7280]">{sublabel}</span>}
    </div>
  );
}

// Sparkline Component
function Sparkline({ data, color = '#1E90FF', height = 40 }: { data: number[]; color?: string; height?: number }) {
  if (data.length === 0) return <div className="h-[40px] bg-white/5 rounded" />;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1 || 1)) * 100;
    const y = 100 - ((value - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 100" className="w-full" style={{ height }} preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// Metrics History Chart
function MetricsChart({ data, series }: { data: MetricHistory[]; series: string[] }) {
  const width = 800;
  const height = 250;
  const padding = { top: 20, right: 30, bottom: 40, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  const getY = (value: number, min: number, max: number) => {
    const range = max - min || 1;
    return padding.top + chartHeight - ((value - min) / range) * chartHeight;
  };

  const getX = (index: number) => padding.left + (index / (data.length - 1 || 1)) * chartWidth;

  const colors: Record<string, string> = {
    block_height: '#1E90FF',
    peer_count: '#10B981',
    cpu_percent: '#F59E0B',
    memory_percent: '#8B5CF6',
  };

  const generatePath = (key: keyof MetricHistory) => {
    const values = data.map(d => d[key] as number);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    return data.map((d, i) => 
      `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d[key] as number, min, max)}`
    ).join(' ');
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[600px]">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line
            key={t}
            x1={padding.left}
            y1={padding.top + t * chartHeight}
            x2={width - padding.right}
            y2={padding.top + t * chartHeight}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
        ))}
        
        {/* Series lines */}
        {series.includes('block_height') && (
          <path d={generatePath('block_height')} fill="none" stroke={colors.block_height} strokeWidth="2" strokeLinecap="round" />
        )}
        {series.includes('peer_count') && (
          <path d={generatePath('peer_count')} fill="none" stroke={colors.peer_count} strokeWidth="2" strokeLinecap="round" strokeDasharray="4,4" />
        )}
        {series.includes('cpu_percent') && (
          <path d={generatePath('cpu_percent')} fill="none" stroke={colors.cpu_percent} strokeWidth="2" strokeLinecap="round" />
        )}
        {series.includes('memory_percent') && (
          <path d={generatePath('memory_percent')} fill="none" stroke={colors.memory_percent} strokeWidth="2" strokeLinecap="round" />
        )}
        
        {/* X-axis labels (every 6th point) */}
        {data.filter((_, i) => i % 6 === 0).map((d, i) => (
          <text
            key={i}
            x={getX(i * 6)}
            y={height - 10}
            textAnchor="middle"
            fill="#6B7280"
            fontSize="10"
          >
            {new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </text>
        ))}
      </svg>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2 flex-wrap">
        {series.map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className="w-4 h-1 rounded" style={{ backgroundColor: colors[s] }} />
            <span className="text-xs text-[#6B7280]">{s.replace('_', ' ').toUpperCase()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Toast Component
function Toast({ message, type = 'success', onClose }: { message: string; type?: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-24 right-6 bg-[#111827] border border-white/10 rounded-lg px-4 py-3 shadow-lg z-50 flex items-center gap-3 animate-fade-in">
      {type === 'success' ? (
        <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
      ) : (
        <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
      )}
      <span className="text-sm">{message}</span>
      <button onClick={onClose} className="text-[#6B7280] hover:text-white">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function NodeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const nodeId = params.id as string;
  
  const [node, setNode] = useState<NodeDetail | null>(null);
  const [status, setStatus] = useState<NodeStatus | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [metrics, setMetrics] = useState<MetricHistory[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  const [expandedPeers, setExpandedPeers] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<string[]>(['block_height', 'peer_count']);
  
  const [sortField, setSortField] = useState<keyof Peer>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Calculate status from last seen
  const nodeStatus = useMemo(() => {
    if (!status?.lastSeen) return 'offline';
    const diff = Date.now() - new Date(status.lastSeen).getTime();
    if (diff < 2 * 60 * 1000) return 'healthy';
    if (diff < 5 * 60 * 1000) return 'degraded';
    return 'offline';
  }, [status?.lastSeen]);

  // Fetch all node data
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      
      const [statusRes, incidentsRes, peersRes, metricsRes] = await Promise.all([
        fetch(`/api/v1/nodes/${nodeId}/status`, { cache: 'no-store' }),
        fetch(`/api/incidents?nodeId=${nodeId}&limit=20`, { cache: 'no-store' }),
        fetch(`/api/v1/nodes/${nodeId}/peers`, { cache: 'no-store' }).catch(() => null),
        fetch(`/api/v1/nodes/${nodeId}/metrics/history?hours=24`, { cache: 'no-store' }),
      ]);

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setNode(statusData.node);
        setStatus(statusData.status);
      } else if (statusRes.status === 404) {
        setError('Node not found');
        return;
      }

      if (incidentsRes.ok) {
        const incidentsData = await incidentsRes.json();
        setIncidents(incidentsData.incidents);
      }

      if (peersRes?.ok) {
        const peersData = await peersRes.json();
        setPeers(peersData.peers);
      }

      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData.history);
      }
    } catch (err) {
      console.error('Error fetching node data:', err);
      setError('Failed to fetch node data');
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Fetch logs
  const fetchLogs = async (lines: number = 100, filter?: string) => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/v1/nodes/${nodeId}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lines, filter }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
        setExpandedLogs(true);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
      setToast({ message: 'Failed to fetch logs', type: 'error' });
    } finally {
      setLogsLoading(false);
    }
  };

  // Quick actions
  const handleRestart = async () => {
    try {
      const res = await fetch(`/api/v1/nodes/${nodeId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'restart', params: {} }),
      });
      
      if (res.ok) {
        setToast({ message: 'Restart command queued', type: 'success' });
      }
    } catch (err) {
      setToast({ message: 'Failed to queue restart', type: 'error' });
    }
  };

  const handleForceSync = async () => {
    try {
      const res = await fetch(`/api/v1/nodes/${nodeId}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'force_sync', params: {} }),
      });
      
      if (res.ok) {
        setToast({ message: 'Force sync command queued', type: 'success' });
      }
    } catch (err) {
      setToast({ message: 'Failed to queue force sync', type: 'error' });
    }
  };

  const handleResolveIncident = async (incidentId: number) => {
    try {
      const res = await fetch('/api/incidents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: incidentId, status: 'resolved' }),
      });
      
      if (res.ok) {
        setToast({ message: 'Incident resolved', type: 'success' });
        fetchData();
      }
    } catch (err) {
      setToast({ message: 'Failed to resolve incident', type: 'error' });
    }
  };

  // Sort peers
  const sortedPeers = useMemo(() => {
    const sorted = [...peers];
    sorted.sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [peers, sortField, sortDirection]);

  const handleSort = (field: keyof Peer) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    if (!logFilter) return logs;
    return logs.filter(log => log.toLowerCase().includes(logFilter.toLowerCase()));
  }, [logs, logFilter]);

  // Trend calculation
  const getTrend = (current: number, key: keyof MetricHistory) => {
    if (metrics.length < 2) return null;
    const previous = metrics[metrics.length - 2]?.[key] as number;
    if (!previous) return null;
    return current > previous ? 'up' : current < previous ? 'down' : 'same';
  };

  // Format OS info for display
  const formatOSInfo = () => {
    const os = status?.os || node?.os_info;
    if (!os) return null;
    const parts = [];
    if (os.release) parts.push(os.release);
    if (os.arch) parts.push(os.arch);
    if (os.kernel) parts.push(`Kernel ${os.kernel}`);
    return parts.join(' · ');
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <RefreshCw className="w-8 h-8 animate-spin text-[#1E90FF]" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <AlertTriangle className="w-12 h-12 text-[#EF4444] mb-4" />
          <h2 className="text-xl font-semibold mb-2">{error}</h2>
          <button 
            onClick={() => router.push('/fleet')}
            className="mt-4 px-4 py-2 bg-[#1E90FF] text-white rounded-lg hover:bg-[#1E90FF]/90"
          >
            Back to Fleet
          </button>
        </div>
      </DashboardLayout>
    );
  }

  if (!node || !status) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <Server className="w-12 h-12 text-[#6B7280] mb-4" />
          <h2 className="text-xl font-semibold">Node not found</h2>
        </div>
      </DashboardLayout>
    );
  }

  const activeIncidents = incidents.filter(i => i.status === 'active');
  const blockHeightTrend = getTrend(status.blockHeight, 'block_height');
  const peerTrend = getTrend(status.peerCount, 'peer_count');
  const osInfo = formatOSInfo();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[rgba(30,144,255,0.1)] flex items-center justify-center">
              <Server className="w-6 h-6 text-[#1E90FF]" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-semibold text-[#F9FAFB]">{node.name}</h1>
                <RoleBadge role={node.role} />
                <StatusIndicator status={nodeStatus} />
              </div>
              <div className="flex items-center gap-4 text-sm text-[#6B7280] mt-1 flex-wrap">
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {node.host}
                </span>
                {status.coinbase && (
                  <span className="font-mono text-xs">
                    {status.coinbase.slice(0, 20)}...{status.coinbase.slice(-8)}
                  </span>
                )}
                {node.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {node.location.city}, {node.location.country}
                  </span>
                )}
              </div>
              
              {/* Node Type and Client Type Badges */}
              <div className="flex items-center gap-2 mt-2">
                <NodeTypeBadge nodeType={status.nodeType || node.node_type} />
                <ClientTypeBadge clientType={status.clientType || node.client_type} />
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => router.push('/')}
              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            
            <div className="text-right mr-4">
              <div className="text-xs text-[#6B7280]">Last seen</div>
              <div className="text-sm font-medium">{formatTimeAgo(status.lastSeen)}</div>
            </div>
            <button
              onClick={handleRestart}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Restart
            </button>
            <button
              onClick={handleForceSync}
              className="flex items-center gap-2 px-4 py-2 bg-[#1E90FF]/10 hover:bg-[#1E90FF]/20 text-[#1E90FF] rounded-lg text-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Force Sync
            </button>
            <button
              onClick={() => setToast({ message: 'Add peers dialog not implemented', type: 'error' })}
              className="flex items-center gap-2 px-4 py-2 bg-[#10B981]/10 hover:bg-[#10B981]/20 text-[#10B981] rounded-lg text-sm transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Add Peers
            </button>
          </div>
        </div>

        {/* System Info Card - New */}
        {(status.ipv4 || status.ipv6 || osInfo) && (
          <div className="card-xdc">
            <div className="flex items-center gap-3 mb-4">
              <Monitor className="w-5 h-5 text-[#1E90FF]" />
              <h2 className="text-lg font-semibold">System Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* IPv4 */}
              {status.ipv4 && (
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-[10px] uppercase text-[#6B7280] mb-1">Public IPv4</div>
                  <div className="text-sm font-mono text-[#1E90FF]">{status.ipv4}</div>
                </div>
              )}
              
              {/* IPv6 */}
              {status.ipv6 && (
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-[10px] uppercase text-[#6B7280] mb-1">Public IPv6</div>
                  <div className="text-sm font-mono text-[#6B7280] truncate" title={status.ipv6}>
                    {status.ipv6.length > 30 ? status.ipv6.slice(0, 30) + '...' : status.ipv6}
                  </div>
                </div>
              )}
              
              {/* OS Info */}
              {osInfo && (
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-[10px] uppercase text-[#6B7280] mb-1">Operating System</div>
                  <div className="text-sm text-[#F9FAFB]">{osInfo}</div>
                </div>
              )}
              
              {/* Client Version */}
              {status.clientVersion && (
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-[10px] uppercase text-[#6B7280] mb-1">Client Version</div>
                  <div className="text-sm text-[#F9FAFB] truncate" title={status.clientVersion}>
                    {status.clientVersion}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Block Height */}
          <div className="card-xdc">
            <div className="text-xs text-[#6B7280] mb-1">Block Height</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono-nums">{status.blockHeight?.toLocaleString() || '—'}</span>
              {blockHeightTrend && (
                blockHeightTrend === 'up' ? <ArrowUp className="w-4 h-4 text-[#10B981]" /> :
                blockHeightTrend === 'down' ? <ArrowDown className="w-4 h-4 text-[#EF4444]" /> : null
              )}
            </div>
            <div className="h-[30px] mt-2">
              <Sparkline 
                data={metrics.slice(-30).map(m => m.block_height).filter(Boolean)} 
                color="#1E90FF" 
                height={30}
              />
            </div>
          </div>

          {/* Sync Progress */}
          <div className="card-xdc">
            <div className="text-xs text-[#6B7280] mb-1">Sync Status</div>
            {status.isSyncing ? (
              <div className="flex flex-col items-center">
                <CircularGauge 
                  value={status.syncPercent || 0} 
                  label="Syncing" 
                  color="#F59E0B"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[80px]">
                <CheckCircle2 className="w-8 h-8 text-[#10B981] mb-1" />
                <span className="text-sm text-[#10B981]">Synced ✓</span>
              </div>
            )}
          </div>

          {/* Peer Count */}
          <div className="card-xdc">
            <div className="text-xs text-[#6B7280] mb-1">Peers</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono-nums">{status.peerCount || 0}</span>
              {peerTrend && (
                peerTrend === 'up' ? <ArrowUp className="w-4 h-4 text-[#10B981]" /> :
                peerTrend === 'down' ? <ArrowDown className="w-4 h-4 text-[#EF4444]" /> : null
              )}
            </div>
            <div className="text-xs text-[#6B7280] mt-1">
              {status.activePeers} active connections
            </div>
          </div>

          {/* TX Pool */}
          <div className="card-xdc">
            <div className="text-xs text-[#6B7280] mb-1">TX Pool</div>
            <div className="text-2xl font-bold font-mono-nums">
              {(status.txPoolPending || 0) + (status.txPoolQueued || 0)}
            </div>
            <div className="flex gap-2 mt-1 text-xs">
              <span className="text-[#F59E0B]">{status.txPoolPending || 0} pending</span>
              <span className="text-[#6B7280]">|</span>
              <span className="text-[#6B7280]">{status.txPoolQueued || 0} queued</span>
            </div>
          </div>

          {/* Gas Price */}
          <div className="card-xdc">
            <div className="text-xs text-[#6B7280] mb-1">Gas Price</div>
            <div className="text-2xl font-bold font-mono-nums">
              {status.gasPrice ? (BigInt(status.gasPrice) / BigInt(1e9)).toString() : '—'}
            </div>
            <div className="text-xs text-[#6B7280] mt-1">Gwei</div>
          </div>

          {/* RPC Latency */}
          <div className="card-xdc">
            <div className="text-xs text-[#6B7280] mb-1">RPC Latency</div>
            <div className="text-2xl font-bold font-mono-nums">
              {status.rpcLatencyMs || '—'}
            </div>
            <div className="text-xs text-[#6B7280] mt-1">ms</div>
          </div>
        </div>

        {/* System Resources */}
        <div className="card-xdc">
          <div className="flex items-center gap-3 mb-4">
            <Activity className="w-5 h-5 text-[#1E90FF]" />
            <h2 className="text-lg font-semibold">System Resources</h2>
          </div>
          
          <div className="grid grid-cols-3 gap-8">
            <CircularGauge 
              value={status.system?.cpuPercent || 0} 
              label="CPU" 
            />
            <CircularGauge 
              value={status.system?.memoryPercent || 0} 
              label="Memory" 
            />
            <CircularGauge 
              value={status.system?.diskPercent || 0} 
              label="Disk"
              sublabel={status.system ? `${Math.round(status.system.diskUsedGb)} / ${Math.round(status.system.diskTotalGb)} GB` : undefined}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Peer List */}
          <div className="card-xdc">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Network className="w-5 h-5 text-[#1E90FF]" />
                <h2 className="text-lg font-semibold">Connected Peers</h2>
              </div>
              <button
                onClick={() => setExpandedPeers(!expandedPeers)}
                className="text-[#6B7280] hover:text-white"
              >
                {expandedPeers ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 px-2 text-xs font-medium text-[#6B7280] cursor-pointer" onClick={() => handleSort('name')}>Name</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-[#6B7280] cursor-pointer" onClick={() => handleSort('ip')}>IP</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-[#6B7280] cursor-pointer" onClick={() => handleSort('direction')}>Dir</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-[#6B7280] cursor-pointer" onClick={() => handleSort('country')}>Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedPeers.slice(0, expandedPeers ? undefined : 5).map((peer) => (
                    <tr key={peer.id} className="hover:bg-white/[0.02]">
                      <td className="py-2 px-2 text-sm">
                        <div className="truncate max-w-[150px]" title={peer.name}>
                          {peer.name?.slice(0, 30) || 'Unknown'}
                        </div>
                        <div className="text-xs text-[#6B7280] font-mono truncate max-w-[150px]">
                          {peer.enode?.slice(0, 30)}...
                        </div>
                      </td>
                      <td className="py-2 px-2 text-xs font-mono">{peer.ip}</td>
                      <td className="py-2 px-2">
                        <span className={`text-xs ${peer.direction === 'inbound' ? 'text-[#10B981]' : 'text-[#1E90FF]'}`}>
                          {peer.direction === 'inbound' ? 'In' : 'Out'}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-xs">
                        {peer.city && peer.country ? `${peer.city}, ${peer.country}` : 'Unknown'}
                      </td>
                    </tr>
                  ))}
                  {sortedPeers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-[#6B7280]">No peers connected</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Incident History */}
          <div className="card-xdc">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-[#EF4444]" />
                <h2 className="text-lg font-semibold">Incidents</h2>
                {activeIncidents.length > 0 && (
                  <span className="px-2 py-0.5 bg-[#EF4444]/10 text-[#EF4444] rounded text-xs">
                    {activeIncidents.length} active
                  </span>
                )}
              </div>
            </div>
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {incidents.length === 0 ? (
                <div className="text-center py-6 text-[#6B7280]">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#10B981]" />
                  <p>No incidents recorded</p>
                </div>
              ) : (
                incidents.map((incident) => (
                  <div 
                    key={incident.id} 
                    className={`p-3 rounded-lg border ${
                      incident.status === 'active' 
                        ? 'bg-[#EF4444]/5 border-[#EF4444]/20' 
                        : 'bg-white/5 border-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={incident.severity} />
                        <span className="text-sm font-medium">{incident.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#6B7280]">{formatTimeAgo(incident.detected_at)}</span>
                        {incident.status === 'active' && (
                          <button
                            onClick={() => handleResolveIncident(incident.id)}
                            className="px-2 py-1 bg-[#10B981]/10 text-[#10B981] rounded text-xs hover:bg-[#10B981]/20"
                          >
                            Resolve
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-[#F9FAFB] mt-1">{incident.title}</p>
                    {incident.description && (
                      <p className="text-xs text-[#6B7280] mt-1">{incident.description}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Logs Section */}
        <div className="card-xdc">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Terminal className="w-5 h-5 text-[#6B7280]" />
              <h2 className="text-lg font-semibold">Node Logs</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchLogs(100)}
                disabled={logsLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded text-sm transition-colors disabled:opacity-50"
              >
                {logsLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Fetch Latest 100
              </button>
              <button
                onClick={() => setExpandedLogs(!expandedLogs)}
                className="text-[#6B7280] hover:text-white"
              >
                {expandedLogs ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          {expandedLogs && (
            <>
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  <input
                    type="text"
                    placeholder="Filter logs..."
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-[#1E90FF]"
                  />
                </div>
                <button
                  onClick={() => fetchLogs(100, 'error')}
                  className="px-3 py-2 bg-[#EF4444]/10 text-[#EF4444] rounded-lg text-sm hover:bg-[#EF4444]/20"
                >
                  Errors Only
                </button>
              </div>
              
              <div className="bg-[#0A0E1A] rounded-lg p-3 font-mono text-xs h-[300px] overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-center text-[#6B7280] py-8">
                    Click "Fetch Latest 100" to load logs
                  </div>
                ) : (
                  filteredLogs.map((log, i) => (
                    <div 
                      key={i} 
                      className={`py-0.5 ${
                        log.toLowerCase().includes('error') ? 'text-[#EF4444]' :
                        log.toLowerCase().includes('warn') ? 'text-[#F59E0B]' :
                        'text-[#6B7280]'
                      }`}
                    >
                      {log}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Metrics History Chart */}
        <div className="card-xdc">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-[#1E90FF]" />
              <h2 className="text-lg font-semibold">24h Metrics History</h2>
            </div>
            <div className="flex gap-2">
              {['block_height', 'peer_count', 'cpu_percent', 'memory_percent'].map((series) => (
                <button
                  key={series}
                  onClick={() => {
                    setSelectedSeries(prev => 
                      prev.includes(series) 
                        ? prev.filter(s => s !== series)
                        : [...prev, series]
                    );
                  }}
                  className={`px-3 py-1 rounded text-xs transition-colors ${
                    selectedSeries.includes(series)
                      ? 'bg-[#1E90FF]/20 text-[#1E90FF]'
                      : 'bg-white/5 text-[#6B7280]'
                  }`}
                >
                  {series.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
          
          {metrics.length > 0 ? (
            <MetricsChart data={metrics} series={selectedSeries} />
          ) : (
            <div className="text-center py-8 text-[#6B7280]">
              No metrics history available
            </div>
          )}
        </div>
      </div>
      
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </DashboardLayout>
  );
}
