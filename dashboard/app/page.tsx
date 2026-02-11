'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
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
  Shield
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
  security_score?: number;
  security_issues?: string;
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

type FilterType = 'all' | 'healthy' | 'syncing' | 'behind' | 'offline';
type ViewMode = 'grid' | 'table';
type SortField = keyof Node | 'security_score';
type SortDirection = 'asc' | 'desc';

function StatusDot({ status }: { status: string }) {
  const colors = {
    healthy: 'bg-[#10B981]',
    degraded: 'bg-[#F59E0B]',
    syncing: 'bg-[#F59E0B]',
    offline: 'bg-[#EF4444]',
  };
  
  return (
    <span className={`inline-flex w-2.5 h-2.5 rounded-full ${colors[status as keyof typeof colors] || colors.offline} ${status !== 'healthy' ? 'animate-pulse' : ''}`} />
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
    <span className={`px-2 py-0.5 text-[10px] font-medium rounded border ${colors[role] || colors.fullnode}`}>
      {role.toUpperCase()}
    </span>
  );
}

// Node Type Badge (masternode/standby/fullnode)
function NodeTypeBadge({ nodeType }: { nodeType?: string }) {
  if (!nodeType) return null;
  
  const styles: Record<string, { bg: string; icon: React.ReactNode }> = {
    masternode: { 
      bg: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20', 
      icon: <Pickaxe className="w-3 h-3" /> 
    },
    standby: { 
      bg: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20', 
      icon: <Clock className="w-3 h-3" /> 
    },
    fullnode: { 
      bg: 'bg-[#1E90FF]/10 text-[#1E90FF] border-[#1E90FF]/20', 
      icon: <Link2 className="w-3 h-3" /> 
    },
  };
  
  const style = styles[nodeType.toLowerCase()] || styles.fullnode;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border ${style.bg}`}>
      {style.icon}
      {nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}
    </span>
  );
}

// Client Type Badge (XDC/Erigon/Geth)
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
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border ${style.bg}`}>
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
    <span className={`px-2 py-0.5 text-[10px] font-medium rounded border ${styles[severity]}`}>
      {severity.toUpperCase()}
    </span>
  );
}

function ProgressBar({ value, color = '#1E90FF', height = 6 }: { value: number; color?: string; height?: number }) {
  const clampedValue = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full bg-white/10 rounded-full overflow-hidden" style={{ height }}>
      <div 
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${clampedValue}%`, backgroundColor: color }}
      />
    </div>
  );
}

// Compact metric bar for table view
function CompactMetricBar({ value, label }: { value: number | null; label: string }) {
  if (value === null) return <span className="text-[#6B7280]">—</span>;
  
  const color = value > 80 ? '#EF4444' : value > 60 ? '#F59E0B' : '#10B981';
  
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1">
        <ProgressBar value={value} color={color} height={4} />
      </div>
      <span className="text-[10px] font-mono w-7 text-right text-[#6B7280]">{value}%</span>
    </div>
  );
}

// Security score badge
function SecurityBadge({ score }: { score?: number }) {
  if (score === undefined || score === null) return <span className="text-[#6B7280]">—</span>;
  
  const color = score >= 90 ? '#10B981' : score >= 70 ? '#1E90FF' : score >= 50 ? '#F59E0B' : '#EF4444';
  
  return (
    <span 
      className="inline-flex items-center justify-center w-8 h-5 rounded text-[10px] font-bold font-mono"
      style={{ backgroundColor: `${color}20`, color }}
    >
      {score}
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

// Format OS info for display
function formatOSInfo(os_info?: Node['os_info']): string {
  if (!os_info) return '';
  return os_info.release || '';
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
              <circle cx="40" cy="40" r="36" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8"/>
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
              <span className="text-[10px] text-[#6B7280]">HEALTH</span>
            </div>
          </div>
          
          <div>
            <h1 className="text-xl font-semibold text-[#F9FAFB]">Network Health</h1>
            <p className="text-sm text-[#6B7280]">
              Last updated {lastUpdated}s ago
              {lastUpdated < 3 && (
                <span className="inline-flex items-center gap-1 ml-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]"></span>
                  </span>
                  <span className="text-[#10B981] text-xs">Live</span>
                </span>
              )}
            </p>
          </div>
        </div>
        
        {/* Stats Row */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatBox label="Total Nodes" value={fleet.totalNodes} />
          <StatBox label="Healthy" value={fleet.healthyNodes} color="#10B981" />
          <StatBox label="Syncing" value={fleet.syncingNodes} color="#F59E0B" />
          <StatBox label="Offline" value={fleet.offlineNodes} color="#EF4444" />
          <StatBox label="Total Peers" value={fleet.totalPeers} />
          <StatBox 
            label="Mainnet Block" 
            value={fleet.mainnetHead > 0 ? fleet.mainnetHead.toLocaleString() : '—'} 
            isNumber={false}
          />
          <StatBox 
            label="Masternodes" 
            value={masternodeCount} 
            icon=<Pickaxe className="w-3 h-3 text-[#F59E0B]" />
          />
        </div>
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
    <div className="bg-white/5 rounded-lg p-3 text-center">
      <div className={`text-lg font-bold font-mono-nums ${color ? '' : 'text-[#F9FAFB]'}`} style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] text-[#6B7280] uppercase tracking-wider flex items-center justify-center gap-1">
        {icon}
        {label}
      </div>
    </div>
  );
}

// Node Card Component (Grid View)
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
      className="card-xdc cursor-pointer hover:border-[#1E90FF]/30 transition-all hover:bg-[#111827]/80 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusDot status={node.status} />
          <div>
            <h3 className="font-semibold text-[#F9FAFB] text-sm truncate max-w-[140px]">{node.name}</h3>
            <p className="text-xs text-[#6B7280] truncate max-w-[140px]">{node.host}</p>
          </div>
        </div>
        <RoleBadge role={node.role} />
      </div>
      
      {/* IPv4 Display */}
      {node.ipv4 && (
        <div className="mb-2 text-xs">
          <span className="font-mono text-[#1E90FF]">{node.ipv4}</span>
        </div>
      )}
      
      {/* Node Type and Client Type Badges */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        <NodeTypeBadge nodeType={node.node_type} />
        <ClientTypeBadge clientType={node.client_type} />
      </div>
      
      {/* OS Info */}
      {node.os_info && (
        <div className="text-[10px] text-[#6B7280] mb-2 flex items-center gap-1">
          <span>{OSIcon({ osType: node.os_info.type })}</span>
          <span className="truncate">{formatOSInfo(node.os_info)}</span>
        </div>
      )}
      
      <div className="space-y-3">
        {/* Block Height */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#6B7280]">Block</span>
          <div className="text-right">
            <span className="text-sm font-mono-nums font-medium">
              {node.blockHeight > 0 ? node.blockHeight.toLocaleString() : '—'}
            </span>
            {node.blocksBehind > 0 && (
              <span className="text-xs text-[#F59E0B] ml-2">
                -{node.blocksBehind}
              </span>
            )}
          </div>
        </div>
        
        {/* Peers */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#6B7280]">Peers</span>
          <span className="text-sm font-mono-nums">{node.peerCount || 0}</span>
        </div>
        
        {/* Security Score */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#6B7280]">Security</span>
          <SecurityBadge score={node.security_score} />
        </div>
        
        {/* Resources Mini Bars */}
        {(node.cpuPercent !== null || node.memoryPercent !== null || node.diskPercent !== null) && (
          <div className="space-y-1.5 pt-2 border-t border-white/5">
            {node.cpuPercent !== null && (
              <div className="flex items-center gap-2">
                <Cpu className="w-3 h-3 text-[#6B7280]" />
                <div className="flex-1">
                  <ProgressBar 
                    value={node.cpuPercent} 
                    color={node.cpuPercent > 80 ? '#EF4444' : node.cpuPercent > 60 ? '#F59E0B' : '#10B981'}
                    height={3}
                  />
                </div>
                <span className="text-[10px] font-mono-nums w-7 text-right">{node.cpuPercent}%</span>
              </div>
            )}
            {node.memoryPercent !== null && (
              <div className="flex items-center gap-2">
                <Wifi className="w-3 h-3 text-[#6B7280]" />
                <div className="flex-1">
                  <ProgressBar 
                    value={node.memoryPercent}
                    color={node.memoryPercent > 80 ? '#EF4444' : node.memoryPercent > 60 ? '#F59E0B' : '#10B981'}
                    height={3}
                  />
                </div>
                <span className="text-[10px] font-mono-nums w-7 text-right">{node.memoryPercent}%</span>
              </div>
            )}
            {node.diskPercent !== null && (
              <div className="flex items-center gap-2">
                <HardDrive className="w-3 h-3 text-[#6B7280]" />
                <div className="flex-1">
                  <ProgressBar 
                    value={node.diskPercent}
                    color={node.diskPercent > 80 ? '#EF4444' : node.diskPercent > 60 ? '#F59E0B' : '#10B981'}
                    height={3}
                  />
                </div>
                <span className="text-[10px] font-mono-nums w-7 text-right">{node.diskPercent}%</span>
              </div>
            )}
          </div>
        )}
        
        {/* Last Seen */}
        <div className="flex items-center gap-1 text-[10px] text-[#6B7280] pt-2 border-t border-white/5">
          <Clock className="w-3 h-3" />
          {node.lastSeen ? formatTimeAgo(node.lastSeen) : 'Never'}
        </div>
      </div>
      
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
        <span className="text-xs text-[#6B7280]">{statusLabels[node.status]}</span>
        <ArrowRight className="w-4 h-4 text-[#6B7280] group-hover:text-[#1E90FF] transition-colors" />
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
      className={`text-left py-3 px-3 text-xs font-medium text-[#6B7280] cursor-pointer select-none hover:text-[#F9FAFB] transition-colors ${className}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className="inline-flex flex-col">
          <ChevronUp 
            className={`w-3 h-3 -mb-1 ${isActive && sortDirection === 'asc' ? 'text-[#1E90FF]' : 'text-transparent'}`} 
          />
          <ChevronDown 
            className={`w-3 h-3 ${isActive && sortDirection === 'desc' ? 'text-[#1E90FF]' : 'text-transparent'}`} 
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
      className="hover:bg-white/[0.03] cursor-pointer transition-colors border-b border-white/5"
      onClick={onClick}
      style={style}
    >
      {/* Checkbox */}
      <td className="py-2 px-3" onClick={onSelect}>
        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
          isSelected 
            ? 'bg-[#1E90FF] border-[#1E90FF]' 
            : 'border-[#6B7280] hover:border-[#1E90FF]'
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
          <span className="text-sm font-medium text-[#F9FAFB] truncate max-w-[150px]">{node.name}</span>
          <span className="text-[10px] text-[#6B7280] truncate max-w-[150px]">{node.host}</span>
        </div>
      </td>
      
      {/* IPv4 */}
      <td className="py-2 px-3">
        <span className="text-xs font-mono text-[#1E90FF]">{node.ipv4 || '—'}</span>
      </td>
      
      {/* Type */}
      <td className="py-2 px-3">
        <NodeTypeBadge nodeType={node.node_type} />
      </td>
      
      {/* Client */}
      <td className="py-2 px-3">
        <div className="flex items-center gap-1">
          <ClientTypeBadge clientType={node.client_type} />
          <span className="text-[10px] text-[#6B7280]">
            {node.clientVersion?.split('/')[1]?.split('-')[0] || ''}
          </span>
        </div>
      </td>
      
      {/* Block */}
      <td className="py-2 px-3">
        <div className="flex flex-col">
          <span className="text-sm font-mono-nums">
            {node.blockHeight > 0 ? node.blockHeight.toLocaleString() : '—'}
          </span>
          {node.blocksBehind > 0 && (
            <span className="text-[10px] text-[#F59E0B]">-{node.blocksBehind}</span>
          )}
        </div>
      </td>
      
      {/* Behind */}
      <td className="py-2 px-3">
        <span className={`text-xs font-mono-nums ${node.blocksBehind > 100 ? 'text-[#EF4444]' : node.blocksBehind > 10 ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>
          {node.blocksBehind || 0}
        </span>
      </td>
      
      {/* Peers */}
      <td className="py-2 px-3">
        <span className="text-sm font-mono-nums">{node.peerCount || 0}</span>
      </td>
      
      {/* CPU */}
      <td className="py-2 px-3 w-20">
        <CompactMetricBar value={node.cpuPercent} label="CPU" />
      </td>
      
      {/* Memory */}
      <td className="py-2 px-3 w-20">
        <CompactMetricBar value={node.memoryPercent} label="Mem" />
      </td>
      
      {/* Disk */}
      <td className="py-2 px-3 w-20">
        <CompactMetricBar value={node.diskPercent} label="Disk" />
      </td>
      
      {/* OS */}
      <td className="py-2 px-3">
        <div className="flex items-center gap-1">
          <span>{OSIcon({ osType: node.os_info?.type })}</span>
          <span className="text-xs text-[#6B7280] truncate max-w-[100px]">
            {formatOSInfo(node.os_info)}
          </span>
        </div>
      </td>
      
      {/* Security */}
      <td className="py-2 px-3">
        <SecurityBadge score={node.security_score} />
      </td>
      
      {/* Last Seen */}
      <td className="py-2 px-3">
        <span className="text-xs text-[#6B7280]">
          {node.lastSeen ? formatTimeAgo(node.lastSeen) : 'Never'}
        </span>
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
  onSelectAll
}: { 
  nodes: Node[];
  onNodeClick: (node: Node) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  selectedNodes: Set<string>;
  onSelectNode: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const updateHeight = () => {
      setContainerHeight(container.clientHeight);
    };
    
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);
  
  const allSelected = nodes.length > 0 && selectedNodes.size === nodes.length;
  
  // Calculate visible range
  const totalHeight = nodes.length * TABLE_ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / TABLE_ROW_HEIGHT) - BUFFER_ROWS);
  const visibleCount = Math.ceil(containerHeight / TABLE_ROW_HEIGHT) + 2 * BUFFER_ROWS;
  const endIndex = Math.min(nodes.length, startIndex + visibleCount);
  
  const visibleNodes = nodes.slice(startIndex, endIndex);
  const offsetY = startIndex * TABLE_ROW_HEIGHT;
  
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };
  
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
        onScroll={handleScroll}
      >
        <table className="w-full">
          <thead className="sticky top-0 bg-[#111827] z-10">
            <tr className="border-b border-white/10">
              <th className="py-3 px-3 w-8">
                <div 
                  className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                    allSelected 
                      ? 'bg-[#1E90FF] border-[#1E90FF]' 
                      : selectedNodes.size > 0 
                        ? 'bg-[#1E90FF]/50 border-[#1E90FF]' 
                        : 'border-[#6B7280] hover:border-[#1E90FF]'
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
              <TableHeader label="Block" field="blockHeight" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <TableHeader label="Behind" field="blocksBehind" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <TableHeader label="Peers" field="peerCount" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <TableHeader label="CPU" field="cpuPercent" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <TableHeader label="Mem" field="memoryPercent" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <TableHeader label="Disk" field="diskPercent" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <TableHeader label="OS" field="os_info" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <TableHeader label="Sec" field="security_score" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
              <TableHeader label="Last Seen" field="lastSeen" sortField={sortField} sortDirection={sortDirection} onSort={onSort} />
            </tr>
          </thead>
          <tbody className="relative">
            <tr style={{ height: offsetY }} />
            {visibleNodes.map((node) => (
              <TableRow
                key={node.id}
                node={node}
                onClick={() => onNodeClick(node)}
                isSelected={selectedNodes.has(node.id)}
                onSelect={(e) => handleSelectNode(e, node.id)}
              />
            ))}
            <tr style={{ height: totalHeight - offsetY - visibleNodes.length * TABLE_ROW_HEIGHT }} />
          </tbody>
        </table>
      </div>
      
      {/* Pagination / Status Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-[#0A0E1A]">
        <div className="flex items-center gap-4">
          <span className="text-sm text-[#6B7280]">
            Showing {startIndex + 1}-{Math.min(endIndex, nodes.length)} of {nodes.length} nodes
          </span>
          {selectedNodes.size > 0 && (
            <span className="text-sm text-[#1E90FF]">
              {selectedNodes.size} selected
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 rounded transition-colors"
          >
            Jump to Top
          </button>
          <button
            onClick={() => containerRef.current?.scrollTo({ top: totalHeight, behavior: 'smooth' })}
            className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 rounded transition-colors"
          >
            Jump to Bottom
          </button>
        </div>
      </div>
    </div>
  );
}

// Active Incidents Strip
function IncidentsStrip({ incidents }: { incidents: Incident[] }) {
  if (incidents.length === 0) return null;
  
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="w-5 h-5 text-[#EF4444]" />
        <h2 className="text-lg font-semibold text-[#F9FAFB]">Active Incidents</h2>
        <span className="px-2 py-0.5 bg-[#EF4444]/10 text-[#EF4444] rounded text-xs font-medium">
          {incidents.length}
        </span>
      </div>
      
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {incidents.map((incident) => (
          <div 
            key={incident.id}
            className="flex-shrink-0 w-72 p-4 bg-[#111827] border border-[#EF4444]/20 rounded-xl"
          >
            <div className="flex items-center gap-2 mb-2">
              <SeverityBadge severity={incident.severity} />
              <span className="text-xs text-[#6B7280]">{formatTimeAgo(incident.detected_at)}</span>
            </div>
            <p className="text-sm font-medium text-[#F9FAFB] mb-1">{incident.title}</p>
            <p className="text-xs text-[#6B7280]">{incident.node_name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Filter Bar
function FilterBar({ 
  activeFilter, 
  onFilterChange,
  counts
}: { 
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  counts: Record<FilterType, number>;
}) {
  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'healthy', label: 'Healthy' },
    { key: 'syncing', label: 'Syncing' },
    { key: 'behind', label: 'Behind' },
    { key: 'offline', label: 'Offline' },
  ];
  
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      <span className="text-sm text-[#6B7280] mr-2">Filter:</span>
      {filters.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onFilterChange(key)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
            activeFilter === key
              ? 'bg-[#1E90FF]/20 text-[#1E90FF] border border-[#1E90FF]/30'
              : 'bg-white/5 text-[#9CA3AF] hover:bg-white/10 border border-transparent'
          }`}
        >
          {label}
          <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${
            activeFilter === key ? 'bg-[#1E90FF]/20' : 'bg-white/10'
          }`}>
            {counts[key]}
          </span>
        </button>
      ))}
    </div>
  );
}

// Bulk Actions Bar
function BulkActionsBar({ 
  selectedCount,
  onClearSelection
}: { 
  selectedCount: number;
  onClearSelection: () => void;
}) {
  if (selectedCount === 0) return null;
  
  return (
    <div className="flex items-center justify-between px-4 py-3 mb-4 bg-[#1E90FF]/10 border border-[#1E90FF]/30 rounded-lg">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-[#1E90FF]">
          {selectedCount} node{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <button
          onClick={onClearSelection}
          className="text-xs text-[#6B7280] hover:text-[#F9FAFB] underline"
        >
          Clear selection
        </button>
      </div>
      
      <div className="flex items-center gap-2">
        <button
          disabled
          title="Coming soon"
          className="px-3 py-1.5 text-xs bg-white/5 text-[#6B7280] rounded cursor-not-allowed flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          Restart
        </button>
        <button
          disabled
          title="Coming soon"
          className="px-3 py-1.5 text-xs bg-white/5 text-[#6B7280] rounded cursor-not-allowed flex items-center gap-1"
        >
          <Settings className="w-3 h-3" />
          Update
        </button>
        <button
          disabled
          title="Coming soon"
          className="px-3 py-1.5 text-xs bg-white/5 text-[#6B7280] rounded cursor-not-allowed flex items-center gap-1"
        >
          <MoreHorizontal className="w-3 h-3" />
          More
        </button>
      </div>
    </div>
  );
}

// Loading State
function LoadingState() {
  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      <Sidebar />
      <main className="lg:ml-[220px] min-h-screen pb-20 lg:pb-6">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
          <div className="card-xdc mb-6 h-32 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-white/5"></div>
              <div className="space-y-2">
                <div className="w-32 h-6 bg-white/5 rounded"></div>
                <div className="w-48 h-4 bg-white/5 rounded"></div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="card-xdc h-48 animate-pulse">
                <div className="w-full h-full bg-white/5 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [fleet, setFleet] = useState<FleetData | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [peers, setPeers] = useState<HealthyPeersSummary | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(0);
  
  // Sorting
  const [sortField, setSortField] = useState<SortField>('lastSeen');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
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
        const fleetData = await fleetRes.json();
        setFleet(fleetData.fleet);
        setNodes(fleetData.nodes || []);
        setIncidents(fleetData.incidents?.active || []);
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

  // Filter and sort nodes
  const filteredNodes = useMemo(() => {
    let result = nodes.filter(node => {
      // Status filter
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
        case 'offline':
          if (node.status !== 'offline') return false;
          break;
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
          formatOSInfo(node.os_info),
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
  }, [nodes, filter, debouncedSearch, sortField, sortDirection]);

  // Calculate filter counts
  const filterCounts: Record<FilterType, number> = {
    all: nodes.length,
    healthy: nodes.filter(n => n.status === 'healthy').length,
    syncing: nodes.filter(n => n.status === 'syncing').length,
    behind: nodes.filter(n => n.blocksBehind > 0).length,
    offline: nodes.filter(n => n.status === 'offline').length,
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

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      <Sidebar />

      <main className="lg:ml-[220px] min-h-screen pb-20 lg:pb-6">
        <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-4">
          
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[#EF4444]">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {fleet && (
            <NetworkHealthBanner 
              fleet={fleet}
              lastUpdated={lastUpdated}
            />
          )}

          {incidents.length > 0 && (
            <IncidentsStrip incidents={incidents} />
          )}

          <div className="mb-6">
            {/* Header Row */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <Server className="w-5 h-5 text-[#1E90FF]" />
                <h2 className="text-lg font-semibold text-[#F9FAFB]">Nodes</h2>
                <span className="px-2 py-0.5 bg-white/10 text-[#6B7280] rounded text-xs">
                  {filteredNodes.length} of {nodes.length}
                </span>
              </div>
              
              <div className="flex items-center gap-3">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  <input
                    type="text"
                    placeholder="Search nodes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-[#F9FAFB] placeholder-[#6B7280] focus:outline-none focus:border-[#1E90FF] w-64"
                  />
                </div>
                
                {/* View Toggle */}
                <div className="flex items-center bg-white/5 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded transition-colors ${viewMode === 'grid' ? 'bg-[#1E90FF]/20 text-[#1E90FF]' : 'text-[#6B7280] hover:text-[#F9FAFB]'}`}
                    title="Grid view"
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`p-2 rounded transition-colors ${viewMode === 'table' ? 'bg-[#1E90FF]/20 text-[#1E90FF]' : 'text-[#6B7280] hover:text-[#F9FAFB]'}`}
                    title="Table view"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
                
                <button
                  onClick={fetchData}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  title="Refresh now"
                >
                  <RefreshCw className="w-4 h-4 text-[#6B7280]" />
                </button>
              </div>
            </div>

            <FilterBar 
              activeFilter={filter}
              onFilterChange={setFilter}
              counts={filterCounts}
            />
            
            <BulkActionsBar 
              selectedCount={selectedNodes.size}
              onClearSelection={handleClearSelection}
            />

            {filteredNodes.length === 0 ? (
              <div className="text-center py-12 text-[#6B7280]">
                <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No nodes match the selected filter</p>
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
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
