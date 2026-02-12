'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  RefreshCw
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
  latencyMs?: number;
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

function LatencyBadge({ latency }: { latency: number }) {
  let color = 'text-[#EF4444]';
  let label = 'Poor';
  if (latency < 50) { color = 'text-[#10B981]'; label = 'Excellent'; }
  else if (latency < 100) { color = 'text-[#1E90FF]'; label = 'Good'; }
  else if (latency < 150) { color = 'text-[#F59E0B]'; label = 'Fair'; }
  
  return (
    <span className={`text-xs ${color}`}>
      {latency}ms ({label})
    </span>
  );
}

export default function PeersPage() {
  const router = useRouter();
  const [livePeers, setLivePeers] = useState<Peer[]>([]);
  const [bannedPeers, setBannedPeers] = useState<BannedPeer[]>([]);
  const [countries, setCountries] = useState<Record<string, { name: string; count: number }>>({});
  const [protocols, setProtocols] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof Peer>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // WebSocket for live updates
  const { peers: wsPeers, connected: wsConnected } = useWebSocket();

  const fetchPeers = useCallback(async () => {
    try {
      const res = await fetch('/api/peers', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setLivePeers(data.live?.peers || []);
        setBannedPeers(data.banned || []);
        setCountries(data.live?.countries || {});
        setProtocols(data.live?.protocols || {});
      }
    } catch (err) {
      console.error('Failed to fetch peers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPeers();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchPeers, 10000);
    return () => clearInterval(interval);
  }, [fetchPeers]);

  // Update from WebSocket
  useEffect(() => {
    if (wsPeers) {
      // WebSocket provides peer stats, trigger refresh for full data
      fetchPeers();
    }
  }, [wsPeers, fetchPeers]);

  const sortedPeers = useMemo(() => {
    const sorted = [...livePeers];
    sorted.sort((a, b) => {
      const aVal = String(a[sortField] ?? '');
      const bVal = String(b[sortField] ?? '');
      const comparison = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [livePeers, sortField, sortDirection]);

  const geoStats = useMemo(() => {
    const countryCount = Object.keys(countries).length;
    const byContinent: Record<string, number> = {};
    
    // Simple continent mapping based on country codes
    const continentMap: Record<string, string> = {
      US: 'North America', CA: 'North America', MX: 'North America',
      DE: 'Europe', GB: 'Europe', FR: 'Europe', NL: 'Europe', IT: 'Europe', ES: 'Europe',
      SG: 'Asia', JP: 'Asia', KR: 'Asia', IN: 'Asia', CN: 'Asia', HK: 'Asia',
      AU: 'Oceania', NZ: 'Oceania',
      BR: 'South America', AR: 'South America',
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
        setToast(`Banned peer ${peer.name.slice(0, 20)}...`);
        fetchPeers();
      }
    } catch (err) {
      console.error('Failed to ban peer:', err);
    }
  };

  const handleUnban = async (peer: BannedPeer) => {
    try {
      const res = await fetch(`/api/peers/ban?id=${peer.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setToast(`Unbanned peer`);
        fetchPeers();
      }
    } catch (err) {
      console.error('Failed to unban peer:', err);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#F1F5F9]">Peers & Network</h1>
            <p className="text-[#64748B] mt-1">Manage peer connections and network topology</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/peers/healthy')}
              className="flex items-center gap-2 px-4 py-2 bg-[#10B981]/10 hover:bg-[#10B981]/20 text-[#10B981] rounded-lg text-sm transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Healthy Peers
            </button>
            {wsConnected && (
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-[#10B981]" />
                <span className="text-sm text-[#10B981]">Live</span>
              </div>
            )}
            <button
              onClick={fetchPeers}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-[#64748B]" />
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-xdc">
            <div className="section-header mb-1">Total Peers</div>
            <div className="text-2xl font-bold font-mono-nums">{livePeers.length}</div>
          </div>
          <div className="card-xdc">
            <div className="section-header mb-1 text-[#10B981]">Inbound</div>
            <div className="text-2xl font-bold font-mono-nums text-[#10B981]">
              {livePeers.filter(p => p.direction === 'inbound').length}
            </div>
          </div>
          <div className="card-xdc">
            <div className="section-header mb-1 text-[#1E90FF]">Outbound</div>
            <div className="text-2xl font-bold font-mono-nums text-[#1E90FF]">
              {livePeers.filter(p => p.direction === 'outbound').length}
            </div>
          </div>
          <div className="card-xdc">
            <div className="section-header mb-1">Countries</div>
            <div className="text-2xl font-bold font-mono-nums">{geoStats.uniqueCountries}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card-xdc lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[rgba(30,144,255,0.1)] flex items-center justify-center text-[#1E90FF]">
                <Network className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#F1F5F9]">Peer Management</h2>
                <p className="text-xs text-[#64748B]">{livePeers.length} connected peers</p>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#64748B]">Name</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#64748B]">Client</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#64748B]">Protocol</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#64748B]">Direction</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#64748B]">Location</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#64748B]">Latency</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#64748B]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#64748B]">Loading...</td>
                    </tr>
                  ) : sortedPeers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#64748B]">No peers connected</td>
                    </tr>
                  ) : (
                    sortedPeers.map((peer) => (
                      <tr key={peer.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 px-3">
                          <div className="text-sm font-medium">{peer.name?.slice(0, 30) || 'Unknown'}</div>
                          <div className="text-xs text-[#64748B] font-mono">{peer.id?.slice(0, 16)}...</div>
                        </td>
                        <td className="py-3 px-3 text-xs">{peer.clientVersion || 'Unknown'}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 bg-white/5 rounded text-xs">{peer.protocols?.[0] || 'eth/68'}</span>
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
                            <MapPin className="w-3 h-3 text-[#64748B]" />
                            {peer.city || 'Unknown'}, {peer.country || 'XX'}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-xs">
                          {peer.latencyMs ? <LatencyBadge latency={peer.latencyMs} /> : '—'}
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
                  <h2 className="text-lg font-semibold text-[#F1F5F9]">Geo Diversity</h2>
                  <p className="text-xs text-[#64748B]">Network decentralization</p>
                </div>
              </div>
              
              <div className="text-center mb-4">
                <div className="text-4xl font-bold font-mono-nums" style={{ 
                  color: geoStats.score >= 80 ? '#10B981' : geoStats.score >= 50 ? '#F59E0B' : '#EF4444' 
                }}>
                  {geoStats.score}
                </div>
                <div className="text-xs text-[#64748B]">Diversity Score</div>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748B]">Countries</span>
                  <span>{geoStats.uniqueCountries}</span>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="text-xs font-medium mb-2">Distribution</div>
                {Object.entries(geoStats.byContinent).map(([continent, count]) => (
                  <div key={continent} className="flex items-center justify-between text-sm mb-1">
                    <span className="text-[#64748B]">{continent}</span>
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
                  <h2 className="text-lg font-semibold text-[#F1F5F9]">Protocol Matrix</h2>
                  <p className="text-xs text-[#64748B]">Active protocol versions</p>
                </div>
              </div>
              
              <div className="space-y-2">
                {Object.keys(protocols).length === 0 ? (
                  <div className="text-sm text-[#64748B]">No protocol data</div>
                ) : (
                  Object.entries(protocols).map(([protocol, count]) => (
                    <div key={protocol} className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                      <span className="text-sm font-mono">{protocol}</span>
                      <span className="text-sm font-mono-nums text-[#10B981]">{count} peers</span>
                    </div>
                  ))
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
              <h2 className="text-lg font-semibold text-[#F1F5F9]">Banned Peers</h2>
              <p className="text-xs text-[#64748B]">{bannedPeers.length} banned addresses</p>
            </div>
          </div>
          
          {bannedPeers.length === 0 ? (
            <div className="text-center py-6 text-[#64748B]">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-[#10B981]" />
              <p>No banned peers</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#64748B]">Enode</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#64748B]">Reason</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#64748B]">Banned Date</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#64748B]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {bannedPeers.map((peer) => (
                    <tr key={peer.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 text-sm font-mono truncate max-w-[200px]">
                        {peer.enode.slice(0, 40)}...
                      </td>
                      <td className="py-3 px-4 text-sm">{peer.reason}</td>
                      <td className="py-3 px-4 text-sm text-[#64748B]">
                        {new Date(peer.banned_at).toLocaleDateString()}
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
          <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
          <span className="text-sm">{toast}</span>
          <button onClick={() => setToast(null)} className="text-[#64748B] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </DashboardLayout>
  );
}
