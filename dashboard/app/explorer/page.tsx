'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  Search, 
  Pickaxe, 
  TrendingUp, 
  Clock, 
  Shield, 
  Award,
  ChevronUp,
  ChevronDown,
  Copy,
  CheckCircle,
  Hash,
  Activity,
  Globe,
  Zap
} from 'lucide-react';

interface Masternode {
  address: string;
  xdcAddress: string;
  status: 'active' | 'standby' | 'penalized';
  stake?: string;
  owner?: string;
  voterCount?: number;
  ethstatsName?: string;
}

interface MasternodeData {
  epoch: number;
  round: number;
  blockNumber: number;
  masternodes: Masternode[];
  standbynodes: Masternode[];
  penalized: Masternode[];
  totalStaked: string;
  nakamotoCoefficient: number;
}

interface NetworkStats {
  bestBlock: number;
  avgBlockTime: number;
  gasPrice: string;
  activeNodes: number;
  tps: number;
  epoch: {
    number: number;
    progress: number;
    blocksRemaining: number;
  };
}

type SortField = 'rank' | 'address' | 'stake' | 'uptime' | 'rewards' | 'status';
type SortDirection = 'asc' | 'desc';

function truncateAddress(address: string, start = 8, end = 6): string {
  if (!address) return '';
  if (address.length <= start + end + 3) return address;
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

function formatXDC(amount: string): string {
  const num = parseFloat(amount.replace(/,/g, ''));
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(2) + 'K';
  return num.toFixed(2);
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    active: 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20',
    standby: 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20',
    penalized: 'bg-[var(--critical)]/10 text-[var(--critical)] border-[var(--critical)]/20',
  };
  
  const labels = {
    active: 'Active',
    standby: 'Standby',
    penalized: 'Penalized',
  };
  
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded border ${styles[status as keyof typeof styles] || styles.active}`}>
      {labels[status as keyof typeof labels] || status}
    </span>
  );
}

function StatCard({ 
  icon, 
  label, 
  value, 
  subtext,
  color = 'blue'
}: { 
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  color?: 'blue' | 'green' | 'yellow' | 'purple';
}) {
  const colors = {
    blue: 'from-[var(--accent-blue)]/20 to-[var(--accent-blue)]/5',
    green: 'from-[var(--success)]/20 to-[var(--success)]/5',
    yellow: 'from-[var(--warning)]/20 to-[var(--warning)]/5',
    purple: 'from-[var(--purple)]/20 to-[var(--purple)]/5',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-xl p-4 border border-[var(--border-subtle)]`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold text-[var(--text-primary)] font-mono-nums">
        {value}
      </div>
      {subtext && (
        <div className="text-xs text-[var(--text-tertiary)] mt-1">{subtext}</div>
      )}
    </div>
  );
}

function TableHeader({ 
  label, 
  field, 
  sortField, 
  sortDirection, 
  onSort 
}: { 
  label: string;
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const isActive = sortField === field;
  
  return (
    <th 
      className="text-left py-3 px-4 text-xs font-medium text-[var(--text-tertiary)] cursor-pointer select-none hover:text-[var(--text-primary)] transition-colors"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className="inline-flex flex-col">
          <ChevronUp 
            className={`w-3 h-3 -mb-1 ${isActive && sortDirection === 'asc' ? 'text-[var(--accent-blue)]' : 'text-transparent'}`} 
          />
          <ChevronDown 
            className={`w-3 h-3 ${isActive && sortDirection === 'desc' ? 'text-[var(--accent-blue)]' : 'text-transparent'}`} 
          />
        </span>
      </div>
    </th>
  );
}

export default function ExplorerPage() {
  const [masternodeData, setMasternodeData] = useState<MasternodeData | null>(null);
  const [networkStats, setNetworkStats] = useState<NetworkStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('stake');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [liveBlockNumber, setLiveBlockNumber] = useState<number>(0);

  // Fetch masternode and network data
  const fetchData = useCallback(async () => {
    try {
      setError(null);
      
      const [masternodeRes, networkRes] = await Promise.all([
        fetch('/api/v1/masternodes', { cache: 'no-store' }),
        fetch('/api/v1/network/stats', { cache: 'no-store' }),
      ]);

      if (masternodeRes.ok) {
        const data = await masternodeRes.json();
        if (data.success) {
          setMasternodeData(data.data);
          setLiveBlockNumber(data.data.blockNumber);
        }
      }

      if (networkRes.ok) {
        const data = await networkRes.json();
        setNetworkStats(data);
      }
    } catch (err) {
      console.error('Error fetching explorer data:', err);
      setError('Failed to fetch network data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Real-time block counter
  useEffect(() => {
    if (!liveBlockNumber) return;
    
    const interval = setInterval(() => {
      setLiveBlockNumber(prev => prev + 1);
    }, 2000); // Approximate block time
    
    return () => clearInterval(interval);
  }, [liveBlockNumber]);

  // Combine all validators for display
  const allValidators = useMemo(() => {
    if (!masternodeData) return [];
    
    const active = masternodeData.masternodes.map((m, i) => ({ ...m, rank: i + 1, type: 'active' as const }));
    const standby = masternodeData.standbynodes.map((m, i) => ({ ...m, rank: active.length + i + 1, type: 'standby' as const }));
    const penalized = masternodeData.penalized.map((m, i) => ({ ...m, rank: active.length + standby.length + i + 1, type: 'penalized' as const }));
    
    return [...active, ...standby, ...penalized];
  }, [masternodeData]);

  // Filter and sort validators
  const filteredValidators = useMemo(() => {
    let result = [...allValidators];
    
    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(v => 
        v.address.toLowerCase().includes(query) ||
        v.xdcAddress.toLowerCase().includes(query) ||
        v.owner?.toLowerCase().includes(query) ||
        v.ethstatsName?.toLowerCase().includes(query)
      );
    }
    
    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortField as keyof typeof a];
      let bVal: any = b[sortField as keyof typeof b];
      
      if (sortField === 'stake') {
        aVal = parseFloat(a.stake?.replace(/,/g, '') || '0');
        bVal = parseFloat(b.stake?.replace(/,/g, '') || '0');
      } else if (sortField === 'rank') {
        aVal = a.rank;
        bVal = b.rank;
      } else if (sortField === 'uptime') {
        // Mock uptime calculation based on status
        aVal = a.status === 'active' ? 99.9 : a.status === 'standby' ? 95 : 50;
        bVal = b.status === 'active' ? 99.9 : b.status === 'standby' ? 95 : 50;
      } else if (sortField === 'rewards') {
        // Mock rewards based on stake
        aVal = parseFloat(a.stake?.replace(/,/g, '') || '0') * 0.1;
        bVal = parseFloat(b.stake?.replace(/,/g, '') || '0') * 0.1;
      }
      
      if (typeof aVal === 'string') {
        const comparison = aVal.localeCompare(bVal);
        return sortDirection === 'asc' ? comparison : -comparison;
      }
      
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return result;
  }, [allValidators, searchQuery, sortField, sortDirection]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!masternodeData) return null;
    
    const totalValidators = masternodeData.masternodes.length + 
                           masternodeData.standbynodes.length + 
                           masternodeData.penalized.length;
    
    const activeCount = masternodeData.masternodes.length;
    const avgUptime = activeCount > 0 
      ? ((activeCount / totalValidators) * 99.9).toFixed(2)
      : '0.00';
    
    return {
      totalValidators,
      totalStaked: masternodeData.totalStaked,
      avgUptime,
      currentEpoch: masternodeData.epoch,
      nakamotoCoefficient: masternodeData.nakamotoCoefficient,
    };
  }, [masternodeData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleCopy = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-body)] p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-[var(--bg-hover)] rounded w-64"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-24 bg-[var(--bg-hover)] rounded-xl"></div>
              ))}
            </div>
            <div className="h-96 bg-[var(--bg-hover)] rounded-xl"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--bg-body)] p-6">
        <div className="max-w-7xl mx-auto">
          <div className="p-4 rounded-xl bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[var(--critical)]">
            {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-body)]">
      {/* Header */}
      <header className="border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--accent-blue)]/20 to-[var(--success)]/20 flex items-center justify-center border border-[var(--accent-blue)]/30">
                <Globe className="w-5 h-5 text-[var(--accent-blue)]" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[var(--text-primary)]">Network Explorer</h1>
                <p className="text-xs text-[var(--text-tertiary)]">XDC Mainnet Validator Leaderboard</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[var(--bg-hover)] rounded-lg">
                <div className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse"></div>
                <span className="text-sm text-[var(--text-secondary)]">Live</span>
              </div>
              
              <a 
                href="/register" 
                className="px-4 py-2 bg-[var(--accent-blue)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-blue)]/90 transition-colors"
              >
                Register Node
              </a>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Network Stats */}
        {stats && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              <StatCard
                icon={<Shield className="w-4 h-4 text-[var(--accent-blue)]" />}
                label="Validators"
                value={stats.totalValidators.toLocaleString()}
                color="blue"
              />
              
              <StatCard
                icon={<TrendingUp className="w-4 h-4 text-[var(--success)]" />}
                label="Total Staked"
                value={`${formatXDC(stats.totalStaked)} XDC`}
                subtext={`${(parseFloat(stats.totalStaked) / 1000000000).toFixed(2)}B XDC`}
                color="green"
              />
              
              <StatCard
                icon={<Activity className="w-4 h-4 text-[var(--warning)]" />}
                label="Avg Uptime"
                value={`${stats.avgUptime}%`}
                color="yellow"
              />
              
              <StatCard
                icon={<Pickaxe className="w-4 h-4 text-[var(--purple)]" />}
                label="Epoch"
                value={stats.currentEpoch}
                color="purple"
              />
              
              <StatCard
                icon={<Hash className="w-4 h-4 text-[var(--accent-blue)]" />}
                label="Block Height"
                value={liveBlockNumber.toLocaleString()}
                color="blue"
              />
              
              <StatCard
                icon={<Zap className="w-4 h-4 text-[var(--success)]" />}
                label="TPS"
                value={networkStats?.tps?.toFixed(1) || '0.0'}
                color="green"
              />
            </div>

            {/* Progress Bar for Epoch */}
            <div className="bg-[var(--bg-card)] rounded-xl p-4 border border-[var(--border-subtle)] mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--text-secondary)]">Epoch Progress</span>
                <span className="text-sm font-medium text-[var(--text-primary)]">
                  {networkStats?.epoch?.progress || 0}% ({networkStats?.epoch?.blocksRemaining || 0} blocks remaining)
                </span>
              </div>
              <div className="h-2 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[var(--accent-blue)] to-[var(--success)] rounded-full transition-all duration-500"
                  style={{ width: `${networkStats?.epoch?.progress || 0}%` }}
                />
              </div>
            </div>
          </>
        )}

        {/* Search and Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Pickaxe className="w-5 h-5 text-[var(--accent-blue)]" />
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Validator Leaderboard</h2>
            <span className="px-2 py-0.5 bg-[var(--bg-hover)] text-[var(--text-tertiary)] rounded text-xs">
              {filteredValidators.length} validators
            </span>
          </div>
          
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <input
              type="text"
              placeholder="Search by address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>
        </div>

        {/* Validators Table */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-[var(--bg-hover)]">
              <tr className="border-b border-[var(--border-subtle)]">
                <TableHeader label="Rank" field="rank" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                <TableHeader label="Address" field="address" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                <TableHeader label="Stake (XDC)" field="stake" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                <TableHeader label="Status" field="status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                <TableHeader label="Uptime" field="uptime" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                <TableHeader label="Est. Rewards" field="rewards" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-tertiary)]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredValidators.map((validator) => (
                <tr 
                  key={validator.address}
                  className="border-b border-[var(--border-subtle)] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {validator.rank <= 3 && (
                        <Award className={`w-4 h-4 ${
                          validator.rank === 1 ? 'text-yellow-500' :
                          validator.rank === 2 ? 'text-gray-400' :
                          'text-amber-600'
                        }`} />
                      )}
                      <span className="font-mono-nums font-medium">#{validator.rank}</span>
                    </div>
                  </td>
                  
                  <td className="py-3 px-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-[var(--accent-blue)]">
                          {truncateAddress(validator.xdcAddress)}
                        </span>
                        <button
                          onClick={() => handleCopy(validator.xdcAddress)}
                          className="text-[var(--text-muted)] hover:text-[var(--accent-blue)] transition-colors"
                          title="Copy address"
                        >
                          {copiedAddress === validator.xdcAddress ? (
                            <CheckCircle className="w-3.5 h-3.5 text-[var(--success)]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      {validator.ethstatsName && (
                        <span className="text-xs text-[var(--text-tertiary)]">{validator.ethstatsName}</span>
                      )}
                    </div>
                  </td>
                  
                  <td className="py-3 px-4">
                    <span className="font-mono-nums font-medium">
                      {validator.stake ? formatXDC(validator.stake) : '0'} XDC
                    </span>
                  </td>
                  
                  <td className="py-3 px-4">
                    <StatusBadge status={validator.status} />
                  </td>
                  
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            validator.status === 'active' ? 'bg-[var(--success)]' :
                            validator.status === 'standby' ? 'bg-[var(--warning)]' :
                            'bg-[var(--critical)]'
                          }`}
                          style={{ 
                            width: validator.status === 'active' ? '99.9%' : 
                                   validator.status === 'standby' ? '95%' : '50%' 
                          }}
                        />
                      </div>
                      <span className="text-sm text-[var(--text-secondary)]">
                        {validator.status === 'active' ? '99.9%' : 
                         validator.status === 'standby' ? '95%' : 'N/A'}%
                      </span>
                    </div>
                  </td>
                  
                  <td className="py-3 px-4">
                    <span className="text-sm text-[var(--success)]">
                      +{validator.stake ? (parseFloat(validator.stake.replace(/,/g, '')) * 0.1 / 365).toFixed(2) : '0'} / day
                    </span>
                  </td>
                  
                  <td className="py-3 px-4">
                    <a 
                      href={`https://explorer.xinfin.network/addr/${validator.xdcAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--accent-blue)] hover:underline"
                    >
                      View →
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredValidators.length === 0 && (
            <div className="text-center py-12 text-[var(--text-tertiary)]">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No validators found matching your search</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-8 pt-6 border-t border-[var(--border-subtle)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm text-[var(--text-tertiary)]">
            <div>
              Data updated every 30 seconds • Block time ~2.0s
            </div>
            <div className="flex items-center gap-4">
              <a href="/" className="hover:text-[var(--accent-blue)] transition-colors">Dashboard</a>
              <a href="/register" className="hover:text-[var(--accent-blue)] transition-colors">Register Node</a>
              <a href="https://xinfin.org" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--accent-blue)] transition-colors">XDC Network</a>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
