'use client';

import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { fetchFleetMetrics, FleetStats } from '@/lib/aggregator';
import { registeredNodes, NodeRole } from '@/lib/node-registry';
import { useEffect } from 'react';
import { 
  Server, 
  AlertTriangle, 
  AlertCircle, 
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
  X
} from 'lucide-react';

type NodeStatus = 'online' | 'degraded' | 'offline';
type Severity = 'critical' | 'warning' | 'info';
type IncidentStatus = 'active' | 'resolved';

interface Incident {
  id: string;
  nodeId: string;
  nodeName: string;
  type: string;
  severity: Severity;
  status: IncidentStatus;
  timestamp: string;
  duration?: string;
  description: string;
}

// Mock incidents
const mockIncidents: Incident[] = [
  {
    id: 'INC-001',
    nodeId: 'xdc-dev-local',
    nodeName: 'xdc-dev-local',
    type: 'Sync Stall',
    severity: 'warning',
    status: 'active',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    description: 'Node stuck at block #84999823 for >5 minutes',
  },
  {
    id: 'INC-002',
    nodeId: 'xdc-dev-local',
    nodeName: 'xdc-dev-local',
    type: 'Peer Drop',
    severity: 'critical',
    status: 'active',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    description: 'Peer count dropped to 2 (threshold: 3)',
  },
  {
    id: 'INC-003',
    nodeId: 'xdc-prod-ap1',
    nodeName: 'xdc-prod-ap1',
    type: 'Memory Pressure',
    severity: 'warning',
    status: 'resolved',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    duration: '45m',
    description: 'Memory usage exceeded 90% threshold',
  },
  {
    id: 'INC-004',
    nodeId: 'xdc-archive-us1',
    nodeName: 'xdc-archive-us1',
    type: 'Disk Pressure',
    severity: 'warning',
    status: 'active',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    description: 'Disk usage at 87% (threshold: 85%)',
  },
  {
    id: 'INC-005',
    nodeId: 'xdc-prod-eu1',
    nodeName: 'xdc-prod-eu1',
    type: 'Block Height Drift',
    severity: 'info',
    status: 'resolved',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    duration: '12m',
    description: 'Node lagged >100 blocks behind fleet leader',
  },
];

// Recent resolved incidents for timeline
const mockTimeline = [
  { id: 'INC-006', node: 'xdc-prod-us1', type: 'Restart Required', status: 'resolved', timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), duration: '5m' },
  { id: 'INC-007', node: 'xdc-rpc-eu1', type: 'High CPU', status: 'resolved', timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(), duration: '18m' },
  { id: 'INC-008', node: 'xdc-prod-ap1', type: 'Network Latency', status: 'resolved', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), duration: '32m' },
  { id: 'INC-009', node: 'xdc-archive-us1', type: 'Compaction Slow', status: 'resolved', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), duration: '1h 15m' },
  { id: 'INC-010', node: 'xdc-dev-local', type: 'Sync Issue', status: 'resolved', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), duration: '22m' },
];

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

function SeverityBadge({ severity }: { severity: Severity }) {
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

// Toast notification component
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-24 right-6 bg-[#111827] border border-white/10 rounded-lg px-4 py-3 shadow-lg z-50 flex items-center gap-3 animate-fade-in">
      <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
      <span className="text-sm">{message}</span>
      <button onClick={onClose} className="text-[#6B7280] hover:text-white">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// Expanded row diagnostics
function DiagnosticsRow({ nodeId, onAction }: { nodeId: string; onAction: (action: string, node: string) => void }) {
  return (
    <div className="col-span-full bg-[#0A0E1A]/50 p-4 rounded-lg mt-2">
      <div className="flex flex-wrap gap-3">
        <button 
          onClick={() => onAction('Check Logs', nodeId)}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
        >
          <FileText className="w-4 h-4 text-[#1E90FF]" />
          Check Logs
        </button>
        <button 
          onClick={() => onAction('Restart Node', nodeId)}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4 text-[#F59E0B]" />
          Restart Node
        </button>
        <button 
          onClick={() => onAction('Force Sync', nodeId)}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
        >
          <Play className="w-4 h-4 text-[#10B981]" />
          Force Sync
        </button>
        <button 
          onClick={() => onAction('Add Peers', nodeId)}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4 text-[#8B5CF6]" />
          Add Peers
        </button>
      </div>
    </div>
  );
}

export default function FleetPage() {
  const [fleetStats, setFleetStats] = useState<FleetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<string>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<NodeRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<NodeStatus | 'all'>('all');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    fetchFleetMetrics().then(stats => {
      setFleetStats(stats);
      setLoading(false);
    });
  }, []);

  const handleAction = (action: string, node: string) => {
    setToast(`Command "${action}" sent to ${node}`);
  };

  const filteredAndSortedNodes = useMemo(() => {
    if (!fleetStats) return [];
    
    let nodes = [...fleetStats.nodes];
    
    // Apply filters
    if (roleFilter !== 'all') {
      const nodeIds = registeredNodes.filter(n => n.role === roleFilter).map(n => n.id);
      nodes = nodes.filter(n => nodeIds.includes(n.nodeId));
    }
    
    if (statusFilter !== 'all') {
      nodes = nodes.filter(n => n.status === statusFilter);
    }
    
    // Apply sorting
    nodes.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = a.nodeId.localeCompare(b.nodeId);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'blockHeight':
          comparison = a.blockHeight - b.blockHeight;
          break;
        case 'syncPercent':
          comparison = a.syncPercent - b.syncPercent;
          break;
        case 'peers':
          comparison = a.peers - b.peers;
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return nodes;
  }, [fleetStats, roleFilter, statusFilter, sortField, sortDirection]);

  const activeIncidents = mockIncidents.filter(i => i.status === 'active');

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getNodeInfo = (nodeId: string) => registeredNodes.find(n => n.id === nodeId);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-semibold text-[#F9FAFB]">Fleet Management</h1>
          <p className="text-[#6B7280] mt-1">Monitor and manage all nodes in your fleet</p>
        </div>

        {/* Fleet Overview Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-xdc">
            <div className="section-header mb-1">Total Nodes</div>
            <div className="text-2xl font-bold font-mono-nums">{fleetStats?.totalNodes || 0}</div>
          </div>
          <div className="card-xdc">
            <div className="section-header mb-1 text-[#10B981]">Healthy</div>
            <div className="text-2xl font-bold font-mono-nums text-[#10B981]">{fleetStats?.healthyCount || 0}</div>
          </div>
          <div className="card-xdc">
            <div className="section-header mb-1 text-[#F59E0B]">Degraded</div>
            <div className="text-2xl font-bold font-mono-nums text-[#F59E0B]">{fleetStats?.degradedCount || 0}</div>
          </div>
          <div className="card-xdc">
            <div className="section-header mb-1 text-[#EF4444]">Offline</div>
            <div className="text-2xl font-bold font-mono-nums text-[#EF4444]">{fleetStats?.offlineCount || 0}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Fleet Status Matrix */}
          <div className="card-xdc lg:col-span-2">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[rgba(30,144,255,0.1)] flex items-center justify-center text-[#1E90FF]">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#F9FAFB]">Fleet Status Matrix</h2>
                  <p className="text-xs text-[#6B7280]">All registered nodes</p>
                </div>
              </div>
              
              {/* Filters */}
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
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280]"></th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280] cursor-pointer hover:text-[#F9FAFB]" onClick={() => handleSort('status')}>Status</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280] cursor-pointer hover:text-[#F9FAFB]" onClick={() => handleSort('name')}>Name</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280]">Role</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280]">Location</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280] cursor-pointer hover:text-[#F9FAFB]" onClick={() => handleSort('blockHeight')}>Height</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280] cursor-pointer hover:text-[#F9FAFB]" onClick={() => handleSort('syncPercent')}>Sync</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280] cursor-pointer hover:text-[#F9FAFB]" onClick={() => handleSort('peers')}>Peers</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280]">CPU</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280]">Mem</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280]">Disk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-[#6B7280]">Loading...</td>
                    </tr>
                  ) : filteredAndSortedNodes.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-[#6B7280]">No nodes match filters</td>
                    </tr>
                  ) : (
                    filteredAndSortedNodes.map((node) => {
                      const info = getNodeInfo(node.nodeId);
                      return (
                        <>
                          <tr 
                            key={node.nodeId} 
                            className="hover:bg-white/[0.02] cursor-pointer"
                            onClick={() => setExpandedNode(expandedNode === node.nodeId ? null : node.nodeId)}
                          >
                            <td className="py-3 px-3">
                              {expandedNode === node.nodeId ? (
                                <ChevronDown className="w-4 h-4 text-[#6B7280]" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-[#6B7280]" />
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <StatusDot status={node.status} />
                            </td>
                            <td className="py-3 px-3 font-medium">{node.nodeId}</td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 bg-white/5 rounded text-xs">{info?.role || 'unknown'}</span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1 text-xs text-[#6B7280]">
                                <MapPin className="w-3 h-3" />
                                {info?.location.city}
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono-nums">{node.blockHeight.toLocaleString()}</td>
                            <td className="py-3 px-3">
                              <span className={node.syncPercent >= 99 ? 'text-[#10B981]' : 'text-[#F59E0B]'} >
                                {node.syncPercent.toFixed(1)}%
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono-nums">{node.peers}</td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <Cpu className="w-3 h-3 text-[#6B7280]" />
                                <span className={node.cpu > 80 ? 'text-[#EF4444]' : ''}>{node.cpu}%</span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <MemoryStick className="w-3 h-3 text-[#6B7280]" />
                                <span className={node.memory > 90 ? 'text-[#EF4444]' : ''}>{node.memory}%</span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <HardDrive className="w-3 h-3 text-[#6B7280]" />
                                <span className={node.disk > 85 ? 'text-[#F59E0B]' : ''}>{node.disk}%</span>
                              </div>
                            </td>
                          </tr>
                          {expandedNode === node.nodeId && (
                            <DiagnosticsRow nodeId={node.nodeId} onAction={handleAction} />
                          )}
                        </>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Incidents */}
          <div className="space-y-4">
            <div className="card-xdc">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[rgba(239,68,68,0.1)] flex items-center justify-center text-[#EF4444]">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#F9FAFB]">Active Incidents</h2>
                  <p className="text-xs text-[#6B7280]">{activeIncidents.length} requiring attention</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {activeIncidents.length === 0 ? (
                  <div className="text-center py-6 text-[#6B7280]">
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
                        <span className="text-xs text-[#6B7280]">{formatTimeAgo(incident.timestamp)}</span>
                      </div>
                      <p className="text-xs text-[#6B7280] mb-2">{incident.description}</p>
                      <div className="flex items-center gap-2 text-xs">
                        <Server className="w-3 h-3 text-[#6B7280]" />
                        <span>{incident.nodeName}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Incident Timeline */}
            <div className="card-xdc">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[rgba(245,158,11,0.1)] flex items-center justify-center text-[#F59E0B]">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#F9FAFB]">Incident Timeline</h2>
                  <p className="text-xs text-[#6B7280]">Recent events</p>
                </div>
              </div>
              
              <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin">
                {[...mockIncidents, ...mockTimeline].map((incident) => (
                  <div key={incident.id} className="flex gap-3 text-sm">
                    <div className="flex flex-col items-center">
                      <div className={`w-2 h-2 rounded-full ${
                        incident.status === 'active' ? 'bg-[#EF4444]' : 'bg-[#10B981]'
                      }`} />
                      <div className="w-0.5 flex-1 bg-white/10 mt-1" />
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{incident.type}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          incident.status === 'active' 
                            ? 'bg-[#EF4444]/10 text-[#EF4444]' 
                            : 'bg-[#10B981]/10 text-[#10B981]'
                        }`}>
                          {incident.status}
                        </span>
                      </div>
                      <div className="text-xs text-[#6B7280] mt-1">
                        {'nodeName' in incident ? incident.nodeName : incident.node} · {formatTimeAgo(incident.timestamp)}
                        {'duration' in incident && incident.duration && ` · ${incident.duration}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
