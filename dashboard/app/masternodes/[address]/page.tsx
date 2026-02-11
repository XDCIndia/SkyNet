'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Pickaxe,
  Copy,
  ArrowLeft,
  Users,
  Coins,
  Activity,
  ExternalLink,
  PieChart
} from 'lucide-react';

interface Voter {
  address: string;
  xdcAddress: string;
  stake: string;
}

interface MasternodeDetail {
  address: string;
  xdcAddress: string;
  status: 'active' | 'standby' | 'penalized';
  owner?: string;
  ownerXdc?: string;
  stake?: string;
  voterCount?: number;
  ethstatsName?: string;
  voters: Voter[];
}

function StatusBadge({ status }: { status: 'active' | 'standby' | 'penalized' }) {
  const styles = {
    active: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20',
    standby: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20',
    penalized: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20',
  };
  
  const pulses = {
    active: 'animate-pulse bg-[#10B981]',
    standby: 'bg-[#F59E0B]',
    penalized: 'bg-[#EF4444]',
  };
  
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full ${pulses[status]}`} />
      <span className={`px-3 py-1 text-sm font-medium rounded border ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    </div>
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
      className="p-2 hover:bg-white/5 rounded-lg transition-colors"
      title={copied ? 'Copied!' : `Copy ${label || 'address'}`}
    >
      <Copy className={`w-4 h-4 ${copied ? 'text-[#10B981]' : 'text-[#6B7280]'}`} />
    </button>
  );
}

function truncateAddress(addr: string, start = 8, end = 6): string {
  if (!addr) return '';
  if (addr.length <= start + end + 3) return addr;
  return `${addr.slice(0, start)}...${addr.slice(-end)}`;
}

// Voter Pie Chart Component
function VoterPieChart({ voters, totalStake }: { voters: Voter[]; totalStake: number }) {
  const topVoters = voters.slice(0, 10);
  const chartData = topVoters.map(v => ({
    ...v,
    percentage: totalStake > 0 ? (parseFloat(v.stake.replace(/,/g, '')) / totalStake) * 100 : 0,
  }));
  
  // Calculate cumulative for pie chart
  const colors = ['#1E90FF', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'];
  
  let cumulativePercent = 0;
  const slices = chartData.map((v, i) => {
    const startAngle = (cumulativePercent / 100) * 2 * Math.PI - Math.PI / 2;
    cumulativePercent += v.percentage;
    const endAngle = (cumulativePercent / 100) * 2 * Math.PI - Math.PI / 2;
    
    const x1 = 100 + 80 * Math.cos(startAngle);
    const y1 = 100 + 80 * Math.sin(startAngle);
    const x2 = 100 + 80 * Math.cos(endAngle);
    const y2 = 100 + 80 * Math.sin(endAngle);
    
    const largeArc = v.percentage > 50 ? 1 : 0;
    
    return {
      path: `M 100 100 L ${x1} ${y1} A 80 80 0 ${largeArc} 1 ${x2} ${y2} Z`,
      color: colors[i % colors.length],
      data: v,
    };
  });
  
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 200" className="w-48 h-48">
        {slices.map((slice, i) => (
          <g key={i}>
            <path
              d={slice.path}
              fill={slice.color}
              stroke="#0A0E1A"
              strokeWidth="2"
            />
          </g>
        ))}
        <!-- Center hole for donut effect -->
        <circle cx="100" cy="100" r="40" fill="#0A0E1A" />
        <text x="100" y="95" textAnchor="middle" fill="#F9FAFB" fontSize="12" fontWeight="bold">
          {voters.length}
        </text>
        <text x="100" y="110" textAnchor="middle" fill="#6B7280" fontSize="8">
          Voters
        </text>
      </svg>
      
      <div className="mt-4 space-y-2 w-full">
        {chartData.slice(0, 5).map((v, i) => (
          <div key={v.address} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded" 
                style={{ backgroundColor: colors[i % colors.length] }}
              />
              <span className="font-mono text-xs">{truncateAddress(v.xdcAddress, 6, 4)}</span>
            </div>
            <span className="text-[#6B7280]">{v.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MasternodeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const address = params.address as string;
  
  const [detail, setDetail] = useState<MasternodeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await fetch(`/api/v1/masternodes/${address}`);
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch masternode details');
      }
      
      setDetail(data.data);
    } catch (err: any) {
      console.error('Failed to fetch masternode detail:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [address]);
  
  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);
  
  const totalStake = detail?.stake 
    ? parseFloat(detail.stake.replace(/,/g, ''))
    : 0;
  
  const totalVoterStake = detail?.voters.reduce((sum, v) => 
    sum + parseFloat(v.stake.replace(/,/g, '')), 0
  ) || 0;
  
  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <Pickaxe className="w-12 h-12 mx-auto mb-4 text-[#1E90FF] animate-pulse" />
            <p className="text-[#6B7280]">Loading masternode details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
  if (error || !detail) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <p className="text-[#EF4444] mb-4">{error || 'Masternode not found'}</p>
            <button
              onClick={() => router.push('/masternodes')}
              className="px-4 py-2 bg-[#1E90FF]/10 text-[#1E90FF] rounded-lg hover:bg-[#1E90FF]/20 transition-colors"
            >
              ← Back to Masternodes
            </button>
          </div>
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Back Button */}
        <button
          onClick={() => router.push('/masternodes')}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#F9FAFB] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Masternodes</span>
        </button>
        
        {/* Header Card */}
        <div className="card-xdc">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-[rgba(30,144,255,0.1)] flex items-center justify-center text-[#1E90FF]">
                <Pickaxe className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-semibold text-[#F9FAFB]">Masternode</h1>
                  <StatusBadge status={detail.status} />
                </div>
                <p className="text-sm text-[#6B7280] mt-1">Validator on XDC Network</p>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold font-mono-nums text-[#1E90FF]">{detail.stake || '0'}</div>
              <div className="text-sm text-[#6B7280]">Total Stake (XDC)</div>
            </div>
          </div>
          
          <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* XDC Address */}
            <div>
              <div className="text-sm text-[#6B7280] mb-2">XDC Address</div>
              <div className="flex items-center gap-2 bg-white/5 p-3 rounded-lg">
                <span className="font-mono text-sm flex-1 break-all">{detail.xdcAddress}</span>
                <CopyButton text={detail.xdcAddress} />
              </div>
            </div>
            
            {/* 0x Address */}
            <div>
              <div className="text-sm text-[#6B7280] mb-2">Ethereum Address (0x)</div>
              <div className="flex items-center gap-2 bg-white/5 p-3 rounded-lg">
                <span className="font-mono text-sm flex-1 break-all">{detail.address}</span>
                <CopyButton text={detail.address} />
              </div>
            </div>
            
            {/* Owner */}
            {detail.owner && (
              <div className="md:col-span-2">
                <div className="text-sm text-[#6B7280] mb-2">Owner</div>
                <div className="flex items-center gap-2 bg-white/5 p-3 rounded-lg">
                  <span className="font-mono text-sm flex-1">{toXdcAddress(detail.owner)}</span>
                  <CopyButton text={toXdcAddress(detail.owner)} label="owner address" />
                  <a
                    href={`https://explorer.xinfin.network/addr/${toXdcAddress(detail.owner)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <ExternalLink className="w-4 h-4 text-[#1E90FF]" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-xdc">
            <div className="flex items-center gap-3 mb-3">
              <Users className="w-5 h-5 text-[#1E90FF]" />
              <span className="text-sm text-[#6B7280]">Voters</span>
            </div>
            <div className="text-2xl font-bold font-mono-nums">{detail.voters.length}</div>
          </div>
          
          <div className="card-xdc">
            <div className="flex items-center gap-3 mb-3">
              <Coins className="w-5 h-5 text-[#10B981]" />
              <span className="text-sm text-[#6B7280]">Voter Stake</span>
            </div>
            <div className="text-2xl font-bold font-mono-nums">{totalVoterStake.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
          </div>
          
          <div className="card-xdc">
            <div className="flex items-center gap-3 mb-3">
              <Activity className="w-5 h-5 text-[#F59E0B]" />
              <span className="text-sm text-[#6B7280]">Self Stake %</span>
            </div>
            <div className="text-2xl font-bold font-mono-nums">
              {totalStake > 0 ? (((totalStake - totalVoterStake) / totalStake) * 100).toFixed(1) : '0'}%
            </div>
          </div>
          
          <div className="card-xdc">
            <div className="flex items-center gap-3 mb-3">
              <PieChart className="w-5 h-5 text-[#8B5CF6]" />
              <span className="text-sm text-[#6B7280]">Avg Voter Stake</span>
            </div>
            <div className="text-2xl font-bold font-mono-nums">
              {detail.voters.length > 0 
                ? (totalVoterStake / detail.voters.length).toLocaleString('en-US', { maximumFractionDigits: 0 })
                : '0'}
            </div>
          </div>
        </div>
        
        {/* Voters Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Voters Table */}
          <div className="card-xdc lg:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[rgba(30,144,255,0.1)] flex items-center justify-center text-[#1E90FF]">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#F9FAFB]">Voters</h2>
                <p className="text-xs text-[#6B7280]">All delegators to this masternode</p>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Rank</th>
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#6B7280]">Address</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-[#6B7280]">Stake (XDC)</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-[#6B7280]">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {detail.voters.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-[#6B7280]">No voters found</td>
                    </tr>
                  ) : (
                    detail.voters.map((voter, index) => {
                      const voterStake = parseFloat(voter.stake.replace(/,/g, ''));
                      const share = totalStake > 0 ? (voterStake / totalStake) * 100 : 0;
                      
                      return (
                        <tr key={voter.address} className="hover:bg-white/[0.02]">
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              index < 3 ? 'bg-[#1E90FF]/20 text-[#1E90FF]' : 'bg-white/5 text-[#6B7280]'
                            }`}>
                              {index + 1}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{truncateAddress(voter.xdcAddress)}</span>
                              <CopyButton text={voter.xdcAddress} />
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono-nums">{voter.stake}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={share > 10 ? 'text-[#1E90FF]' : 'text-[#6B7280]'}>
                              {share.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Voter Distribution Chart */}
          <div className="card-xdc">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[rgba(16,185,129,0.1)] flex items-center justify-center text-[#10B981]">
                <PieChart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#F9FAFB]">Stake Distribution</h2>
                <p className="text-xs text-[#6B7280]">Top voters by stake</p>
              </div>
            </div>
            
            {detail.voters.length > 0 ? (
              <VoterPieChart voters={detail.voters} totalStake={totalStake} />
            ) : (
              <div className="text-center py-8 text-[#6B7280]">No voter data</div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function toXdcAddress(address: string): string {
  if (!address) return '';
  if (address.startsWith('0x')) {
    return 'xdc' + address.slice(2);
  }
  return address;
}
