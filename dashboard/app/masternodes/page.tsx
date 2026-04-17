'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Pickaxe,
  Users,
  AlertTriangle,
  Coins,
  Shield,
  ArrowUpDown,
  Search,
  Copy,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Activity,
  ChevronLeft,
  ChevronLast,
  ChevronFirst,
  RefreshCw
} from 'lucide-react';

interface MasternodeInfo {
  address: string;
  xdcAddress: string;
  status: 'active' | 'standby' | 'penalized';
  owner?: string;
  stake?: string;
  stakeRaw?: string;
  voterCount?: number;
  ethstatsName?: string;
  rank?: number;
}

interface MasternodeStats {
  epoch: number;
  round: number;
  blockNumber: number;
  totalActive: number;
  totalStandby: number;
  totalPenalized: number;
  totalStaked: string;
  averageStake: string;
  nakamotoCoefficient: number;
  topValidators: {
    address: string;
    stake: string;
    percentage: string;
  }[];
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function StatusBadge({ status }: { status: 'active' | 'standby' | 'penalized' }) {
  const styles = {
    active: 'bg-[var(--success)]/10 text-[var(--success)] border-[#10B981]/20',
    standby: 'bg-[var(--warning)]/10 text-[var(--warning)] border-[#F59E0B]/20',
    penalized: 'bg-[var(--critical)]/10 text-[var(--critical)] border-[#EF4444]/20',
  };
  
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${styles[status]}`}>
      {status?.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <button
      onClick={handleCopy}
      className="p-1 hover:bg-white/5 rounded transition-colors"
      title={copied ? 'Copied!' : `Copy ${label || 'address'}`}
    >
      <Copy className={`w-3.5 h-3.5 ${copied ? 'text-[var(--success)]' : 'text-[var(--text-tertiary)]'}`} />
    </button>
  );
}

function truncateAddress(addr: string, start = 6, end = 4): string {
  if (!addr) return '';
  if (addr.length <= start + end + 3) return addr;
  return `${addr.slice(0, start)}...${addr.slice(-end)}`;
}

// Stake Distribution Bar Chart (SVG)
function StakeDistributionChart({ validators }: { validators: { address: string; stake: string; percentage: string }[] }) {
  const maxStake = Math.max(...validators.map(v => parseFloat(v.stake?.replace(/,/g, '') || '0')));
  
  return (
    <div className="w-full">
      <svg viewBox="0 0 600 200" className="w-full">
        {/* Background grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line
            key={t}
            x1={50}
            y1={20 + t * 140}
            x2={580}
            y2={20 + t * 140}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
        ))}
        
        {/* Bars */}
        {validators.slice(0, 20).map((v, i) => {
          const stake = parseFloat(v.stake?.replace(/,/g, '') || '0');
          const height = (stake / maxStake) * 140;
          const x = 50 + i * 26;
          
          return (
            <g key={v.address}>
              <rect
                x={x}
                y={160 - height}
                width="20"
                height={height}
                fill={i < 10 ? '#1E90FF' : '#1E90FF80'}
                rx="2"
              />
              <text
                x={x + 10}
                y={175}
                textAnchor="middle"
                fill="var(--text-tertiary)"
                fontSize="8"
              >
                {i + 1}
              </text>
            </g>
          );
        })}
        
        {/* Y-axis labels */}
        <text x="40" y="25" textAnchor="end" fill="var(--text-tertiary)" fontSize="10">{(maxStake / 1e6).toFixed(1)}M</text>
        <text x="40" y="90" textAnchor="end" fill="var(--text-tertiary)" fontSize="10">{(maxStake / 2 / 1e6).toFixed(1)}M</text>
        <text x="40" y="165" textAnchor="end" fill="var(--text-tertiary)" fontSize="10">0</text>
      </svg>
      <div className="text-center text-xs text-[var(--text-tertiary)] mt-2">Top 20 Validators by Stake</div>
    </div>
  );
}

// Pagination Component
function Pagination({ 
  pagination, 
  onPageChange 
}: { 
  pagination: PaginationInfo; 
  onPageChange: (page: number) => void;
}) {
  const { page, totalPages } = pagination;
  
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = page - 1; i <= page + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        onClick={() => onPageChange(1)}
        disabled={page === 1}
        className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
        title="First page"
      >
        <ChevronFirst className="w-4 h-4" />
      </button>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
        title="Previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      
      <div className="flex items-center gap-1">
        {getPageNumbers().map((p, i) => (
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="px-2 text-[var(--text-tertiary)]">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium transition-colors ${
                page === p 
                  ? 'bg-[var(--accent-blue)] text-white' 
                  : 'hover:bg-white/5 text-[var(--text-secondary)]'
              }`}
            >
              {p}
            </button>
          )
        ))}
      </div>
      
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
        title="Next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={page === totalPages}
        className="p-2 hover:bg-white/5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
        title="Last page"
      >
        <ChevronLast className="w-4 h-4" />
      </button>
      
      <span className="ml-4 text-sm text-[var(--text-tertiary)]">
        Page {page} of {totalPages}
      </span>
    </div>
  );
}

export default function MasternodesPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<'active' | 'standby' | 'penalized' | 'all'>('active');
  const [stats, setStats] = useState<MasternodeStats | null>(null);
  const [masternodes, setMasternodes] = useState<MasternodeInfo[]>([]);
  const [standbynodes, setStandbynodes] = useState<MasternodeInfo[]>([]);
  const [penalized, setPenalized] = useState<MasternodeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'stake' | 'rank' | 'address'>('rank');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  
  // Pagination state
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  const fetchData = useCallback(async (page = pagination.page, search = searchTerm, statusFilter = filter) => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        filter: statusFilter === 'all' ? 'all' : statusFilter,
      });
      
      if (search) {
        params.append('search', search);
      }
      
      const [statsRes, nodesRes] = await Promise.all([
        fetch('/api/v1/masternodes/stats'),
        fetch(`/api/v1/masternodes?${params}`),
      ]);
      
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success) {
          setStats(statsData.data);
        }
      }
      
      if (nodesRes.ok) {
        const nodesData = await nodesRes.json();
        if (nodesData.success) {
          setMasternodes(nodesData.data.masternodes);
          setStandbynodes(nodesData.data.standbynodes);
          setPenalized(nodesData.data.penalized);
          if (nodesData.data.pagination) {
            setPagination(nodesData.data.pagination);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch masternode data:', err);
    } finally {
      setLoading(false);
    }
  }, [pagination.limit]);
  
  // Initial fetch and auto-refresh every 60 seconds
  useEffect(() => {
    fetchData(1, searchTerm, filter);
    const interval = setInterval(() => fetchData(pagination.page, searchTerm, filter), 60000);
    return () => clearInterval(interval);
  }, [fetchData, pagination.page, searchTerm, filter]);
  
  const currentNodes = useMemo(() => {
    let nodes: MasternodeInfo[] = [];
    switch (filter) {
      case 'active':
        nodes = masternodes;
        break;
      case 'standby':
        nodes = standbynodes;
        break;
      case 'penalized':
        nodes = penalized;
        break;
      case 'all':
        nodes = [...masternodes, ...standbynodes, ...penalized];
        break;
    }
    
    // Sort
    return [...nodes].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'stake':
          const aStake = parseFloat(a.stake?.replace(/,/g, '') || '0');
          const bStake = parseFloat(b.stake?.replace(/,/g, '') || '0');
          comparison = aStake - bStake;
          break;
        case 'rank':
          comparison = (a.rank || 0) - (b.rank || 0);
          break;
        case 'address':
          comparison = a.xdcAddress.localeCompare(b.xdcAddress);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filter, masternodes, standbynodes, penalized, sortField, sortDirection]);
  
  const handleSort = (field: 'stake' | 'rank' | 'address') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  const handleRowClick = (address: string) => {
    setExpandedRow(expandedRow === address ? null : address);
  };
  
  const handleNavigateToDetail = (xdcAddress: string) => {
    router.push(`/masternodes/${xdcAddress}`);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPagination(prev => ({ ...prev, page: 1 }));
    // Debounce search
    const timeout = setTimeout(() => {
      fetchData(1, value, filter);
    }, 300);
    return () => clearTimeout(timeout);
  };

  const handleFilterChange = (newFilter: 'active' | 'standby' | 'penalized' | 'all') => {
    setFilter(newFilter);
    setPagination(prev => ({ ...prev, page: 1 }));
    fetchData(1, searchTerm, newFilter);
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    fetchData(newPage, searchTerm, filter);
    // Scroll to top of table
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRefresh = () => {
    fetchData(pagination.page, searchTerm, filter);
  };
  
  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Masternodes</h1>
            <p className="text-[var(--text-tertiary)] mt-1">XDC Validator network overview — Live from XDCValidator Contract</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
              <span>Epoch {stats?.epoch || '--'}</span>
              <span className="text-[var(--text-tertiary)]">·</span>
              <span>Block {(stats?.blockNumber || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
        
        {/* Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="card-xdc">
            <div className="section-header mb-1 text-[var(--success)]">Active</div>
            <div className="text-2xl font-bold font-mono-nums text-[var(--success)]">{stats?.totalActive || '--'}</div>
          </div>
          <div className="card-xdc">
            <div className="section-header mb-1 text-[var(--warning)]">Standby</div>
            <div className="text-2xl font-bold font-mono-nums text-[var(--warning)]">{stats?.totalStandby || '--'}</div>
          </div>
          <div className="card-xdc">
            <div className="section-header mb-1 text-[var(--critical)]">Penalized</div>
            <div className="text-2xl font-bold font-mono-nums text-[var(--critical)]">{stats?.totalPenalized || '--'}</div>
          </div>
          <div className="card-xdc">
            <div className="section-header mb-1">Total Staked</div>
            <div className="text-xl font-bold font-mono-nums">{stats ? `${parseFloat(stats.totalStaked.replace(/,/g, '')).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '--'}</div>
            <div className="text-xs text-[var(--text-tertiary)]">XDC</div>
          </div>
          <div className="card-xdc">
            <div className="section-header mb-1">Avg Stake</div>
            <div className="text-xl font-bold font-mono-nums">{stats ? `${parseFloat(stats.averageStake.replace(/,/g, '')).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '--'}</div>
            <div className="text-xs text-[var(--text-tertiary)]">XDC</div>
          </div>
          <div className="card-xdc">
            <div className="section-header mb-1">Nakamoto Coeff</div>
            <div className="text-2xl font-bold font-mono-nums">{stats?.nakamotoCoefficient || '--'}</div>
          </div>
        </div>
        
        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Masternode Lists */}
          <div className="card-xdc lg:col-span-2">
            {/* Tabs */}
            <div className="flex items-center gap-2 mb-6 border-b border-white/10">
              {(['active', 'standby', 'penalized', 'all'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => handleFilterChange(tab)}
                  className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                    filter === tab ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tab?.charAt(0).toUpperCase() + tab.slice(1)}
                  <span className="ml-2 text-xs opacity-60">
                    {tab === 'active' ? stats?.totalActive : 
                     tab === 'standby' ? stats?.totalStandby : 
                     tab === 'penalized' ? stats?.totalPenalized :
                     (stats?.totalActive || 0) + (stats?.totalStandby || 0) + (stats?.totalPenalized || 0)}
                  </span>
                  {filter === tab && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-blue)]" />
                  )}
                </button>
              ))}
            </div>
            
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
              <input
                type="text"
                placeholder="Search by address (xdc... or 0x...)..."
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm focus:outline-none focus:border-[var(--accent-blue)]"
              />
            </div>
            
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-tertiary)] w-8"></th>
                    <th 
                      className="text-left py-3 px-3 text-xs font-medium text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-primary)]"
                      onClick={() => handleSort('rank')}
                    >
                      <div className="flex items-center gap-1">
                        #
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-tertiary)]">Address</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-tertiary)]">Owner</th>
                    <th 
                      className="text-left py-3 px-3 text-xs font-medium text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--text-primary)]"
                      onClick={() => handleSort('stake')}
                    >
                      <div className="flex items-center gap-1">
                        Stake
                        <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-tertiary)]">Status</th>
                    <th className="text-left py-3 px-3 text-xs font-medium text-[var(--text-tertiary)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[var(--text-tertiary)]">
                        <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2" />
                        Loading...
                      </td>
                    </tr>
                  ) : currentNodes.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[var(--text-tertiary)]">
                        No masternodes found
                        {searchTerm && <div className="text-xs mt-1">Try a different search term</div>}
                      </td>
                    </tr>
                  ) : (
                    currentNodes.map((node) => (
                      <>
                        <tr
                          key={node.address}
                          className="hover:bg-white/[0.02] cursor-pointer"
                          onClick={() => handleRowClick(node.address)}
                        >
                          <td className="py-3 px-3">
                            {expandedRow === node.address ? (
                              <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)]" />
                            )}
                          </td>
                          <td className="py-3 px-3 text-[var(--text-tertiary)]">
                            {node.rank || '-'}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{truncateAddress(node.xdcAddress)}</span>
                              <CopyButton text={node.xdcAddress} />
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {node.owner ? (
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">{truncateAddress(toXdcAddress(node.owner))}</span>
                                <CopyButton text={toXdcAddress(node.owner)} />
                              </div>
                            ) : (
                              <span className="text-[var(--text-tertiary)]">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-mono-nums">{node.stake || '0'}</span>
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge status={node.status} />
                          </td>
                          <td className="py-3 px-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavigateToDetail(node.xdcAddress);
                              }}
                              className="p-1.5 hover:bg-white/5 rounded transition-colors"
                              title="View details"
                            >
                              <ExternalLink className="w-4 h-4 text-[var(--accent-blue)]" />
                            </button>
                          </td>
                        </tr>
                        {expandedRow === node.address && (
                          <tr>
                            <td colSpan={7} className="bg-[var(--bg-body)]/50 p-4">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-[var(--text-tertiary)]">Full XDC Address:</span>
                                  <span className="font-mono text-sm">{node.xdcAddress}</span>
                                  <CopyButton text={node.xdcAddress} />
                                </div>
                                {node.owner && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-[var(--text-tertiary)]">Owner:</span>
                                    <span className="font-mono text-sm">{toXdcAddress(node.owner)}</span>
                                    <CopyButton text={toXdcAddress(node.owner)} />
                                  </div>
                                )}
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-[var(--text-tertiary)]">Raw Stake:</span>
                                  <span className="font-mono text-sm">{node.stakeRaw || '0'} wei</span>
                                </div>
                                <button
                                  onClick={() => handleNavigateToDetail(node.xdcAddress)}
                                  className="mt-2 text-sm text-[var(--accent-blue)] hover:underline"
                                >
                                  View full details →
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <Pagination 
                pagination={pagination} 
                onPageChange={handlePageChange}
              />
            )}
            
            {/* Results summary */}
            <div className="mt-4 text-xs text-[var(--text-tertiary)] text-center">
              Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)} - {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} masternodes
            </div>
          </div>
          
          {/* Decentralization Metrics */}
          <div className="space-y-6">
            {/* Nakamoto Coefficient */}
            <div className="card-xdc">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[rgba(30,144,255,0.1)] flex items-center justify-center text-[var(--accent-blue)]">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Decentralization</h2>
                  <p className="text-xs text-[var(--text-tertiary)]">Network security metrics</p>
                </div>
              </div>
              
              <div className="text-center mb-4">
                <div className="text-4xl font-bold font-mono-nums text-[var(--accent-blue)]">{stats?.nakamotoCoefficient || '--'}</div>
                <div className="text-sm text-[var(--text-tertiary)]">Nakamoto Coefficient</div>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">Min validators for 33% control</p>
              </div>
              
              <div className="pt-4 border-t border-white/10">
                <div className="text-sm font-medium mb-3">Top 10 Validators</div>
                <div className="space-y-2">
                  {stats?.topValidators.slice(0, 5).map((v, i) => (
                    <div key={v.address} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-tertiary)] w-4">{i + 1}</span>
                        <span className="font-mono text-sm">{truncateAddress(v.address)}</span>
                      </div>
                      <span className="text-sm text-[var(--success)]">{v.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Stake Distribution Chart */}
            <div className="card-xdc">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[rgba(16,185,129,0.1)] flex items-center justify-center text-[var(--success)]">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Stake Distribution</h2>
                  <p className="text-xs text-[var(--text-tertiary)]">Top validators by stake</p>
                </div>
              </div>
              
              {stats?.topValidators && <StakeDistributionChart validators={stats.topValidators} />}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// Helper to convert 0x to xdc
function toXdcAddress(address: string): string {
  if (!address) return '';
  if (address.startsWith('0x')) {
    return 'xdc' + address.slice(2);
  }
  return address;
}
