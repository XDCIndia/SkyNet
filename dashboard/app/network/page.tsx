'use client';

import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Activity, 
  Clock, 
  Zap, 
  Server, 
  Layers, 
  RefreshCw,
  BarChart3,
  Hash,
  Flame,
  Timer,
  Globe,
  TrendingUp,
  Box
} from 'lucide-react';

interface NetworkStats {
  bestBlock: number;
  avgBlockTime: number;
  gasPrice: string;
  gasLimit: number;
  difficulty: string;
  activeNodes: number;
  totalTransactions: number;
  lastBlocks: Array<{
    number: number;
    hash: string;
    txCount: number;
    gasUsed: number;
    gasLimit: number;
    time: string;
    miner: string;
  }>;
  blockTimes: number[];
  txsPerBlock: number[];
  gasPerBlock: number[];
  epoch: {
    number: number;
    progress: number;
    blocksRemaining: number;
    secondsToNextEpoch: number;
  };
  tps: number;
  pendingTxs: number;
  timestamp: string;
}

interface NodeInfo {
  id: string;
  name: string;
  host: string;
  ipv4?: string;
  blockHeight: number;
  peerCount: number;
  latency?: number;
  status: string;
  lastSeen: string;
}

const REFRESH_INTERVAL = 5000;

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatTimeRemaining(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins > 60) {
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  }
  return `${mins}m ${secs}s`;
}

function StatCard({ 
  label, 
  value, 
  subValue, 
  icon: Icon, 
  color = '#1E90FF',
  pulse = false 
}: { 
  label: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  color?: string;
  pulse?: boolean;
}) {
  return (
    <div className="bg-gradient-to-br from-[#111827] to-[#0f1729] rounded-xl p-5 border border-white/5 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="p-2.5 rounded-lg"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <div>
            <p className="text-xs text-[#64748B] uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-2xl font-bold text-[#F1F5F9] font-mono-nums">{value}</p>
            {subValue && (
              <p className="text-xs text-[#64748B] mt-0.5">{subValue}</p>
            )}
          </div>
        </div>
        {pulse && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#10B981]"></span>
          </span>
        )}
      </div>
    </div>
  );
}

function BlockTimeChart({ data }: { data: number[] }) {
  const maxValue = Math.max(...data, 10);
  const chartHeight = 120;
  
  return (
    <div className="card-xdc">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-[#1E90FF]" />
        <h3 className="text-sm font-semibold text-[#F1F5F9]">Block Time (last 25 blocks)</h3>
      </div>
      
      <div className="relative h-[140px]">
        <svg viewBox={`0 0 ${data.length * 12 + 20} ${chartHeight + 30}`} className="w-full h-full">
          {[0, 2.5, 5, 7.5, 10].map((val) => (
            <g key={val}>
              <line
                x1="20"
                y1={chartHeight - (val / maxValue) * chartHeight}
                x2={data.length * 12 + 20}
                y2={chartHeight - (val / maxValue) * chartHeight}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="0.5"
              />
              <text
                x="15"
                y={chartHeight - (val / maxValue) * chartHeight + 3}
                fill="#64748B"
                fontSize="6"
                textAnchor="end"
              >
                {val}s
              </text>
            </g>
          ))}
          
          {data.map((time, i) => {
            const height = (time / maxValue) * chartHeight;
            const color = time <= 2.5 ? '#10B981' : time <= 5 ? '#F59E0B' : '#EF4444';
            
            return (
              <rect
                key={i}
                x={25 + i * 12}
                y={chartHeight - height}
                width="8"
                height={height}
                fill={color}
                rx="1"
                opacity={0.8}
              />
            );
          })}
        </svg>
      </div>
      
      <div className="flex items-center justify-between text-[10px] text-[#64748B] mt-2">
        <span>Latest &rarr;</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-[#10B981]"></span> Fast (&lt;2.5s)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-[#F59E0B]"></span> Slow (&gt;2.5s)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-[#EF4444]"></span> Slow (&gt;5s)
          </span>
        </div>
      </div>
    </div>
  );
}

function TransactionsChart({ data }: { data: number[] }) {
  const maxValue = Math.max(...data, 1);
  const chartHeight = 120;
  
  return (
    <div className="card-xdc">
      <div className="flex items-center gap-2 mb-4">
        <Layers className="w-4 h-4 text-[#1E90FF]" />
        <h3 className="text-sm font-semibold text-[#F1F5F9]">Transactions Per Block</h3>
      </div>
      
      <div className="relative h-[140px]">
        <svg viewBox={`0 0 ${data.length * 12 + 20} ${chartHeight + 30}`} className="w-full h-full">
          {[0, Math.ceil(maxValue / 2), maxValue].map((val, i) => (
            <g key={val}>
              <line
                x1="20"
                y1={chartHeight - (val / maxValue) * chartHeight}
                x2={data.length * 12 + 20}
                y2={chartHeight - (val / maxValue) * chartHeight}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="0.5"
              />
              <text
                x="15"
                y={chartHeight - (val / maxValue) * chartHeight + 3}
                fill="#64748B"
                fontSize="6"
                textAnchor="end"
              >
                {val}
              </text>
            </g>
          ))}
          
          {data.map((count, i) => {
            const height = (count / maxValue) * chartHeight;
            
            return (
              <rect
                key={i}
                x={25 + i * 12}
                y={chartHeight - height}
                width="8"
                height={height}
                fill="#1E90FF"
                rx="1"
                opacity={0.8}
              />
            );
          })}
        </svg>
      </div>
      
      <div className="flex items-center justify-between text-[10px] text-[#64748B] mt-2">
        <span>Latest &rarr;</span>
        <span>Max: {maxValue} txns</span>
      </div>
    </div>
  );
}

function GasUsageChart({ data, gasLimit }: { data: number[]; gasLimit: number }) {
  const percentages = data.map(g => (g / gasLimit) * 100);
  const maxValue = Math.max(...percentages, 100);
  const chartHeight = 120;
  
  return (
    <div className="card-xdc">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-4 h-4 text-[#F59E0B]" />
        <h3 className="text-sm font-semibold text-[#F1F5F9]">Gas Usage (% of limit)</h3>
      </div>
      
      <div className="relative h-[140px]">
        <svg viewBox={`0 0 ${data.length * 12 + 20} ${chartHeight + 30}`} className="w-full h-full">
          {[0, 25, 50, 75, 100].map((val) => (
            <g key={val}>
              <line
                x1="20"
                y1={chartHeight - (val / maxValue) * chartHeight}
                x2={data.length * 12 + 20}
                y2={chartHeight - (val / maxValue) * chartHeight}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="0.5"
              />
              <text
                x="15"
                y={chartHeight - (val / maxValue) * chartHeight + 3}
                fill="#64748B"
                fontSize="6"
                textAnchor="end"
              >
                {val}%
              </text>
            </g>
          ))}
          
          {percentages.map((pct, i) => {
            const height = (pct / maxValue) * chartHeight;
            const color = pct > 80 ? '#EF4444' : pct > 50 ? '#F59E0B' : '#10B981';
            
            return (
              <rect
                key={i}
                x={25 + i * 12}
                y={chartHeight - height}
                width="8"
                height={height}
                fill={color}
                rx="1"
                opacity={0.8}
              />
            );
          })}
        </svg>
      </div>
      
      <div className="flex items-center justify-between text-[10px] text-[#64748B] mt-2">
        <span>Latest &rarr;</span>
        <span>Gas Limit: {(gasLimit / 1e6).toFixed(0)}M</span>
      </div>
    </div>
  );
}

function EpochProgress({ epoch }: { epoch: NetworkStats['epoch'] }) {
  const radius = 50;
  const strokeWidth = 8;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (epoch.progress / 100) * circumference;
  
  return (
    <div className="card-xdc">
      <div className="flex items-center gap-2 mb-4">
        <Timer className="w-4 h-4 text-[#1E90FF]" />
        <h3 className="text-sm font-semibold text-[#F1F5F9]">Epoch Progress</h3>
      </div>
      
      <div className="flex items-center justify-center">
        <div className="relative">
          <svg width="120" height="120" className="transform -rotate-90">
            <circle
              cx="60"
              cy="60"
              r={normalizedRadius}
              fill="transparent"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={strokeWidth}
            />
            
            <circle
              cx="60"
              cy="60"
              r={normalizedRadius}
              fill="transparent"
              stroke="#1E90FF"
              strokeWidth={strokeWidth}
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-[#F1F5F9] font-mono-nums">{epoch.number}</span>
            <span className="text-[10px] text-[#64748B]">Epoch</span>
          </div>
        </div>
      </div>
      
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="text-center">
          <p className="text-lg font-bold text-[#1E90FF] font-mono-nums">{epoch.progress}%</p>
          <p className="text-[10px] text-[#64748B]">Progress</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-[#F1F5F9] font-mono-nums">{epoch.blocksRemaining}</p>
          <p className="text-[10px] text-[#64748B]">Blocks Left</p>
        </div>
      </div>      
      
      <div className="mt-3 pt-3 border-t border-white/5 text-center">
        <p className="text-[10px] text-[#64748B]">
          Next epoch in ~{formatTimeRemaining(epoch.secondsToNextEpoch)}
        </p>
      </div>
    </div>
  );
}

function LastBlocksTable({ blocks }: { blocks: NetworkStats['lastBlocks'] }) {
  return (
    <div className="card-xdc overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Box className="w-4 h-4 text-[#1E90FF]" />
          <h3 className="text-sm font-semibold text-[#F1F5F9]">Last 25 Blocks</h3>
        </div>
        <span className="text-xs text-[#64748B]">Auto-refreshing</span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left py-2 px-2 text-[10px] font-medium text-[#64748B] uppercase">#</th>
              <th className="text-left py-2 px-2 text-[10px] font-medium text-[#64748B] uppercase">Block</th>
              <th className="text-left py-2 px-2 text-[10px] font-medium text-[#64748B] uppercase">Txns</th>
              <th className="text-left py-2 px-2 text-[10px] font-medium text-[#64748B] uppercase">Gas Used</th>
              <th className="text-left py-2 px-2 text-[10px] font-medium text-[#64748B] uppercase">Miner</th>
              <th className="text-left py-2 px-2 text-[10px] font-medium text-[#64748B] uppercase">Time</th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((block, index) => (
              <tr 
                key={block.number} 
                className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
              >
                <td className="py-2.5 px-2 text-xs text-[#64748B]">{index + 1}</td>
                <td className="py-2.5 px-2">
                  <span className="text-xs font-mono text-[#1E90FF]">
                    {formatNumber(block.number)}
                  </span>
                </td>
                <td className="py-2.5 px-2">
                  <span className={`text-xs font-mono ${block.txCount > 0 ? 'text-[#10B981]' : 'text-[#64748B]'}`}>
                    {block.txCount}
                  </span>
                </td>
                <td className="py-2.5 px-2">
                  <span className="text-xs text-[#F1F5F9]">
                    {(block.gasUsed / 1e6).toFixed(2)}M
                  </span>
                </td>
                <td className="py-2.5 px-2">
                  <span className="text-xs font-mono text-[#94A3B8]">
                    {block.miner}
                  </span>
                </td>
                <td className="py-2.5 px-2">
                  <span className="text-xs text-[#64748B]">{block.time}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NodePerformanceTable({ nodes }: { nodes: NodeInfo[] }) {
  return (
    <div className="card-xdc overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <Server className="w-4 h-4 text-[#1E90FF]" />
        <h3 className="text-sm font-semibold text-[#F1F5F9]">Node Performance</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left py-2 px-2 text-[10px] font-medium text-[#64748B] uppercase">Node</th>
              <th className="text-left py-2 px-2 text-[10px] font-medium text-[#64748B] uppercase">Location</th>
              <th className="text-left py-2 px-2 text-[10px] font-medium text-[#64748B] uppercase">Peers</th>
              <th className="text-left py-2 px-2 text-[10px] font-medium text-[#64748B] uppercase">Block</th>
              <th className="text-left py-2 px-2 text-[10px] font-medium text-[#64748B] uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((node) => (
              <tr 
                key={node.id} 
                className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
              >
                <td className="py-2.5 px-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      node.status === 'healthy' ? 'bg-[#10B981]' : 
                      node.status === 'syncing' ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
                    }`}></span>
                    <span className="text-xs font-medium text-[#F1F5F9]">{node.name}</span>
                  </div>
                </td>
                <td className="py-2.5 px-2">
                  <span className="text-xs text-[#94A3B8]">{node.ipv4 || '—'}</span>
                </td>
                <td className="py-2.5 px-2">
                  <span className="text-xs font-mono text-[#F1F5F9]">{node.peerCount}</span>
                </td>
                <td className="py-2.5 px-2">
                  <span className="text-xs font-mono text-[#1E90FF]">
                    {formatNumber(node.blockHeight)}
                  </span>
                </td>
                <td className="py-2.5 px-2">
                  <span className={`text-xs capitalize ${
                    node.status === 'healthy' ? 'text-[#10B981]' : 
                    node.status === 'syncing' ? 'text-[#F59E0B]' : 'text-[#EF4444]'
                  }`}>
                    {node.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <DashboardLayout>
      <div className="h-8 w-48 bg-white/5 rounded animate-pulse mb-6"></div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-24 bg-white/5 rounded-xl animate-pulse"></div>
        ))}
      </div>
    </DashboardLayout>
  );
}

export default function NetworkPage() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      
      const statsRes = await fetch('/api/v1/network/stats', { cache: 'no-store' });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      } else {
        throw new Error('Failed to fetch network stats');
      }
      
      const fleetRes = await fetch('/api/v1/fleet/status', { cache: 'no-store' });
      if (fleetRes.ok) {
        const fleetData = await fleetRes.json();
        setNodes(fleetData.nodes?.slice(0, 10) || []);
      }
      
      setLastUpdated(0);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  useEffect(() => {
    const countdownId = setInterval(() => {
      setLastUpdated(prev => prev + 1);
    }, 1000);
    return () => clearInterval(countdownId);
  }, []);

  if (loading) {
    return <LoadingState />;
  }

  if (!stats) {
    return (
      <DashboardLayout>
        <div className="p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444]">
          Failed to load network stats. Please try again later.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-[#F1F5F9] flex items-center gap-3">
                <Activity className="w-6 h-6 text-[#1E90FF]" />
                Network Stats
              </h1>
              <p className="text-sm text-[#64748B] mt-1">
                Real-time XDC network monitoring
                {lastUpdated < 3 && (
                  <span className="inline-flex items-center gap-1 ml-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#10B981]"></span>
                    </span>
                    <span className="text-[#10B981] text-xs">Live</span>
                  </span>
                )}
              </p>
            </div>
            
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm text-[#F1F5F9] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <StatCard
              label="Best Block"
              value={formatNumber(stats.bestBlock)}
              icon={Hash}
              color="#1E90FF"
              pulse
            />
            
            <StatCard
              label="Avg Block Time"
              value={`${stats.avgBlockTime}s`}
              subValue="~2s target"
              icon={Clock}
              color="#10B981"
            />
            
            <StatCard
              label="Gas Price"
              value={stats.gasPrice}
              icon={Zap}
              color="#F59E0B"
            />
            
            <StatCard
              label="Active Nodes"
              value={stats.activeNodes}
              icon={Server}
              color="#8B5CF6"
            />
            
            <StatCard
              label="TPS"
              value={stats.tps.toFixed(1)}
              subValue="avg"
              icon={TrendingUp}
              color="#EC4899"
            />
            
            <StatCard
              label="Pending Txs"
              value={stats.pendingTxs}
              icon={BarChart3}
              color="#64748B"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <BlockTimeChart data={stats.blockTimes} />
            <TransactionsChart data={stats.txsPerBlock} />
            <GasUsageChart data={stats.gasPerBlock} gasLimit={stats.gasLimit} />
            <EpochProgress epoch={stats.epoch} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LastBlocksTable blocks={stats.lastBlocks} />
            <NodePerformanceTable nodes={nodes} />
          </div>
    </DashboardLayout>
  );
}
