'use client';

import { useState, useMemo } from 'react';
import { Globe, ArrowDownLeft, ArrowUpRight, Users, ChevronUp, ChevronDown } from 'lucide-react';
import type { Peer } from './types';

interface PeerMapProps {
  peers: Peer[];
}

type SortField = 'country' | 'direction' | 'client';
type SortDirection = 'asc' | 'desc';

export default function PeerMap({ peers }: PeerMapProps) {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('country');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Calculate country stats
  const countryStats = useMemo(() => {
    const stats: Record<string, { name: string; count: number; code: string }> = {};
    peers.forEach(peer => {
      if (peer.country) {
        if (!stats[peer.country]) {
          stats[peer.country] = { name: peer.country, count: 0, code: peer.country.slice(0, 2).toUpperCase() };
        }
        stats[peer.country].count++;
      }
    });
    return Object.entries(stats)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);
  }, [peers]);

  // Sort peers for table
  const sortedPeers = useMemo(() => {
    let list = [...peers];
    
    // Filter by selected country if any
    if (selectedCountry) {
      list = list.filter(p => p.country === selectedCountry);
    }
    
    // Sort
    list.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'country':
          comparison = (a.country || '').localeCompare(b.country || '');
          break;
        case 'direction':
          comparison = (a.direction === b.direction) ? 0 : a.direction === 'inbound' ? -1 : 1;
          break;
        case 'client':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return list;
  }, [peers, sortField, sortDirection, selectedCountry]);

  // Stats
  const inboundCount = peers.filter(p => p.direction === 'inbound').length;
  const outboundCount = peers.filter(p => p.direction === 'outbound').length;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  return (
    <div className="card-xdc">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--success)]/20 to-[var(--accent-blue)]/10 flex items-center justify-center">
            <Globe className="w-5 h-5 text-[var(--success)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Global Peer Distribution</h2>
            <div className="flex items-center gap-2">
              <span className="status-dot active" />
              <span className="text-sm text-[var(--text-tertiary)]">Real-time peer locations</span>
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
            <div className="text-2xl sm:text-3xl font-bold font-mono-nums text-[var(--accent-blue)]">{peers.length}</div>
            <div className="section-header flex items-center gap-1 justify-center sm:justify-end">
              <Users className="w-3 h-3" /> Total Peers
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* SVG Map Placeholder */}
        <div className="lg:col-span-3 relative">
          {/* Legend */}
          <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-[var(--bg-card)] px-2 py-1 rounded-full border border-[var(--border-subtle)]">
              <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse"></span>
              <span className="text-[var(--text-tertiary)]">In</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[var(--bg-card)] px-2 py-1 rounded-full border border-[var(--border-subtle)]">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-blue)] animate-pulse"></span>
              <span className="text-[var(--text-tertiary)]">Out</span>
            </div>
          </div>

          {/* Simple SVG World Map */}
          <div className="h-[300px] sm:h-[350px] bg-gradient-to-b from-[var(--bg-hover)] to-[var(--bg-body)] rounded-xl border border-[var(--border-subtle)] relative overflow-hidden">
            <svg viewBox="0 0 1000 500" className="w-full h-full opacity-30">
              {/* Simplified world map paths */}
              <path
                d="M150,100 Q200,80 250,100 T350,120 T450,100 T550,110 T650,100 T750,90 T850,100"
                fill="none"
                stroke="var(--accent-blue)"
                strokeWidth="1"
              />
              {/* North America */}
              <path
                d="M50,80 Q100,60 150,80 Q200,100 180,150 Q150,200 100,180 Q50,160 30,120 Q20,90 50,80"
                fill="var(--bg-card)"
                stroke="var(--border-subtle)"
              />
              {/* South America */}
              <path
                d="M120,220 Q150,210 170,240 Q180,280 160,320 Q140,360 120,380 Q100,360 90,320 Q80,280 100,240 Q110,220 120,220"
                fill="var(--bg-card)"
                stroke="var(--border-subtle)"
              />
              {/* Europe */}
              <path
                d="M420,80 Q460,70 490,90 Q510,110 500,140 Q480,160 450,150 Q420,140 410,110 Q405,90 420,80"
                fill="var(--bg-card)"
                stroke="var(--border-subtle)"
              />
              {/* Africa */}
              <path
                d="M430,170 Q470,160 490,190 Q510,230 500,280 Q480,330 450,340 Q420,330 410,280 Q400,230 415,190 Q425,170 430,170"
                fill="var(--bg-card)"
                stroke="var(--border-subtle)"
              />
              {/* Asia */}
              <path
                d="M520,70 Q600,50 700,70 Q800,90 820,140 Q830,190 780,220 Q720,240 650,220 Q580,200 540,160 Q510,120 520,70"
                fill="var(--bg-card)"
                stroke="var(--border-subtle)"
              />
              {/* Australia */}
              <path
                d="M750,300 Q800,290 830,310 Q850,340 840,370 Q820,400 780,390 Q740,380 730,350 Q725,320 750,300"
                fill="var(--bg-card)"
                stroke="var(--border-subtle)"
              />
            </svg>
            
            {/* Peer dots */}
            {peers.slice(0, 20).map((peer, i) => {
              // Generate pseudo-random positions based on peer data
              const x = ((peer.ip.charCodeAt(0) || 50) % 90) * 10 + 50;
              const y = ((peer.ip.charCodeAt(peer.ip.length - 1) || 50) % 50) * 8 + 50;
              return (
                <div
                  key={peer.id}
                  className={`absolute w-2 h-2 rounded-full animate-pulse ${
                    peer.direction === 'inbound' ? 'bg-[var(--success)]' : 'bg-[var(--accent-blue)]'
                  }`}
                  style={{
                    left: `${x}px`,
                    top: `${y}px`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  title={`${peer.ip} (${peer.country || 'Unknown'})`}
                />
              );
            })}
            
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Globe className="w-16 h-16 text-[var(--accent-blue)]/20 mx-auto mb-2" />
                <p className="text-[var(--text-tertiary)]">{peers.length} peers globally distributed</p>
              </div>
            </div>
          </div>
        </div>

        {/* Country List */}
        <div className="lg:col-span-1">
          <div className="bg-[var(--bg-body)] rounded-xl p-4 h-full border border-[var(--border-subtle)]">
            <div className="section-header mb-4">Top Countries</div>

            {countryStats.length === 0 ? (
              <div className="text-center text-[var(--text-tertiary)] py-8">
                No peer data available
              </div>
            ) : (
              <div className="space-y-2 max-h-[350px] overflow-y-auto scrollbar-thin">
                {countryStats.map(([code, info], index) => (
                  <div
                    key={code}
                    className={`flex items-center justify-between p-2 sm:p-3 rounded-lg cursor-pointer transition-all ${
                      selectedCountry === code
                        ? 'bg-[var(--accent-blue-glow)] border border-[var(--border-blue-glow)]'
                        : 'hover:bg-[var(--bg-hover)] border border-transparent'
                    }`}
                    onClick={() => setSelectedCountry(selectedCountry === code ? null : code)}
                  >
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[var(--bg-card)] flex items-center justify-center text-xs font-bold text-[var(--text-tertiary)]">
                        {index + 1}
                      </span>
                      <span className="inline-flex w-5 h-5 rounded-full bg-[var(--accent-blue)]/20 flex items-center justify-center text-[9px] font-bold text-[var(--accent-blue)]">
                        {info.code}
                      </span>
                      <span className="text-xs sm:text-sm text-[var(--text-primary)] truncate max-w-[60px] sm:max-w-[80px]">{info.name}</span>
                    </div>
                    <span className="text-sm font-bold font-mono-nums text-[var(--accent-blue)]">{info.count}</span>
                  </div>
                ))}
              </div>
            )}
            
            {selectedCountry && (
              <button
                onClick={() => setSelectedCountry(null)}
                className="mt-3 w-full py-2 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Peer List Table */}
      <div className="mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Connected Peers</h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[var(--text-tertiary)]">Sort by:</span>
            <button
              onClick={() => handleSort('country')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                sortField === 'country' 
                  ? 'bg-[var(--accent-blue-glow)] text-[var(--accent-blue)]' 
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Country
              <SortIcon field="country" />
            </button>
            <button
              onClick={() => handleSort('direction')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                sortField === 'direction' 
                  ? 'bg-[var(--accent-blue-glow)] text-[var(--accent-blue)]' 
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Direction
              <SortIcon field="direction" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-xl border border-[var(--border-subtle)]">
          <table className="w-full min-w-[600px]">
            <thead className="bg-[var(--bg-hover)]">
              <tr className="border-b border-[var(--border-subtle)]">
                <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-tertiary)]">#</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-tertiary)]">IP Address</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-tertiary)]">Country</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-tertiary)]">City</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-tertiary)]">Direction</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-tertiary)]">Client</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {sortedPeers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--text-tertiary)]">
                    No peers connected
                  </td>
                </tr>
              ) : (
                sortedPeers.slice(0, 20).map((peer, index) => (
                  <tr 
                    key={peer.id} 
                    className="hover:bg-[var(--bg-hover)] transition-colors"
                  >
                    <td className="py-2 sm:py-3 px-4 text-xs text-[var(--text-tertiary)]">{index + 1}</td>
                    <td className="py-2 sm:py-3 px-4 text-xs sm:text-sm font-mono-nums text-[var(--text-primary)]">
                      {peer.ip}:{peer.port}
                    </td>
                    <td className="py-2 sm:py-3 px-4 text-xs sm:text-sm text-[var(--text-primary)]">
                      <span className="w-5 h-5 rounded-full bg-[var(--accent-blue)]/20 flex items-center justify-center text-[9px] font-bold text-[var(--accent-blue)] inline-flex mr-2">
                        {(peer.country || '??').slice(0, 2).toUpperCase()}
                      </span>
                      <span className="hidden sm:inline">{peer.country || 'Unknown'}</span>
                    </td>
                    <td className="py-2 sm:py-3 px-4 text-xs sm:text-sm text-[var(--text-tertiary)]">{peer.city || 'Unknown'}</td>
                    <td className="py-2 sm:py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        peer.direction === 'inbound' 
                          ? 'bg-[var(--success)]/10 text-[var(--success)]' 
                          : 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
                      }`}>
                        {peer.direction === 'inbound' ? <ArrowDownLeft className="w-3 h-3 inline mr-1" /> : <ArrowUpRight className="w-3 h-3 inline mr-1" />}
                        {peer.direction === 'inbound' ? 'In' : 'Out'}
                      </span>
                    </td>
                    <td className="py-2 sm:py-3 px-4 text-xs sm:text-sm text-[var(--text-tertiary)] truncate max-w-[100px] sm:max-w-[200px]">
                      {(peer.name || 'Unknown').slice(0, 30)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {sortedPeers.length > 20 && (
          <div className="text-center mt-4 text-sm text-[var(--text-tertiary)]">
            Showing 20 of {sortedPeers.length} peers
          </div>
        )}
      </div>
    </div>
  );
}
