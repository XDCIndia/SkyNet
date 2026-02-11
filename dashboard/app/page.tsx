'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { 
  Server, 
  Activity, 
  Users, 
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
  ExternalLink
} from 'lucide-react';

const REFRESH_INTERVAL = 10; // 10 seconds

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

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
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

// Node Card Component
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
            <h3 className="font-semibold text-[#F9FAFB] text-sm">{node.name}</h3>
            <p className="text-xs text-[#6B7280]">{node.host}</p>
          </div>
        </div>
        <RoleBadge role={node.role} />
      </div>
      
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

// Healthy Peers Summary
function PeersSummary({ 
  peers,
  onViewPeers 
}: { 
  peers: HealthyPeersSummary | null;
  onViewPeers: () => void;
}) {
  if (!peers) return null;
  
  return (
    <div className="card-xdc mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(30,144,255,0.1)] flex items-center justify-center">
            <Globe className="w-5 h-5 text-[#1E90FF]" />
          </div>
          <div>
            <h3 className="font-semibold text-[#F9FAFB]">Healthy Peers</h3>
            <p className="text-sm text-[#6B7280]">
              {peers.healthyPeers} healthy peers across {peers.totalPeers} unique connections
            </p>
          </div>
        </div>
        
        <button
          onClick={onViewPeers}
          className="flex items-center gap-2 px-4 py-2 bg-[#1E90FF]/10 text-[#1E90FF] rounded-lg hover:bg-[#1E90FF]/20 transition-colors text-sm"
        >
          View Full Peer List
          <ArrowRight className="w-4 h-4" />
        </button>
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
    <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(0);

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

  // Filter nodes
  const filteredNodes = nodes.filter(node => {
    switch (filter) {
      case 'healthy':
        return node.status === 'healthy';
      case 'syncing':
        return node.status === 'syncing';
      case 'behind':
        return node.blocksBehind > 0;
      case 'offline':
        return node.status === 'offline';
      default:
        return true;
    }
  });

  // Calculate filter counts
  const filterCounts: Record<FilterType, number> = {
    all: nodes.length,
    healthy: nodes.filter(n => n.status === 'healthy').length,
    syncing: nodes.filter(n => n.status === 'syncing').length,
    behind: nodes.filter(n => n.blocksBehind > 0).length,
    offline: nodes.filter(n => n.status === 'offline').length,
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

          <PeersSummary 
            peers={peers}
            onViewPeers={() => router.push('/peers/healthy')}
          />

          {incidents.length > 0 && (
            <IncidentsStrip incidents={incidents} />
          )}

          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Server className="w-5 h-5 text-[#1E90FF]" />
                <h2 className="text-lg font-semibold text-[#F9FAFB]">Nodes</h2>
                <span className="px-2 py-0.5 bg-white/10 text-[#6B7280] rounded text-xs">
                  {filteredNodes.length} of {nodes.length}
                </span>
              </div>
              
              <button
                onClick={fetchData}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                title="Refresh now"
              >
                <RefreshCw className="w-4 h-4 text-[#6B7280]" />
              </button>
            </div>

            <FilterBar 
              activeFilter={filter}
              onFilterChange={setFilter}
              counts={filterCounts}
            />

            {filteredNodes.length === 0 ? (
              <div className="text-center py-12 text-[#6B7280]">
                <Server className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No nodes match the selected filter</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredNodes.map((node) => (
                  <NodeCard 
                    key={node.id} 
                    node={node}
                    onClick={() => router.push(`/nodes/${node.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
