'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import ClientDistributionChart from '@/components/ClientDistributionChart';
import NetworkFilter from '@/components/NetworkFilter';
import IncidentsPanel from '@/components/IncidentsPanel';
import { formatTimeAgo } from '@/lib/formatters';
import { 
  Server, 
  Activity, 
  AlertTriangle, 
  CheckCircle2,
  ArrowRight,
  Wifi,
  RefreshCw,
  Cpu,
  HardDrive,
  Globe,
  Pickaxe,
  ChevronLeft,
  Clock,
  ShieldAlert,
  Copy,
  ExternalLink,
  Terminal,
  MapPin,
  Layers,
  Link2,
  Grid3X3,
  List,
  Search,
  ChevronUp,
  ChevronDown,
  MoreHorizontal,
  Settings,
  Square,
  CheckSquare,
  AlertCircle,
  Shield,
  BarChart3,
  Zap,
  Hash,
  TrendingUp,
  Flame,
  Eye,
  EyeOff,
  ChevronRight,
  Trash2,
  X,
  Filter,
} from 'lucide-react';

const REFRESH_INTERVAL = 10; // 10 seconds
const ROW_HEIGHT = 48; // Height of each table row
const BUFFER_ROWS = 10; // Buffer rows above and below viewport
const TABLE_ROW_HEIGHT = 48;

interface FleetData {
  totalNodes: number;
  healthyNodes: number;
  degradedNodes: number;
  offlineNodes: number;
  syncingNodes: number;
  healthScore: number;
  totalPeers: number;
  mainnetHead: number;
  apothemHead: number;
  avgSyncPercent: number;
  avgBlockHeight: number;
}

interface Node {
  id: string;
  name: string;
  host: string;
  role: string;
  status: 'healthy' | 'degraded' | 'syncing' | 'offline';
  blockHeight: number;
  blocksBehind: number;
  syncPercent: number;
  peerCount: number;
  cpuPercent: number | null;
  memoryPercent: number | null;
  diskPercent: number | null;
  clientVersion: string;
  lastSeen: string;
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
  network?: string;
  email?: string | null;
  telegram?: string | null;
  security_score?: number;
  security_issues?: string;
  stallHours?: number;
  stalledAtBlock?: number;
  prevBlock?: number;
  blockDiff?: number;
  networkHeight?: number;
  peakBlock?: number;
  dockerImage?: string;
}

interface Incident {
  id: number;
  node_id: string;
  node_name: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detected_at: string;
}

interface HealthyPeersSummary {
  totalPeers: number;
  healthyPeers: number;
}

type FilterType = 'all' | 'healthy' | 'syncing' | 'behind' | 'active';
type ViewMode = 'grid' | 'table';
type SortField = keyof Node | 'security_score';
type SortDirection = 'asc' | 'desc';

interface NetworkStats {
  bestBlock: number;
  avgBlockTime: number;
  gasPrice: string;
  gasLimit: number;
  difficulty: string;
  activeNodes: number;
  tps: number;
  pendingTxs: number;
  epoch: {
    number: number;
    progress: number;
    blocksRemaining: number;
  };
}

function StatusDot({ status }: { status: string }) {
  const colors = {
    healthy: 'bg-[var(--success)]',
    degraded: 'bg-[var(--warning)]',
    syncing: 'bg-[var(--warning)]',
    offline: 'bg-[var(--critical)]',
  };
  
  return (
    <span className={`inline-flex w-2.5 h-2.5 rounded-full ${colors[status as keyof typeof colors] || colors.offline} ${status !== 'healthy' ? 'animate-pulse' : ''}`} />
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    masternode: 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border-[var(--accent-blue)]/20',
    fullnode: 'bg-[var(--success)]/10 text-[var(--success)] border-[#10B981]/20',
    archive: 'bg-[var(--purple)]/10 text-[var(--purple)] border-[#8B5CF6]/20',
    rpc: 'bg-[var(--warning)]/10 text-[var(--warning)] border-[#F59E0B]/20',
  };
  
  return (
    <span className={`px-2 py-0.5 text-[12px] font-medium rounded border ${colors[role] || colors.fullnode}`}>
      {role?.toUpperCase()}
    </span>
  );
}

// Node Type Badge (masternode/standby/fullnode)
function NodeTypeBadge({ nodeType }: { nodeType?: string }) {
  if (!nodeType) return null;
  
  const styles: Record<string, { bg: string; icon: React.ReactNode }> = {
    masternode: { 
      bg: 'bg-[var(--success)]/10 text-[var(--success)] border-[#10B981]/20', 
      icon: <Pickaxe className="w-3 h-3" /> 
    },
    standby: { 
      bg: 'bg-[var(--warning)]/10 text-[var(--warning)] border-[#F59E0B]/20', 
      icon: <Clock className="w-3 h-3" /> 
    },
    fullnode: { 
      bg: 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border-[var(--accent-blue)]/20', 
      icon: <Link2 className="w-3 h-3" /> 
    },
  };
  
  const style = styles[nodeType.toLowerCase()] || styles.fullnode;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[12px] font-medium rounded border ${style.bg}`}>
      {style.icon}
      {nodeType?.charAt(0).toUpperCase() + nodeType.slice(1)}
    </span>
  );
}

// Helper: Determine client display name
function getClientDisplayName(clientType?: string, clientVersion?: string): string {
  if (!clientType) return 'Unknown';
  
  const ct = clientType.toLowerCase();
  const version = clientVersion?.toLowerCase() || '';
  
  // Check if geth with XDC Client version (v2.6.x or XDC/v2.x)
  if (ct === 'geth' && (version.includes('v2.6.') || version.includes('xdc/v2.'))) {
    return 'XDC';
  }
  
  // Otherwise return normal client type
  return clientType.charAt(0).toUpperCase() + clientType.slice(1);
}

// Client Type Badge (XDC/Erigon/Geth)
function ClientTypeBadge({ clientType, clientVersion }: { clientType?: string; clientVersion?: string }) {
  if (!clientType || clientType === 'Unknown') return null;
  
  const displayName = getClientDisplayName(clientType, clientVersion);
  const ct = clientType.toLowerCase();
  
  const styles: Record<string, { bg: string; icon: React.ReactNode }> = {
    geth: { 
      bg: 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border-[var(--accent-blue)]/20', 
      icon: <Globe className="w-3 h-3" />,
    },
    erigon: { 
      bg: 'bg-[var(--purple)]/10 text-[var(--purple)] border-[#8B5CF6]/20', 
      icon: <Layers className="w-3 h-3" />,
    },
    nethermind: { 
      bg: 'bg-[var(--success)]/10 text-[var(--success)] border-[#10B981]/20', 
      icon: <Terminal className="w-3 h-3" />,
    },
  };
  
  const style = styles[ct] || { 
    bg: 'bg-[var(--bg-hover)] text-[var(--text-tertiary)] border-[var(--border-subtle)]', 
    icon: <Terminal className="w-3 h-3" />
  };
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[12px] font-medium rounded border ${style.bg}`}>
      {style.icon}
      {displayName}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: 'critical' | 'warning' | 'info' }) {
  const styles = {
    critical: 'bg-[var(--critical)]/10 text-[var(--critical)] border-[#EF4444]/20',
    warning: 'bg-[var(--warning)]/10 text-[var(--warning)] border-[#F59E0B]/20',
    info: 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border-[var(--accent-blue)]/20',
  };
  
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${styles[severity]}`}>
      {severity.toUpperCase()}
    </span>
  );
}

// Mini Sparkline for card view
function MiniSparkline({ value, color = '#1E90FF' }: { value: number; color?: string }) {
  // Generate a pseudo-sparkline from the block height (decorative, shows "activity")
  const points = useMemo(() => {
    const seed = value || 1;
    const pts = [];
    for (let i = 0; i < 12; i++) {
      const v = 20 + Math.sin(seed / 1000 + i * 0.8) * 15 + Math.cos(seed / 500 + i * 1.2) * 10;
      pts.push(Math.max(5, Math.min(95, v)));
    }
    // Last point trends toward current "health"
    pts.push(value > 0 ? 85 : 15);
    return pts;
  }, [value]);

  const pathD = points.map((y, i) => {
    const x = (i / (points.length - 1)) * 100;
    const yFlipped = 100 - y;
    return `${i === 0 ? 'M' : 'L'}${x},${yFlipped}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 100" className="w-full h-[24px]" preserveAspectRatio="none">
      <path d={pathD} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity="0.6" />
    </svg>
  );
}

function ProgressBar({ value, color = '#1E90FF', height = 6 }: { value: number; color?: string; height?: number }) {
  const clampedValue = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full bg-[var(--bg-hover)] rounded-full overflow-hidden" style={{ height }}>
      <div 
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${clampedValue}%`, backgroundColor: color }}
      />
    </div>
  );
}

// Compact metric bar for table view
function CompactMetricBar({ value, label }: { value: number | null; label: string }) {
  if (value === null) return <span className="text-[var(--text-tertiary)]">—</span>;
  
  const color = value > 80 ? '#EF4444' : value > 60 ? '#F59E0B' : '#10B981';
  
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1">
        <ProgressBar value={value} color={color} height={4} />
      </div>
      <span className="text-[12px] font-mono w-7 text-right text-[var(--text-tertiary)]">{value}%</span>
    </div>
  );
}

// Mini SVG ring gauge — compact radial indicator for table rows
function MiniRingGauge({ value, label }: { value: number | null; label: string }) {
  const pct = value ?? 0;
  const r = 9;
  const circ = 2 * Math.PI * r;
  const stroke = pct > 80 ? '#EF4444' : pct > 60 ? '#F59E0B' : '#10B981';
  const trackColor = 'var(--border-subtle)';
  const arc = (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-0.5" title={`${label}: ${value !== null ? pct + '%' : 'N/A'}`}>
      <svg width="26" height="26" viewBox="0 0 26 26">
        {/* Track */}
        <circle cx="13" cy="13" r={r} fill="none" stroke={trackColor} strokeWidth="3" />
        {/* Arc */}
        {value !== null && (
          <circle
            cx="13" cy="13" r={r}
            fill="none"
            stroke={stroke}
            strokeWidth="3"
            strokeDasharray={`${arc} ${circ - arc}`}
            strokeLinecap="round"
            transform="rotate(-90 13 13)"
          />
        )}
        {/* Value text */}
        <text
          x="13" y="16"
          textAnchor="middle"
          fontSize="6.5"
          fontWeight="700"
          fill={value !== null ? stroke : 'var(--text-tertiary)'}
          fontFamily="monospace"
        >
          {value !== null ? pct : '—'}
        </text>
      </svg>
      <span className="text-[8px] text-[var(--text-tertiary)] uppercase tracking-wide leading-none">{label}</span>
    </div>
  );
}

// Security score badge
function SecurityBadge({ score }: { score?: number }) {
  if (score === undefined || score === null) return <span className="text-[var(--text-tertiary)]">—</span>;
  
  const color = score >= 90 ? '#10B981' : score >= 70 ? '#1E90FF' : score >= 50 ? '#F59E0B' : '#EF4444';
  
  return (
    <span 
      className="inline-flex items-center justify-center w-8 h-5 rounded text-[12px] font-bold font-mono"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {score}
    </span>
  );
}

// Check if a node should be filtered out (no heartbeat in >24h)
const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

function isNodeStale(node: Node): boolean {
  if (!node.lastSeen) return true; // No heartbeat at all = stale
  const lastHeartbeat = new Date(node.lastSeen).getTime();
  const now = Date.now();
  return now - lastHeartbeat > STALE_THRESHOLD_MS;
}

// Parse OS info from client version string as fallback
function parseOsFromClientVersion(clientVersion?: string): { type: string; arch: string } {
  if (!clientVersion) return { type: '', arch: '' };
  const match = clientVersion.match(/\/(linux|darwin|windows)-(amd64|arm64|x64|x86)/i);
  return match ? { type: match[1].toLowerCase(), arch: match[2].toLowerCase() } : { type: '', arch: '' };
}

// Format OS info for display
function formatOSInfo(os_info?: Node['os_info'], clientVersion?: string): string {
  if (os_info?.type && os_info.type !== 'unknown') {
    const parts = [os_info.type];
    if (os_info.arch) parts.push(os_info.arch);
    if (os_info.release) parts.push(os_info.release);
    return parts.join(' / ');
  }
  // Fallback: parse from client version
  const parsed = parseOsFromClientVersion(clientVersion);
  if (parsed.type) return `${parsed.type}${parsed.arch ? ' / ' + parsed.arch : ''}`;
  return 'Unknown';
}

// OS Icon Component
function OSIcon({ osType }: { osType?: string }) {
  const type = osType?.toLowerCase() || '';
  if (type.includes('linux') || type.includes('ubuntu')) return '🐧';
  if (type.includes('darwin') || type.includes('macos')) return '🍎';
  if (type.includes('windows')) return '🪟';
  return '🖥️';
}

// Network Health Banner Component
function NetworkHealthBanner({ 
  fleet,
  lastUpdated,
  masternodeCount = 108
}: { 
  fleet: FleetData;
  lastUpdated: number;
  masternodeCount?: number;
}) {
  const healthColor = fleet.healthScore >= 90 ? '#10B981' : fleet.healthScore >= 70 ? '#F59E0B' : '#EF4444';
  
  return (
    <div className="card-xdc mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
        {/* Health Score */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <svg width="80" height="80" viewBox="0 0 80 80" className="transform -rotate-90">
              <circle cx="40" cy="40" r="36" fill="none" stroke="var(--border-subtle)" strokeWidth="8"/>
              <circle 
                cx="40" 
                cy="40" 
                r="36" 
                fill="none" 
                stroke={healthColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 36}`}
                strokeDashoffset={`${2 * Math.PI * 36 * (1 - fleet.healthScore / 100)}`}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold font-mono-nums" style={{ color: healthColor }}>
                {fleet.healthScore}
              </span>
              <span className="text-[12px] text-[var(--text-tertiary)]">HEALTH</span>
            </div>
          </div>
          
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">Network Health</h1>
            <p className="text-sm text-[var(--text-tertiary)]">
              Last updated {lastUpdated}s ago
              {lastUpdated < 3 && (
                <span className="inline-flex items-center gap-1 ml-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]"></span>
                  </span>
                  <span className="text-[var(--success)] text-xs">Live</span>
                </span>
              )}
            </p>
          </div>
        </div>
        
        {/* Stats Row */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <StatBox label="Total Nodes" value={fleet.totalNodes} />
          <StatBox label="Healthy" value={fleet.healthyNodes} color="#10B981" />
          <StatBox label="Syncing" value={fleet.syncingNodes} color="#F59E0B" />
          <StatBox label="Offline" value={fleet.offlineNodes} color="#EF4444" />
          <StatBox label="Total Peers" value={fleet.totalPeers} />
          <StatBox 
            label="Mainnet Tip" 
            value={fleet.mainnetHead > 0 ? fleet.mainnetHead.toLocaleString() : '—'} 
            isNumber={false}
          />
          <StatBox 
            label="Apothem Tip" 
            value={fleet.apothemHead > 0 ? fleet.apothemHead.toLocaleString() : '—'} 
            isNumber={false}
          />
          <StatBox 
            label="Avg Sync" 
            value={`${fleet.avgSyncPercent.toFixed(1)}%`}
            isNumber={false}
            color={fleet.avgSyncPercent >= 90 ? '#10B981' : fleet.avgSyncPercent >= 50 ? '#F59E0B' : '#EF4444'}
          />
        </div>
      </div>
    </div>
  );
}

// Network Stats Bar Component - ethstats-style
function NetworkStatsBar({ 
  stats,
  lastUpdated
}: { 
  stats: NetworkStats | null;
  lastUpdated: number;
}) {
  if (!stats) return null;

  return (
    <div className="bg-gradient-to-r from-[var(--bg-card)] to-[var(--bg-body)] rounded-xl p-4 border border-[var(--border-subtle)] mb-6">
      {/* Top Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
        {/* Best Block */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--accent-blue)]/10">
            <Hash className="w-4 h-4 text-[var(--accent-blue)]" />
          </div>
          <div>
            <p className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wider">Best Block</p>
            <p className="text-lg font-bold text-[var(--text-primary)] font-mono-nums">
              {stats.bestBlock.toLocaleString()}
            </p>
          </div>
          <span className="relative flex h-2 w-2 ml-auto">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]"></span>
          </span>
        </div>

        {/* Avg Block Time */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--success)]/10">
            <Clock className="w-4 h-4 text-[var(--success)]" />
          </div>
          <div>
            <p className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wider">Avg Block Time</p>
            <p className="text-lg font-bold text-[var(--text-primary)] font-mono-nums">
              {stats.avgBlockTime.toFixed(1)}s
            </p>
          </div>
        </div>

        {/* Gas Price */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--warning)]/10">
            <Zap className="w-4 h-4 text-[var(--warning)]" />
          </div>
          <div>
            <p className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wider">Gas Price</p>
            <p className="text-lg font-bold text-[var(--text-primary)] font-mono-nums">
              {stats.gasPrice}
            </p>
          </div>
        </div>

        {/* Active Nodes */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--purple)]/10">
            <Server className="w-4 h-4 text-[var(--purple)]" />
          </div>
          <div>
            <p className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wider">Active Nodes</p>
            <p className="text-lg font-bold text-[var(--text-primary)] font-mono-nums">
              {stats.activeNodes}
            </p>
          </div>
        </div>

        {/* TPS */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--pink)]/10">
            <TrendingUp className="w-4 h-4 text-[var(--pink)]" />
          </div>
          <div>
            <p className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wider">TPS</p>
            <p className="text-lg font-bold text-[var(--text-primary)] font-mono-nums">
              {stats.tps.toFixed(1)}
            </p>
          </div>
        </div>

        {/* Pending Txs */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--bg-hover)]">
            <Flame className="w-4 h-4 text-[var(--text-tertiary)]" />
          </div>
          <div>
            <p className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wider">Pending</p>
            <p className="text-lg font-bold text-[var(--text-primary)] font-mono-nums">
              {stats.pendingTxs}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Row - Epoch Info */}
      <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-tertiary)]">Epoch</span>
          <span className="text-sm font-bold text-[var(--accent-blue)] font-mono-nums">{stats.epoch.number.toLocaleString()}</span>
        </div>
        
        <div className="flex items-center gap-2 flex-1 max-w-[200px]">
          <span className="text-xs text-[var(--text-tertiary)]">Progress</span>
          <div className="flex-1 h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
            <div 
              className="h-full bg-[var(--accent-blue)] rounded-full transition-all duration-500"
              style={{ width: `${stats.epoch.progress}%` }}
            />
          </div>
          <span className="text-xs text-[var(--text-primary)] font-mono-nums">{stats.epoch.progress}%</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-tertiary)]">Remaining</span>
          <span className="text-sm font-bold text-[var(--text-primary)] font-mono-nums">{stats.epoch.blocksRemaining} blocks</span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-[var(--text-tertiary)]">Difficulty</span>
          <span className="text-sm font-bold text-[var(--text-primary)] font-mono-nums">{stats.difficulty}</span>
        </div>

        {lastUpdated < 3 && (
          <span className="text-xs text-[var(--success)]">● Live</span>
        )}
      </div>
    </div>
  );
}

function StatBox({ 
  label, 
  value, 
  color,
  isNumber = true,
  icon
}: { 
  label: string; 
  value: string | number;
  color?: string;
  isNumber?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--bg-hover)] rounded-lg p-3 text-center">
      <div className={`text-lg font-bold font-mono-nums ${color ? '' : 'text-[var(--text-primary)]'}`} style={{ color }}>
        {value}
      </div>
      <div className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wider flex items-center justify-center gap-1">
        {icon}
        {label}
      </div>
    </div>
  );
}

// Node Card Component (Grid View) with 3D styling
function NodeCard({ node, onClick }: { node: Node; onClick: () => void }) {
  const statusLabels = {
    healthy: 'Healthy',
    degraded: 'Degraded',
    syncing: 'Syncing',
    offline: 'Offline',
  };
  
  return (
    <div 
      onClick={onClick}
      className="card-xdc cursor-pointer transition-all duration-300 [perspective:1000px] hover:[transform:translateY(-6px)_translateZ(20px)_rotateX(2deg)] hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5),0_10px_20px_-10px_rgba(0,0,0,0.3)] hover:border-[var(--accent-blue)]/30 group"
      style={{
        transformStyle: 'preserve-3d',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <StatusDot status={node.status} />
            {/* Glow effect for status */}
            <div 
              className={`absolute inset-0 rounded-full blur-sm ${
                node.status === 'healthy' ? 'bg-[var(--success)]' :
                node.status === 'syncing' ? 'bg-[var(--warning)]' :
                'bg-[var(--critical)]'
              } opacity-50`}
            />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)] text-sm truncate max-w-[140px]">{node.name}</h3>
            <p className="text-xs text-[var(--text-tertiary)] truncate max-w-[140px]">{node.host}</p>
          </div>
        </div>
        <RoleBadge role={node.role} />
      </div>
      
      {/* IPv4 Display */}
      {(node.ipv4 || node.host) && (
        <div className="mb-2 flex items-center gap-1.5">
          <Globe className="w-3 h-3 text-[var(--text-tertiary)]" />
          <span className="text-xs font-mono text-[var(--accent-blue)]">{node.ipv4 || node.host}</span>
        </div>
      )}
      
      {/* Node Type and Client Type Badges */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        <NodeTypeBadge nodeType={node.node_type} />
        <ClientTypeBadge clientType={node.client_type} clientVersion={node.clientVersion} />
      </div>
      
      {/* OS Info */}
      {node.os_info && (
        <div className="text-[12px] text-[var(--text-tertiary)] mb-2 flex items-center gap-1">
          <span>{OSIcon({ osType: node.os_info.type })}</span>
          <span className="truncate">{formatOSInfo(node.os_info, node.clientVersion)}</span>
        </div>
      )}
      
      {/* Contact Info (masked) */}
      {(node.email || node.telegram) && (
        <div className="text-[12px] text-[var(--text-tertiary)] mb-2 flex flex-wrap gap-2">
          {node.email && <span>📧 {node.email}</span>}
          {node.telegram && <span>✈️ {node.telegram}</span>}
        </div>
      )}
      
      <div className="space-y-3">
        {/* Block Height */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-tertiary)]">Block</span>
          <div className="text-right">
            <span className="text-sm font-mono-nums font-medium">
              {node.blockHeight > 0 ? node.blockHeight.toLocaleString() : '—'}
            </span>
            {node.networkHeight && node.networkHeight > 0 && (
              <span className="text-xs text-[var(--text-tertiary)] ml-1">
                / {node.networkHeight.toLocaleString()}
              </span>
            )}
          </div>
        </div>
        
        {/* Sync Percentage */}
        {node.networkHeight && node.networkHeight > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-tertiary)]">Sync</span>
            <div className="text-right">
              <span className={`text-sm font-mono-nums font-medium ${
                node.syncPercent >= 99.9 ? 'text-[var(--success)]' :
                node.syncPercent >= 95 ? 'text-[var(--warning)]' :
                'text-[var(--critical)]'
              }`}>
                {node.syncPercent.toFixed(2)}%
              </span>
              {node.syncPercent < 100 && (
                <div className={`text-xs mt-0.5 ${
                  node.syncPercent >= 99.9 ? 'text-[var(--success)]' :
                  node.syncPercent >= 95 ? 'text-[var(--warning)]' :
                  'text-[var(--critical)]'
                }`}>
                  Behind: {(100 - node.syncPercent).toFixed(2)}%
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Block Increase Since Last Update */}
        {node.blockDiff !== undefined && node.blockDiff > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--success)]/10 border border-[var(--success)]/20">
            <TrendingUp className="h-3 w-3 text-[var(--success)]" />
            <span className="text-xs text-[var(--success)] font-medium">
              ↑{node.blockDiff.toLocaleString()} blocks since last update
            </span>
          </div>
        )}
        
        {/* Sync Stall Warning */}
        {node.stallHours && node.stallHours > 0 && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/20">
            <Clock className="h-3.5 w-3.5 text-[var(--warning)]" />
            <span className="text-xs text-[var(--warning)] font-medium">
              Stuck {node.stallHours.toFixed(1)}h at #{node.stalledAtBlock?.toLocaleString()}
            </span>
          </div>
        )}
        
        {/* Block Sparkline */}
        {node.blockHeight > 0 && (
          <MiniSparkline 
            value={node.blockHeight} 
            color={node.status === 'healthy' ? '#10B981' : node.status === 'syncing' ? '#F59E0B' : '#EF4444'} 
          />
        )}
        
        {/* Peak Block */}
        {node.peakBlock && node.peakBlock > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-tertiary)]">Peak Block</span>
            <span className={`text-xs font-mono-nums ${node.peakBlock > node.blockHeight ? 'text-[var(--warning)]' : 'text-[var(--text-secondary)]'}`}>
              {node.peakBlock.toLocaleString()}
              {node.peakBlock > node.blockHeight && ' ⚠'}
            </span>
          </div>
        )}

        {/* Peers */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-tertiary)]">Peers</span>
          <span className="text-sm font-mono-nums">{node.peerCount || 0}</span>
        </div>
        
        {/* Security Score */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-tertiary)]">Security</span>
          <SecurityBadge score={node.security_score} />
        </div>
        
        {/* Resources Mini Bars */}
        {(node.cpuPercent !== null || node.memoryPercent !== null || node.diskPercent !== null) && (
          <div className="space-y-1.5 pt-2 border-t border-[var(--border-subtle)]">
            {node.cpuPercent !== null && (
              <div className="flex items-center gap-2">
                <Cpu className="w-3 h-3 text-[var(--text-tertiary)]" />
                <div className="flex-1">
                  <ProgressBar 
                    value={node.cpuPercent} 
                    color={node.cpuPercent > 80 ? '#EF4444' : node.cpuPercent > 60 ? '#F59E0B' : '#10B981'}
                    height={3}
                  />
                </div>
                <span className="text-[12px] font-mono-nums w-7 text-right">{node.cpuPercent}%</span>
              </div>
            )}
            {node.memoryPercent !== null && (
              <div className="flex items-center gap-2">
                <Wifi className="w-3 h-3 text-[var(--text-tertiary)]" />
                <div className="flex-1">
                  <ProgressBar 
                    value={node.memoryPercent}
                    color={node.memoryPercent > 80 ? '#EF4444' : node.memoryPercent > 60 ? '#F59E0B' : '#10B981'}
                    height={3}
                  />
                </div>
                <span className="text-[12px] font-mono-nums w-7 text-right">{node.memoryPercent}%</span>
              </div>
            )}
            {node.diskPercent !== null && (
              <div className="flex items-center gap-2">
                <HardDrive className="w-3 h-3 text-[var(--text-tertiary)]" />
                <div className="flex-1">
                  <ProgressBar 
                    value={node.diskPercent}
                    color={node.diskPercent > 80 ? '#EF4444' : node.diskPercent > 60 ? '#F59E0B' : '#10B981'}
                    height={3}
                  />
                </div>
                <span className="text-[12px] font-mono-nums w-7 text-right">{node.diskPercent}%</span>
              </div>
            )}
          </div>
        )}
        
        {/* Last Block Update Time */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
          <div className="flex items-center gap-1.5 text-[12px] text-[var(--text-tertiary)]">
            <span className={`w-1.5 h-1.5 rounded-full ${
              node.status === 'healthy' ? 'bg-[var(--success)] animate-pulse' :
              node.status === 'syncing' || node.status === 'degraded' ? 'bg-[var(--warning)]' :
              'bg-[var(--critical)]'
            }`} />
            <Clock className="w-3 h-3" />
            <span>Last update</span>
          </div>
          <span className={`text-[12px] font-medium ${
            node.status === 'healthy' ? 'text-[var(--success)]' :
            node.status === 'syncing' || node.status === 'degraded' ? 'text-[var(--warning)]' :
            'text-[var(--critical)]'
          }`}>
            {node.lastSeen ? formatTimeAgo(node.lastSeen) : 'Never'}
          </span>
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
        <span className="text-xs text-[var(--text-tertiary)]">{statusLabels[node.status]}</span>
        <ArrowRight className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--accent-blue)] transition-colors" />
      </div>
    </div>
  );
}

// Table Header Component
function TableHeader({ 
  label, 
  field, 
  sortField, 
  sortDirection, 
  onSort,
  className = ''
}: { 
  label: string;
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const isActive = sortField === field;
  
  return (
    <th 
      className={`text-left py-3 px-3 text-xs font-medium text-[var(--text-tertiary)] cursor-pointer select-none hover:text-[var(--text-primary)] transition-colors ${className}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className="inline-flex flex-col">
          <ChevronUp 
            className={`w-3 h-3 -mb-1 ${isActive && sortDirection === 'asc' ? 'text-[var(--accent-blue)]' : 'text-transparent'}`} 
          />
          <ChevronDown 
            className={`w-3 h-3 ${isActive && sortDirection === 'desc' ? 'text-[var(--accent-blue)]' : 'text-transparent'}`} 
          />
        </span>
      </div>
    </th>
  );
}

// Table Row Component
function TableRow({ 
  node, 
  onClick, 
  isSelected, 
  onSelect,
  style
}: { 
  node: Node; 
  onClick: () => void;
  isSelected: boolean;
  onSelect: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}) {
  return (
    <tr 
      className="hover:bg-white/[0.03] cursor-pointer transition-colors border-b border-[var(--border-subtle)]"
      onClick={onClick}
      style={style}
    >
      {/* Checkbox */}
      <td className="py-2 px-3" onClick={onSelect}>
        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
          isSelected 
            ? 'bg-[var(--accent-blue)] border-[var(--accent-blue)]' 
            : 'border-[#64748B] hover:border-[var(--accent-blue)]'
        }`}>
          {isSelected && <CheckSquare className="w-3 h-3 text-white" />}
        </div>
      </td>
      
      {/* Status */}
      <td className="py-2 px-3">
        <StatusDot status={node.status} />
      </td>
      
      {/* Name */}
      <td className="py-2 px-3">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[150px]">{node.name}</span>
          <span className="text-[12px] text-[var(--text-tertiary)] truncate max-w-[150px]">{node.host}</span>
        </div>
      </td>
      
      {/* IPv4 */}
      <td className="py-2 px-3">
        <span className="text-xs font-mono text-[var(--accent-blue)]">{node.ipv4 || node.host || '—'}</span>
      </td>
      
      {/* Type */}
      <td className="py-2 px-3">
        <NodeTypeBadge nodeType={node.node_type} />
      </td>
      
      {/* Client */}
      <td className="py-2 px-3">
        <div className="flex items-center gap-1">
          <ClientTypeBadge clientType={node.client_type} clientVersion={node.clientVersion} />
          <span className="text-[12px] text-[var(--text-tertiary)]">
            {node.clientVersion?.split('/')[1]?.split('-')[0] || ''}
          </span>
        </div>
      </td>
      
      {/* Docker Image */}
      <td className="py-2 px-3">
        <span className="text-[11px] font-mono text-[var(--text-tertiary)] truncate max-w-[180px] block" title={node.dockerImage || ''}>
          {node.dockerImage ? `🐳 ${node.dockerImage.split('/').pop()}` : '—'}
        </span>
      </td>
      
      {/* Block */}
      <td className="py-2 px-3">
        <div className="flex flex-col">
          <span className="text-sm font-mono-nums">
            {node.blockHeight > 0 ? node.blockHeight.toLocaleString() : '—'}
          </span>
          {node.syncPercent < 100 && node.networkHeight && (
            <span className={`text-[12px] font-mono-nums ${
              node.syncPercent >= 99 ? 'text-[var(--success)]' : 
              node.syncPercent >= 95 ? 'text-[var(--warning)]' : 
              'text-[var(--critical)]'
            }`}>
              {node.syncPercent.toFixed(2)}% synced
            </span>
          )}
          {node.blockDiff !== undefined && node.blockDiff > 0 && (
            <span className="text-[12px] text-[var(--success)]">
              ↑{node.blockDiff.toLocaleString()}
            </span>
          )}
          {node.stallHours && node.stallHours > 0 && (
            <div className="flex items-center gap-1 mt-0.5" title={`Stuck at block ${node.stalledAtBlock?.toLocaleString()}`}>
              <Clock className="h-3 w-3 text-[var(--warning)]" />
              <span className="text-[12px] text-[var(--warning)]">{node.stallHours.toFixed(1)}h</span>
            </div>
          )}
        </div>
      </td>
      
      {/* Peak Block */}
      <td className="py-2 px-3">
        <div className="flex flex-col">
          <span className="text-xs font-mono-nums text-[var(--text-secondary)]">
            {node.peakBlock ? node.peakBlock.toLocaleString() : '—'}
          </span>
          {node.peakBlock && node.peakBlock > node.blockHeight && (
            <span className="text-[12px] text-[var(--warning)]" title="Node regressed from peak - possible roadblock">
              ⚠ was higher
            </span>
          )}
        </div>
      </td>
      
      {/* Peers */}
      <td className="py-2 px-3">
        <span className="text-sm font-mono-nums">{node.peerCount || 0}</span>
      </td>
      
      {/* Resources: mini ring gauges for CPU / Mem / Disk + OS icon */}
      <td className="py-2 px-3">
        <div className="flex items-center gap-2">
          <MiniRingGauge value={node.cpuPercent} label="CPU" />
          <MiniRingGauge value={node.memoryPercent} label="MEM" />
          <MiniRingGauge value={node.diskPercent} label="DSK" />
          <span className="text-base leading-none ml-0.5" title={node.os_info?.type}>
            {OSIcon({ osType: node.os_info?.type })}
          </span>
        </div>
      </td>
      
      {/* Last Heartbeat */}
      <td className="py-2 px-3">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${
            node.status === 'healthy' ? 'bg-[var(--success)] animate-pulse' :
            node.status === 'syncing' || node.status === 'degraded' ? 'bg-[var(--warning)]' :
            'bg-[var(--critical)]'
          }`} />
          <span className={`text-xs ${
            node.status === 'healthy' ? 'text-[var(--success)]' :
            node.status === 'syncing' || node.status === 'degraded' ? 'text-[var(--warning)]' :
            'text-[var(--critical)]'
          }`}>
            {node.lastSeen ? formatTimeAgo(node.lastSeen) : 'Never'}
          </span>
        </div>
      </td>
    </tr>
  );
}

// Virtual Table Component
function VirtualTable({ 
  nodes, 
  onNodeClick,
  sortField,
  sortDirection,
  onSort,
  selectedNodes,
  onSelectNode,
  onSelectAll,
  onDeleteSelected
}: { 
  nodes: Node[];
  onNodeClick: (node: Node) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  selectedNodes: Set<string>;
  onSelectNode: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onDeleteSelected: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const allSelected = nodes.length > 0 && selectedNodes.size === nodes.length;

  const handleSelectNode = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    onSelectNode(nodeId, !selectedNodes.has(nodeId));
  };
  
  return (
    <div className="card-xdc overflow-hidden">
      <div 
        ref={containerRef}
        className="overflow-auto"
        style={{ maxHeight: 'calc(100vh - 400px)' }}
      >
        <table className="w-full">
          <thead className="sticky top-0 bg-[var(--bg-card)] z-10">
            <tr className="border-b border-[var(--border-subtle)]">
              <th className="py-3 px-3 w-8">
                <div 
                  className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                    allSelected 
                      ? 'bg-[var(--accent-blue)] border-[var(--accent-blue)]' 
                      : selectedNodes.size > 0 
                        ? 'bg-[var(--accent-blue)]/50 border-[var(--accent-blue)]' 
                        : 'border-[#64748B] hover:border-[var(--accent-blue)]'
                  }`}
                  onClick={() => onSelectAll(!allSelected)}
                >
                  {(allSelected || selectedNodes.size > 0) && <CheckSquare className="w-3 h-3 text-white" />}
                </div>
              </th>
              <TableHeader label="" field="status" sortField={sortField} sortDirection={sortDirection} onSort={onSort} className="w-8" />
              <TableHeader label="Name" field="name" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <TableHeader label="IPv4" field="ipv4" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <TableHeader label="Type" field="node_type" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <TableHeader label="Client" field="client_type" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <TableHeader label="Docker Image" field="dockerImage" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <TableHeader label="Block" field="blockHeight" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <TableHeader label="Peak" field="peakBlock" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <TableHeader label="Peers" field="peerCount" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <TableHeader label="Resources" field="cpuPercent" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <TableHeader label="Last Seen" field="lastSeen" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {nodes.map((node) => (
              <TableRow
                key={node.id}
                node={node}
                onClick={() => onNodeClick(node)}
                isSelected={selectedNodes.has(node.id)}
                onSelect={(e) => handleSelectNode(e, node.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination / Status Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-body)]">
        <div className="flex items-center gap-4">
          <span className="text-sm text-[var(--text-tertiary)]">
            Showing {nodes.length} nodes
          </span>
          {selectedNodes.size > 0 && (
            <>
              <span className="text-sm text-[var(--accent-blue)]">
                {selectedNodes.size} selected
              </span>
              <button
                onClick={onDeleteSelected}
                className="px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded transition-colors flex items-center gap-1.5"
              >
                <Trash2 className="w-3 h-3" />
                Delete Selected
              </button>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            className="px-3 py-1.5 text-xs bg-[var(--bg-hover)] hover:bg-[var(--bg-hover)] rounded transition-colors"
          >
            Jump to Top
          </button>
          <button
            onClick={() => containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' })}
            className="px-3 py-1.5 text-xs bg-[var(--bg-hover)] hover:bg-[var(--bg-hover)] rounded transition-colors"
          >
            Jump to Bottom
          </button>
        </div>
      </div>
    </div>
  );
}

// Collapsible Active Incidents Timeline
function IncidentsStrip({ incidents, isCollapsed, onToggle }: { incidents: Incident[]; isCollapsed: boolean; onToggle: () => void }) {
  if (incidents.length === 0) return null;
  
  return (
    <div className="card-xdc mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-[var(--critical)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Active Incidents</h2>
          <span className="px-2 py-0.5 bg-[var(--critical)]/10 text-[var(--critical)] rounded text-xs font-medium">
            {incidents.length}
          </span>
        </div>
        <button
          onClick={onToggle}
          className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
          )}
        </button>
      </div>
      
      {!isCollapsed && (
        <div className="space-y-0 max-h-[300px] overflow-y-auto">
          {incidents.map((incident, idx) => (
            <div key={incident.id} className="flex gap-3 relative">
              {/* Timeline line */}
              {idx < incidents.length - 1 && (
                <div className="absolute left-[11px] top-6 bottom-0 w-px bg-[var(--bg-hover)]" />
              )}
              {/* Dot */}
              <div className="flex-shrink-0 mt-1.5">
                <div className={`w-[10px] h-[10px] rounded-full border-2 ${
                  incident.severity === 'critical' ? 'border-[#EF4444] bg-[var(--critical)]/30' :
                  incident.severity === 'warning' ? 'border-[#F59E0B] bg-[var(--warning)]/30' :
                  'border-[var(--accent-blue)] bg-[var(--accent-blue)]/30'
                }`} />
              </div>
              {/* Content */}
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2 mb-0.5">
                  <SeverityBadge severity={incident.severity} />
                  <span className="text-xs text-[var(--text-tertiary)]">{formatTimeAgo(incident.detected_at)}</span>
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{incident.title}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{incident.node_name}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Filter Bar
// Dropdown filter component
function DropdownFilter({ label, value, options, onChange }: { 
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-2 py-1.5 rounded-lg text-sm bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
    >
      <option value="all">{label}: All</option>
      {options.map(opt => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );
}

function FilterBar({ 
  activeFilter, 
  onFilterChange,
  counts,
  clientFilter,
  onClientFilterChange,
  osFilter,
  onOsFilterChange,
  clients,
  osList,
  showZeroBlockNodes,
  onToggleZeroBlockNodes,
}: { 
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  counts: Record<FilterType, number>;
  clientFilter: string;
  onClientFilterChange: (v: string) => void;
  osFilter: string;
  onOsFilterChange: (v: string) => void;
  clients: string[];
  osList: string[];
  showZeroBlockNodes: boolean;
  onToggleZeroBlockNodes: () => void;
}) {
  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'healthy', label: 'Healthy' },
    { key: 'syncing', label: 'Syncing' },
    { key: 'behind', label: 'Behind' },
    { key: 'active', label: 'Active Only' },
  ];
  
  return (
    <div className="flex flex-wrap items-center gap-2 pb-2">
      <span className="text-sm text-[var(--text-tertiary)] mr-1">Status:</span>
      {filters.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onFilterChange(key)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            activeFilter === key
              ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)] border border-[var(--accent-blue)]/30'
              : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-transparent'
          }`}
        >
          {label}
          <span className={`ml-2 px-1.5 py-0.5 rounded text-[12px] ${
            activeFilter === key ? 'bg-[var(--accent-blue)]/20' : 'bg-[var(--bg-hover)]'
          }`}>
            {counts[key]}
          </span>
        </button>
      ))}
      <span className="mx-1 text-[var(--border-subtle)]">|</span>
      <DropdownFilter label="Client" value={clientFilter} options={clients} onChange={onClientFilterChange} />
      <DropdownFilter label="OS" value={osFilter} options={osList} onChange={onOsFilterChange} />
      
      {/* Zero Block Nodes Toggle */}
      <button
        onClick={onToggleZeroBlockNodes}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
          showZeroBlockNodes
            ? 'bg-[var(--warning)]/20 text-[var(--warning)] border border-[var(--warning)]/30'
            : 'bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] border border-transparent'
        }`}
        title={showZeroBlockNodes ? "Hide 0 block nodes" : "Show 0 block nodes"}
      >
        {showZeroBlockNodes ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        0 Block Nodes
      </button>
    </div>
  );
}

// Bulk Actions Bar
function BulkActionsBar({ 
  selectedCount,
  onClearSelection,
  onDeleteSelected,
}: { 
  selectedCount: number;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
}) {
  if (selectedCount === 0) return null;
  
  return (
    <div className="flex items-center justify-between px-4 py-3 mb-4 bg-[var(--accent-blue)]/10 border border-[var(--accent-blue)]/30 rounded-lg">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-[var(--accent-blue)]">
          {selectedCount} node{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <button
          onClick={onClearSelection}
          className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] underline"
        >
          Clear selection
        </button>
      </div>
      
      <div className="flex items-center gap-2">
        <button
          disabled
          title="Coming soon"
          className="px-3 py-1.5 text-xs bg-[var(--bg-hover)] text-[var(--text-tertiary)] rounded cursor-not-allowed flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          Restart
        </button>
        <button
          disabled
          title="Coming soon"
          className="px-3 py-1.5 text-xs bg-[var(--bg-hover)] text-[var(--text-tertiary)] rounded cursor-not-allowed flex items-center gap-1"
        >
          <Settings className="w-3 h-3" />
          Update
        </button>
        <button
          onClick={onDeleteSelected}
          className="px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded transition-colors flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          Delete
        </button>
      </div>
    </div>
  );
}

// Loading State
function LoadingState() {
  return (
    <DashboardLayout>
      <div className="card-xdc mb-6 h-32 animate-pulse">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-[var(--bg-hover)]"></div>
          <div className="space-y-2">
            <div className="w-32 h-6 bg-[var(--bg-hover)] rounded"></div>
            <div className="w-48 h-4 bg-[var(--bg-hover)] rounded"></div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="card-xdc h-48 animate-pulse">
            <div className="w-full h-full bg-[var(--bg-hover)] rounded"></div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fleet, setFleet] = useState<FleetData | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [peers, setPeers] = useState<HealthyPeersSummary | null>(null);
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null);
  const [filter, setFilter] = useState<FilterType>('all'); // Default to 'all' — show every node including block=0
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [networkFilter, setNetworkFilter] = useState(() => searchParams.get('network') || 'all');
  const [clientFilter, setClientFilter] = useState(() => searchParams.get('client') || 'all');
  const [osFilter, setOsFilter] = useState('all');
  
  // New state for features
  const [showZeroBlockNodes, setShowZeroBlockNodes] = useState(true);
  const [incidentsCollapsed, setIncidentsCollapsed] = useState(false);
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('blockHeight');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Sync filters to URL query string
  useEffect(() => {
    const params = new URLSearchParams();
    if (networkFilter !== 'all') params.set('network', networkFilter);
    if (clientFilter !== 'all') params.set('client', clientFilter);
    const qs = params.toString();
    const newUrl = qs ? `?${qs}` : window.location.pathname;
    window.history.replaceState(null, '', newUrl);
  }, [networkFilter, clientFilter]);
  
  // Selection
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  
  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      
      // Fetch fleet status
      const fleetRes = await fetch('/api/v1/fleet/status', { cache: 'no-store' });
      if (fleetRes.ok) {
        const json = await fleetRes.json();
        const d = json.data || json;
        const counts = d.nodeCounts || d.nodes || {};
        
        // Get nodes array from API, map camelCase→snake_case, filter stale
        const nodeArr: Node[] = (Array.isArray(d.nodes) ? d.nodes : []).map((n: any) => ({
          ...n,
          client_type: n.client_type || n.clientType || 'unknown',
          node_type: n.node_type || n.nodeType || 'fullnode',
          network: n.network || 'mainnet',
        })).filter((n: Node) => !isNodeStale(n));
        
        // Count nodes by status
        const countHealthy = nodeArr.filter(n => n.status === 'healthy').length;
        const countSyncing = nodeArr.filter(n => n.status === 'syncing').length;
        const countOffline = nodeArr.filter(n => n.status === 'offline').length;
        const countDegraded = nodeArr.filter(n => n.status === 'degraded').length;
        
        setFleet({
          totalNodes: nodeArr.length,
          healthyNodes: countHealthy,
          degradedNodes: countDegraded,
          offlineNodes: countOffline,
          syncingNodes: countSyncing,
          healthScore: d.healthScore || 0,
          totalPeers: 0,
          mainnetHead: d.networkHeights?.mainnet || d.maxBlockHeight || 0,
          apothemHead: d.networkHeights?.apothem || 0,
          avgSyncPercent: nodeArr.length > 0 ? nodeArr.reduce((s, n) => s + (n.syncPercent || 0), 0) / nodeArr.length : 0,
          avgBlockHeight: d.avgBlockHeight || 0,
        });
        
        setNodes(nodeArr);
        const inc = d.incidents;
        setIncidents(inc?.active || (Array.isArray(inc) ? inc : []));
      }
      
      // Fetch healthy peers summary
      const peersRes = await fetch('/api/v1/peers/healthy', { cache: 'no-store' });
      if (peersRes.ok) {
        const peersData = await peersRes.json();
        setPeers({
          totalPeers: peersData.totalPeers,
          healthyPeers: peersData.healthyPeers,
        });
      }

      // Fetch network stats
      const networkRes = await fetch('/api/v1/network/stats', { cache: 'no-store' });
      if (networkRes.ok) {
        const networkData = await networkRes.json();
        setNetworkStats(networkData);
      }
      
      setLastUpdated(0);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, REFRESH_INTERVAL * 1000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  // Countdown timer
  useEffect(() => {
    const countdownId = setInterval(() => {
      setLastUpdated(prev => prev + 1);
    }, 1000);
    return () => clearInterval(countdownId);
  }, []);
  
  // Auto-switch to table view when nodes > 10
  useEffect(() => {
    if (nodes.length > 10 && viewMode === 'grid') {
      setViewMode('table');
    }
  }, [nodes.length]);

  // Network-filtered nodes (global filter)
  const globalFilteredNodes = useMemo(() => {
    if (networkFilter === 'all') return nodes;
    return nodes.filter(n => {
      const network = (n as any).network || 'mainnet';
      return network === networkFilter;
    });
  }, [nodes, networkFilter]);

  // Client distribution for donut chart
  const clientDistribution = useMemo(() => {
    const clientColors: Record<string, string> = {
      geth:       '#2563EB', // Blue
      erigon:     '#EA580C', // Orange
      nethermind: '#7C3AED', // Purple
      reth:       '#16A34A', // Green
      xdc:        '#1E90FF', // XDC blue
      unknown:    '#6B7280', // Gray
    };
    const clientDisplayNames: Record<string, string> = {
      geth:       'Geth',
      erigon:     'Erigon',
      nethermind: 'Nethermind',
      reth:       'Reth',
      xdc:        'XDC',
      unknown:    'Unknown',
    };
    const clientIcons: Record<string, string> = {
      geth:       '🔷',
      erigon:     '🔶',
      nethermind: '🟣',
      reth:       '🟢',
      xdc:        '⚡',
      unknown:    '⚪',
    };
    // Normalize: geth-pr5 and other geth variants → 'geth'
    const normalizeClient = (ct: string): string => {
      if (ct === 'geth-pr5' || ct === 'geth-xdc') return 'geth';
      return ct;
    };
    const counts: Record<string, number> = {};
    globalFilteredNodes.forEach(n => {
      const ct = normalizeClient((n.client_type || 'unknown').toLowerCase());
      counts[ct] = (counts[ct] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .map(([type, count]) => ({
        type: clientDisplayNames[type] || type,
        count,
        color: clientColors[type] || '#6B7280',
        icon: clientIcons[type] || '⚪',
        percentage: globalFilteredNodes.length > 0 ? (count / globalFilteredNodes.length) * 100 : 0,
      }));
  }, [globalFilteredNodes]);

  // OS distribution — uses os_release for precise distro label (Ubuntu 22.04, Alpine 3.20, etc.)
  const osDistribution = useMemo(() => {
    // Parse a meaningful short label from os_release string
    const parseOsLabel = (osRelease?: string, osType?: string): string => {
      const r = (osRelease || '').trim();
      if (!r) {
        // Fall back to osType or parse from clientVersion
        const t = (osType || '').toLowerCase();
        if (t === 'linux') return 'Linux';
        if (t === 'darwin') return 'macOS';
        if (t === 'windows') return 'Windows';
        return 'Unknown';
      }
      // Alpine Linux v3.20.x → Alpine 3.20
      const alpine = r.match(/Alpine Linux v?(\d+\.\d+)/i);
      if (alpine) return `Alpine ${alpine[1]}`;
      // Ubuntu 22.04.x LTS → Ubuntu 22.04
      const ubuntu = r.match(/Ubuntu (\d+\.\d+)/i);
      if (ubuntu) return `Ubuntu ${ubuntu[1]}`;
      // Debian GNU/Linux 12 → Debian 12
      const debian = r.match(/Debian[^0-9]*(\d+)/i);
      if (debian) return `Debian ${debian[1]}`;
      // CentOS/RHEL
      const centos = r.match(/(CentOS|Rocky|AlmaLinux)[^0-9]*(\d+)/i);
      if (centos) return `${centos[1]} ${centos[2]}`;
      // Trim overly long strings
      return r.length > 20 ? r.substring(0, 20) : r;
    };
    const osColors: Record<string, string> = {
      'Ubuntu 22.04': '#E95420',
      'Ubuntu 24.04': '#DD4814',
      'Ubuntu 20.04': '#F77F00',
      'Alpine 3.20':  '#0D597F',
      'Alpine 3.19':  '#0D597F',
      'Alpine 3.18':  '#0A4F70',
      'Debian 12':    '#A80030',
      'Debian 11':    '#A80030',
      'Linux':        '#F59E0B',
      'macOS':        '#64748B',
      'Windows':      '#3B82F6',
      'Unknown':      '#6B7280',
    };
    const osIcons: Record<string, string> = {
      'Ubuntu 22.04': '🐧',
      'Ubuntu 24.04': '🐧',
      'Ubuntu 20.04': '🐧',
      'Alpine 3.20':  '🐳',
      'Alpine 3.19':  '🐳',
      'Alpine 3.18':  '🐳',
      'Debian 12':    '🐧',
      'Debian 11':    '🐧',
      'Linux':        '🐧',
      'macOS':        '🍎',
      'Windows':      '🪟',
      'Unknown':      '❓',
    };
    const counts: Record<string, number> = {};
    globalFilteredNodes.forEach(n => {
      const label = parseOsLabel(n.os_info?.release, n.os_info?.type)
        || parseOsFromClientVersion(n.clientVersion).type
        || 'Unknown';
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([,a], [,b]) => b - a)
      .map(([type, count]) => ({
        type,
        count,
        color: osColors[type] || '#6B7280',
        icon: osIcons[type] || '🐧',
        percentage: globalFilteredNodes.length > 0 ? (count / globalFilteredNodes.length) * 100 : 0,
      }));
  }, [globalFilteredNodes]);

  // Version distribution (per client)
  const versionDistribution = useMemo(() => {
    const versions: Record<string, number> = {};
    globalFilteredNodes.forEach(n => {
      const ver = n.clientVersion || 'Unknown';
      // Shorten version string
      const short = ver.length > 30 ? ver.substring(0, 30) + '…' : ver;
      versions[short] = (versions[short] || 0) + 1;
    });
    return Object.entries(versions)
      .sort(([,a], [,b]) => b - a)
      .map(([version, count]) => ({ version, count }));
  }, [globalFilteredNodes]);

  // Filter and sort nodes
  const filteredNodes = useMemo(() => {
    let result = globalFilteredNodes.filter(node => {
      // Zero block nodes filter - hide by default
      if (!showZeroBlockNodes && node.blockHeight === 0) {
        return false;
      }
      
      // Status filter (stale nodes already filtered out at fetch time)
      switch (filter) {
        case 'healthy':
          if (node.status !== 'healthy') return false;
          break;
        case 'syncing':
          if (node.status !== 'syncing') return false;
          break;
        case 'behind':
          if (node.blocksBehind <= 0) return false;
          break;
        case 'active':
          // Show only healthy and syncing (exclude offline and degraded)
          if (node.status !== 'healthy' && node.status !== 'syncing') return false;
          break;
      }
      
      // Client type filter
      if (clientFilter !== 'all') {
        if ((node.client_type || 'unknown').toLowerCase() !== clientFilter) return false;
      }
      
      // OS filter
      if (osFilter !== 'all') {
        const nodeOs = (node.os_info?.type && node.os_info.type !== 'unknown') ? node.os_info.type : (parseOsFromClientVersion(node.clientVersion).type || '');
        if (nodeOs !== osFilter) return false;
      }

      // Search filter
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase();
        const searchable = [
          node.name,
          node.host,
          node.ipv4,
          node.ipv6,
          node.clientVersion,
          node.client_type,
          node.node_type,
          formatOSInfo(node.os_info, node.clientVersion),
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchable.includes(query)) return false;
      }
      
      return true;
    });
    
    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      
      // Handle nested fields
      if (sortField === 'security_score') {
        aVal = a.security_score ?? 0;
        bVal = b.security_score ?? 0;
      }
      
      if (aVal === null || aVal === undefined) aVal = sortDirection === 'asc' ? Infinity : -Infinity;
      if (bVal === null || bVal === undefined) bVal = sortDirection === 'asc' ? Infinity : -Infinity;
      
      if (typeof aVal === 'string') {
        const comparison = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [globalFilteredNodes, filter, debouncedSearch, sortField, sortDirection, clientFilter, osFilter, showZeroBlockNodes]);

  // Calculate filter counts (stale nodes already filtered out at fetch time)
  // Unique client types and OS types for filter dropdowns
  const uniqueClients = useMemo(() => {
    const set = new Set(nodes.map(n => (n.client_type || 'unknown').toLowerCase()).filter(Boolean));
    return Array.from(set).sort();
  }, [nodes]);

  const uniqueOS = useMemo(() => {
    const set = new Set(nodes.map(n => {
      const os = n.os_info?.type && n.os_info.type !== 'unknown' ? n.os_info.type : parseOsFromClientVersion(n.clientVersion).type;
      return os || '';
    }).filter(Boolean));
    return Array.from(set).sort();
  }, [nodes]);

  const filterCounts: Record<FilterType, number> = {
    all: globalFilteredNodes.filter(n => showZeroBlockNodes || n.blockHeight > 0).length,
    healthy: globalFilteredNodes.filter(n => (showZeroBlockNodes || n.blockHeight > 0) && n.status === 'healthy').length,
    syncing: globalFilteredNodes.filter(n => (showZeroBlockNodes || n.blockHeight > 0) && n.status === 'syncing').length,
    behind: globalFilteredNodes.filter(n => (showZeroBlockNodes || n.blockHeight > 0) && n.blocksBehind > 0).length,
    active: globalFilteredNodes.filter(n => (showZeroBlockNodes || n.blockHeight > 0) && (n.status === 'healthy' || n.status === 'syncing')).length,
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectNode = (nodeId: string, selected: boolean) => {
    const newSet = new Set(selectedNodes);
    if (selected) {
      newSet.add(nodeId);
    } else {
      newSet.delete(nodeId);
    }
    setSelectedNodes(newSet);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedNodes(new Set(filteredNodes.map(n => n.id)));
    } else {
      setSelectedNodes(new Set());
    }
  };

  const handleClearSelection = () => {
    setSelectedNodes(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedNodes.size === 0) return;
    
    setDeleting(true);
    try {
      const response = await fetch('/api/v1/nodes/bulk-delete', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer xdc-netown-key-2026-prod',
        },
        body: JSON.stringify({
          nodeIds: Array.from(selectedNodes),
          confirm: true,
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        // Refresh data
        await fetchData();
        setSelectedNodes(new Set());
        setShowDeleteConfirm(false);
        // Show success message
        alert(`Successfully deleted ${result.summary.deleted} node(s)`);
      } else {
        alert(`Delete failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      alert(`Delete failed: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <LoadingState />;
  }

  return (
    <DashboardLayout>
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[var(--critical)]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {networkStats && (
            <NetworkStatsBar 
              stats={networkStats}
              lastUpdated={lastUpdated}
            />
          )}

          {fleet && (
            <div className="flex items-center justify-between mb-2">
              <div />
              <NetworkFilter value={networkFilter} onChange={setNetworkFilter} />
            </div>
          )}

          {fleet && (
            <NetworkHealthBanner 
              fleet={{
                ...fleet,
                totalNodes: globalFilteredNodes.length,
                healthyNodes: globalFilteredNodes.filter(n => n.status === 'healthy').length,
                syncingNodes: globalFilteredNodes.filter(n => n.status === 'syncing').length,
                offlineNodes: globalFilteredNodes.filter(n => n.status === 'offline').length,
                degradedNodes: globalFilteredNodes.filter(n => n.status === 'degraded').length,
              }}
              lastUpdated={lastUpdated}
            />
          )}

          {/* Client Distribution + OS Distribution + Fleet by Network */}
          {globalFilteredNodes.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
              {/* Client Distribution with 3D styling */}
              <div className="card-xdc [perspective:1000px] hover:[transform:translateY(-2px)_rotateX(2deg)] transition-all duration-300">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--accent-blue)]" />
                  Client Distribution
                </h3>
                <ClientDistributionChart 
                  data={clientDistribution} 
                  total={globalFilteredNodes.length}
                  variant="3d-donut"
                />
              </div>

              {/* OS Distribution with 3D styling */}
              <div className="card-xdc [perspective:1000px] hover:[transform:translateY(-2px)_rotateX(2deg)] transition-all duration-300">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--warning)]" />
                  OS Distribution
                </h3>
                <ClientDistributionChart 
                  data={osDistribution.map(os => ({ type: os.type, count: os.count, color: os.color, icon: os.icon }))} 
                  total={globalFilteredNodes.length}
                  variant="3d-donut"
                />
              </div>

              {/* Fleet by Network with 3D bar chart style */}
              <div className="card-xdc lg:col-span-2">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
                  Fleet by Network
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {['mainnet', 'apothem', 'devnet'].map(net => {
                    const count = nodes.filter(n => (n as any).network === net || (net === 'mainnet' && !(n as any).network)).length;
                    const isActive = networkFilter === net;
                    const netHeight = net === 'mainnet' ? (fleet?.mainnetHead || 0) : net === 'apothem' ? (fleet?.apothemHead || 0) : 0;
                    const maxCount = Math.max(...['mainnet', 'apothem', 'devnet'].map(n => 
                      nodes.filter(node => (node as any).network === n || (n === 'mainnet' && !(node as any).network)).length
                    )) || 1;
                    const barHeight = count > 0 ? Math.max(20, (count / maxCount) * 60) : 4;
                    return (
                      <div 
                        key={net} 
                        onClick={() => setNetworkFilter(isActive ? 'all' : net)}
                        className={`relative p-4 rounded-xl text-center cursor-pointer transition-all duration-300 [perspective:500px] hover:[transform:translateZ(10px)_rotateX(-5deg)] ${
                          isActive 
                            ? 'bg-gradient-to-b from-[var(--accent-blue)]/20 to-[var(--accent-blue)]/5 border border-[var(--accent-blue)]/40 shadow-[0_8px_24px_rgba(30,144,255,0.2)]' 
                            : 'bg-[var(--bg-hover)] hover:bg-[var(--bg-hover)]/80 border border-transparent hover:shadow-lg'
                        }`}
                      >
                        {/* 3D Bar effect */}
                        <div className="relative h-16 mb-3 flex items-end justify-center">
                          <div 
                            className="w-12 rounded-t-lg transition-all duration-500 relative"
                            style={{ 
                              height: `${barHeight}px`,
                              background: isActive 
                                ? 'linear-gradient(180deg, var(--accent-blue) 0%, var(--accent-blue)40 100%)'
                                : 'linear-gradient(180deg, var(--text-tertiary) 0%, var(--text-tertiary)40 100%)',
                              boxShadow: isActive 
                                ? '0 4px 16px rgba(30,144,255,0.4), inset 0 1px 0 rgba(255,255,255,0.3)'
                                : '0 2px 8px rgba(0,0,0,0.3)',
                            }}
                          >
                            {/* Top highlight */}
                            <div 
                              className="absolute top-0 left-0 right-0 h-1 rounded-t-lg"
                              style={{
                                background: 'linear-gradient(90deg, rgba(255,255,255,0.4) 0%, transparent 50%, rgba(255,255,255,0.2) 100%)'
                              }}
                            />
                          </div>
                        </div>
                        <div className={`text-2xl font-bold font-mono-nums ${isActive ? 'text-[var(--accent-blue)]' : 'text-[var(--text-primary)]'}`}>{count}</div>
                        <div className="text-xs text-[var(--text-tertiary)] capitalize font-medium">{net}</div>
                        {netHeight > 0 && (
                          <div className="text-[12px] font-mono-nums text-[var(--text-tertiary)] mt-1">
                            #{netHeight.toLocaleString()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Per-network sync summary */}
                <div className="mt-4 space-y-3">
                  {['mainnet', 'apothem'].map(net => {
                    const netNodes = globalFilteredNodes.filter(n => (n as any).network === net || (net === 'mainnet' && !(n as any).network));
                    if (netNodes.length === 0) return null;
                    const avgSync = netNodes.reduce((s, n) => s + (n.syncPercent || 0), 0) / netNodes.length;
                    const syncColor = avgSync >= 90 ? '#10B981' : avgSync >= 50 ? '#F59E0B' : '#EF4444';
                    return (
                      <div key={net} className="p-3 rounded-lg bg-[var(--bg-hover)]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-[var(--text-primary)] capitalize font-medium">{net}</span>
                          <span className="text-sm font-mono-nums font-medium" style={{ color: syncColor }}>{avgSync.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, avgSync)}%`, backgroundColor: syncColor }} />
                        </div>
                        <div className="flex justify-between mt-1 text-[12px] text-[var(--text-tertiary)]">
                          <span>{netNodes.length} node{netNodes.length !== 1 ? 's' : ''}</span>
                          <span>{netNodes.filter(n => n.status === 'healthy').length} healthy</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {incidents.length > 0 && (
            <IncidentsStrip 
              incidents={incidents} 
              isCollapsed={incidentsCollapsed}
              onToggle={() => setIncidentsCollapsed(!incidentsCollapsed)}
            />
          )}

          {/* SkyNet AI Incidents Intelligence Panel */}
          <div className="mb-6">
            <IncidentsPanel refreshInterval={30000} />
          </div>

          <div className="mb-6">
            {/* Header Row */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <Server className="w-5 h-5 text-[var(--accent-blue)]" />
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Nodes</h2>
                <span className="px-2 py-0.5 bg-[var(--bg-hover)] text-[var(--text-tertiary)] rounded text-xs">
                  {filteredNodes.length} of {globalFilteredNodes.length}
                  {networkFilter !== 'all' && ` (${networkFilter})`}
                </span>
                {!showZeroBlockNodes && globalFilteredNodes.some(n => n.blockHeight === 0) && (
                  <span className="px-2 py-0.5 bg-[var(--warning)]/10 text-[var(--warning)] rounded text-xs">
                    {globalFilteredNodes.filter(n => n.blockHeight === 0).length} hidden (0 blocks)
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                  <input
                    type="text"
                    placeholder="Search nodes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[#64748B] focus:outline-none focus:border-[var(--accent-blue)] w-64"
                  />
                </div>
                
                {/* View Toggle */}
                <div className="flex items-center bg-[var(--bg-hover)] rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
                    title="Grid view"
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-2 rounded transition-colors ${viewMode === 'table' ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
                    title="Table view"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
                
                <button
                  onClick={fetchData}
                  className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                  title="Refresh now"
                >
                  <RefreshCw className="w-4 h-4 text-[var(--text-tertiary)]" />
                </button>
              </div>
            </div>

            <FilterBar 
              activeFilter={filter}
              onFilterChange={setFilter}
              counts={filterCounts}
              clientFilter={clientFilter}
              onClientFilterChange={setClientFilter}
              osFilter={osFilter}
              onOsFilterChange={setOsFilter}
              clients={uniqueClients}
              osList={uniqueOS}
              showZeroBlockNodes={showZeroBlockNodes}
              onToggleZeroBlockNodes={() => setShowZeroBlockNodes(!showZeroBlockNodes)}
            />
            
            <BulkActionsBar 
              selectedCount={selectedNodes.size}
              onClearSelection={handleClearSelection}
              onDeleteSelected={() => setShowDeleteConfirm(true)}
            />

            {filteredNodes.length === 0 ? (
              <div className="text-center py-12 text-[var(--text-tertiary)]">
                <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No nodes match the selected filter</p>
                {filter === 'active' && (
                  <p className="text-sm mt-2">Try switching to &quot;All&quot; to see all nodes including offline ones</p>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredNodes.map((node) => (
                  <NodeCard 
                    key={node.id} 
                    node={node}
                    onClick={() => router.push(`/nodes/${node.id}`)}
                  />
                ))}
              </div>
            ) : (
              <VirtualTable
                nodes={filteredNodes}
                onNodeClick={(node) => router.push(`/nodes/${node.id}`)}
                sortField={sortField}
                sortDirection={sortDirection}
                onSort={handleSort}
                selectedNodes={selectedNodes}
                onSelectNode={handleSelectNode}
                onSelectAll={handleSelectAll}
                onDeleteSelected={() => setShowDeleteConfirm(true)}
              />
            )}
          </div>

      {/* Bulk Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                  Delete {selectedNodes.size} Node{selectedNodes.size !== 1 ? 's' : ''}?
                </h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  This will permanently delete all node data including metrics, peers, incidents, and command history. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-[var(--bg-hover)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={deleting}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete Permanently
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div style={{display:'flex',justifyContent:'center',alignItems:'center',height:'100vh',background:'#0A0E1A',color:'#fff'}}>Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
