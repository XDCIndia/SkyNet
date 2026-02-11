'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { 
  Globe, 
  Shield, 
  ShieldAlert, 
  Trash2,
  ArrowDownLeft, 
  ArrowUpRight,
  Network,
  MapPin,
  Activity,
  CheckCircle2,
  AlertCircle,
  X,
  Wifi,
  Server
} from 'lucide-react';

interface Peer {
  id: string;
  enode: string;
  name: string;
  ip: string;
  port: number;
  country: string;
  city: string;
  lat: number;
  lon: number;
  asn: string;
  direction: 'inbound' | 'outbound';
  protocols: string[];
  clientVersion: string;
  nodeId: string;
  nodeName: string;
}

interface BannedPeer {
  id: number;
  enode: string;
  remote_ip: string;
  reason: string;
  banned_at: string;
}

function ScoreBadge({ score }: { score: number }) {
  let color = 'bg-[#EF4444]/10 text-[#EF4444]';
  if (score >= 90) color = 'bg-[#10B981]/10 text-[#10B981]';
  else if (score >= 70) color = 'bg-[#1E90FF]/10 text-[#1E90FF]';
  else if (score >= 50) color = 'bg-[#F59E0B]/10 text-[#F59E0B]';
  
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${color}`}>
      {score}
    </span>
  );
}

export default function PeersPage() {
  const [livePeers, setLivePeers] = useState<Peer[]>([]);
  const [bannedPeers, setBannedPeers] = useState<BannedPeer[]>([]);
  const [countries, setCountries] = useState<Record<string, { name: string; count: number }>>({});
  const [protocols, setProtocols] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [sortField, setSortField] = useState<keyof Peer>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedNode, setSelectedNode] = useState<string>('all');
  const [nodes, setNodes] = useState<Array<{ id: string; name: string }>>([]);

  // WebSocket for live updates
  const { peers: wsPeers, connected: wsConnected } = useWebSocket();

  // Fetch nodes list for filter
  const fetchNodes = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/fleet/status', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setNodes(data.nodes?.map((n: any) => ({ id: n.id, name: n.name })) || []);
      }
    } catch (err) {
      console.error('Failed to fetch nodes:', err);
    }
  }, []);

  const fetchPeers = useCallback(async () => {
    try {
      // Fetch all peer snapshots from DB
      const res = await fetch('/api/peers', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        
        // Transform to our format with node info
        const transformedPeers: Peer[] = [];
        const countryMap: Record<string, { name: string; count: number }> = {};
        const protocolMap: Record<string, number> = {};

        if (data.live?.peers) {
          data.live.peers.forEach((peer: any) => {
            transformedPeers.push({
              id: peer.id,
              enode: peer.enode,
              name: peer.name || 'Unknown',
              ip: peer.ip || 'unknown',
              port: peer.port || 0,
              country: peer.country || 'Unknown',
              city: peer.city || 'Unknown',
              lat: peer.lat || 0,
              lon: peer.lon || 0,
              asn: peer.asn || 'Unknown',
              direction: peer.direction || 'outbound',
              protocols: peer.protocols || ['eth/66'],
              clientVersion: peer.clientVersion || 'Unknown',
              nodeId: 'unknown', // Will be populated from DB
              nodeName: 'Unknown',
            });

            // Count countries
            if (peer.country && peer.country !== 'Unknown') {
              if (!countryMap[peer.country]) {
                countryMap[peer.country] = { name: peer.country, count: 0 };
              }
              countryMap[peer.country].count++;
            }

            // Count protocols
            if (peer.protocols) {
              peer.protocols.forEach((p: string) => {
                protocolMap[p] = (protocolMap[p] || 0) + 1;
              });
            }
          });
        }

        setLivePeers(transformedPeers);
        setCountries(countryMap);
        setProtocols(protocolMap);
        setBannedPeers(data.banned || []);
      }
    } catch (err) {
      console.error('Failed to fetch peers:', err);
      setToast({ message: 'Failed to fetch peers', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + 10s auto-refresh
  useEffect(() => {
    fetchNodes();
    fetchPeers();
    const interval = setInterval(fetchPeers, 10000);
    return () => clearInterval(interval);
  }, [fetchPeers, fetchNodes]);

  // Update from WebSocket
  useEffect(() => {
    if (wsPeers) {
      fetchPeers();
    }
  }, [wsPeers, fetchPeers]);

  // Filter and sort peers
  const filteredAndSortedPeers = useMemo(() => {
    let filtered = [...livePeers];
    
    if (selectedNode !== 'all') {
      filtered = filtered.filter(p => p.nodeId === selectedNode);
    }
    
    filtered.sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [livePeers, selectedNode, sortField, sortDirection]);

  const geoStats = useMemo(() => {
    const countryCount = Object.keys(countries).length;
    const byContinent: Record<string, number> = {};
    
    // Simple continent mapping based on country codes
    const continentMap: Record<string, string> = {
      US: 'North America', CA: 'North America', MX: 'North America',
      DE: 'Europe', GB: 'Europe', FR: 'Europe', NL: 'Europe', IT: 'Europe', ES: 'Europe',
      SG: 'Asia', JP: 'Asia', KR: 'Asia', IN: 'Asia', CN: 'Asia',
      AU: 'Oceania',
    };

    for (const [code, info] of Object.entries(countries)) {
      const continent = continentMap[code] || 'Other';
      byContinent[continent] = (byContinent[continent] || 0) + info.count;
    }

    return {
      uniqueCountries: countryCount,
      byContinent,
      score: Math.min(100, countryCount * 10 + Object.keys(byContinent).length * 15),
    };
  }, [countries]);

  const handleSort = (field: keyof Peer) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleBanPeer = async (peer: Peer) => {
    try {
      const res = await fetch('/api/peers/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enode: peer.enode,
          ip: peer.ip,
          reason: 'Manual ban from dashboard',
        }),
      });

      if (res.ok) {
        setToast({ message: `Banned peer ${peer.name.slice(0, 20)}...`, type: 'success' });
        fetchPeers();
      }
    } catch (err) {
      console.error('Failed to ban peer:', err);
      setToast({ message: 'Failed to ban peer', type: 'error' });
    }
  };

  const handleUnban = async (peer: BannedPeer) => {
    try {
      const res = await fetch(`/api/peers/ban?id=${peer.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setToast({ message: 'Peer unbanned', type: 'success' });
        fetchPeers();
      }
    } catch (err) {
      console.error('Failed to unban peer:', err);
      setToast({ message: 'Failed to unban peer', type: 'error' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#F9FAFB]">Peers & Network</h1>
            <p className="text-[#6B7280] mt-1">Manage peer connections and network topology</p>
          </div>
          {wsConnected && (
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-[#10B981]" />
              <span className="text-sm text-[#10B981]">Live</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card-xdc lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[rgba(30,144,255,0.1)] flex items-center justify-center text-[#1E90FF]">
                  <Network className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#F9FAFB]">Peer Management</h2>
                  <p className="text-xs text-[#6B7280]">{filteredAndSortedPeers.length} connected peers</p>
                </div>
              </div>
              
              <select
                value={selectedNode}
                onChange={(e) => setSelectedNode(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1E90FF]"
              >
                <option value="all">All Nodes</option>
                {nodes.map(node => (
                  <option key={node.id} value={node.id}>{node.name}</option>
                ))}
              </select>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280] cursor-pointer hover:text-[#F9FAFB]" onClick={() => handleSort('name')}>Name</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280]">Client</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280]">Protocol</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280] cursor-pointer hover:text-[#F9FAFB]" onClick={() => handleSort('direction')}>Direction</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280] cursor-pointer hover:text-[#F9FAFB]" onClick={() => handleSort('country')}>Location</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#6B7280]">Loading...</td>
                    </tr>
                  ) : filteredAndSortedPeers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#6B7280]">No peers connected</td>
                    </tr>
                  ) : (
                    filteredAndSortedPeers.map((peer) => (
                      <tr key={peer.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-3">
                          <div className="text-sm font-medium">{peer.name?.slice(0, 30) || 'Unknown'}</div>
                          <div className="text-xs text-[#6B7280] font-mono truncate max-w-[150px]">
                            {peer.enode?.slice(0, 30)}...
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs">{peer.clientVersion?.slice(0, 30) || 'Unknown'}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 bg-white/5 rounded text-xs">{peer.protocols?.[0] || 'unknown'}</span>
                        </td>
                        <td className="py-3 px-3">
                          {peer.direction === 'inbound' ? (
                            <span className="flex items-center gap-1 text-xs text-[#10B981]">
                              <ArrowDownLeft className="w-3 h-3" /> In
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-[#1E90FF]">
                              <ArrowUpRight className="w-3 h-3" /> Out
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-xs">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#6B7280]" />
                            {peer.city !== 'Unknown' ? `${peer.city}, ${peer.country}` : peer.country}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleBanPeer(peer)}
                              className="p-1.5 hover:bg-white/5 rounded"
                              title="Ban"
                            >
                              <ShieldAlert className="w-4 h-4 text-[#F59E0B]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card-xdc">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[rgba(16,185,129,0.1)] flex items-center justify-center text-[#10B981]">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#F9FAFB]">Geo Diversity</h2>
                  <p className="text-xs text-[#6B7280]">Network decentralization</p>
                </div>
              </div>
              
              <div className="text-center mb-4">
                <div className="text-4xl font-bold font-mono-nums" style={{ 
                  color: geoStats.score >= 80 ? '#10B981' : geoStats.score >= 50 ? '#F59E0B' : '#EF4444' 
                }}>
                  {geoStats.score}
                </div>
                <div className="text-xs text-[#6B7280]">Diversity Score</div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">Countries</span>
                  <span>{geoStats.uniqueCountries}</span>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-xs font-medium mb-2">Distribution</div>
                {Object.entries(geoStats.byContinent).map(([continent, count]) => (
                  <div key={continent} className="flex items-center justify-between text-sm mb-1">
                    <span className="text-[#6B7280]">{continent}</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-xdc">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[rgba(139,92,246,0.1)] flex items-center justify-center text-[#8B5CF6]">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#F9FAFB]">Protocol Matrix</h2>
                  <p className="text-xs text-[#6B7280]">Active protocol versions</p>
                </div>
              </div>
              
              <div className="space-y-2">
                {Object.entries(protocols).map(([protocol, count]) => (
                  <div key={protocol} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                    <span className="text-sm font-mono">{protocol}</span>
                    <span className="text-sm font-mono-nums text-[#10B981]">{count} peers</span>
                  </div>
                ))}
                {Object.keys(protocols).length === 0 && (
                  <div className="text-center py-4 text-[#6B7280]">No protocol data</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="card-xdc">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[rgba(239,68,68,0.1)] flex items-center justify-center text-[#EF4444]">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#F9FAFB]">Banned Peers</h2>
              <p className="text-xs text-[#6B7280]">{bannedPeers.length} banned addresses</p>
            </div>
          </div>
          
          {bannedPeers.length === 0 ? (
            <div className="text-center py-6 text-[#6B7280]">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#10B981]" />
              <p>No banned peers</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Enode</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Reason</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Banned Date</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {bannedPeers.map((peer) => (
                    <tr key={peer.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 text-sm font-mono truncate max-w-[200px]">
                        {peer.enode?.slice(0, 40)}...
                      </td>
                      <td className="py-3 px-4 text-sm">{peer.reason || 'Manual ban'}</td>
                      <td className="py-3 px-4 text-sm text-[#6B7280]">
                        {peer.banned_at ? new Date(peer.banned_at).toLocaleDateString() : 'Unknown'}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleUnban(peer)}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded text-xs transition-colors"
                        >
                          Unban
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 right-6 bg-[#111827] border border-white/10 rounded-lg px-4 py-3 shadow-lg z-50 flex items-center gap-3 animate-fade-in">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
          ) : (
            <AlertCircle className="w-5 h-5 text-[#EF4444]" />
          )}
          <span className="text-sm">{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-[#6B7280] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </DashboardLayout>
  );
}
