'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { 
  Server, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronRight,
  RefreshCw,
  FileText,
  Play,
  Plus,
  Clock,
  MapPin,
  Cpu,
  HardDrive,
  MemoryStick,
  Activity,
  X,
  Wifi
} from 'lucide-react';

type NodeStatus = 'online' | 'degraded' | 'offline';
type NodeRole = 'masternode' | 'fullnode' | 'archive' | 'rpc';

interface FleetNode {
  id: string;
  name: string;
  host: string;
  role: NodeRole;
  location_city: string;
  location_country: string;
  is_active: boolean;
  block_height: number;
  sync_percent: number;
  peer_count: number;
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  rpc_latency_ms: number;
  is_syncing: boolean;
  client_version: string;
  last_seen: string;
  status: NodeStatus;
}

interface Incident {
  id: number;
  node_id: string;
  node_name: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  status: string;
  detected_at: string;
  resolved_at: string | null;
}

function StatusDot({ status }: { status: NodeStatus }) {
  const colors = {
    online: 'bg-[#10B981]',
    degraded: 'bg-[#F59E0B]',
    offline: 'bg-[#EF4444]',
  };
  
  return (
    <span className={`inline-flex w-2.5 h-2.5 rounded-full ${colors[status]} ${status !== 'online' ? 'animate-pulse' : ''}`} />
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
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

function getNodeStatus(lastSeen: string | null): NodeStatus {
  if (!lastSeen) return 'offline';
  
  const diff = Date.now() - new Date(lastSeen).getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 2) return 'online';
  if (minutes < 5) return 'degraded';
  return 'offline';
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-24 right-6 bg-[#111827] border border-white/10 rounded-lg px-4 py-3 shadow-lg z-50 flex items-center gap-3 animate-fade-in">
      <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
      <span className="text-sm">{message}</span>
      <button onClick={onClose} className="text-[#64748B] hover:text-white">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function DiagnosticsRow({ nodeId, onAction }: { nodeId: string; onAction: (action: string, node: string) => void }) {
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const runDiagnostic = async (command: string) => {
    setRunning(command);
    try {
      const res = await fetch('/api/diagnostics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, command }),
      });
      const data = await res.json();
      setResult(data);
      onAction(`Diagnostic: ${command}`, nodeId);
    } catch (err) {
      console.error('Diagnostic failed:', err);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="col-span-full bg-[#0A0E1A]/50 p-4 rounded-lg mt-2">
      <div className="flex flex-wrap gap-3 mb-4">
        {['health_check', 'sync_status', 'peer_discovery', 'disk_usage', 'memory_profile', 'rpc_test'].map((cmd) => (
          <button
            key={cmd}
            onClick={() => runDiagnostic(cmd)}
            disabled={running === cmd}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {running === cmd ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Activity className="w-4 h-4 text-[#1E90FF]" />
            )}
            {cmd.replace('_', ' ')}
          </button>
        ))}
      </div>
      
      {result && (
        <div className="bg-white/5 rounded-lg p-3 text-sm font-mono overflow-x-auto">
          <pre className="text-xs">{JSON.stringify(result.result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default function FleetPage() {
  const router = useRouter();
  const [nodes, setNodes] = useState<FleetNode[]>([]);
  const [stats, setStats] = useState({
    totalNodes: 0,
    healthyNodes: 0,
    degradedNodes: 0,
    offlineNodes: 0,
    healthScore: 0,
    maxBlockHeight: 0,
  });
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<NodeRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<NodeStatus | 'all'>('all');
  const [toast, setToast] = useState<string | null>(null);

  // WebSocket for live updates
  const { incidents: wsIncidents, connected: wsConnected } = useWebSocket();

  const fetchFleet = useCallback(async () => {
    try {
      const [fleetRes, incidentsRes] = await Promise.all([
        fetch('/api/v1/fleet/status', { cache: 'no-store' }),
        fetch('/api/incidents?status=active', { cache: 'no-store' }),
      ]);

      if (fleetRes.ok) {
        const fleetData = await fleetRes.json();
        
        // Map nodes with calculated status
        const mappedNodes: FleetNode[] = fleetData.nodes.map((n: any) => ({
          id: n.id,
          name: n.name,
          host: n.host,
          role: n.role,
          location_city: n.location_city || 'Unknown',
          location_country: n.location_country || 'XX',
          is_active: n.isActive,
          block_height: n.blockHeight || 0,
          sync_percent: n.syncPercent || 0,
          peer_count: n.peerCount || 0,
          cpu_percent: n.cpuPercent || 0,
          memory_percent: n.memoryPercent || 0,
          disk_percent: n.diskPercent || 0,
          rpc_latency_ms: n.rpcLatencyMs || 0,
          is_syncing: n.isSyncing || false,
          client_version: n.clientVersion || 'Unknown',
          last_seen: n.lastSeen,
          status: getNodeStatus(n.lastSeen),
        }));
        
        setNodes(mappedNodes);
        setStats({
          totalNodes: fleetData.fleet.totalNodes,
          healthyNodes: fleetData.fleet.healthyNodes,
          degradedNodes: mappedNodes.filter(n => n.status === 'degraded').length,
          offlineNodes: fleetData.fleet.offlineNodes,
          healthScore: fleetData.fleet.healthScore,
          maxBlockHeight: Math.max(...mappedNodes.map(n => n.block_height), 0),
        });
      }

      if (incidentsRes.ok) {
        const incidentsData = await incidentsRes.json();
        setIncidents(incidentsData.incidents || []);
      }
    } catch (err) {
      console.error('Failed to fetch fleet:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFleet();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchFleet, 10000);
    return () => clearInterval(interval);
  }, [fetchFleet]);

  // Update incidents from WebSocket
  useEffect(() => {
    if (wsIncidents) {
      setIncidents((wsIncidents as any).data || []);
    }
  }, [wsIncidents]);

  const handleAction = (action: string, node: string) => {
    setToast(`Command "${action}" executed on ${node}`);
  };

  const handleRowClick = (nodeId: string) => {
    router.push(`/nodes/${nodeId}`);
  };

  const filteredAndSortedNodes = useMemo(() => {
    let filtered = [...nodes];
    
    if (roleFilter !== 'all') {
      filtered = filtered.filter(n => n.role === roleFilter);
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(n => n.status === statusFilter);
    }
    
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'blockHeight':
          comparison = (a.block_height || 0) - (b.block_height || 0);
          break;
        case 'syncPercent':
          comparison = (a.sync_percent || 0) - (b.sync_percent || 0);
          break;
        case 'peers':
          comparison = (a.peer_count || 0) - (b.peer_count || 0);
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [nodes, roleFilter, statusFilter, sortField, sortDirection]);

  const activeIncidents = incidents.filter(i => i.status === 'active');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#F1F5F9]">Fleet Management</h1>
            <p className="text-[#64748B] mt-1">Monitor and manage all nodes in your fleet</p>
          </div>
          {wsConnected && (
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-[#10B981]" />
              <span className="text-sm text-[#10B981]">Live</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-xdc">
            <div className="section-header mb-1">Total Nodes</div>
            <div className="text-2xl font-bold font-mono-nums">{stats.totalNodes}</div>
          </div>
          <div className="card-xdc">
            <div className="section-header mb-1 text-[#10B981]">Healthy</div>
            <div className="text-2xl font-bold font-mono-nums text-[#10B981]">{stats.healthyNodes}</div>
          </div>
          <div className="card-xdc">
            <div className="section-header mb-1 text-[#F59E0B]">Degraded</div>
            <div className="text-2xl font-bold font-mono-nums text-[#F59E0B]">{stats.degradedNodes}</div>
          </div>
          <div className="card-xdc">
            <div className="section-header mb-1 text-[#EF4444]">Offline</div>
            <div className="text-2xl font-bold font-mono-nums text-[#EF4444]">{stats.offlineNodes}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card-xdc lg:col-span-2">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[rgba(30,144,255,0.1)] flex items-center justify-center text-[#1E90FF]">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#F1F5F9]">Fleet Status Matrix</h2>
                  <p className="text-xs text-[#64748B]">All registered nodes</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as NodeRole | 'all')}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1E90FF]"
                >
                  <option value="all">All Roles</option>
                  <option value="masternode">Masternode</option>
                  <option value="fullnode">Fullnode</option>
                  <option value="archive">Archive</option>
                  <option value="rpc">RPC</option>
                </select>
                
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as NodeStatus | 'all')}
                  className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1E90FF]"
                >
                  <option value="all">All Status</option>
                  <option value="online">Online</option>
                  <option value="degraded">Degraded</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#64748B]"></th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#64748B] cursor-pointer hover:text-[#F1F5F9]" onClick={() => handleSort('status')}>Status</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#64748B] cursor-pointer hover:text-[#F1F5F9]" onClick={() => handleSort('name')}>Name</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#64748B]">Role</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#64748B]">Location</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#64748B] cursor-pointer hover:text-[#F1F5F9]" onClick={() => handleSort('blockHeight')}>Height</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#64748B] cursor-pointer hover:text-[#F1F5F9]" onClick={() => handleSort('syncPercent')}>Sync</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#64748B] cursor-pointer hover:text-[#F1F5F9]" onClick={() => handleSort('peers')}>Peers</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#64748B]">CPU</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#64748B]">Mem</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#64748B]">Disk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-[#64748B]">Loading...</td>
                    </tr>
                  ) : filteredAndSortedNodes.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-[#64748B]">No nodes match filters</td>
                    </tr>
                  ) : (
                    filteredAndSortedNodes.map((node) => (
                      <>
                        <tr
                          key={node.id}
                          className="hover:bg-white/[0.02] cursor-pointer"
                          onClick={() => handleRowClick(node.id)}
                        >
                          <td className="py-3 px-3">
                            <ChevronRight className="w-4 h-4 text-[#64748B]" />
                          </td>
                          <td className="py-3 px-3">
                            <StatusDot status={node.status} />
                          </td>
                          <td className="py-3 px-3 font-medium">{node.name}</td>
                          <td className="py-3 px-3">
                            <span className="px-2 py-0.5 bg-white/5 rounded text-xs">{node.role}</span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-1 text-xs text-[#64748B]">
                              <MapPin className="w-3 h-3" />
                              {node.location_city}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono-nums">{(node.block_height || 0).toLocaleString()}</td>
                          <td className="py-3 px-3">
                            <span className={node.sync_percent >= 99 ? 'text-[#10B981]' : 'text-[#F59E0B]'} >
                              {(node.sync_percent || 0).toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-3 font-mono-nums">{node.peer_count || 0}</td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <Cpu className="w-3 h-3 text-[#64748B]" />
                              <span className={(node.cpu_percent || 0) > 80 ? 'text-[#EF4444]' : ''}>{Math.round(node.cpu_percent || 0)}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <MemoryStick className="w-3 h-3 text-[#64748B]" />
                              <span className={(node.memory_percent || 0) > 90 ? 'text-[#EF4444]' : ''}>{Math.round(node.memory_percent || 0)}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <HardDrive className="w-3 h-3 text-[#64748B]" />
                              <span className={(node.disk_percent || 0) > 85 ? 'text-[#F59E0B]' : ''}>{Math.round(node.disk_percent || 0)}%</span>
                            </div>
                          </td>
                        </tr>
                      </>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card-xdc">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[rgba(239,68,68,0.1)] flex items-center justify-center text-[#EF4444]">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#F1F5F9]">Active Incidents</h2>
                  <p className="text-xs text-[#64748B]">{activeIncidents.length} requiring attention</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {activeIncidents.length === 0 ? (
                  <div className="text-center py-6 text-[#64748B]">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#10B981]" />
                    <p>All systems operational</p>
                  </div>
                ) : (
                  activeIncidents.map(incident => (
                    <div key={incident.id} className="bg-white/5 rounded-lg p-3 border border-white/5">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <SeverityBadge severity={incident.severity} />
                          <span className="text-sm font-medium">{incident.type}</span>
                        </div>
                        <span className="text-xs text-[#64748B]">{formatTimeAgo(incident.detected_at)}</span>
                      </div>
                      <p className="text-xs text-[#64748B] mb-2">{incident.description}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <Server className="w-3 h-3 text-[#64748B]" />
                        <span>{incident.node_name}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="card-xdc">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[rgba(245,158,11,0.1)] flex items-center justify-center text-[#F59E0B]">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#F1F5F9]">Health Score</h2>
                  <p className="text-xs text-[#64748B]">Fleet-wide health</p>
                </div>
              </div>
              
              <div className="text-center">
                <div className={`text-4xl font-bold font-mono-nums ${
                  stats.healthScore >= 90 ? 'text-[#10B981]' :
                  stats.healthScore >= 70 ? 'text-[#F59E0B]' : 'text-[#EF4444]'
                }`}>
                  {stats.healthScore}%
                </div>
                <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      stats.healthScore >= 90 ? 'bg-[#10B981]' :
                      stats.healthScore >= 70 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
                    }`}
                    style={{ width: `${stats.healthScore}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
