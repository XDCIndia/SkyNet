'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Server,
  Users,
  Zap,
  Coins,
  Shield,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Share2,
  TrendingUp,
  Pickaxe
} from 'lucide-react';

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

interface FleetStats {
  totalNodes: number;
  healthyNodes: number;
  healthScore: number;
}

// Health Score Gauge Component
function HealthScoreGauge({ score, rating }: { score: number; rating: string }) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getColor = () => {
    if (score >= 80) return '#10B981';
    if (score >= 50) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <svg width="200" height="200" className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="16"
          />
          {/* Progress circle */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={getColor()}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-bold font-mono-nums" style={{ color: getColor() }}>
            {score}
          </span>
          <span className="text-sm text-[var(--text-tertiary)] mt-1 capitalize">{rating}</span>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  icon,
  label,
  value,
  change,
  suffix = ''
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  change?: number;
  suffix?: string;
}) {
  return (
    <div className="card-xdc">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue-glow)] flex items-center justify-center text-[var(--accent-blue)]">
          {icon}
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-xs ${change >= 0 ? 'text-[var(--success)]' : 'text-[var(--critical)]'}`}>
            {change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            <span>{Math.abs(change)}%</span>
          </div>
        )}
      </div>
      <div className="section-header mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="stat-value font-mono-nums">{value}</span>
        {suffix && <span className="text-sm text-[var(--text-tertiary)]">{suffix}</span>}
      </div>
    </div>
  );
}

function truncateAddress(addr: string, start = 6, end = 4): string {
  if (!addr) return '';
  if (addr.length <= start + end + 3) return addr;
  return `${addr.slice(0, start)}...${addr.slice(-end)}`;
}

export default function ExecutiveDashboard() {
  const [showSocialCard, setShowSocialCard] = useState(false);
  const [masternodeStats, setMasternodeStats] = useState<MasternodeStats | null>(null);
  const [fleetStats, setFleetStats] = useState<FleetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [epochData, setEpochData] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch all data in parallel
      const [mnRes, fleetRes, epochRes] = await Promise.all([
        fetch('/api/v1/masternodes/stats'),
        fetch('/api/v1/fleet/status'),
        fetch('/api/v1/network/epoch'),
      ]);

      if (mnRes.ok) {
        const mnData = await mnRes.json();
        if (mnData.success) {
          setMasternodeStats(mnData.data);
        }
      }

      if (fleetRes.ok) {
        const fleetData = await fleetRes.json();
        setFleetStats({
          totalNodes: fleetData.fleet.totalNodes,
          healthyNodes: fleetData.fleet.healthyNodes,
          healthScore: fleetData.fleet.healthScore,
        });
      }

      if (epochRes.ok) {
        const epochData = await epochRes.json();
        if (epochData.success) {
          setEpochData(epochData.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch executive data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const formatStaked = (staked: string): string => {
    const num = parseFloat(staked?.replace(/,/g, '') || '0');
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    return num.toLocaleString();
  };

  const healthRating = (fleetStats?.healthScore ?? 0) >= 90 ? 'excellent'
    : (fleetStats?.healthScore ?? 0) >= 70 ? 'good' 
    : (fleetStats?.healthScore ?? 0) >= 50 ? 'fair' 
    : 'poor';

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Executive Dashboard</h1>
            <p className="text-[var(--text-tertiary)] mt-1">Network-wide metrics and validator overview</p>
          </div>
          <button
            onClick={() => setShowSocialCard(true)}
            className="py-2 px-4 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] rounded-lg hover:bg-[var(--accent-blue)]/20 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Generate Social Card
          </button>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            icon={<Server className="w-5 h-5" />}
            label="Total Nodes"
            value={fleetStats?.totalNodes || '--'}
          />
          <StatCard
            icon={<Pickaxe className="w-5 h-5" />}
            label="Validators"
            value={masternodeStats ? `${masternodeStats.totalActive}/${masternodeStats.totalStandby}` : '--'}
          />
          <StatCard
            icon={<Zap className="w-5 h-5" />}
            label="Network TPS"
            value={fleetStats?.totalNodes ? Math.round(fleetStats.totalNodes * 2000 / 5) : '--'}
            suffix="tx/s"
          />
          <StatCard
            icon={<Coins className="w-5 h-5" />}
            label="Total Staked"
            value={masternodeStats ? formatStaked(masternodeStats.totalStaked) : '--'}
            suffix=" XDC"
          />
          <StatCard
            icon={<Shield className="w-5 h-5" />}
            label="Nakamoto Coeff"
            value={masternodeStats?.nakamotoCoefficient || '--'}
          />
          <StatCard
            icon={<Activity className="w-5 h-5" />}
            label="Epoch"
            value={epochData?.epoch || masternodeStats?.epoch || '--'}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Network Health Score */}
          <div className="card-xdc">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue-glow)] flex items-center justify-center text-[var(--accent-blue)]">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Network Health</h2>
                <p className="text-xs text-[var(--text-tertiary)]">Composite score from all metrics</p>
              </div>
            </div>

            <HealthScoreGauge
              score={fleetStats?.healthScore || 0}
              rating={healthRating}
            />

            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-tertiary)]">Node Uptime</span>
                <span className="font-medium">{fleetStats?.healthyNodes || 0}/{fleetStats?.totalNodes || 0}</span>
              </div>
              <div className="w-full bg-[var(--bg-hover)] rounded-full h-1.5">
                <div
                  className="bg-[var(--accent-blue)] h-1.5 rounded-full"
                  style={{ width: `${fleetStats?.totalNodes ? (fleetStats.healthyNodes / fleetStats.totalNodes) * 100 : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-tertiary)]">Active Validators</span>
                <span className="font-medium">{masternodeStats?.totalActive || 0}</span>
              </div>
              <div className="w-full bg-[var(--bg-hover)] rounded-full h-1.5">
                <div
                  className="bg-[var(--success)] h-1.5 rounded-full"
                  style={{ width: `${masternodeStats?.totalActive ? Math.min(100, (masternodeStats.totalActive / 108) * 100) : 0}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--text-tertiary)]">Epoch Progress</span>
                <span className="font-medium">{epochData?.epochProgress || 0}%</span>
              </div>
              <div className="w-full bg-[var(--bg-hover)] rounded-full h-1.5">
                <div
                  className="bg-[var(--warning)] h-1.5 rounded-full"
                  style={{ width: `${epochData?.epochProgress || 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* Validator Leaderboard */}
          <div className="card-xdc lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[rgba(139,92,246,0.1)] flex items-center justify-center text-[#8B5CF6]">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Validator Leaderboard</h2>
                <p className="text-xs text-[var(--text-tertiary)]">Top validators by stake</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-tertiary)]">Rank</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[var(--text-tertiary)]">Validator</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-[var(--text-tertiary)]">Stake</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-[var(--text-tertiary)]">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-[var(--text-tertiary)]">Loading...</td>
                    </tr>
                  ) : masternodeStats?.topValidators.slice(0, 10).map((validator, index) => (
                    <tr key={validator.address} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                          index < 3 ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]' : 'bg-[var(--bg-hover)] text-[var(--text-tertiary)]'
                        }`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-[var(--text-primary)] font-mono">{truncateAddress(validator.address)}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-nums">
                        {parseInt(validator.stake.replace(/,/g, '')).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={parseFloat(validator.percentage) > 5 ? 'text-[var(--accent-blue)]' : 'text-[var(--text-tertiary)]'}>
                          {validator.percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Social Card Modal */}
      {showSocialCard && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#111827] rounded-2xl p-6 max-w-lg w-full mx-4 border border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Social Card Preview</h3>
              <button
                onClick={() => setShowSocialCard(false)}
                className="text-[var(--text-tertiary)] hover:text-white transition-colors"
              >
                ×
              </button>
            </div>

            <div
              className="aspect-[1200/675] bg-gradient-to-br from-[#0A0E1A] to-[#111827] rounded-xl p-6 border border-white/10 relative overflow-hidden"
              style={{ aspectRatio: '1200/675' }}
            >
              <div className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: 'linear-gradient(rgba(30, 144, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(30, 144, 255, 0.1) 1px, transparent 1px)',
                  backgroundSize: '40px 40px'
                }}
              />

              <div className="relative z-10 h-full flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1E90FF]/20 to-[#10B981]/20 flex items-center justify-center border border-[var(--accent-blue)]/30">
                    <Pickaxe className="w-5 h-5 text-[var(--accent-blue)]" />
                  </div>
                  <div>
                    <div className="font-semibold">XDC NetOwn</div>
                    <div className="text-xs text-[var(--text-tertiary)]">{new Date().toLocaleDateString()}</div>
                  </div>
                </div>

                <div className="flex-1 flex items-center">
                  <div className="grid grid-cols-2 gap-4 w-full">
                    <div>
                      <div className="text-2xl font-bold text-[var(--accent-blue)] font-mono-nums">{fleetStats?.totalNodes || 0}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">Active Nodes</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-[var(--success)] font-mono-nums">{masternodeStats?.totalActive || 0}</div>
                      <div className="text-xs text-[var(--text-tertiary)]">Validators</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-[var(--text-primary)] font-mono-nums">{formatStaked(masternodeStats?.totalStaked || '0')}M</div>
                      <div className="text-xs text-[var(--text-tertiary)]">Total Staked</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-[var(--text-primary)] font-mono-nums">{fleetStats?.healthScore || 0}%</div>
                      <div className="text-xs text-[var(--text-tertiary)]">Network Health</div>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-[var(--text-tertiary)] mt-2">
                  xdc.network · #XDC #Blockchain
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowSocialCard(false)}
                className="flex-1 py-2 px-4 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] rounded-lg hover:bg-[var(--accent-blue)]/20 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download PNG
              </button>
              <button
                onClick={() => setShowSocialCard(false)}
                className="flex-1 py-2 px-4 bg-[var(--accent-blue)] text-white rounded-lg hover:bg-[var(--accent-blue)]/90 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
