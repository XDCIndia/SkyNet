'use client';

import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Globe, 
  Shield, 
  ShieldAlert, 
  Trash2,
  ArrowDownLeft, 
  ArrowUpRight,
  ChevronUp,
  ChevronDown,
  Network,
  MapPin,
  Activity,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react';

// Peer interfaces
type ProtocolVersion = 'eth/62' | 'eth/63' | 'eth/100';
type Direction = 'inbound' | 'outbound';

interface Peer {
  id: string;
  nodeId: string;
  address: string;
  client: string;
  protocol: ProtocolVersion;
  direction: Direction;
  latency: number;
  bandwidth: number;
  score: number;
  country: string;
  city: string;
  asn: string;
  continent: string;
  connectedSince: string;
}

// Mock peers data
const mockPeers: Peer[] = [
  { id: 'peer-1', nodeId: '0x7f8a9b...c2d3e4', address: '192.168.1.100:30303', client: 'XDC v1.4.5', protocol: 'eth/100', direction: 'outbound', latency: 24, bandwidth: 1250, score: 95, country: 'United States', city: 'Virginia', asn: 'AS15169', continent: 'North America', connectedSince: '2024-01-15T10:00:00Z' },
  { id: 'peer-2', nodeId: '0x3e4f5g...h6i7j8', address: '10.0.0.50:30303', client: 'XDC v1.4.4', protocol: 'eth/100', direction: 'inbound', latency: 45, bandwidth: 980, score: 88, country: 'Germany', city: 'Frankfurt', asn: 'AS16509', continent: 'Europe', connectedSince: '2024-01-14T08:00:00Z' },
  { id: 'peer-3', nodeId: '0x9k0l1m...n2o3p4', address: '172.16.0.25:30303', client: 'Geth v1.13.0', protocol: 'eth/63', direction: 'outbound', latency: 120, bandwidth: 650, score: 72, country: 'Singapore', city: 'Singapore', asn: 'AS16509', continent: 'Asia', connectedSince: '2024-01-13T12:00:00Z' },
  { id: 'peer-4', nodeId: '0x5q6r7s...t8u9v0', address: '192.168.2.75:30303', client: 'XDC v1.4.5', protocol: 'eth/100', direction: 'inbound', latency: 18, bandwidth: 1500, score: 98, country: 'United Kingdom', city: 'London', asn: 'AS8075', continent: 'Europe', connectedSince: '2024-01-15T09:00:00Z' },
  { id: 'peer-5', nodeId: '0x1w2x3y...z4a5b6', address: '10.1.0.30:30303', client: 'XDC v1.4.3', protocol: 'eth/63', direction: 'outbound', latency: 85, bandwidth: 720, score: 76, country: 'Japan', city: 'Tokyo', asn: 'AS16509', continent: 'Asia', connectedSince: '2024-01-12T15:00:00Z' },
  { id: 'peer-6', nodeId: '0x7c8d9e...f0g1h2', address: '172.20.0.15:30303', client: 'Geth v1.13.1', protocol: 'eth/62', direction: 'inbound', latency: 200, bandwidth: 320, score: 45, country: 'Australia', city: 'Sydney', asn: 'AS14618', continent: 'Oceania', connectedSince: '2024-01-10T20:00:00Z' },
  { id: 'peer-7', nodeId: '0x3i4j5k...l6m7n8', address: '192.168.3.40:30303', client: 'XDC v1.4.5', protocol: 'eth/100', direction: 'outbound', latency: 32, bandwidth: 1100, score: 92, country: 'Canada', city: 'Toronto', asn: 'AS15169', continent: 'North America', connectedSince: '2024-01-14T14:00:00Z' },
  { id: 'peer-8', nodeId: '0x9o0p1q...r2s3t4', address: '10.2.0.55:30303', client: 'XDC v1.4.4', protocol: 'eth/100', direction: 'inbound', latency: 67, bandwidth: 890, score: 84, country: 'Netherlands', city: 'Amsterdam', asn: 'AS8075', continent: 'Europe', connectedSince: '2024-01-13T16:00:00Z' },
  { id: 'peer-9', nodeId: '0x5u6v7w...x8y9z0', address: '172.30.0.20:30303', client: 'Geth v1.12.2', protocol: 'eth/63', direction: 'outbound', latency: 150, bandwidth: 480, score: 58, country: 'India', city: 'Mumbai', asn: 'AS16509', continent: 'Asia', connectedSince: '2024-01-11T22:00:00Z' },
  { id: 'peer-10', nodeId: '0x1a2b3c...d4e5f6', address: '192.168.4.60:30303', client: 'XDC v1.4.5', protocol: 'eth/100', direction: 'inbound', latency: 28, bandwidth: 1350, score: 96, country: 'United States', city: 'Oregon', asn: 'AS14618', continent: 'North America', connectedSince: '2024-01-15T11:00:00Z' },
  { id: 'peer-11', nodeId: '0x7g8h9i...j0k1l2', address: '10.3.0.35:30303', client: 'XDC v1.4.4', protocol: 'eth/100', direction: 'outbound', latency: 55, bandwidth: 820, score: 82, country: 'France', city: 'Paris', asn: 'AS15169', continent: 'Europe', connectedSince: '2024-01-14T10:00:00Z' },
  { id: 'peer-12', nodeId: '0x3m4n5o...p6q7r8', address: '172.40.0.45:30303', client: 'XDC v1.4.5', protocol: 'eth/100', direction: 'inbound', latency: 40, bandwidth: 1050, score: 90, country: 'South Korea', city: 'Seoul', asn: 'AS16509', continent: 'Asia', connectedSince: '2024-01-13T08:00:00Z' },
];

// Banned peers
const mockBannedPeers = [
  { address: '10.99.0.10:30303', reason: 'Protocol violation', bannedAt: '2024-01-10T08:00:00Z' },
  { address: '192.168.99.20:30303', reason: 'Spam transactions', bannedAt: '2024-01-08T14:00:00Z' },
];

// Score badge component
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

// Latency badge
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

// Topology visualization
function TopologyGraph() {
  const nodes = [
    { id: 'n1', x: 150, y: 150, label: 'US-East' },
    { id: 'n2', x: 400, y: 100, label: 'EU-Central' },
    { id: 'n3', x: 600, y: 200, label: 'AP-South' },
    { id: 'n4', x: 100, y: 350, label: 'US-West' },
    { id: 'n5', x: 350, y: 300, label: 'EU-West' },
    { id: 'n6', x: 550, y: 400, label: 'Local' },
  ];
  
  const connections = [
    { from: 'n1', to: 'n2' },
    { from: 'n1', to: 'n4' },
    { from: 'n2', to: 'n3' },
    { from: 'n2', to: 'n5' },
    { from: 'n3', to: 'n6' },
    { from: 'n4', to: 'n5' },
    { from: 'n5', to: 'n6' },
  ];

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox="0 0 750 500" className="w-full min-w-[400px]">
        {/* Background */}
        <rect width="750" height="500" fill="transparent" />
        
        {/* Connections */}
        {connections.map((conn, i) => {
          const from = nodes.find(n => n.id === conn.from)!;
          const to = nodes.find(n => n.id === conn.to)!;
          return (
            <line
              key={i}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="rgba(30, 144, 255, 0.3)"
              strokeWidth="2"
              strokeDasharray="4,4"
            />
          );
        })}
        
        {/* Nodes */}
        {nodes.map(node => (
          <g key={node.id}>
            <circle
              cx={node.x}
              cy={node.y}
              r="30"
              fill="#111827"
              stroke="#1E90FF"
              strokeWidth="2"
            />
            <text
              x={node.x}
              y={node.y + 5}
              textAnchor="middle"
              fill="#F9FAFB"
              fontSize="10"
            >
              {node.label}
            </text>
          </g>
        ))}
        
        {/* Legend */}
        <g transform="translate(20, 460)">
          <line x1="0" y1="0" x2="30" y2="0" stroke="rgba(30, 144, 255, 0.3)" strokeWidth="2" strokeDasharray="4,4" />
          <text x="40" y="4" fill="#6B7280" fontSize="11">P2P Connection</text>
          <circle cx="150" cy="0" r="8" fill="#111827" stroke="#1E90FF" strokeWidth="2" />
          <text x="170" y="4" fill="#6B7280" fontSize="11">Node</text>
        </g>
      </svg>
    </div>
  );
}

export default function PeersPage() {
  const [sortField, setSortField] = useState<keyof Peer>('score');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [bannedPeers, setBannedPeers] = useState(mockBannedPeers);
  const [toast, setToast] = useState<string | null>(null);

  const sortedPeers = useMemo(() => {
    const sorted = [...mockPeers];
    sorted.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [sortField, sortDirection]);

  // Calculate geographic diversity
  const geoStats = useMemo(() => {
    const countries = new Set(mockPeers.map(p => p.country));
    const asns = new Set(mockPeers.map(p => p.asn));
    const continents = new Set(mockPeers.map(p => p.continent));
    
    // Calculate diversity score (0-100)
    // Based on: unique countries (max 30), unique ASNs (max 30), continent spread (max 40)
    const countryScore = Math.min(30, countries.size * 3);
    const asnScore = Math.min(30, asns.size * 6);
    const continentScore = Math.min(40, continents.size * 10);
    const totalScore = countryScore + asnScore + continentScore;
    
    return {
      uniqueCountries: countries.size,
      uniqueASNs: asns.size,
      continents: Array.from(continents),
      score: totalScore,
      byContinent: {
        'North America': mockPeers.filter(p => p.continent === 'North America').length,
        'Europe': mockPeers.filter(p => p.continent === 'Europe').length,
        'Asia': mockPeers.filter(p => p.continent === 'Asia').length,
        'Oceania': mockPeers.filter(p => p.continent === 'Oceania').length,
        'South America': 0,
        'Africa': 0,
      }
    };
  }, []);

  // Protocol distribution
  const protocolStats = useMemo(() => {
    const eth100 = mockPeers.filter(p => p.protocol === 'eth/100').length;
    const eth63 = mockPeers.filter(p => p.protocol === 'eth/63').length;
    const eth62 = mockPeers.filter(p => p.protocol === 'eth/62').length;
    return { eth100, eth63, eth62 };
  }, []);

  const handleSort = (field: keyof Peer) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleAction = (action: string, peerId: string) => {
    setToast(`${action} action triggered for peer ${peerId.slice(0, 8)}`);
  };

  const handleUnban = (address: string) => {
    setBannedPeers(bannedPeers.filter(p => p.address !== address));
    setToast(`Peer ${address} has been unbanned`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-semibold text-[#F9FAFB]">Peers & Network</h1>
          <p className="text-[#6B7280] mt-1">Manage peer connections and network topology</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Peer Management Table */}
          <div className="card-xdc lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[rgba(30,144,255,0.1)] flex items-center justify-center text-[#1E90FF]">
                <Network className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#F9FAFB]">Peer Management</h2>
                <p className="text-xs text-[#6B7280]">{mockPeers.length} connected peers</p>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280] cursor-pointer" onClick={() => handleSort('address')}>Address</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280]">Node ID</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280]">Client</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280]">Protocol</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280]">Direction</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280] cursor-pointer" onClick={() => handleSort('latency')}>Latency</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280] cursor-pointer" onClick={() => handleSort('score')}>Score</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280]">Location</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[#6B7280]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {sortedPeers.map((peer) => (
                    <tr key={peer.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-3 text-xs font-mono-nums">{peer.address}</td>
                      <td className="py-3 px-3 text-xs font-mono-nums text-[#6B7280]">{peer.nodeId}</td>
                      <td className="py-3 px-3 text-xs">{peer.client}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 bg-white/5 rounded text-xs">{peer.protocol}</span>
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
                      <td className="py-3 px-3">
                        <LatencyBadge latency={peer.latency} />
                      </td>
                      <td className="py-3 px-3">
                        <ScoreBadge score={peer.score} />
                      </td>
                      <td className="py-3 px-3 text-xs">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#6B7280]" />
                          {peer.city}, {peer.country}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex gap-1">
                          <button 
                            onClick={() => handleAction('Trust', peer.id)}
                            className="p-1.5 hover:bg-white/5 rounded"
                            title="Trust"
                          >
                            <Shield className="w-4 h-4 text-[#10B981]" />
                          </button>
                          <button 
                            onClick={() => handleAction('Ban', peer.id)}
                            className="p-1.5 hover:bg-white/5 rounded"
                            title="Ban"
                          >
                            <ShieldAlert className="w-4 h-4 text-[#F59E0B]" />
                          </button>
                          <button 
                            onClick={() => handleAction('Remove', peer.id)}
                            className="p-1.5 hover:bg-white/5 rounded"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4 text-[#EF4444]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Geographic Diversity */}
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
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">Unique ASNs</span>
                  <span>{geoStats.uniqueASNs}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#6B7280]">Continents</span>
                  <span>{geoStats.continents.length}</span>
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
              
              {geoStats.byContinent['South America'] === 0 && (
                <div className="mt-4 p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-medium">Suggestion:</span> Add peers in South America (0 peers currently)
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Protocol Matrix */}
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
                <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                  <span className="text-sm font-mono">eth/100</span>
                  <span className="text-sm font-mono-nums text-[#10B981]">{protocolStats.eth100} peers</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                  <span className="text-sm font-mono">eth/63</span>
                  <span className="text-sm font-mono-nums text-[#1E90FF]">{protocolStats.eth63} peers</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-white/5 rounded-lg">
                  <span className="text-sm font-mono">eth/62</span>
                  <span className="text-sm font-mono-nums text-[#6B7280]">{protocolStats.eth62} peers</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* P2P Topology */}
        <div className="card-xdc">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[rgba(245,158,11,0.1)] flex items-center justify-center text-[#F59E0B]">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#F9FAFB]">P2P Topology</h2>
              <p className="text-xs text-[#6B7280]">Network graph visualization</p>
            </div>
          </div>
          
          <TopologyGraph />
        </div>

        {/* Banned Peers */}
        <<div className="card-xdc">
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
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Address</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Reason</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Banned Date</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {bannedPeers.map((peer, index) => (
                    <tr key={index} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 text-sm font-mono-nums">{peer.address}</td>
                      <td className="py-3 px-4 text-sm">{peer.reason}</td>
                      <td className="py-3 px-4 text-sm text-[#6B7280]">
                        {new Date(peer.bannedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <button 
                          onClick={() => handleUnban(peer.address)}
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
          <button onClick={() => setToast(null)} className="text-[#6B7280] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </DashboardLayout>
  );
}
