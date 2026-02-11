'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Globe, 
  CheckCircle2, 
  X,
  RefreshCw,
  Copy,
  Download,
  Shield,
  Wifi,
  ArrowLeft,
  Clock,
  ExternalLink,
  Search,
  Check,
  XCircle,
  Server
} from 'lucide-react';

interface HealthyPeer {
  enode: string;
  ip: string;
  port: number;
  portOpen: boolean;
  name: string;
  protocols: string[];
  direction: 'inbound' | 'outbound';
  country: string | null;
  city: string | null;
  connectedNodes: string[];
  lastSeen: string;
}

interface PeersData {
  totalPeers: number;
  healthyPeers: number;
  unhealthyPeers: number;
  peers: HealthyPeer[];
  unhealthyPeersList: HealthyPeer[];
  enodeList: string;
  staticNodesJson: string[];
  checkedAt: string;
  cached?: boolean;
  cachedAt?: string;
}

type FilterType = 'all' | 'open' | 'closed';
type SortField = 'enode' | 'ip' | 'port' | 'name' | 'country' | 'connectedNodes' | 'lastSeen';
type SortDirection = 'asc' | 'desc';

function truncateEnode(enode: string, length = 20): string {
  if (enode.length <= length * 2 + 3) return enode;
  return `${enode.slice(0, length)}...${enode.slice(-length)}`;
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

function PortStatus({ open }: { open: boolean }) {
  if (open) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#10B981]/10 text-[#10B981] rounded text-xs">
        <CheckCircle2 className="w-3 h-3" />
        Open
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#EF4444]/10 text-[#EF4444] rounded text-xs">
      <XCircle className="w-3 h-3" />
      Closed
    </span>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  return (
    <span className={`text-xs ${direction === 'inbound' ? 'text-[#10B981]' : 'text-[#1E90FF]'}`}>
      {direction === 'inbound' ? 'In' : 'Out'}
    </span>
  );
}

export default function HealthyPeersPage() {
  const router = useRouter();
  const [data, setData] = useState<PeersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortField, setSortField] = useState<SortField>('connectedNodes');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/peers/healthy', { cache: 'no-store' });
      if (res.ok) {
        const peerData = await res.json();
        setData(peerData);
      }
    } catch (err) {
      console.error('Failed to fetch peers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 60 seconds (port check is expensive)
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Filter and sort peers
  const filteredPeers = useMemo(() => {
    if (!data) return [];
    
    let peers = [...data.peers];
    
    // Apply status filter
    if (filter === 'open') {
      peers = peers.filter(p => p.portOpen);
    } else if (filter === 'closed') {
      peers = data.unhealthyPeersList || [];
    }
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      peers = peers.filter(p => 
        p.enode.toLowerCase().includes(query) ||
        p.ip.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query) ||
        (p.country?.toLowerCase() || '').includes(query) ||
        p.connectedNodes.some(n => n.toLowerCase().includes(query))
      );
    }
    
    // Sort
    peers.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      
      if (sortField === 'connectedNodes') {
        aVal = a.connectedNodes.length;
        bVal = b.connectedNodes.length;
      }
      
      if (aVal === null) aVal = '';
      if (bVal === null) bVal = '';
      
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal as string).toLowerCase();
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return peers;
  }, [data, filter, sortField, sortDirection, searchQuery]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadStaticNodes = () => {
    if (!data) return;
    
    const content = JSON.stringify(data.staticNodesJson, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'static-nodes.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th 
      className="text-left py-3 px-3 text-xs font-medium text-[#6B7280] cursor-pointer hover:text-[#F9FAFB] transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <span className="text-[#1E90FF]">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/peers')}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-[#F9FAFB]">Healthy Peers</h1>
              <p className="text-[#6B7280] text-sm">Peers with verified open P2P ports</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-[#6B7280]">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Port check running...
              </div>
            )}
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card-xdc">
              <div className="text-xs text-[#6B7280] mb-1">Total Peers</div>
              <div className="text-2xl font-bold font-mono-nums">{data.totalPeers}</div>
            </div>
            
            <div className="card-xdc border-[#10B981]/20">
              <div className="text-xs text-[#10B981] mb-1">Healthy (Open Port)</div>
              <div className="text-2xl font-bold font-mono-nums text-[#10B981]">{data.healthyPeers}</div>
            </div>
            
            <div className="card-xdc border-[#EF4444]/20">
              <div className="text-xs text-[#EF4444] mb-1">Unhealthy (Closed Port)</div>
              <div className="text-2xl font-bold font-mono-nums text-[#EF4444]">{data.unhealthyPeers}</div>
            </div>
            
            <div className="card-xdc">
              <div className="text-xs text-[#6B7280] mb-1">Success Rate</div>
              <div className="text-2xl font-bold font-mono-nums">
                {data.totalPeers > 0 ? Math.round((data.healthyPeers / data.totalPeers) * 100) : 0}%
              </div>
            </div>
          </div>
        )}

        {/* Export Section */}
        {data && data.healthyPeers > 0 && (
          <div className="card-xdc">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="font-semibold text-[#F9FAFB]">Export Healthy Peers</h3>
                <p className="text-sm text-[#6B7280]">
                  {data.healthyPeers} healthy peers with open ports out of {data.totalPeers} total
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copyToClipboard(data.enodeList, 'enodeList')}
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
                >
                  {copied === 'enodeList' ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4" />}
                  Copy Enode List
                </button>
                
                <button
                  onClick={() => copyToClipboard(JSON.stringify(data.staticNodesJson, null, 2), 'staticNodes')}
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors"
                >
                  {copied === 'staticNodes' ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4" />}
                  Copy static-nodes.json
                </button>
                
                <button
                  onClick={downloadStaticNodes}
                  className="flex items-center gap-2 px-3 py-2 bg-[#1E90FF]/10 hover:bg-[#1E90FF]/20 text-[#1E90FF] rounded-lg text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Filter and Search */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[#6B7280]">Filter:</span>
            {[
              { key: 'all', label: 'All' },
              { key: 'open', label: 'Open Port' },
              { key: 'closed', label: 'Closed Port' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key as FilterType)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  filter === key
                    ? 'bg-[#1E90FF]/20 text-[#1E90FF] border border-[#1E90FF]/30'
                    : 'bg-white/5 text-[#9CA3AF] hover:bg-white/10 border border-transparent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
            <input
              type="text"
              placeholder="Search peers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-[#1E90FF]"
            />
          </div>
        </div>

        {/* Peers Table */}
        <div className="card-xdc overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b border-white/10">
                  <SortHeader field="enode">Enode</SortHeader>
                  <SortHeader field="ip">IP</SortHeader>
                  <SortHeader field="port">Port</SortHeader>
                  <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280]">Status</th>
                  <SortHeader field="name">Client</SortHeader>
                  <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280]">Protocols</th>
                  <SortHeader field="country">Location</SortHeader>
                  <SortHeader field="connectedNodes">Connected To</SortHeader>
                  <SortHeader field="lastSeen">Last Seen</SortHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading && !data ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-[#6B7280]">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                      Loading peers...
                    </td>
                  </tr>
                ) : filteredPeers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-[#6B7280]">
                      <Server className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      No peers found
                    </td>
                  </tr>
                ) : (
                  filteredPeers.map((peer) => (
                    <tr key={peer.enode} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono truncate max-w-[200px]" title={peer.enode}>
                            {truncateEnode(peer.enode, 15)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(peer.enode, peer.enode)}
                            className="p-1 hover:bg-white/5 rounded transition-colors"
                            title="Copy enode"
                          >
                            {copied === peer.enode ? (
                              <Check className="w-3 h-3 text-[#10B981]" />
                            ) : (
                              <Copy className="w-3 h-3 text-[#6B7280]" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs font-mono">{peer.ip}</td>
                      <td className="py-3 px-3 text-xs font-mono">{peer.port}</td>
                      <td className="py-3 px-3">
                        <PortStatus open={peer.portOpen} />
                      </td>
                      <td className="py-3 px-3 text-xs truncate max-w-[150px]" title={peer.name}>
                        {peer.name?.slice(0, 30) || 'Unknown'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 bg-white/5 rounded text-xs">
                          {peer.protocols?.[0] || 'eth/68'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs">
                        {peer.city && peer.country ? `${peer.city}, ${peer.country}` : peer.country || 'Unknown'}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {peer.connectedNodes.slice(0, 2).map((node) => (
                            <span key={node} className="px-1.5 py-0.5 bg-[#1E90FF]/10 text-[#1E90FF] rounded text-[10px]">
                              {node}
                            </span>
                          ))}
                          {peer.connectedNodes.length > 2 && (
                            <span className="px-1.5 py-0.5 bg-white/5 text-[#6B7280] rounded text-[10px]">
                              +{peer.connectedNodes.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-xs text-[#6B7280]">
                        {formatTimeAgo(peer.lastSeen)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Last Checked */}
        {data?.checkedAt && (
          <div className="text-center text-xs text-[#6B7280]">
            <Clock className="w-3 h-3 inline mr-1" />
            Last port check: {formatTimeAgo(data.checkedAt)}
            {data.cached && data.cachedAt && (
              <span className="ml-2">(cached from {formatTimeAgo(data.cachedAt)})</span>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
