'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { 
  Globe, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Users, 
  ChevronUp, 
  ChevronDown,
  Plus,
  Minus,
  Ban,
  Shield,
  Network,
  Signal,
  Clock,
  AlertTriangle,
  Star,
  Settings,
  MapPin
} from 'lucide-react';
import type { PeersData, PeerInfo } from '@/lib/types';

// Dynamically import PeerMapChart to avoid SSR issues with echarts
const PeerMapChart = dynamic(() => import('./PeerMapChart'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[300px] sm:h-[350px] lg:h-[450px]">
      <div className="w-12 h-12 border-4 border-[var(--accent-blue)] border-t-transparent rounded-full animate-spin"></div>
    </div>
  )
});

interface PeerMapProps {
  peers: PeersData;
}

type SortField = 'country' | 'direction' | 'client' | 'latency' | 'score' | 'version';
type SortDirection = 'asc' | 'desc';

// Extended peer info with scoring data
interface ExtendedPeerInfo extends PeerInfo {
  latency: number;
  uptime: number;
  score: number;
  protocolVersion: string;
  bandwidth: number;
  trustLevel: 'untrusted' | 'basic' | 'trusted' | 'whitelisted';
  lastSeen: string;
}

// Mock extended peer data for scoring
const generateExtendedPeerData = (peers: PeerInfo[]): ExtendedPeerInfo[] => {
  return peers.map((peer, index) => ({
    ...peer,
    latency: Math.floor(Math.random() * 150) + 10, // 10-160ms
    uptime: Math.floor(Math.random() * 30) + 70, // 70-100%
    score: Math.floor(Math.random() * 40) + 60, // 60-100
    protocolVersion: ['eth/100', 'eth/63', 'eth/62'][Math.floor(Math.random() * 3)],
    bandwidth: Math.floor(Math.random() * 5000) + 500, // 0.5-5.5 MB/s
    trustLevel: ['untrusted', 'basic', 'trusted', 'whitelisted'][Math.floor(Math.random() * 4)] as any,
    lastSeen: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
  }));
};

// Mock banned peers
const mockBannedPeers: BannedPeer[] = [
  { id: 'banned-1', ip: '203.0.113.45', reason: 'Protocol violation', bannedAt: '2026-02-10T10:30:00Z', expiresAt: '2026-02-17T10:30:00Z' },
  { id: 'banned-2', ip: '198.51.100.22', reason: 'Invalid block propagation', bannedAt: '2026-02-09T15:20:00Z', expiresAt: null },
  { id: 'banned-3', ip: '192.0.2.156', reason: 'Repeated failed handshakes', bannedAt: '2026-02-08T08:45:00Z', expiresAt: '2026-02-15T08:45:00Z' },
];

interface BannedPeer {
  id: string;
  ip: string;
  reason: string;
  bannedAt: string;
  expiresAt: string | null;
}

export default function PeerMap({ peers }: PeerMapProps) {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showAddPeerModal, setShowAddPeerModal] = useState(false);
  const [showBannedPeers, setShowBannedPeers] = useState(false);
  const [newPeerEnode, setNewPeerEnode] = useState('');
  const [activeTab, setActiveTab] = useState<'peers' | 'scoring' | 'banned'>('peers');

  // Generate extended peer data
  const extendedPeers = useMemo(() => generateExtendedPeerData(peers.peers || []), [peers.peers]);

  // Top countries for sidebar
  const sortedCountries = useMemo(() => {
    return Object.entries(peers.countries || {})
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);
  }, [peers.countries]);

  // Calculate geographic diversity score
  const geoDiversityScore = useMemo(() => {
    const countries = Object.keys(peers.countries || {}).length;
    const continents = new Set(extendedPeers.map(p => getContinent(p.countryCode))).size;
    // Score based on countries (max 50) + continents (max 50)
    const countryScore = Math.min(50, countries * 2);
    const continentScore = continents * 8; // 6 continents max = 48
    return Math.min(100, countryScore + continentScore);
  }, [peers.countries, extendedPeers]);

  // Protocol version distribution
  const protocolDistribution = useMemo(() => {
    const dist: Record<string, number> = {};
    extendedPeers.forEach(p => {
      dist[p.protocolVersion] = (dist[p.protocolVersion] || 0) + 1;
    });
    return dist;
  }, [extendedPeers]);

  // Sort peers for table
  const sortedPeers = useMemo(() => {
    let list = [...extendedPeers];
    
    // Filter by selected country if any
    if (selectedCountry) {
      list = list.filter(p => p.countryCode === selectedCountry);
    }
    
    // Sort
    list.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'country':
          comparison = a.country.localeCompare(b.country);
          break;
        case 'direction':
          comparison = (a.inbound === b.inbound) ? 0 : a.inbound ? -1 : 1;
          break;
        case 'client':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'latency':
          comparison = a.latency - b.latency;
          break;
        case 'score':
          comparison = a.score - b.score;
          break;
        case 'version':
          comparison = a.protocolVersion.localeCompare(b.protocolVersion);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return list;
  }, [extendedPeers, sortField, sortDirection, selectedCountry]);

  // Stats
  const inboundCount = extendedPeers.filter(p => p.inbound).length;
  const outboundCount = extendedPeers.filter(p => !p.inbound).length;
  const avgLatency = extendedPeers.length > 0 
    ? Math.round(extendedPeers.reduce((sum, p) => sum + p.latency, 0) / extendedPeers.length)
    : 0;
  const avgScore = extendedPeers.length > 0
    ? Math.round(extendedPeers.reduce((sum, p) => sum + p.score, 0) / extendedPeers.length)
    : 0;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleAddPeer = () => {
    // TODO: Connect to API
    console.log('Adding peer:', newPeerEnode);
    setShowAddPeerModal(false);
    setNewPeerEnode('');
  };

  const handleRemovePeer = (peerId: string) => {
    // TODO: Connect to API
    console.log('Removing peer:', peerId);
  };

  const handleBanPeer = (peerId: string) => {
    // TODO: Connect to API
    console.log('Banning peer:', peerId);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#10B981';
    if (score >= 70) return '#F59E0B';
    return '#EF4444';
  };

  const getLatencyColor = (latency: number) => {
    if (latency <= 50) return '#10B981';
    if (latency <= 100) return '#F59E0B';
    return '#EF4444';
  };

  const getTrustIcon = (level: string) => {
    switch (level) {
      case 'whitelisted': return <Star className="w-4 h-4 text-[var(--accent-blue)]" />;
      case 'trusted': return <Shield className="w-4 h-4 text-[var(--success)]" />;
      case 'basic': return <Signal className="w-4 h-4 text-[var(--warning)]" />;
      default: return <AlertTriangle className="w-4 h-4 text-[#6B7280]" />;
    }
  };

  return (
    <div id="map" className="card-xdc">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10B981]/20 to-[#1E90FF]/10 flex items-center justify-center">
            <Globe className="w-5 h-5 text-[var(--success)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#F9FAFB]">Global Peer Distribution</h2>
            <div className="flex items-center gap-2">
              <span className="status-dot active" />
              <span className="text-sm text-[#6B7280]">Real-time peer locations</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <div className="text-center sm:text-right">
            <div className="section-header">Inbound</div>
            <div className="text-xl font-bold font-mono-nums text-[var(--success)]">{inboundCount}</div>
          </div>
          <div className="text-center sm:text-right">
            <div className="section-header">Outbound</div>
            <div className="text-xl font-bold font-mono-nums text-[var(--accent-blue)]">{outboundCount}</div>
          </div>
          <div className="text-center sm:text-right">
            <div className="text-2xl sm:text-3xl font-bold font-mono-nums text-[var(--accent-blue)]">{peers.totalPeers || 0}</div>
            <div className="section-header flex items-center gap-1 justify-center sm:justify-end">
              <Users className="w-3 h-3" /> Total Peers
            </div>
          </div>
        </div>
      </div>

      {/* Scoring Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2 mb-2">
            <Signal className="w-4 h-4 text-[var(--accent-blue)]" />
            <span className="text-xs text-[#6B7280]">Avg Latency</span>
          </div>
          <div className="text-xl font-bold font-mono-nums" style={{ color: getLatencyColor(avgLatency) }}>
            {avgLatency}ms
          </div>
        </div>
        
        <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-[var(--warning)]" />
            <span className="text-xs text-[#6B7280]">Avg Score</span>
          </div>
          <div className="text-xl font-bold font-mono-nums" style={{ color: getScoreColor(avgScore) }}>
            {avgScore}/100
          </div>
        </div>
        
        <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-4 h-4 text-[var(--success)]" />
            <span className="text-xs text-[#6B7280]">Geo Diversity</span>
          </div>
          <div className="text-xl font-bold font-mono-nums text-[var(--success)]">
            {geoDiversityScore}%
          </div>
        </div>
        
        <div className="p-4 rounded-xl bg-[var(--bg-card)] border border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2 mb-2">
            <Network className="w-4 h-4 text-[var(--accent-blue)]" />
            <span className="text-xs text-[#6B7280]">Protocol</span>
          </div>
          <div className="text-sm text-[#F9FAFB]">
            {Object.entries(protocolDistribution).map(([ver, count]) => (
              <span key={ver} className={`block ${ver === 'eth/100' ? 'text-[var(--success)]' : ver === 'eth/63' ? 'text-[var(--warning)]' : 'text-[var(--critical)]'}`}>
                {ver}: {count}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mb-6">
        <button 
          onClick={() => setShowAddPeerModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgba(30,144,255,0.15)] text-[var(--accent-blue)] hover:bg-[rgba(30,144,255,0.25)] transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Static Peer
        </button>
        <button 
          onClick={() => setShowBannedPeers(!showBannedPeers)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${showBannedPeers ? 'bg-[rgba(239,68,68,0.25)] text-[var(--critical)]' : 'bg-[rgba(239,68,68,0.15)] text-[var(--critical)] hover:bg-[rgba(239,68,68,0.25)]'}`}
        >
          <Ban className="w-4 h-4" />
          Banned Peers ({mockBannedPeers.length})
        </button>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgba(16,185,129,0.15)] text-[var(--success)] hover:bg-[rgba(16,185,129,0.25)] transition-colors">
          <Settings className="w-4 h-4" />
          Optimize Peers
        </button>
      </div>

      {/* Add Peer Modal */}
      {showAddPeerModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--bg-card)] rounded-2xl p-6 max-w-lg w-full border border-[rgba(255,255,255,0.1)]">
            <h3 className="text-lg font-semibold text-[#F9FAFB] mb-4">Add Static Peer</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#6B7280] mb-2">Enode URL</label>
                <input
                  type="text"
                  value={newPeerEnode}
                  onChange={(e) => setNewPeerEnode(e.target.value)}
                  placeholder="enode://pubkey@ip:port"
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-body)] border border-[rgba(255,255,255,0.1)] text-[#F9FAFB] text-sm focus:outline-none focus:border-[var(--accent-blue)]"
                />
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={handleAddPeer}
                  className="flex-1 py-2 rounded-lg bg-[var(--accent-blue)] text-white font-medium hover:bg-[#1a7fd9] transition-colors"
                >
                  Add Peer
                </button>
                <button 
                  onClick={() => setShowAddPeerModal(false)}
                  className="flex-1 py-2 rounded-lg bg-[rgba(255,255,255,0.1)] text-[#F9FAFB] hover:bg-[rgba(255,255,255,0.15)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Banned Peers Section */}
      {showBannedPeers && (
        <div className="mb-6 p-4 rounded-xl bg-[var(--bg-card)] border border-[rgba(239,68,68,0.3)]">
          <h3 className="text-sm font-semibold text-[var(--critical)] mb-3 flex items-center gap-2">
            <Ban className="w-4 h-4" />
            Banned Peers ({mockBannedPeers.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.06)]">
                  <th className="text-left py-2 px-3 text-xs font-medium text-[#6B7280]">IP Address</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-[#6B7280]">Reason</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-[#6B7280]">Banned At</th>
                  <th className="text-left py-2 px-3 text-xs font-medium text-[#6B7280]">Expires</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-[#6B7280]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgba(255,255,255,0.03)]">
                {mockBannedPeers.map((peer) => (
                  <tr key={peer.id} className="hover:bg-[rgba(255,255,255,0.02)]">
                    <td className="py-2 px-3 text-sm font-mono-nums text-[#F9FAFB]">{peer.ip}</td>
                    <td className="py-2 px-3 text-sm text-[#9CA3AF]">{peer.reason}</td>
                    <td className="py-2 px-3 text-sm text-[#6B7280]">{new Date(peer.bannedAt).toLocaleDateString()}</td>
                    <td className="py-2 px-3 text-sm text-[#6B7280]">
                      {peer.expiresAt ? new Date(peer.expiresAt).toLocaleDateString() : 'Permanent'}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button className="text-xs text-[var(--accent-blue)] hover:text-[#60a5fa] transition-colors">
                        Unban
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Map */}
        <div className="lg:col-span-3 relative">
          {/* Legend */}
          <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-[var(--bg-card)] px-2 py-1 rounded-full border border-[rgba(255,255,255,0.06)]">
              <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse"></span>
              <span className="text-[#6B7280]">In</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[var(--bg-card)] px-2 py-1 rounded-full border border-[rgba(255,255,255,0.06)]">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-blue)] animate-pulse"></span>
              <span className="text-[#6B7280]">Out</span>
            </div>
          </div>

          <PeerMapChart peers={peers} />
        </div>

        {/* Country List */}
        <div className="lg:col-span-1">
          <div className="bg-[var(--bg-card)] rounded-xl p-4 h-full border border-[rgba(255,255,255,0.06)]">
            <div className="section-header mb-4">Top Countries</div>

            {sortedCountries.length === 0 ? (
              <div className="text-center text-[#6B7280] py-8">
                No peer data available
              </div>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto scrollbar-thin">
                {sortedCountries.map(([code, info], index) => (
                  <div
                    key={code}
                    className={`flex items-center justify-between p-2 sm:p-3 rounded-lg cursor-pointer transition-all ${
                      selectedCountry === code
                        ? 'bg-[rgba(30,144,255,0.15)] border border-[rgba(30,144,255,0.3)]'
                        : 'hover:bg-[rgba(255,255,255,0.03)] border border-transparent'
                    }`}
                    onClick={() => setSelectedCountry(selectedCountry === code ? null : code)}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[var(--bg-card)] flex items-center justify-center text-xs font-bold text-[#6B7280]">
                        {index + 1}
                      </span>
                      <span className="inline-flex">{getCountryFlag(code)}</span>
                      <span className="text-xs sm:text-sm text-[#F9FAFB] truncate max-w-[60px] sm:max-w-[80px]">{info.name}</span>
                    </div>
                    <span className="text-sm font-bold font-mono-nums text-[var(--accent-blue)]">{info.count}</span>
                  </div>
                ))}
              </div>
            )}
            
            {selectedCountry && (
              <button
                onClick={() => setSelectedCountry(null)}
                className="mt-3 w-full py-2 text-xs text-[#6B7280] hover:text-[#F9FAFB] transition-colors"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Peer List Table with Scoring */}
      <div className="mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <h3 className="text-lg font-semibold text-[#F9FAFB]">Connected Peers with Scoring</h3>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="text-[#6B7280]">Sort by:</span>
            <button
              onClick={() => handleSort('score')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                sortField === 'score' 
                  ? 'bg-[rgba(30,144,255,0.15)] text-[var(--accent-blue)]' 
                  : 'text-[#6B7280] hover:text-[#F9FAFB]'
              }`}
            >
              Score
              <SortIcon field="score" />
            </button>
            <button
              onClick={() => handleSort('latency')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                sortField === 'latency' 
                  ? 'bg-[rgba(30,144,255,0.15)] text-[var(--accent-blue)]' 
                  : 'text-[#6B7280] hover:text-[#F9FAFB]'
              }`}
            >
              Latency
              <SortIcon field="latency" />
            </button>
            <button
              onClick={() => handleSort('country')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                sortField === 'country' 
                  ? 'bg-[rgba(30,144,255,0.15)] text-[var(--accent-blue)]' 
                  : 'text-[#6B7280] hover:text-[#F9FAFB]'
              }`}
            >
              Country
              <SortIcon field="country" />
            </button>
            <button
              onClick={() => handleSort('version')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                sortField === 'version' 
                  ? 'bg-[rgba(30,144,255,0.15)] text-[var(--accent-blue)]' 
                  : 'text-[#6B7280] hover:text-[#F9FAFB]'
              }`}
            >
              Version
              <SortIcon field="version" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-xl border border-[rgba(255,255,255,0.06)]">
          <table className="w-full min-w-[800px]">
            <thead className="bg-[var(--bg-card)]">
              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Trust</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">IP Address</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Country</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Latency</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Score</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Version</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Direction</th>
                <th className="text-right py-3 px-4 text-xs font-medium text-[#6B7280]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.03)]">
              {sortedPeers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[#6B7280]">
                    No peers connected
                  </td>
                </tr>
              ) : (
                sortedPeers.slice(0, 20).map((peer, index) => (
                  <tr 
                    key={peer.id} 
                    className="hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                  >
                    <td className="py-2 sm:py-3 px-4">
                      {getTrustIcon(peer.trustLevel)}
                    </td>
                    <td className="py-2 sm:py-3 px-4 text-xs sm:text-sm font-mono-nums text-[#F9FAFB]">
                      {peer.ip}:{peer.port}
                    </td>
                    <td className="py-2 sm:py-3 px-4 text-xs sm:text-sm text-[#F9FAFB]">
                      <span className="mr-1 sm:mr-2 inline-flex align-middle">{getCountryFlag(peer.countryCode)}</span>
                      <span className="hidden sm:inline">{peer.country}</span>
                    </td>
                    <td className="py-2 sm:py-3 px-4">
                      <span className="text-xs font-medium" style={{ color: getLatencyColor(peer.latency) }}>
                        {peer.latency}ms
                      </span>
                    </td>
                    <td className="py-2 sm:py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
                          <div 
                            className="h-full rounded-full"
                            style={{ 
                              width: `${peer.score}%`,
                              backgroundColor: getScoreColor(peer.score)
                            }}
                          />
                        </div>
                        <span className="text-xs font-medium" style={{ color: getScoreColor(peer.score) }}>
                          {peer.score}
                        </span>
                      </div>
                    </td>
                    <td className="py-2 sm:py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        peer.protocolVersion === 'eth/100' 
                          ? 'bg-[rgba(16,185,129,0.15)] text-[var(--success)]' 
                          : peer.protocolVersion === 'eth/63'
                          ? 'bg-[rgba(245,158,11,0.15)] text-[var(--warning)]'
                          : 'bg-[rgba(239,68,68,0.15)] text-[var(--critical)]'
                      }`}>
                        {peer.protocolVersion}
                      </span>
                    </td>
                    <td className="py-2 sm:py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        peer.inbound 
                          ? 'bg-[rgba(16,185,129,0.1)] text-[var(--success)]' 
                          : 'bg-[rgba(30,144,255,0.1)] text-[var(--accent-blue)]'
                      }`}>
                        {peer.inbound ? <ArrowDownLeft className="w-3 h-3 inline mr-1" /> : <ArrowUpRight className="w-3 h-3 inline mr-1" />}
                        {peer.inbound ? 'In' : 'Out'}
                      </span>
                    </td>
                    <td className="py-2 sm:py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleRemovePeer(peer.id)}
                          className="p-1 rounded hover:bg-[rgba(239,68,68,0.15)] text-[#6B7280] hover:text-[var(--critical)] transition-colors"
                          title="Remove peer"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleBanPeer(peer.id)}
                          className="p-1 rounded hover:bg-[rgba(239,68,68,0.15)] text-[#6B7280] hover:text-[var(--critical)] transition-colors"
                          title="Ban peer"
                        >
                          <Ban className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {sortedPeers.length > 20 && (
          <div className="text-center mt-4 text-sm text-[#6B7280]">
            Showing 20 of {sortedPeers.length} peers
          </div>
        )}
      </div>
    </div>
  );
}

function getCountryFlag(countryCode: string): React.ReactNode {
  if (!countryCode) {
    return (
      <span className="w-5 h-5 rounded-full bg-[var(--accent-blue)]/20 flex items-center justify-center text-[12px] font-bold text-[var(--accent-blue)]">
        ?
      </span>
    );
  }
  return (
    <span className="w-5 h-5 rounded-full bg-[var(--accent-blue)]/20 flex items-center justify-center text-[12px] font-bold text-[var(--accent-blue)]">
      {countryCode.toUpperCase()}
    </span>
  );
}

function getContinent(countryCode: string): string {
  // Simplified continent mapping
  const continentMap: Record<string, string> = {
    'US': 'NA', 'CA': 'NA', 'MX': 'NA',
    'GB': 'EU', 'DE': 'EU', 'FR': 'EU', 'IT': 'EU', 'ES': 'EU', 'NL': 'EU', 'BE': 'EU',
    'CN': 'AS', 'JP': 'AS', 'KR': 'AS', 'IN': 'AS', 'SG': 'AS', 'HK': 'AS',
    'AU': 'OC', 'NZ': 'OC',
    'BR': 'SA', 'AR': 'SA', 'CL': 'SA',
    'ZA': 'AF', 'NG': 'AF', 'EG': 'AF',
  };
  return continentMap[countryCode] || 'Unknown';
}
