'use client';

import { useState, useMemo } from 'react';
import { 
  Server, 
  Activity, 
  RefreshCw, 
  FileText, 
  Settings, 
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
  Tag,
  ChevronDown,
  MoreHorizontal,
  Play,
  Square,
  RotateCcw,
  Terminal,
  Edit3,
  Trash2
} from 'lucide-react';

// Types
interface FleetNode {
  id: string;
  name: string;
  role: 'validator' | 'rpc' | 'archive' | 'bootnode';
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
}

// Mock data
const mockNodes: FleetNode[] = [
  {
    id: 'mn-001',
    name: 'Masternode Alpha',
    role: 'validator',
    region: 'eu-west',
    status: 'healthy',
    version: 'v2.6.8',
    blockHeight: 99234567,
    peers: 45,
    cpuUsage: 12,
    memoryUsage: 45,
    diskUsage: 34,
    uptime: 99.98,
    tags: ['production', 'critical', 'masternode'],
    lastSeen: '2026-02-11T14:30:00Z',
    ip: '192.168.1.10'
  },
  {
    id: 'mn-002',
    name: 'Masternode Beta',
    role: 'validator',
    region: 'us-east',
    status: 'warning',
    version: 'v2.6.8',
    blockHeight: 99234562,
    peers: 38,
    cpuUsage: 25,
    memoryUsage: 78,
    diskUsage: 92,
    uptime: 99.95,
    tags: ['production', 'masternode'],
    lastSeen: '2026-02-11T14:29:45Z',
    ip: '192.168.2.20'
  },
  {
    id: 'mn-003',
    name: 'Masternode Gamma',
    role: 'validator',
    region: 'ap-south',
    status: 'critical',
    version: 'v2.6.7',
    blockHeight: 99234520,
    peers: 12,
    cpuUsage: 95,
    memoryUsage: 88,
    diskUsage: 45,
    uptime: 98.50,
    tags: ['production', 'masternode', 'needs-update'],
    lastSeen: '2026-02-11T14:25:00Z',
    ip: '192.168.3.30'
  },
  {
    id: 'rpc-001',
    name: 'RPC Node Primary',
    role: 'rpc',
    region: 'eu-west',
    status: 'healthy',
    version: 'v2.6.8',
    blockHeight: 99234567,
    peers: 50,
    cpuUsage: 35,
    memoryUsage: 62,
    diskUsage: 78,
    uptime: 99.99,
    tags: ['production', 'rpc', 'public'],
    lastSeen: '2026-02-11T14:30:00Z',
    ip: '192.168.1.50'
  },
  {
    id: 'rpc-002',
    name: 'RPC Node Secondary',
    role: 'rpc',
    region: 'us-west',
    status: 'healthy',
    version: 'v2.6.8',
    blockHeight: 99234567,
    peers: 48,
    cpuUsage: 28,
    memoryUsage: 55,
    diskUsage: 65,
    uptime: 99.97,
    tags: ['production', 'rpc'],
    lastSeen: '2026-02-11T14:29:55Z',
    ip: '192.168.4.40'
  },
  {
    id: 'arch-001',
    name: 'Archive Node',
    role: 'archive',
    region: 'eu-west',
    status: 'warning',
    version: 'v2.6.8',
    blockHeight: 99234567,
    peers: 25,
    cpuUsage: 45,
    memoryUsage: 85,
    diskUsage: 94,
    uptime: 99.90,
    tags: ['production', 'archive', 'historical'],
    lastSeen: '2026-02-11T14:28:00Z',
    ip: '192.168.1.100'
  },
  {
    id: 'boot-001',
    name: 'Bootstrap Node 1',
    role: 'bootnode',
    region: 'us-east',
    status: 'healthy',
    version: 'v2.6.8',
    blockHeight: 99234567,
    peers: 100,
    cpuUsage: 8,
    memoryUsage: 25,
    diskUsage: 15,
    uptime: 99.99,
    tags: ['production', 'bootnode', 'discovery'],
    lastSeen: '2026-02-11T14:30:00Z',
    ip: '192.168.2.5'
  },
  {
    id: 'mn-004',
    name: 'Masternode Delta',
    role: 'validator',
    region: 'ap-northeast',
    status: 'offline',
    version: 'v2.6.7',
    blockHeight: 99234000,
    peers: 0,
    cpuUsage: 0,
    memoryUsage: 0,
    diskUsage: 0,
    uptime: 95.00,
    tags: ['production', 'masternode', 'down'],
    lastSeen: '2026-02-11T13:00:00Z',
    ip: '192.168.5.50'
  }
];

const regions = ['all', 'eu-west', 'us-east', 'us-west', 'ap-south', 'ap-northeast'];
const roles = ['all', 'validator', 'rpc', 'archive', 'bootnode'];
const statuses = ['all', 'healthy', 'warning', 'critical', 'offline'];

export default function FleetOverview() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [filterRegion, setFilterRegion] = useState('all');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTag, setFilterTag] = useState('');
  const [showActions, setShowActions] = useState<string | null>(null);

  // Filter nodes
  const filteredNodes = useMemo(() => {
    return mockNodes.filter(node => {
      if (filterRegion !== 'all' && node.region !== filterRegion) return false;
      if (filterRole !== 'all' && node.role !== filterRole) return false;
      if (filterStatus !== 'all' && node.status !== filterStatus) return false;
      if (filterTag && !node.tags.some(t => t.toLowerCase().includes(filterTag.toLowerCase()))) return false;
      return true;
    });
  }, [filterRegion, filterRole, filterStatus, filterTag]);

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
      case 'healthy': return { bg: 'bg-[rgba(16,185,129,0.15)]', text: 'text-[#10B981]', border: 'border-[rgba(16,185,129,0.3)]', icon: CheckCircle2 };
      case 'warning': return { bg: 'bg-[rgba(245,158,11,0.15)]', text: 'text-[#F59E0B]', border: 'border-[rgba(245,158,11,0.3)]', icon: AlertTriangle };
      case 'critical': return { bg: 'bg-[rgba(239,68,68,0.15)]', text: 'text-[#EF4444]', border: 'border-[rgba(239,68,68,0.3)]', icon: AlertTriangle };
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

  return (
    <div className="card-xdc">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E90FF]/20 to-[#1E90FF]/10 flex items-center justify-center">
            <Server className="w-5 h-5 text-[#1E90FF]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#F9FAFB]">Fleet Overview</h2>
            <div className="flex items-center gap-2">
              <span className="status-dot active" />
              <span className="text-sm text-[#6B7280]">{stats.total} nodes monitored</span>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(16,185,129,0.15)] border border-[rgba(16,185,129,0.3)]">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            <span className="text-sm font-medium text-[#10B981]">{stats.healthy} Healthy</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(245,158,11,0.15)] border border-[rgba(245,158,11,0.3)]">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-sm font-medium text-[#F59E0B]">{stats.warning} Warning</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.3)]">
            <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
            <span className="text-sm font-medium text-[#EF4444]">{stats.critical} Critical</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[rgba(107,114,128,0.15)] border border-[rgba(107,114,128,0.3)]">
            <Square className="w-4 h-4 text-[#6B7280]" />
            <span className="text-sm font-medium text-[#6B7280]">{stats.offline} Offline</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6 p-4 rounded-xl bg-[#111827] border border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-2 text-[#6B7280]">
          <Filter className="w-4 h-4" />
          <span className="text-sm">Filters:</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#0A0E1A] border border-[rgba(255,255,255,0.1)] text-sm text-[#F9FAFB] focus:outline-none focus:border-[#1E90FF]"
          >
            <option value="all">All Regions</option>
            {regions.filter(r => r !== 'all').map(r => (
              <option key={r} value={r}>{r.replace('-', ' ').toUpperCase()}</option>
            ))}
          </select>
          
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#0A0E1A] border border-[rgba(255,255,255,0.1)] text-sm text-[#F9FAFB] focus:outline-none focus:border-[#1E90FF]"
          >
            <option value="all">All Roles</option>
            {roles.filter(r => r !== 'all').map(r => (
              <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            ))}
          </select>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-[#0A0E1A] border border-[rgba(255,255,255,0.1)] text-sm text-[#F9FAFB] focus:outline-none focus:border-[#1E90FF]"
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
            className="px-3 py-1.5 rounded-lg bg-[#0A0E1A] border border-[rgba(255,255,255,0.1)] text-sm text-[#F9FAFB] placeholder-[#6B7280] focus:outline-none focus:border-[#1E90FF]"
          />
        </div>
        
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-[rgba(30,144,255,0.25)] text-[#1E90FF]' : 'text-[#6B7280] hover:text-[#F9FAFB]'}`}
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-[rgba(30,144,255,0.25)] text-[#1E90FF]' : 'text-[#6B7280] hover:text-[#F9FAFB]'}`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedNodes.size > 0 && (
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-[rgba(30,144,255,0.1)] border border-[rgba(30,144,255,0.3)]">
          <span className="text-sm text-[#F9FAFB]">{selectedNodes.size} nodes selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <button 
              onClick={() => handleBulkAction('restart')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(245,158,11,0.15)] text-[#F59E0B] hover:bg-[rgba(245,158,11,0.25)] transition-colors text-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restart
            </button>
            <button 
              onClick={() => handleBulkAction('update')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(30,144,255,0.15)] text-[#1E90FF] hover:bg-[rgba(30,144,255,0.25)] transition-colors text-sm"
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filteredNodes.map((node) => {
            const statusStyle = getStatusColor(node.status);
            const StatusIcon = statusStyle.icon;
            const isSelected = selectedNodes.has(node.id);
            
            return (
              <div 
                key={node.id}
                className={`relative p-4 rounded-xl border transition-all cursor-pointer ${
                  isSelected 
                    ? 'bg-[rgba(30,144,255,0.15)] border-[#1E90FF]' 
                    : 'bg-[#111827] border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]'
                }`}
                onClick={() => handleSelectNode(node.id)}
              >
                {/* Selection checkbox */}
                <div className="absolute top-3 left-3">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                    isSelected ? 'bg-[#1E90FF] border-[#1E90FF]' : 'border-[#6B7280]'
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
                    <p className="text-xs text-[#6B7280]">{node.id} • {node.ip}</p>
                  </div>
                </div>
                
                {/* Status badge */}
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${statusStyle.bg} ${statusStyle.text} text-xs font-medium mb-3`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {node.status.charAt(0).toUpperCase() + node.status.slice(1)}
                </div>
                
                {/* Metrics */}
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6B7280] flex items-center gap-1"><Cpu className="w-3 h-3" /> CPU</span>
                    <span style={{ color: getUsageColor(node.cpuUsage) }}>{node.cpuUsage}%</span>
                  </div>
                  <div className="w-full h-1 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${node.cpuUsage}%`, backgroundColor: getUsageColor(node.cpuUsage) }} />
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6B7280] flex items-center gap-1"><MemoryStick className="w-3 h-3" /> RAM</span>
                    <span style={{ color: getUsageColor(node.memoryUsage) }}>{node.memoryUsage}%</span>
                  </div>
                  <div className="w-full h-1 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${node.memoryUsage}%`, backgroundColor: getUsageColor(node.memoryUsage) }} />
                  </div>
                  
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6B7280] flex items-center gap-1"><HardDrive className="w-3 h-3" /> Disk</span>
                    <span style={{ color: getUsageColor(node.diskUsage) }}>{node.diskUsage}%</span>
                  </div>
                  <div className="w-full h-1 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${node.diskUsage}%`, backgroundColor: getUsageColor(node.diskUsage) }} />
                  </div>
                </div>
                
                {/* Footer info */}
                <div className="flex items-center justify-between text-xs text-[#6B7280] pt-3 border-t border-[rgba(255,255,255,0.06)]">
                  <span className="flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {node.region}
                  </span>
                  <span>v{node.version}</span>
                </div>
                
                {/* Tags */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {node.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="px-1.5 py-0.5 rounded text-[10px] bg-[rgba(255,255,255,0.05)] text-[#6B7280]">
                      {tag}
                    </span>
                  ))}
                  {node.tags.length > 3 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-[rgba(255,255,255,0.05)] text-[#6B7280]">+{node.tags.length - 3}</span>
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
          <table className="w-full min-w-[1000px]">
            <thead className="bg-[#111827]">
              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                <th className="text-left py-3 px-4">
                  <button onClick={handleSelectAll} className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      selectedNodes.size === filteredNodes.length && filteredNodes.length > 0
                        ? 'bg-[#1E90FF] border-[#1E90FF]' 
                        : 'border-[#6B7280]'
                    }`}>
                      {selectedNodes.size === filteredNodes.length && filteredNodes.length > 0 && <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                    </div>
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Node</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Status</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Role</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Block</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Peers</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Resources</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Region</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-[#6B7280]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.03)]">
              {filteredNodes.map((node) => {
                const statusStyle = getStatusColor(node.status);
                const StatusIcon = statusStyle.icon;
                const isSelected = selectedNodes.has(node.id);
                
                return (
                  <tr key={node.id} className="hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <td className="py-3 px-4">
                      <div 
                        className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer ${
                          isSelected ? 'bg-[#1E90FF] border-[#1E90FF]' : 'border-[#6B7280]'
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
                          <div className="text-xs text-[#6B7280]">{node.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${statusStyle.bg} ${statusStyle.text} text-xs font-medium`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {node.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-[#9CA3AF] capitalize">{node.role}</td>
                    <td className="py-3 px-4 text-sm font-mono-nums text-[#F9FAFB]">{node.blockHeight.toLocaleString()}</td>
                    <td className="py-3 px-4 text-sm text-[#9CA3AF]">{node.peers}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5" style={{ color: getUsageColor(node.cpuUsage) }} />
                          <span className="text-xs" style={{ color: getUsageColor(node.cpuUsage) }}>{node.cpuUsage}%</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MemoryStick className="w-3.5 h-3.5" style={{ color: getUsageColor(node.memoryUsage) }} />
                          <span className="text-xs" style={{ color: getUsageColor(node.memoryUsage) }}>{node.memoryUsage}%</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-[#9CA3AF]">{node.region}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => handleNodeAction(node.id, 'restart')}
                          className="p-1.5 rounded hover:bg-[rgba(245,158,11,0.15)] text-[#6B7280] hover:text-[#F59E0B] transition-colors"
                          title="Restart"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleNodeAction(node.id, 'logs')}
                          className="p-1.5 rounded hover:bg-[rgba(30,144,255,0.15)] text-[#6B7280] hover:text-[#1E90FF] transition-colors"
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
            className="mt-4 text-[#1E90FF] hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
