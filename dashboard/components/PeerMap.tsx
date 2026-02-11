'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Globe, ArrowDownLeft, ArrowUpRight, Users, ChevronUp, ChevronDown } from 'lucide-react';
import type { PeersData, PeerInfo } from '@/lib/types';

// Dynamically import PeerMapChart to avoid SSR issues with echarts
const PeerMapChart = dynamic(() => import('./PeerMapChart'), { 
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[300px] sm:h-[350px] lg:h-[450px]">
      <div className="w-12 h-12 border-4 border-[#1E90FF] border-t-transparent rounded-full animate-spin"></div>
    </div>
  )
});

interface PeerMapProps {
  peers: PeersData;
}

type SortField = 'country' | 'direction' | 'client';
type SortDirection = 'asc' | 'desc';

export default function PeerMap({ peers }: PeerMapProps) {
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('country');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Top countries for sidebar
  const sortedCountries = useMemo(() => {
    return Object.entries(peers.countries || {})
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);
  }, [peers.countries]);

  // Sort peers for table
  const sortedPeers = useMemo(() => {
    let list = [...(peers.peers || [])];
    
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
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return list;
  }, [peers.peers, sortField, sortDirection, selectedCountry]);

  // Stats
  const inboundCount = peers.peers?.filter(p => p.inbound).length || 0;
  const outboundCount = peers.peers?.filter(p => !p.inbound).length || 0;

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
    <div id="map" className="card-xdc">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#10B981]/20 to-[#1E90FF]/10 flex items-center justify-center">
            <Globe className="w-5 h-5 text-[#10B981]" />
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
            <div className="text-xl font-bold font-mono-nums text-[#10B981]">{inboundCount}</div>
          </div>
          <div className="text-center sm:text-right">
            <div className="section-header">Outbound</div>
            <div className="text-xl font-bold font-mono-nums text-[#1E90FF]">{outboundCount}</div>
          </div>
          <div className="text-center sm:text-right">
            <div className="text-2xl sm:text-3xl font-bold font-mono-nums text-[#1E90FF]">{peers.totalPeers || 0}</div>
            <div className="section-header flex items-center gap-1 justify-center sm:justify-end">
              <Users className="w-3 h-3" /> Total Peers
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Map */}
        <div className="lg:col-span-3 relative">
          {/* Legend */}
          <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-[#111827] px-2 py-1 rounded-full border border-[rgba(255,255,255,0.06)]">
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse"></span>
              <span className="text-[#6B7280]">In</span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#111827] px-2 py-1 rounded-full border border-[rgba(255,255,255,0.06)]">
              <span className="w-2 h-2 rounded-full bg-[#1E90FF] animate-pulse"></span>
              <span className="text-[#6B7280]">Out</span>
            </div>
          </div>

          <PeerMapChart peers={peers} />
        </div>

        {/* Country List */}
        <div className="lg:col-span-1">
          <div className="bg-[#111827] rounded-xl p-4 h-full border border-[rgba(255,255,255,0.06)]">
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
                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-[#111827] flex items-center justify-center text-xs font-bold text-[#6B7280]">
                        {index + 1}
                      </span>
                      <span className="inline-flex">{getCountryFlag(code)}</span>
                      <span className="text-xs sm:text-sm text-[#F9FAFB] truncate max-w-[60px] sm:max-w-[80px]">{info.name}</span>
                    </div>
                    <span className="text-sm font-bold font-mono-nums text-[#1E90FF]">{info.count}</span>
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

      {/* Peer List Table */}
      <div className="mt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
          <h3 className="text-lg font-semibold text-[#F9FAFB]">Connected Peers</h3>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-[#6B7280]">Sort by:</span>
            <button
              onClick={() => handleSort('country')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                sortField === 'country' 
                  ? 'bg-[rgba(30,144,255,0.15)] text-[#1E90FF]' 
                  : 'text-[#6B7280] hover:text-[#F9FAFB]'
              }`}
            >
              Country
              <SortIcon field="country" />
            </button>
            <button
              onClick={() => handleSort('direction')}
              className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                sortField === 'direction' 
                  ? 'bg-[rgba(30,144,255,0.15)] text-[#1E90FF]' 
                  : 'text-[#6B7280] hover:text-[#F9FAFB]'
              }`}
            >
              Direction
              <SortIcon field="direction" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0 rounded-xl border border-[rgba(255,255,255,0.06)]">
          <table className="w-full min-w-[600px]">
            <thead className="bg-[#111827]">
              <tr className="border-b border-[rgba(255,255,255,0.06)]">
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">#</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">IP Address</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Country</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">City</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Direction</th>
                <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Client</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(255,255,255,0.03)]">
              {sortedPeers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#6B7280]">
                    No peers connected
                  </td>
                </tr>
              ) : (
                sortedPeers.slice(0, 20).map((peer, index) => (
                  <tr 
                    key={peer.id} 
                    className="hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                  >
                    <td className="py-2 sm:py-3 px-4 text-xs text-[#6B7280]">{index + 1}</td>
                    <td className="py-2 sm:py-3 px-4 text-xs sm:text-sm font-mono-nums text-[#F9FAFB]">
                      {peer.ip}:{peer.port}
                    </td>
                    <td className="py-2 sm:py-3 px-4 text-xs sm:text-sm text-[#F9FAFB]">
                      <span className="mr-1 sm:mr-2 inline-flex align-middle">{getCountryFlag(peer.countryCode)}</span>
                      <span className="hidden sm:inline">{peer.country}</span>
                    </td>
                    <td className="py-2 sm:py-3 px-4 text-xs sm:text-sm text-[#6B7280]">{peer.city}</td>
                    <td className="py-2 sm:py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        peer.inbound 
                          ? 'bg-[rgba(16,185,129,0.1)] text-[#10B981]' 
                          : 'bg-[rgba(30,144,255,0.1)] text-[#1E90FF]'
                      }`}>
                        {peer.inbound ? <ArrowDownLeft className="w-3 h-3 inline mr-1" /> : <ArrowUpRight className="w-3 h-3 inline mr-1" />}
                        {peer.inbound ? 'In' : 'Out'}
                      </span>
                    </td>
                    <td className="py-2 sm:py-3 px-4 text-xs sm:text-sm text-[#6B7280] truncate max-w-[100px] sm:max-w-[200px]">
                      {peer.name}
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
      <span className="w-5 h-5 rounded-full bg-[#1E90FF]/20 flex items-center justify-center text-[9px] font-bold text-[#1E90FF]">
        ?
      </span>
    );
  }
  return (
    <span className="w-5 h-5 rounded-full bg-[#1E90FF]/20 flex items-center justify-center text-[9px] font-bold text-[#1E90FF]">
      {countryCode.toUpperCase()}
    </span>
  );
}
