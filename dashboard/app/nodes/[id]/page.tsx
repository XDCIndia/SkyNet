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
  Activity,
  Clock,
  Globe,
  Terminal,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Network,
  MapPin,
  Shield,
  Search,
  Download,
  RotateCcw,
  UserPlus,
  Layers,
  Link2,
  Pickaxe,
  Monitor,
  Copy,
  Check,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Info,
  Trash2,
} from 'lucide-react';

// Import the new components
import { 
  HeroSection,
  SyncPanel,
  ServerStats,
  StoragePanel,
  TroubleshootPanel,
  PeerMap,
  TxPoolPanel,
  type NodeDetail,
  type NodeStatus,
  type MetricHistory,
  type Incident,
  type Peer,
  type SentryInfo,
} from './components';

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

// Client Logo Component
function ClientLogo({ clientType, size = 'md' }: { clientType?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-lg',
  };
  
  const styles: Record<string, { bg: string; color: string; letter: string }> = {
    XDC: { bg: 'bg-[#1E90FF]/20', color: 'text-[#1E90FF]', letter: 'X' },
    Erigon: { bg: 'bg-orange-500/20', color: 'text-orange-400', letter: 'E' },
    Geth: { bg: 'bg-gray-500/20', color: 'text-gray-400', letter: 'G' },
  };
  
  const style = styles[clientType || 'Unknown'] || { bg: 'bg-white/10', color: 'text-[#64748B]', letter: '?' };
  
  return (
    <div className={`${sizeClasses[size]} ${style.bg} ${style.color} rounded-lg flex items-center justify-center font-bold border border-white/10`}>
      {style.letter}
    </div>
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

// Copy to clipboard hook
function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);
  
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      return false;
    }
  };
  
  return { copied, copy };
}

// Security Score Gauge
function SecurityGauge({ score = 0 }: { score?: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  const getColor = () => {
    if (score >= 90) return '#10B981';
    if (score >= 70) return '#1E90FF';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  };
  
  const getLabel = () => {
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    if (score >= 50) return 'Fair';
    return 'Poor';
  };
  
  const color = getColor();
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="90" height="90" className="transform -rotate-90">
          <circle cx="45" cy="45" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="10" />
          <circle
            cx="45" cy="45" r={radius} fill="none" stroke={color} strokeWidth="10"
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold font-mono-nums" style={{ color }}>{score}</span>
          <span className="text-[12px] text-[#64748B] uppercase">Score</span>
        </div>
      </div>
      <span className="text-sm font-medium mt-2" style={{ color }}>{getLabel()}</span>
    </div>
  );
}

// Security Suggestions Component
function SecuritySuggestions({ issues }: { issues?: string }) {
  if (!issues) {
    return (
      <div className="flex items-center gap-2 text-[#10B981]">
        <ShieldCheck className="w-5 h-5" />
        <span>All security checks passed</span>
      </div>
    );
  }
  
  const issueList = issues.split(',').filter(Boolean);
  
  const issueMap: Record<string, { icon: React.ReactNode; text: string }> = {
    ssh_default_port: { icon: <AlertCircle className="w-4 h-4 text-[#F59E0B]" />, text: 'SSH running on default port 22 — Change to non-standard port' },
    root_login_enabled: { icon: <AlertCircle className="w-4 h-4 text-[#F59E0B]" />, text: 'Root login via SSH is enabled — Disable in /etc/ssh/sshd_config' },
    no_firewall: { icon: <ShieldAlert className="w-4 h-4 text-[#EF4444]" />, text: 'No active firewall (UFW) — Install and enable UFW' },
    no_fail2ban: { icon: <ShieldAlert className="w-4 h-4 text-[#F59E0B]" />, text: 'Fail2ban is not running — Install fail2ban to protect against brute force' },
    no_auto_updates: { icon: <Info className="w-4 h-4 text-[#F59E0B]" />, text: 'Unattended upgrades not installed — Enable automatic security updates' },
    rpc_exposed: { icon: <ShieldAlert className="w-4 h-4 text-[#EF4444]" />, text: 'RPC API exposed to all interfaces (0.0.0.0) — Bind to 127.0.0.1 only' },
    docker_root: { icon: <Info className="w-4 h-4 text-[#F59E0B]" />, text: 'Docker running as root — Consider rootless Docker mode' },
  };
  
  return (
    <div className="space-y-2">
      {issueList.map((issue) => {
        const mapped = issueMap[issue];
        if (!mapped) return null;
        return (
          <div key={issue} className="flex items-start gap-2 text-sm">
            {mapped.icon}
            <span className="text-[#F1F5F9]">{mapped.text}</span>
          </div>
        );
      })}
    </div>
  );
}

// Erigon Dual Sentry Monitor Component
function SentryMonitor({ sentries, clientType }: { sentries?: SentryInfo[]; clientType?: string }) {
  if (clientType?.toLowerCase() !== 'erigon' || !sentries || sentries.length === 0) {
    return null;
  }

  const totalPeers = sentries.reduce((sum, s) => sum + s.peers, 0);
  const hasIssues = sentries.some(s => s.peers === 0);

  return (
    <div className="card-xdc">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Erigon Sentry Monitoring</h2>
          <p className="text-xs text-[#64748B]">Dual sentry P2P status</p>
        </div>
        {hasIssues && (
          <span className="ml-auto px-2 py-1 bg-[#EF4444]/10 text-[#EF4444] text-xs rounded-lg flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            Sentry Issue
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sentries.map((sentry, i) => (
          <div key={i} className={`bg-white/5 rounded-lg p-4 border ${sentry.peers > 0 ? 'border-[#10B981]/20' : 'border-[#EF4444]/20'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Network className={`w-4 h-4 ${sentry.peers > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`} />
                <span className="text-sm font-medium">Sentry {i + 1}</span>
              </div>
              <span className={`w-2.5 h-2.5 rounded-full ${sentry.peers > 0 ? 'bg-[#10B981]' : 'bg-[#EF4444] animate-pulse'}`} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#64748B]">Port</span>
                <span className="font-mono">{sentry.port}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#64748B]">Protocol</span>
                <span className={`font-mono px-2 py-0.5 rounded text-xs ${sentry.protocol.includes('68') ? 'bg-[#1E90FF]/10 text-[#1E90FF]' : 'bg-[#8B5CF6]/10 text-[#8B5CF6]'}`}>
                  {sentry.protocol}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#64748B]">Peers</span>
                <span className={`font-mono font-bold ${sentry.peers > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                  {sentry.peers}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between">
          <div className="text-sm text-[#64748B]">Total P2P Peers</div>
          <div className="text-lg font-bold font-mono-nums">{totalPeers}</div>
        </div>
      </div>
    </div>
  );
}

// Coinbase Display Component
function CoinbaseDisplay({ coinbase }: { coinbase?: string }) {
  const { copied, copy } = useCopyToClipboard();
  
  if (!coinbase || coinbase === '0x0') return <span className="text-[#64748B]">Not set</span>;
  
  const xdcAddress = coinbase.replace(/^0x/, 'xdc');
  
  return (
    <div className="flex items-center gap-2">
      <code className="text-sm font-mono text-[#1E90FF] bg-[#1E90FF]/10 px-2 py-1 rounded">
        {xdcAddress.slice(0, 20)}...{xdcAddress.slice(-8)}
      </code>
      <button onClick={() => copy(xdcAddress)} className="p-1.5 hover:bg-white/10 rounded transition-colors" title="Copy full address">
        {copied ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4 text-[#64748B]" />}
      </button>
    </div>
  );
}

// OS Icon Component
function OSIcon({ osType }: { osType?: string }) {
  const getIcon = () => {
    const type = osType?.toLowerCase() || '';
    if (type.includes('linux') || type.includes('ubuntu') || type.includes('debian')) return '🐧';
    if (type.includes('darwin') || type.includes('macos')) return '🍎';
    if (type.includes('windows')) return '🪟';
    return '🖥️';
  };
  return <span className="text-xl">{getIcon()}</span>;
}

// Parse client version string
function parseClientVersion(version: string) {
  const parts = version.split('/');
  return {
    client: parts[0] || 'Unknown',
    version: parts[1] || 'Unknown',
    platform: parts[2] || 'Unknown',
    goVersion: parts[3] || 'Unknown',
  };
}

// Toast Component
function Toast({ message, type = 'success', onClose }: { message: string; type?: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-24 right-6 bg-[#111827] border border-white/10 rounded-lg px-4 py-3 shadow-lg z-50 flex items-center gap-3 animate-fade-in">
      {type === 'success' ? <CheckCircle2 className="w-5 h-5 text-[#10B981]" /> : <AlertTriangle className="w-5 h-5 text-[#EF4444]" />}
      <span className="text-sm">{message}</span>
      <button onClick={onClose} className="text-[#64748B] hover:text-white"><X className="w-4 h-4" /></button>
    </div>
  );
}

// Metrics History Chart Component
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
    disk_percent: '#EF4444',
    sync_percent: '#EC4899',
    rpc_latency_ms: '#F59E0B',
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
          <line key={t} x1={padding.left} y1={padding.top + t * chartHeight} x2={width - padding.right} y2={padding.top + t * chartHeight} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}
        
        {/* Series lines */}
        {series.map(s => (
          <path key={s} d={generatePath(s as keyof MetricHistory)} fill="none" stroke={colors[s]} strokeWidth="2" strokeLinecap="round" />
        ))}
        
        {/* X-axis labels */}
        {data.filter((_, i) => i % 6 === 0).map((d, i) => (
          <text key={i} x={getX(i * 6)} y={height - 10} textAnchor="middle" fill="#64748B" fontSize="10">
            {new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </text>
        ))}
      </svg>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2 flex-wrap">
        {series.map(s => (
          <div key={s} className="flex items-center gap-2">
            <div className="w-4 h-1 rounded" style={{ backgroundColor: colors[s] }} />
            <span className="text-xs text-[#64748B]">{s.replace('_', ' ').toUpperCase()}</span>
          </div>
        ))}
      </div>
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
  
  const [expandedLogs, setExpandedLogs] = useState(false);
  const [selectedSeries, setSelectedSeries] = useState<string[]>(['block_height', 'peer_count']);
  const [timeRange, setTimeRange] = useState<number>(24);
  
  // Node removal state
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [isRemovingNode, setIsRemovingNode] = useState(false);

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
        fetch(`/api/v1/nodes/${nodeId}/metrics/history?hours=${timeRange}`, { cache: 'no-store' }),
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
  }, [nodeId, timeRange]);

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

  // Handle node removal
  const handleRemoveNode = async () => {
    setIsRemovingNode(true);
    try {
      const res = await fetch(`/api/v1/nodes/${nodeId}`, {
        method: 'DELETE',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_KEY || 'xdc-netown-key-2026-prod'}`,
        },
      });

      if (res.ok) {
        setToast({ message: 'Node has been removed successfully', type: 'success' });
        // Redirect to fleet page after short delay
        setTimeout(() => {
          router.push('/fleet');
        }, 1500);
      } else {
        const error = await res.json();
        setToast({ message: `Failed to remove node: ${error.error || 'Unknown error'}`, type: 'error' });
        setShowRemoveConfirm(false);
      }
    } catch (err) {
      console.error('Error removing node:', err);
      setToast({ message: 'Failed to remove node. Please try again.', type: 'error' });
      setShowRemoveConfirm(false);
    } finally {
      setIsRemovingNode(false);
    }
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    if (!logFilter) return logs;
    return logs.filter(log => log.toLowerCase().includes(logFilter.toLowerCase()));
  }, [logs, logFilter]);

  // Parse client version
  const parsedVersion = useMemo(() => {
    if (!status?.clientVersion) return null;
    return parseClientVersion(status.clientVersion);
  }, [status?.clientVersion]);

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
          <button onClick={() => router.push('/fleet')} className="mt-4 px-4 py-2 bg-[#1E90FF] text-white rounded-lg hover:bg-[#1E90FF]/90">
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
          <Server className="w-12 h-12 text-[#64748B] mb-4" />
          <h2 className="text-xl font-semibold">Node not found</h2>
        </div>
      </DashboardLayout>
    );
  }

  const activeIncidents = incidents.filter(i => i.status === 'active');
  const osInfo = formatOSInfo();
  const securityScore = status?.security?.score ?? node?.security_score ?? 0;
  const securityIssues = status?.security?.issues ?? node?.security_issues ?? '';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <ClientLogo clientType={status.clientType || node.client_type} size="lg" />
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-semibold text-[#F1F5F9]">{node.name}</h1>
                <RoleBadge role={node.role} />
                <StatusIndicator status={nodeStatus} />
              </div>
              <div className="flex items-center gap-4 text-sm text-[#64748B] mt-1 flex-wrap">
                <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{node.host}</span>
                {node.location && (
                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{node.location.city}, {node.location.country}</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={() => router.push('/')} className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">
              <ChevronLeft className="w-4 h-4" />Back
            </button>
            
            <div className="text-right mr-4">
              <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
                <span className={`w-2 h-2 rounded-full ${nodeStatus === 'healthy' ? 'bg-[#10B981] animate-pulse' : nodeStatus === 'degraded' ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'}`} />
                <span>Last Heartbeat</span>
              </div>
              <div className={`text-sm font-medium ${nodeStatus === 'healthy' ? 'text-[#10B981]' : nodeStatus === 'degraded' ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
                {formatTimeAgo(status.lastSeen)}
              </div>
            </div>
            <button onClick={handleRestart} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors">
              <RotateCcw className="w-4 h-4" />Restart
            </button>
            <button onClick={handleForceSync} className="flex items-center gap-2 px-4 py-2 bg-[#1E90FF]/10 hover:bg-[#1E90FF]/20 text-[#1E90FF] rounded-lg text-sm transition-colors">
              <RefreshCw className="w-4 h-4" />Force Sync
            </button>
            <button onClick={() => setToast({ message: 'Add peers dialog not implemented', type: 'error' })} className="flex items-center gap-2 px-4 py-2 bg-[#10B981]/10 hover:bg-[#10B981]/20 text-[#10B981] rounded-lg text-sm transition-colors">
              <UserPlus className="w-4 h-4" />Add Peers
            </button>
            <button 
              onClick={() => setShowRemoveConfirm(true)} 
              className="flex items-center gap-2 px-4 py-2 bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[#EF4444] rounded-lg text-sm transition-colors"
              title="Remove this node from fleet"
            >
              <Trash2 className="w-4 h-4" />Remove
            </button>
          </div>
        </div>

        {/* Hero Section - NEW from SkyOne */}
        <HeroSection node={node} status={status} metrics={metrics} />

        {/* System Information Card */}
        <div className="card-xdc">
          <div className="flex items-center gap-3 mb-4">
            <Monitor className="w-5 h-5 text-[#1E90FF]" />
            <h2 className="text-lg font-semibold">System Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {parsedVersion && (
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ClientLogo clientType={parsedVersion.client} size="sm" />
                  <div className="text-[12px] uppercase text-[#64748B]">Client Version</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-[#F1F5F9]">{parsedVersion.client} {parsedVersion.version}</div>
                  {parsedVersion.platform !== 'Unknown' && <div className="text-xs text-[#64748B] font-mono">{parsedVersion.platform}</div>}
                  {parsedVersion.goVersion !== 'Unknown' && <div className="text-xs text-[#64748B] font-mono">{parsedVersion.goVersion}</div>}
                </div>
              </div>
            )}
            
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-[12px] uppercase text-[#64748B] mb-2">Coinbase Address</div>
              <CoinbaseDisplay coinbase={status.coinbase} />
            </div>
            
            {status.ipv4 && (
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-[12px] uppercase text-[#64748B] mb-1">Public IPv4</div>
                <div className="text-sm font-mono text-[#1E90FF]">{status.ipv4}</div>
              </div>
            )}
            
            {osInfo && (
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <OSIcon osType={status?.os?.type || node?.os_info?.type} />
                  <div className="text-[12px] uppercase text-[#64748B]">Operating System</div>
                </div>
                <div className="text-sm text-[#F1F5F9]">{osInfo}</div>
              </div>
            )}
          </div>
        </div>

        {/* Security Score Card */}
        <div className="card-xdc">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-[#1E90FF]" />
            <h2 className="text-lg font-semibold">Security Assessment</h2>
          </div>
          
          {securityScore > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="flex justify-center lg:justify-start">
                <SecurityGauge score={securityScore} />
              </div>
              <div className="lg:col-span-2">
                <h3 className="text-sm font-medium text-[#64748B] mb-3">Recommendations</h3>
                <SecuritySuggestions issues={securityIssues} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <Shield className="w-10 h-10 text-[#64748B] mb-3" />
              <p className="text-sm text-[#64748B]">Security audit not yet performed</p>
              <p className="text-xs text-[#475569] mt-1">Run <code className="bg-white/5 px-1.5 py-0.5 rounded">xdc security</code> on the node to generate a report</p>
            </div>
          )}
        </div>

        {/* Grid: Sync & Server Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SyncPanel status={status} metrics={metrics} />
          <ServerStats status={status} />
        </div>

        {/* Grid: TxPool & Storage */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TxPoolPanel status={status} />
          <StoragePanel status={status} metrics={metrics} />
        </div>

        {/* Erigon Sentry Monitoring */}
        <SentryMonitor sentries={status.sentries} clientType={status.clientType || node.client_type} />

        {/* Peer Map */}
        {peers.length > 0 && <PeerMap peers={peers} />}

        {/* Troubleshoot Panel */}
        <TroubleshootPanel nodeId={nodeId} status={status} />

        {/* Grid: Incidents */}
        <div className="card-xdc">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-[#EF4444]" />
              <h2 className="text-lg font-semibold">Incidents</h2>
              {activeIncidents.length > 0 && (
                <span className="px-2 py-0.5 bg-[#EF4444]/10 text-[#EF4444] rounded text-xs">{activeIncidents.length} active</span>
              )}
            </div>
          </div>
          
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {incidents.length === 0 ? (
              <div className="text-center py-6 text-[#64748B]">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#10B981]" />
                <p>No incidents recorded</p>
              </div>
            ) : (
              incidents.map((incident) => (
                <div key={incident.id} className={`p-3 rounded-lg border ${incident.status === 'active' ? 'bg-[#EF4444]/5 border-[#EF4444]/20' : 'bg-white/5 border-white/5'}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={incident.severity} />
                      <span className="text-sm font-medium">{incident.type}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[#64748B]">{formatTimeAgo(incident.detected_at)}</span>
                      {incident.status === 'active' && (
                        <button onClick={() => handleResolveIncident(incident.id)} className="px-2 py-1 bg-[#10B981]/10 text-[#10B981] rounded text-xs hover:bg-[#10B981]/20">
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-[#F1F5F9] mt-1">{incident.title}</p>
                  {incident.description && <p className="text-xs text-[#64748B] mt-1">{incident.description}</p>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Logs Section */}
        <div className="card-xdc">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Terminal className="w-5 h-5 text-[#64748B]" />
              <h2 className="text-lg font-semibold">Node Logs</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => fetchLogs(100)} disabled={logsLoading} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded text-sm transition-colors disabled:opacity-50">
                {logsLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Fetch Latest 100
              </button>
              <button onClick={() => setExpandedLogs(!expandedLogs)} className="text-[#64748B] hover:text-white">
                {expandedLogs ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          {expandedLogs && (
            <>
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                  <input type="text" placeholder="Filter logs..." value={logFilter} onChange={(e) => setLogFilter(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-[#1E90FF]" />
                </div>
                <button onClick={() => fetchLogs(100, 'error')} className="px-3 py-2 bg-[#EF4444]/10 text-[#EF4444] rounded-lg text-sm hover:bg-[#EF4444]/20">
                  Errors Only
                </button>
              </div>
              
              <div className="bg-[#0A0E1A] rounded-lg p-3 font-mono text-xs h-[300px] overflow-y-auto">
                {logs.length === 0 ? (
                  <div className="text-center text-[#64748B] py-8">
                    <p>Log streaming requires a log aggregation agent on the node.</p>
                    <p className="mt-2 text-[12px]">Use <code className="bg-white/10 px-1 rounded">xdc logs -f</code> on the node directly, or configure Loki/ELK for remote log access.</p>
                  </div>
                ) : (
                  filteredLogs.map((log, i) => (
                    <div key={i} className={`py-0.5 ${log.toLowerCase().includes('error') ? 'text-[#EF4444]' : log.toLowerCase().includes('warn') ? 'text-[#F59E0B]' : 'text-[#64748B]'}`}>
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
          <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-[#1E90FF]" />
              <h2 className="text-lg font-semibold">Metrics History</h2>
            </div>            
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              <div className="flex gap-1">
                {[1, 6, 24].map((hours) => (
                  <button key={hours} onClick={() => setTimeRange(hours)}
                    className={`px-3 py-1.5 rounded text-xs transition-colors min-h-[44px] sm:min-h-0 ${timeRange === hours ? 'bg-[#1E90FF]/20 text-[#1E90FF]' : 'bg-white/5 text-[#64748B] hover:bg-white/10'}`}>
                    {hours}h
                  </button>
                ))}
              </div>
              
              <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
                {['block_height', 'peer_count', 'cpu_percent', 'memory_percent', 'disk_percent', 'sync_percent'].map((series) => (
                  <button key={series} onClick={() => setSelectedSeries(prev => prev.includes(series) ? prev.filter(s => s !== series) : [...prev, series])}
                    className={`px-3 py-1.5 rounded text-xs transition-colors whitespace-nowrap flex-shrink-0 min-h-[44px] sm:min-h-0 ${selectedSeries.includes(series) ? 'bg-[#1E90FF]/20 text-[#1E90FF]' : 'bg-white/5 text-[#64748B]'}`}>
                    {series.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          {metrics.length > 0 ? (
            <MetricsChart data={metrics} series={selectedSeries} />
          ) : (
            <div className="text-center py-8 text-[#64748B]">No metrics history available</div>
          )}
        </div>
      </div>
      
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {/* Confirmation Dialog for Node Removal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#111827] border border-white/10 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#EF4444]/10 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-[#EF4444]" />
              </div>
              <h3 className="text-lg font-semibold text-[#F1F5F9]">Remove Node</h3>
            </div>
            <p className="text-[#94A3B8] mb-6 leading-relaxed">
              Are you sure you want to remove <strong className="text-[#F1F5F9]">{node?.name}</strong>? 
              This will deactivate the node and revoke its API keys. Historical data will be preserved, 
              but the node will no longer appear in the fleet.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRemoveConfirm(false)}
                disabled={isRemovingNode}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveNode}
                disabled={isRemovingNode}
                className="px-4 py-2 bg-[#EF4444] hover:bg-[#EF4444]/90 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isRemovingNode && <RefreshCw className="w-4 h-4 animate-spin" />}
                Remove Node
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
