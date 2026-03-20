'use client';

import { useState, useEffect, useMemo } from 'react';
import { Users, ChevronDown, ChevronUp, ArrowDownLeft, ArrowUpRight, Network } from 'lucide-react';

interface PeerData {
  ip: string;
  clientType: string;
  clientVersion: string;
  caps: string[];
  direction: string;
  country?: string | null;
  city?: string | null;
}

interface Diversity {
  geth: number;
  erigon: number;
  nethermind: number;
  reth: number;
  unknown: number;
  total: number;
}

interface PeerResponse {
  diversity: Diversity;
  peers: PeerData[];
  capturedAt: string | null;
}

interface PeerQualityProps {
  nodeId: string;
}

// Client type colors
const CLIENT_COLORS: Record<string, string> = {
  geth: '#1E90FF',        // Blue
  erigon: '#F97316',      // Orange
  nethermind: '#8B5CF6',  // Purple
  reth: '#10B981',        // Green
  unknown: '#6B7280',     // Gray
};

export default function PeerQuality({ nodeId }: PeerQualityProps) {
  const [data, setData] = useState<PeerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [showAllPeers, setShowAllPeers] = useState(false);
  const [sortField, setSortField] = useState<'client' | 'direction'>('client');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    const fetchPeers = async () => {
      try {
        const res = await fetch(`/api/v1/nodes/${nodeId}/peers`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error('Failed to fetch peer data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPeers();
    const interval = setInterval(fetchPeers, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [nodeId]);

  // Sorted peers
  const sortedPeers = useMemo(() => {
    if (!data?.peers) return [];
    const list = [...data.peers];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'client') {
        cmp = (a.clientType || '').localeCompare(b.clientType || '');
      } else {
        cmp = (a.direction || '').localeCompare(b.direction || '');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [data?.peers, sortField, sortDir]);

  const displayedPeers = showAllPeers ? sortedPeers : sortedPeers.slice(0, 25);

  // Direction stats
  const inboundCount = data?.peers.filter(p => p.direction === 'inbound').length ?? 0;
  const outboundCount = data?.peers.filter(p => p.direction === 'outbound').length ?? 0;
  const inboundPct = data?.peers.length ? Math.round((inboundCount / data.peers.length) * 100) : 0;

  const handleSort = (field: 'client' | 'direction') => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  if (loading) {
    return (
      <div className="card-xdc animate-pulse">
        <div className="h-6 bg-[var(--bg-hover)] rounded w-1/3 mb-4"></div>
        <div className="h-32 bg-[var(--bg-hover)] rounded"></div>
      </div>
    );
  }

  if (!data || data.diversity.total === 0) {
    return null; // Don't render if no peer data
  }

  // Donut chart segments
  const donutSegments = useMemo(() => {
    const { geth, erigon, nethermind, reth, unknown, total } = data.diversity;
    if (total === 0) return [];

    const segments: { client: string; count: number; color: string; pct: number }[] = [];
    if (geth > 0) segments.push({ client: 'Geth/XDC', count: geth, color: CLIENT_COLORS.geth, pct: (geth / total) * 100 });
    if (erigon > 0) segments.push({ client: 'Erigon', count: erigon, color: CLIENT_COLORS.erigon, pct: (erigon / total) * 100 });
    if (nethermind > 0) segments.push({ client: 'Nethermind', count: nethermind, color: CLIENT_COLORS.nethermind, pct: (nethermind / total) * 100 });
    if (reth > 0) segments.push({ client: 'Reth', count: reth, color: CLIENT_COLORS.reth, pct: (reth / total) * 100 });
    if (unknown > 0) segments.push({ client: 'Unknown', count: unknown, color: CLIENT_COLORS.unknown, pct: (unknown / total) * 100 });

    return segments;
  }, [data.diversity]);

  // Build conic-gradient for donut
  const conicGradient = useMemo(() => {
    if (donutSegments.length === 0) return 'conic-gradient(#333 0deg, #333 360deg)';
    let angle = 0;
    const stops: string[] = [];
    for (const seg of donutSegments) {
      const startAngle = angle;
      const endAngle = angle + (seg.pct / 100) * 360;
      stops.push(`${seg.color} ${startAngle}deg ${endAngle}deg`);
      angle = endAngle;
    }
    return `conic-gradient(${stops.join(', ')})`;
  }, [donutSegments]);

  return (
    <div className="card-xdc">
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-blue)]/20 to-purple-500/10 flex items-center justify-center">
            <Network className="w-5 h-5 text-[var(--accent-blue)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Peer Quality</h2>
            <div className="flex items-center gap-2">
              <span className="status-dot active" />
              <span className="text-sm text-[var(--text-tertiary)]">Client diversity & connections</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-bold font-mono-nums text-[var(--accent-blue)]">{data.diversity.total}</div>
            <div className="section-header">Total Peers</div>
          </div>
          {expanded ? <ChevronUp className="w-5 h-5 text-[var(--text-tertiary)]" /> : <ChevronDown className="w-5 h-5 text-[var(--text-tertiary)]" />}
        </div>
      </div>

      {expanded && (
        <div className="mt-6 space-y-6">
          {/* Section 1: Diversity Donut + Legend */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Donut Chart */}
            <div className="flex items-center justify-center">
              <div className="relative w-40 h-40">
                <div
                  className="w-full h-full rounded-full"
                  style={{
                    background: conicGradient,
                  }}
                />
                {/* Inner white circle to make it a donut */}
                <div className="absolute inset-6 rounded-full bg-[var(--bg-card)] flex items-center justify-center flex-col">
                  <span className="text-2xl font-bold font-mono-nums text-[var(--text-primary)]">{data.diversity.total}</span>
                  <span className="text-xs text-[var(--text-tertiary)]">peers</span>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-col justify-center space-y-2">
              {donutSegments.map((seg) => (
                <div key={seg.client} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-hover)]">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="text-sm text-[var(--text-primary)]">{seg.client}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono-nums text-[var(--text-secondary)]">{seg.count}</span>
                    <span className="text-xs text-[var(--text-tertiary)]">({seg.pct.toFixed(0)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Direction Balance Bar */}
          <div className="bg-[var(--bg-hover)] rounded-xl p-4">
            <div className="section-header mb-2">Connection Direction</div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-sm">
                <ArrowDownLeft className="w-4 h-4 text-[var(--success)]" />
                <span className="text-[var(--text-secondary)]">In: {inboundCount}</span>
              </div>
              <div className="flex-1 h-3 bg-[var(--bg-card)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[var(--success)] to-[var(--accent-blue)]"
                  style={{ width: `${inboundPct}%` }}
                />
              </div>
              <div className="flex items-center gap-1 text-sm">
                <ArrowUpRight className="w-4 h-4 text-[var(--accent-blue)]" />
                <span className="text-[var(--text-secondary)]">Out: {outboundCount}</span>
              </div>
            </div>
            <div className="text-center text-xs text-[var(--text-tertiary)] mt-1">
              {inboundPct}% inbound / {100 - inboundPct}% outbound
            </div>
          </div>

          {/* Section 2: Peer Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Connected Peers</h3>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[var(--text-tertiary)]">Sort:</span>
                <button
                  onClick={() => handleSort('client')}
                  className={`px-2 py-1 rounded ${sortField === 'client' ? 'bg-[var(--accent-blue-glow)] text-[var(--accent-blue)]' : 'text-[var(--text-tertiary)]'}`}
                >
                  Client {sortField === 'client' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => handleSort('direction')}
                  className={`px-2 py-1 rounded ${sortField === 'direction' ? 'bg-[var(--accent-blue-glow)] text-[var(--accent-blue)]' : 'text-[var(--text-tertiary)]'}`}
                >
                  Dir {sortField === 'direction' && (sortDir === 'asc' ? '↑' : '↓')}
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-hover)]">
                  <tr className="border-b border-[var(--border-subtle)]">
                    <th className="text-left py-2 px-3 text-xs font-medium text-[var(--text-tertiary)]">IP</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[var(--text-tertiary)]">Client</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[var(--text-tertiary)]">Protocols</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[var(--text-tertiary)]">Dir</th>
                    <th className="text-left py-2 px-3 text-xs font-medium text-[var(--text-tertiary)]">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {displayedPeers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-[var(--text-tertiary)]">
                        No peer data available
                      </td>
                    </tr>
                  ) : (
                    displayedPeers.map((peer, idx) => (
                      <tr key={`${peer.ip}-${idx}`} className="hover:bg-[var(--bg-hover)]">
                        <td className="py-2 px-3 font-mono-nums text-[var(--text-secondary)] truncate max-w-[120px]" title={peer.ip}>
                          {peer.ip.length > 15 ? peer.ip.slice(0, 15) + '…' : peer.ip}
                        </td>
                        <td className="py-2 px-3 truncate max-w-[200px]" title={peer.clientVersion}>
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
                            style={{
                              backgroundColor: `${CLIENT_COLORS[peer.clientType] || CLIENT_COLORS.unknown}20`,
                              color: CLIENT_COLORS[peer.clientType] || CLIENT_COLORS.unknown,
                            }}
                          >
                            {peer.clientType}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex flex-wrap gap-1">
                            {(peer.caps || []).slice(0, 3).map((cap, i) => (
                              <span key={i} className="px-1.5 py-0.5 text-[10px] bg-[var(--bg-card)] text-[var(--text-tertiary)] rounded">
                                {cap}
                              </span>
                            ))}
                            {(peer.caps || []).length > 3 && (
                              <span className="text-[10px] text-[var(--text-tertiary)]">+{peer.caps.length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex items-center gap-1 text-xs ${peer.direction === 'inbound' ? 'text-[var(--success)]' : 'text-[var(--accent-blue)]'}`}>
                            {peer.direction === 'inbound' ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                            {peer.direction === 'inbound' ? 'In' : 'Out'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[var(--text-tertiary)]">
                          {peer.country ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="font-bold text-[10px]">{peer.country}</span>
                              {peer.city && <span className="text-[10px]">{peer.city}</span>}
                            </span>
                          ) : (
                            <span className="text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {sortedPeers.length > 25 && (
              <button
                onClick={() => setShowAllPeers(!showAllPeers)}
                className="mt-3 w-full py-2 text-sm text-[var(--accent-blue)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
              >
                {showAllPeers ? 'Show Less' : `Show All ${sortedPeers.length} Peers`}
              </button>
            )}
          </div>

          {/* Last updated */}
          {data.capturedAt && (
            <div className="text-xs text-[var(--text-tertiary)] text-right">
              Last updated: {new Date(data.capturedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
