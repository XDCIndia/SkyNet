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
  Monitor,
  Copy,
  Check,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Info,
  Radio,
  Antenna
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
  sync_mode?: string;
  security_score?: number;
  security_issues?: string;
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
  syncMode?: string;
  coinbase: string;
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
  // Erigon dual sentry monitoring (Issue #14)
  sentries?: SentryInfo[];
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
  disk_percent: number;
  sync_percent: number;
  rpc_latency_ms?: number;
  chain_data_size?: number;
  database_size?: number;
  sentries?: SentryInfo[];
}

// Erigon Dual Sentry Info (Issue #14)
interface SentryInfo {
  port: number;
  protocol: string;
  peers: number;
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

// Client Logo Component
function ClientLogo({ clientType, size = 'md' }: { clientType?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-lg',
  };
  
  const styles: Record<string, { bg: string; color: string; letter: string }> = {
    XDC: { 
      bg: 'bg-[#1E90FF]/20', 
      color: 'text-[#1E90FF]',
      letter: 'X'
    },
    Erigon: { 
      bg: 'bg-orange-500/20', 
      color: 'text-orange-400',
      letter: 'E'
    },
    Geth: { 
      bg: 'bg-gray-500/20', 
      color: 'text-gray-400',
      letter: 'G'
    },
  };
  
  const style = styles[clientType || 'Unknown'] || { bg: 'bg-white/10', color: 'text-[#64748B]', letter: '?' };
  
  return (
    <div className={`${sizeClasses[size]} ${style.bg} ${style.color} rounded-lg flex items-center justify-center font-bold border border-white/10`}>
      {style.letter}
    </div>
  );
}

// OS Icon Component
function OSIcon({ osType, size = 'md' }: { osType?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'text-base',
    md: 'text-xl',
    lg: 'text-2xl',
  };
  
  const getIcon = () => {
    const type = osType?.toLowerCase() || '';
    if (type.includes('linux') || type.includes('ubuntu') || type.includes('debian')) return '🐧';
    if (type.includes('darwin') || type.includes('macos')) return '🍎';
    if (type.includes('windows')) return '🪟';
    return '🖥️';
  };
  
  return <span className={sizeClasses[size]}>{getIcon()}</span>;
}

// Parse client version string
function parseClientVersion(version: string) {
  // Format: XDC/v2.6.8-stable/linux-amd64/go1.23.12
  const parts = version.split('/');
  return {
    client: parts[0] || 'Unknown',
    version: parts[1] || 'Unknown',
    platform: parts[2] || 'Unknown',
    goVersion: parts[3] || 'Unknown',
  };
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

// Node Type Badge
function NodeTypeBadge({ nodeType, syncMode }: { nodeType?: string; syncMode?: string }) {
  if (!nodeType) return null;
  
  const getLabel = () => {
    if (nodeType === 'archive') return 'Archive';
    if (nodeType === 'full' || nodeType === 'fullnode') {
      if (syncMode === 'fast') return 'Fast Sync';
      if (syncMode === 'snap') return 'Snap Sync';
      return 'Full Node';
    }
    if (nodeType === 'masternode') return 'Masternode';
    if (nodeType === 'standby') return 'Standby';
    return nodeType.charAt(0).toUpperCase() + nodeType.slice(1);
  };
  
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
      label: getLabel()
    },
    full: { 
      bg: 'bg-[#1E90FF]/10 text-[#1E90FF] border-[#1E90FF]/20', 
      icon: <Link2 className="w-3 h-3" />,
      label: getLabel()
    },
    archive: { 
      bg: 'bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20', 
      icon: <Layers className="w-3 h-3" />,
      label: 'Archive'
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
  
  const style = styles[clientType] || { bg: 'bg-white/5 text-[#64748B] border-white/10', icon: <Terminal className="w-3 h-3" /> };
  
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

// Format bytes to human readable
function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '—';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

// Security Score Gauge
function SecurityGauge({ score = 0 }: { score?: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  const getColor = () => {
    if (score >= 90) return '#10B981'; // Green
    if (score >= 70) return '#1E90FF'; // Blue
    if (score >= 50) return '#F59E0B'; // Yellow
    return '#EF4444'; // Red
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
          <circle
            cx="45"
            cy="45"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="10"
          />
          <circle
            cx="45"
            cy="45"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold font-mono-nums" style={{ color }}>
            {score}
          </span>
          <span className="text-[10px] text-[#64748B] uppercase">Score</span>
        </div>
      </div>
      <span className="text-sm font-medium mt-2" style={{ color }}>
        {getLabel()}
      </span>
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
  
  const issueMap: Record<string, { icon: React.ReactNode; text: string; type: 'warning' | 'success' }> = {
    ssh_default_port: {
      icon: <AlertCircle className="w-4 h-4 text-[#F59E0B]" />,
      text: 'SSH running on default port 22 — Change to non-standard port',
      type: 'warning'
    },
    root_login_enabled: {
      icon: <AlertCircle className="w-4 h-4 text-[#F59E0B]" />,
      text: 'Root login via SSH is enabled — Disable in /etc/ssh/sshd_config',
      type: 'warning'
    },
    no_firewall: {
      icon: <ShieldAlert className="w-4 h-4 text-[#EF4444]" />,
      text: 'No active firewall (UFW) — Install and enable UFW',
      type: 'warning'
    },
    no_fail2ban: {
      icon: <ShieldAlert className="w-4 h-4 text-[#F59E0B]" />,
      text: 'Fail2ban is not running — Install fail2ban to protect against brute force',
      type: 'warning'
    },
    no_auto_updates: {
      icon: <Info className="w-4 h-4 text-[#F59E0B]" />,
      text: 'Unattended upgrades not installed — Enable automatic security updates',
      type: 'warning'
    },
    rpc_exposed: {
      icon: <ShieldAlert className="w-4 h-4 text-[#EF4444]" />,
      text: 'RPC API exposed to all interfaces (0.0.0.0) — Bind to 127.0.0.1 only',
      type: 'warning'
    },
    docker_root: {
      icon: <Info className="w-4 h-4 text-[#F59E0B]" />,
      text: 'Docker running as root — Consider rootless Docker mode',
      type: 'warning'
    },
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

// Erigon Dual Sentry Monitor Component (Issue #14)
function SentryMonitor({ sentries, clientType }: { sentries?: SentryInfo[]; clientType?: string }) {
  // Only show for Erigon clients
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
          <div 
            key={i} 
            className={`bg-white/5 rounded-lg p-4 border ${
              sentry.peers > 0 ? 'border-[#10B981]/20' : 'border-[#EF4444]/20'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Network className={`w-4 h-4 ${sentry.peers > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`} />
                <span className="text-sm font-medium">Sentry {i + 1}</span>
              </div>
              <span className={`w-2.5 h-2.5 rounded-full ${
                sentry.peers > 0 ? 'bg-[#10B981]' : 'bg-[#EF4444] animate-pulse'
              }`} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#64748B]">Port</span>
                <span className="font-mono">{sentry.port}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#64748B]">Protocol</span>
                <span className={`font-mono px-2 py-0.5 rounded text-xs ${
                  sentry.protocol.includes('68') 
                    ? 'bg-[#1E90FF]/10 text-[#1E90FF]' 
                    : 'bg-[#8B5CF6]/10 text-[#8B5CF6]'
                }`}>
                  {sentry.protocol}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#64748B]">Peers</span>
                <span className={`font-mono font-bold ${
                  sentry.peers > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                }`}>
                  {sentry.peers}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Protocol Summary */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center justify-between">
          <div className="text-sm text-[#64748B]">Total P2P Peers</div>
          <div className="text-lg font-bold font-mono-nums">{totalPeers}</div>
        </div>
        <div className="flex gap-4 mt-2">
          {sentries.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${
                s.protocol.includes('68') ? 'bg-[#1E90FF]' : 'bg-[#8B5CF6]'
              }`} />
              <span className="text-[#64748B]">{s.protocol}:</span>
              <span className="font-mono">{s.peers} peers</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
      <span className="text-xs text-[#64748B] mt-2">{label}</span>
      {sublabel && <span className="text-xs text-[#64748B]">{sublabel}</span>}
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
    disk_percent: '#EF4444',
    sync_percent: '#EC4899',
    rpc_latency_ms: '#F59E0B',
    chain_data_size: '#F59E0B',
    database_size: '#EC4899',
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
        {series.includes('disk_percent') && (
          <path d={generatePath('disk_percent')} fill="none" stroke={colors.disk_percent} strokeWidth="2" strokeLinecap="round" strokeDasharray="2,2" />
        )}
        {series.includes('sync_percent') && (
          <path d={generatePath('sync_percent')} fill="none" stroke={colors.sync_percent} strokeWidth="2" strokeLinecap="round" strokeDasharray="3,3" />
        )}
        {series.includes('rpc_latency_ms') && (
          <path d={generatePath('rpc_latency_ms')} fill="none" stroke={colors.rpc_latency_ms} strokeWidth="2" strokeLinecap="round" />
        )}
        {series.includes('chain_data_size') && (
          <path d={generatePath('chain_data_size')} fill="none" stroke={colors.chain_data_size} strokeWidth="2" strokeLinecap="round" />
        )}
        {series.includes('database_size') && (
          <path d={generatePath('database_size')} fill="none" stroke={colors.database_size} strokeWidth="2" strokeLinecap="round" strokeDasharray="3,3" />
        )}
        
        {/* X-axis labels (every 6th point) */}
        {data.filter((_, i) => i % 6 === 0).map((d, i) => (
          <text
            key={i}
            x={getX(i * 6)}
            y={height - 10}
            textAnchor="middle"
            fill="#64748B"
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
            <span className="text-xs text-[#64748B]">{s.replace('_', ' ').toUpperCase()}</span>
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
      <button onClick={onClose} className="text-[#64748B] hover:text-white">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Coinbase Display Component
function CoinbaseDisplay({ coinbase }: { coinbase?: string }) {
  const { copied, copy } = useCopyToClipboard();
  
  if (!coinbase || coinbase === '0x0') return <span className="text-[#64748B]">Not set</span>;
  
  // Convert 0x address to xdc prefix
  const xdcAddress = coinbase.replace(/^0x/, 'xdc');
  
  return (
    <div className="flex items-center gap-2">
      <code className="text-sm font-mono text-[#1E90FF] bg-[#1E90FF]/10 px-2 py-1 rounded">
        {xdcAddress.slice(0, 20)}...{xdcAddress.slice(-8)}
      </code>
      <button
        onClick={() => copy(xdcAddress)}
        className="p-1.5 hover:bg-white/10 rounded transition-colors"
        title="Copy full address"
      >
        {copied ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4 text-[#64748B]" />}
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
  const [timeRange, setTimeRange] = useState<number>(24);
  
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
          <Server className="w-12 h-12 text-[#64748B] mb-4" />
          <h2 className="text-xl font-semibold">Node not found</h2>
        </div>
      </DashboardLayout>
    );
  }

  const activeIncidents = incidents.filter(i => i.status === 'active');
  const blockHeightTrend = getTrend(status.blockHeight, 'block_height');
  const peerTrend = getTrend(status.peerCount, 'peer_count');
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
                <span className="flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  {node.host}
                </span>
                {node.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {node.location.city}, {node.location.country}
                  </span>
                )}
              </div>
              
              {/* Node Type and Client Type Badges */}
              <div className="flex items-center gap-2 mt-2">
                <NodeTypeBadge nodeType={status.nodeType || node.node_type} syncMode={status.syncMode || node.sync_mode} />
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
              <div className="flex items-center gap-2 text-xs text-[#64748B] mb-1">
                <span className={`w-2 h-2 rounded-full ${
                  nodeStatus === 'healthy' ? 'bg-[#10B981] animate-pulse' :
                  nodeStatus === 'degraded' ? 'bg-[#F59E0B]' :
                  'bg-[#EF4444]'
                }`} />
                <span>Last Heartbeat</span>
              </div>
              <div className={`text-sm font-medium ${
                nodeStatus === 'healthy' ? 'text-[#10B981]' :
                nodeStatus === 'degraded' ? 'text-[#F59E0B]' :
                'text-[#EF4444]'
              }`}>
                {formatTimeAgo(status.lastSeen)}
              </div>
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

        {/* System Information Card - Enhanced */}
        <div className="card-xdc">
          <div className="flex items-center gap-3 mb-4">
            <Monitor className="w-5 h-5 text-[#1E90FF]" />
            <h2 className="text-lg font-semibold">System Information</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Client Version - Parsed */}
            {parsedVersion && (
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ClientLogo clientType={parsedVersion.client} size="sm" />
                  <div className="text-[10px] uppercase text-[#64748B]">Client Version</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-[#F1F5F9]">{parsedVersion.client} {parsedVersion.version}</div>
                  {parsedVersion.platform !== 'Unknown' && <div className="text-xs text-[#64748B] font-mono">{parsedVersion.platform}</div>}
                  {parsedVersion.goVersion !== 'Unknown' && <div className="text-xs text-[#64748B] font-mono">{parsedVersion.goVersion}</div>}
                </div>
              </div>
            )}
            
            {/* Coinbase */}
            <div className="bg-white/5 rounded-lg p-4">
              <div className="text-[10px] uppercase text-[#64748B] mb-2">Coinbase Address</div>
              <CoinbaseDisplay coinbase={status.coinbase} />
            </div>
            
            {/* IPv4 */}
            {status.ipv4 && (
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-[10px] uppercase text-[#64748B] mb-1">Public IPv4</div>
                <div className="text-sm font-mono text-[#1E90FF]">{status.ipv4}</div>
              </div>
            )}
            
            {/* IPv6 */}
            {status.ipv6 && (
              <div className="bg-white/5 rounded-lg p-4">
                <div className="text-[10px] uppercase text-[#64748B] mb-1">Public IPv6</div>
                <div className="text-sm font-mono text-[#64748B] truncate" title={status.ipv6}>
                  {status.ipv6.length > 30 ? status.ipv6.slice(0, 30) + '...' : status.ipv6}
                </div>
              </div>
            )}
            
            {/* OS Info */}
            {osInfo && (
              <div className="bg-white/5 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <OSIcon osType={status?.os?.type || node?.os_info?.type} size="md" />
                  <div className="text-[10px] uppercase text-[#64748B]">Operating System</div>
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

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Block Height */}
          <div className="card-xdc p-3 sm:p-4">
            <div className="text-xs text-[#64748B] mb-1">Block Height</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-bold font-mono-nums">{status.blockHeight?.toLocaleString() || '—'}</span>
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
          <div className="card-xdc p-3 sm:p-4">
            <div className="text-xs text-[#64748B] mb-1">Sync Status</div>
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
          <div className="card-xdc p-3 sm:p-4">
            <div className="text-xs text-[#64748B] mb-1">Peers</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-bold font-mono-nums">{status.peerCount || 0}</span>
              {peerTrend && (
                peerTrend === 'up' ? <ArrowUp className="w-4 h-4 text-[#10B981]" /> :
                peerTrend === 'down' ? <ArrowDown className="w-4 h-4 text-[#EF4444]" /> : null
              )}
            </div>
            <div className="text-xs text-[#64748B] mt-1">
              {status.activePeers} active connections
            </div>
          </div>

          {/* TX Pool */}
          <div className="card-xdc p-3 sm:p-4">
            <div className="text-xs text-[#64748B] mb-1">TX Pool</div>
            <div className="text-xl sm:text-2xl font-bold font-mono-nums">
              {(status.txPoolPending || 0) + (status.txPoolQueued || 0)}
            </div>
            <div className="flex gap-2 mt-1 text-xs">
              <span className="text-[#F59E0B]">{status.txPoolPending || 0} pending</span>
              <span className="text-[#64748B]">|</span>
              <span className="text-[#64748B]">{status.txPoolQueued || 0} queued</span>
            </div>
          </div>

          {/* Gas Price */}
          <div className="card-xdc p-3 sm:p-4">
            <div className="text-xs text-[#64748B] mb-1">Gas Price</div>
            <div className="text-xl sm:text-2xl font-bold font-mono-nums">
              {status.gasPrice ? (BigInt(status.gasPrice) / BigInt(1e9)).toString() : '—'}
            </div>
            <div className="text-xs text-[#64748B] mt-1">Gwei</div>
          </div>

          {/* RPC Latency */}
          <div className="card-xdc p-3 sm:p-4">
            <div className="text-xs text-[#64748B] mb-1">RPC Latency</div>
            <div className="text-xl sm:text-2xl font-bold font-mono-nums">
              {status.rpcLatencyMs || '—'}
            </div>
            <div className="text-xs text-[#64748B] mt-1">ms</div>
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

        {/* Storage Section */}
        {(status.storage?.chainDataSize || status.storage?.databaseSize) && (
          <div className="card-xdc">
            <div className="flex items-center gap-3 mb-4">
              <HardDrive className="w-5 h-5 text-[#1E90FF]" />
              <h2 className="text-lg font-semibold">Storage</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {status.storage?.chainDataSize != null && (
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="text-[10px] uppercase text-[#64748B] mb-1">Chain Data Size</div>
                  <div className="text-2xl font-bold font-mono text-[#F59E0B]">
                    {status.storage.chainDataSize >= 1024 
                      ? `${(status.storage.chainDataSize / 1024).toFixed(2)} TB`
                      : `${status.storage.chainDataSize.toFixed(1)} GB`}
                  </div>
                </div>
              )}
              
              {status.storage?.databaseSize != null && (
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="text-[10px] uppercase text-[#64748B] mb-1">Database Size</div>
                  <div className="text-2xl font-bold font-mono text-[#EC4899]">
                    {status.storage.databaseSize >= 1024
                      ? `${(status.storage.databaseSize / 1024).toFixed(2)} TB`
                      : `${status.storage.databaseSize.toFixed(1)} GB`}
                  </div>
                </div>
              )}
            </div>
            
            {metrics.length > 0 && (metrics[0].chain_data_size || metrics[0].database_size) && (
              <div className="mt-4">
                <div className="text-sm text-[#64748B] mb-2">Storage History</div>
                <Sparkline 
                  data={metrics.slice(-30).map(m => m.chain_data_size || m.database_size || 0).filter(Boolean)} 
                  color="#F59E0B" 
                  height={60}
                />
              </div>
            )}
          </div>
        )}

        {/* Erigon Sentry Monitoring (Issue #14) */}
        <SentryMonitor sentries={status.sentries} clientType={status.clientType || node.client_type} />

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
                className="text-[#64748B] hover:text-white"
              >
                {expandedPeers ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 px-2 text-xs font-medium text-[#64748B] cursor-pointer" onClick={() => handleSort('name')}>Name</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-[#64748B] cursor-pointer" onClick={() => handleSort('ip')}>IP</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-[#64748B] cursor-pointer" onClick={() => handleSort('direction')}>Dir</th>
                    <th className="text-left py-2 px-2 text-xs font-medium text-[#64748B] cursor-pointer" onClick={() => handleSort('country')}>Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedPeers.slice(0, expandedPeers ? undefined : 5).map((peer) => (
                    <tr key={peer.id} className="hover:bg-white/[0.02]">
                      <td className="py-2 px-2 text-sm">
                        <div className="truncate max-w-[150px]" title={peer.name}>
                          {peer.name?.slice(0, 30) || 'Unknown'}
                        </div>
                        <div className="text-xs text-[#64748B] font-mono truncate max-w-[150px]">
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
                      <td colSpan={4} className="py-4 text-center text-[#64748B]">No peers connected</td>
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
                <div className="text-center py-6 text-[#64748B]">
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
                        <span className="text-xs text-[#64748B]">{formatTimeAgo(incident.detected_at)}</span>
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
                    <p className="text-sm text-[#F1F5F9] mt-1">{incident.title}</p>
                    {incident.description && (
                      <p className="text-xs text-[#64748B] mt-1">{incident.description}</p>
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
              <Terminal className="w-5 h-5 text-[#64748B]" />
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
                className="text-[#64748B] hover:text-white"
              >
                {expandedLogs ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
          </div>
          
          {expandedLogs && (
            <>
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
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
                  <div className="text-center text-[#64748B] py-8">
                    <p>Log streaming requires a log aggregation agent on the node.</p>
                    <p className="mt-2 text-[10px]">Use <code className="bg-white/10 px-1 rounded">xdc logs -f</code> on the node directly, or configure Loki/ELK for remote log access.</p>
                  </div>
                ) : (
                  filteredLogs.map((log, i) => (
                    <div 
                      key={i} 
                      className={`py-0.5 ${
                        log.toLowerCase().includes('error') ? 'text-[#EF4444]' :
                        log.toLowerCase().includes('warn') ? 'text-[#F59E0B]' :
                        'text-[#64748B]'
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
          <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4 gap-4">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-[#1E90FF]" />
              <h2 className="text-lg font-semibold">Metrics History</h2>
            </div>            
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
              {/* Time range selector */}
              <div className="flex gap-1">
                {[1, 6, 24].map((hours) => (
                  <button
                    key={hours}
                    onClick={() => setTimeRange(hours)}
                    className={`px-3 py-1.5 rounded text-xs transition-colors min-h-[44px] sm:min-h-0 ${
                      timeRange === hours
                        ? 'bg-[#1E90FF]/20 text-[#1E90FF]'
                        : 'bg-white/5 text-[#64748B] hover:bg-white/10'
                    }`}
                  >
                    {hours}h
                  </button>
                ))}
              </div>
              
              {/* Series toggles - scrollable on mobile */}
              <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
                {['block_height', 'peer_count', 'cpu_percent', 'memory_percent', 'disk_percent', 'sync_percent', 'rpc_latency_ms'].map((series) => (
                  <button
                    key={series}
                    onClick={() => {
                      setSelectedSeries(prev => 
                        prev.includes(series) 
                          ? prev.filter(s => s !== series)
                          : [...prev, series]
                      );
                    }}
                    className={`px-3 py-1.5 rounded text-xs transition-colors whitespace-nowrap flex-shrink-0 min-h-[44px] sm:min-h-0 ${
                      selectedSeries.includes(series)
                        ? 'bg-[#1E90FF]/20 text-[#1E90FF]'
                        : 'bg-white/5 text-[#64748B]'
                    }`}
                  >
                    {series.replace('_', ' ')}
                  </button>
                ))}
              
                {/* Storage series (only show if data exists) */}
                {metrics.length > 0 && metrics.some(m => m.chain_data_size || m.database_size) && (
                  <>
                    {['chain_data_size', 'database_size'].map((series) => (
                      <button
                        key={series}
                        onClick={() => {
                          setSelectedSeries(prev => 
                            prev.includes(series) 
                              ? prev.filter(s => s !== series)
                              : [...prev, series]
                          );
                        }}
                        className={`px-3 py-1 rounded text-xs transition-colors whitespace-nowrap flex-shrink-0 ${
                          selectedSeries.includes(series)
                            ? 'bg-[#F59E0B]/20 text-[#F59E0B]'
                            : 'bg-white/5 text-[#64748B]'
                        }`}
                      >
                        {series.replace('_', ' ')}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
          
          {metrics.length > 0 ? (
            <MetricsChart data={metrics} series={selectedSeries} />
          ) : (
            <div className="text-center py-8 text-[#64748B]">
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
