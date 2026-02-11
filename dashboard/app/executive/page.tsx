'use client';

import { useState, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { fetchFleetMetrics, calculateHealthScore, getGrowthTimeline } from '@/lib/aggregator';
import type { HealthScore } from '@/lib/aggregator';
import { useEffect } from 'react';
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
  TrendingUp
} from 'lucide-react';

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
          <span className="text-sm text-[#6B7280] mt-1 capitalize">{rating}</span>
        </div>
      </div>
    </div>
  );
}

// Growth Timeline SVG Chart
function GrowthTimelineChart() {
  const data = useMemo(() => getGrowthTimeline(), []);
  
  const width = 800;
  const height = 300;
  const padding = { top: 20, right: 30, bottom: 50, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  // Normalize data for chart
  const maxNodes = Math.max(...data.map(d => d.activeNodes));
  const maxTx = Math.max(...data.map(d => d.dailyTransactions));
  const maxStaked = Math.max(...data.map(d => d.totalStaked));
  
  const getX = (index: number) => padding.left + (index / (data.length - 1)) * chartWidth;
  const getY = (value: number, max: number) => padding.top + chartHeight - (value / max) * chartHeight;
  
  // Generate path for active nodes
  const nodesPath = data.map((d, i) => 
    `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.activeNodes, maxNodes * 1.2)}`
  ).join(' ');
  
  // Generate path for transactions (scaled)
  const txPath = data.map((d, i) => 
    `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.dailyTransactions / 100, maxTx / 100)}`
  ).join(' ');
  
  return (
    <div className="w-full overflow-x-auto">
      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        className="w-full min-w-[600px]"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line
            key={t}
            x1={padding.left}
            y1={padding.top + t * chartHeight}
            x2={width - padding.right}
            y2={padding.top + t * chartHeight}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
        ))}
        
        {/* Active Nodes Line */}
        <path
          d={nodesPath}
          fill="none"
          stroke="#1E90FF"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Transaction Line (scaled) */}
        <path
          d={txPath}
          fill="none"
          stroke="#10B981"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="5,5"
        />
        
        {/* Data points for nodes */}
        {data.map((d, i) => (
          <circle
            key={i}
            cx={getX(i)}
            cy={getY(d.activeNodes, maxNodes * 1.2)}
            r="4"
            fill="#1E90FF"
          />
        ))}
        
        {/* X-axis labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={getX(i)}
            y={height - 15}
            textAnchor="middle"
            fill="#6B7280"
            fontSize="12"
          >
            {d.month}
          </text>
        ))}
        
        {/* Y-axis labels */}
        <text x={20} y={padding.top + 5} textAnchor="middle" fill="#1E90FF" fontSize="11">{Math.round(maxNodes * 1.2)}</text>
        <text x={20} y={padding.top + chartHeight / 2 + 5} textAnchor="middle" fill="#6B7280" fontSize="11">{Math.round(maxNodes * 0.6)}</text>
        <text x={20} y={height - padding.bottom + 5} textAnchor="middle" fill="#6B7280" fontSize="11">0</text>
      </svg>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-[#1E90FF] rounded"></div>
          <span className="text-xs text-[#6B7280]">Active Nodes</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-1 bg-[#10B981] rounded border-dashed border-t-2 border-[#10B981]"></div>
          <span className="text-xs text-[#6B7280]">Daily TXs (÷100)</span>
        </div>
      </div>
    </div>
  );
}

// Validator interface
interface Validator {
  rank: number;
  name: string;
  address: string;
  uptime: number;
  blocksProduced: number;
  rewards: number;
  stake: number;
}

// Mock validators
const mockValidators: Validator[] = [
  { rank: 1, name: 'XinFin Foundation', address: 'xdc8f8e8...a1b2c3', uptime: 99.98, blocksProduced: 1523450, rewards: 1250000, stake: 10000000 },
  { rank: 2, name: 'AlphaStake', address: 'xdc3d4e5...f6g7h8', uptime: 99.95, blocksProduced: 1512890, rewards: 1242000, stake: 8500000 },
  { rank: 3, name: 'BlockMatrix', address: 'xdc9i0j1...k2l3m4', uptime: 99.92, blocksProduced: 1508760, rewards: 1238000, stake: 7200000 },
  { rank: 4, name: 'CryptoGuardians', address: 'xdc5n6o7...p8q9r0', uptime: 99.87, blocksProduced: 1492340, rewards: 1225000, stake: 6800000 },
  { rank: 5, name: 'ValidatorOne', address: 'xdc1s2t3...u4v5w6', uptime: 99.82, blocksProduced: 1489000, rewards: 1210000, stake: 6500000 },
  { rank: 6, name: 'StakePool Pro', address: 'xdc7x8y9...z0a1b2', uptime: 99.76, blocksProduced: 1476500, rewards: 1198000, stake: 6200000 },
  { rank: 7, name: 'NodeMasters', address: 'xdc3c4d5...e6f7g8', uptime: 99.71, blocksProduced: 1467800, rewards: 1185000, stake: 5800000 },
  { rank: 8, name: 'BlockForge', address: 'xdc9h0i1...j2k3l4', uptime: 99.65, blocksProduced: 1453200, rewards: 1172000, stake: 5500000 },
  { rank: 9, name: 'ChainKeepers', address: 'xdc5m6n7...o8p9q0', uptime: 99.58, blocksProduced: 1441000, rewards: 1158000, stake: 5200000 },
  { rank: 10, name: 'StakeWise', address: 'xdc1r2s3...t4u5v6', uptime: 99.52, blocksProduced: 1429800, rewards: 1145000, stake: 4900000 },
];

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
        <div className="w-10 h-10 rounded-xl bg-[rgba(30,144,255,0.1)] flex items-center justify-center text-[#1E90FF]">
          {icon}
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-xs ${change >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
            {change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            <span>{Math.abs(change)}%</span>
          </div>
        )}
      </div>
      <div className="section-header mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className="stat-value font-mono-nums">{value}</span>
        {suffix && <span className="text-sm text-[#6B7280]">{suffix}</span>}
      </div>
    </div>
  );
}

// Social Card Preview
function SocialCardPreview({ onClose }: { onClose: () => void }) {
  const date = new Date().toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#111827] rounded-2xl p-6 max-w-lg w-full mx-4 border border-white/10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Social Card Preview</h3>
          <button 
            onClick={onClose}
            className="text-[#6B7280] hover:text-white transition-colors"
          >
            &times;
          </button>
        </div>
        
        {/* Twitter Card Preview */}
        <div 
          className="aspect-[1200/675] bg-gradient-to-br from-[#0A0E1A] to-[#111827] rounded-xl p-6 border border-white/10 relative overflow-hidden"
          style={{ aspectRatio: '1200/675' }}
        >
          {/* Background grid pattern */}
          <div className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'linear-gradient(rgba(30, 144, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(30, 144, 255, 0.1) 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}
          />
          
          <div className="relative z-10 h-full flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1E90FF]/20 to-[#10B981]/20 flex items-center justify-center border border-[#1E90FF]/30">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="#1E90FF" strokeWidth="2"/>
                  <path d="M8 8L16 16M16 8L8 16" stroke="#1E90FF" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <div className="font-semibold">XDC NetOwn</div>
                <div className="text-xs text-[#6B7280]">{date}</div>
              </div>
            </div>
            
            <div className="flex-1 flex items-center">
              <div className="grid grid-cols-2 gap-4 w-full">
                <div>
                  <div className="text-2xl font-bold text-[#1E90FF] font-mono-nums">186</div>
                  <div className="text-xs text-[#6B7280]">Active Nodes</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#10B981] font-mono-nums">108</div>
                  <div className="text-xs text-[#6B7280]">Validators</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#F9FAFB] font-mono-nums">4.3M</div>
                  <div className="text-xs text-[#6B7280]">Daily TXs</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-[#F9FAFB] font-mono-nums">99.8%</div>
                  <div className="text-xs text-[#6B7280]">Network Health</div>
                </div>
              </div>
            </div>
            
            <div className="text-xs text-[#6B7280] mt-2">
              xdc.network · #XDC #Blockchain
            </div>
          </div>
        </div>
        
        <div className="flex gap-3 mt-4">
          <button className="flex-1 py-2 px-4 bg-[#1E90FF]/10 text-[#1E90FF] rounded-lg hover:bg-[#1E90FF]/20 transition-colors text-sm font-medium flex items-center justify-center gap-2">
            <Download className="w-4 h-4" />
            Download PNG
          </button>
          <button className="flex-1 py-2 px-4 bg-[#1E90FF] text-white rounded-lg hover:bg-[#1E90FF]/90 transition-colors text-sm font-medium flex items-center justify-center gap-2">
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExecutiveDashboard() {
  const [sortField, setSortField] = useState<keyof Validator>('rank');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showSocialCard, setShowSocialCard] = useState(false);
  const [healthScore, setHealthScore] = useState<HealthScore>({ score: 92, rating: 'excellent', breakdown: { nodeUptime: 23, syncStatus: 24, peerDiversity: 22, consensusParticipation: 23 } });

  useEffect(() => {
    fetchFleetMetrics().then(stats => {
      const score = calculateHealthScore(stats);
      setHealthScore(score);
    });
  }, []);

  const sortedValidators = useMemo(() => {
    const sorted = [...mockValidators];
    sorted.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [sortField, sortDirection]);

  const handleSort = (field: keyof Validator) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#F9FAFB]">Executive Dashboard</h1>
            <p className="text-[#6B7280] mt-1">Network-wide metrics and validator overview</p>
          </div>
          <button 
            onClick={() => setShowSocialCard(true)}
            className="py-2 px-4 bg-[#1E90FF]/10 text-[#1E90FF] rounded-lg hover:bg-[#1E90FF]/20 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <Share2 className="w-4 h-4" />
            Generate Social Card
          </button>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard icon={<Server className="w-5 h-5" />} label="Total Nodes" value={186} change={5.2} />
          <StatCard icon={<Users className="w-5 h-5" />} label="Active Validators" value={108} change={2.1} />
          <StatCard icon={<Zap className="w-5 h-5" />} label="Network TPS" value={2000} suffix="tx/s" change={8.5} />
          <StatCard icon={<Coins className="w-5 h-5" />} label="Total Staked" value="4.2B" suffix=" XDC" change={3.2} />
          <StatCard icon={<Shield className="w-5 h-5" />} label="Nakamoto Coeff" value={7} />
          <StatCard icon={<Activity className="w-5 h-5" />} label="Uptime Streak" value={156} suffix=" days" change={0.5} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Network Health Score */}
          <div className="card-xdc">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[rgba(30,144,255,0.1)] flex items-center justify-center text-[#1E90FF]">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#F9FAFB]">Network Health</h2>
                <p className="text-xs text-[#6B7280]">Composite score from all metrics</p>
              </div>
            </div>
            
            <HealthScoreGauge score={healthScore.score} rating={healthScore.rating} />
            
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#6B7280]">Node Uptime</span>
                <span className="font-medium">{healthScore.breakdown.nodeUptime}/25</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1.5">
                <div className="bg-[#1E90FF] h-1.5 rounded-full" style={{ width: `${(healthScore.breakdown.nodeUptime / 25) * 100}%` }} />
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#6B7280]">Sync Status</span>
                <span className="font-medium">{healthScore.breakdown.syncStatus}/25</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1.5">
                <div className="bg-[#10B981] h-1.5 rounded-full" style={{ width: `${(healthScore.breakdown.syncStatus / 25) * 100}%` }} />
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#6B7280]">Peer Diversity</span>
                <span className="font-medium">{healthScore.breakdown.peerDiversity}/25</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1.5">
                <div className="bg-[#F59E0B] h-1.5 rounded-full" style={{ width: `${(healthScore.breakdown.peerDiversity / 25) * 100}%` }} />
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#6B7280]">Consensus Participation</span>
                <span className="font-medium">{healthScore.breakdown.consensusParticipation}/25</span>
              </div>
              <div className="w-full bg-white/5 rounded-full h-1.5">
                <div className="bg-[#8B5CF6] h-1.5 rounded-full" style={{ width: `${(healthScore.breakdown.consensusParticipation / 25) * 100}%` }} />
              </div>
            </div>
          </div>

          {/* Growth Timeline */}
          <div className="card-xdc lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[rgba(16,185,129,0.1)] flex items-center justify-center text-[#10B981]">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#F9FAFB]">Growth Timeline</h2>
                <p className="text-xs text-[#6B7280]">12-month network growth</p>
              </div>
            </div>
            
            <GrowthTimelineChart />
          </div>
        </div>

        {/* Validator Leaderboard */}
        <div className="card-xdc">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[rgba(139,92,246,0.1)] flex items-center justify-center text-[#8B5CF6]">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#F9FAFB]">Validator Leaderboard</h2>
              <p className="text-xs text-[#6B7280]">Top 10 validators by performance</p>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280] cursor-pointer hover:text-[#F9FAFB]" onClick={() => handleSort('rank')}>Rank</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280] cursor-pointer hover:text-[#F9FAFB]" onClick={() => handleSort('name')}>Validator</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280] cursor-pointer hover:text-[#F9FAFB]" onClick={() => handleSort('uptime')}>Uptime</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280] cursor-pointer hover:text-[#F9FAFB]" onClick={() => handleSort('blocksProduced')}>Blocks</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280] cursor-pointer hover:text-[#F9FAFB]" onClick={() => handleSort('rewards')}>Rewards</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280] cursor-pointer hover:text-[#F9FAFB]" onClick={() => handleSort('stake')}>Stake</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {sortedValidators.map((validator) => (
                  <tr key={validator.rank} className="hover:bg-white/[0.02]">
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        validator.rank <= 3 ? 'bg-[#1E90FF]/20 text-[#1E90FF]' : 'bg-white/5 text-[#6B7280]'
                      }`}>
                        {validator.rank}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <div className="font-medium text-[#F9FAFB]">{validator.name}</div>
                        <div className="text-xs text-[#6B7280] font-mono-nums">{validator.address}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[#10B981] font-mono-nums">{validator.uptime.toFixed(2)}%</span>
                    </td>
                    <td className="py-3 px-4 font-mono-nums">{validator.blocksProduced.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className="font-mono-nums">{validator.rewards.toLocaleString()} XDC</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono-nums">{(validator.stake / 1000000).toFixed(1)}M</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {showSocialCard && <SocialCardPreview onClose={() => setShowSocialCard(false)} />}
    </DashboardLayout>
  );
}
