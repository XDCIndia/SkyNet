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
  PieChart,
  Clock,
  Link2,
  Terminal,
  Layers,
  Globe,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface NodeHealth {
  id: string;
  name: string;
  host: string;
  role: string;
  status: 'healthy' | 'degraded' | 'offline';
  lastSeen: string;
  node_type?: string;
  client_type?: string;
  os_info?: {
    type?: string;
    release?: string;
    arch?: string;
    kernel?: string;
  };
  metrics: {
    blockHeight: string;
    syncPercent: number;
    peerCount: number;
    cpuPercent: number;
    memoryPercent: number;
    diskPercent: number;
    diskUsedGb: number;
    diskTotalGb: number;
    txPoolPending: number;
    txPoolQueued: number;
    gasPrice: string;
    rpcLatencyMs: number;
    isSyncing: boolean;
    clientVersion: string;
  };
  incidents: Array<{ type: string; severity: string; title: string; detected_at: string; status: string }>;
}

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
    active: 'bg-[var(--success)]/10 text-[var(--success)] border-[#10B981]/20',
    standby: 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20',
    penalized: 'bg-[var(--critical)]/10 text-[var(--critical)] border-[#EF4444]/20',
  };
  
  const pulses = {
    active: 'animate-pulse bg-[var(--success)]',
    standby: 'bg-[var(--warning)]',
    penalized: 'bg-[var(--critical)]',
  };
  
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-full ${pulses[status]}`} />
      <span className={`px-3 py-1 text-sm font-medium rounded border ${styles[status]}`}>
        {status?.charAt(0).toUpperCase() + status.slice(1)}
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
      <Copy className={`w-4 h-4 ${copied ? 'text-[var(--success)]' : 'text-[#6B7280]'}`} />
    </button>
  );
}

function truncateAddress(addr: string, start = 8, end = 6): string {
  if (!addr) return '';
  if (addr.length <= start + end + 3) return addr;
  return `${addr.slice(0, start)}...${addr.slice(-end)}`;
}

// Node Type Badge
function NodeTypeBadge({ nodeType, confirmed = false }: { nodeType?: string; confirmed?: boolean }) {
  if (!nodeType) {
    // Show based on masternode status from contract
    return null;
  }

  const styles: Record<string, { bg: string; icon: React.ReactNode; label: string }> = {
    masternode: {
      bg: 'bg-[var(--success)]/10 text-[var(--success)] border-[#10B981]/20',
      icon: <Pickaxe className="w-3 h-3" />,
      label: confirmed ? '⛏ Masternode (Confirmed)' : '⛏ Masternode'
    },
    standby: {
      bg: 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20',
      icon: <Clock className="w-3 h-3" />,
      label: '⏳ Standby'
    },
    fullnode: {
      bg: 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border-[var(--accent-blue)]/20',
      icon: <Link2 className="w-3 h-3" />,
      label: '🔗 Full Node'
    },
  };

  const style = styles[nodeType.toLowerCase()] || styles.fullnode;

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border ${style.bg}`}>
      {style.icon}
      {style.label}
    </span>
  );
}

// Client Type Badge
function ClientTypeBadge({ clientType }: { clientType?: string }) {
  if (!clientType || clientType.toLowerCase() === 'unknown') return null;

  // Normalize to display name
  const ct = clientType.toLowerCase();
  let displayName = clientType;
  if (ct === 'nethermind') displayName = 'Nethermind';
  else if (ct === 'erigon') displayName = 'Erigon';
  else if (ct === 'reth') displayName = 'Reth';
  else if (ct === 'gp5' || ct === 'geth-pr5') displayName = 'GP5';
  else if (ct === 'geth' || ct === 'xdc') displayName = 'Geth';

  const styles: Record<string, { bg: string; icon: React.ReactNode }> = {
    Nethermind: {
      bg: 'bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20',
      icon: <Layers className="w-3 h-3" />
    },
    Erigon: {
      bg: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20',
      icon: <Layers className="w-3 h-3" />
    },
    Reth: {
      bg: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20',
      icon: <Terminal className="w-3 h-3" />
    },
    GP5: {
      bg: 'bg-[#0EA5E9]/10 text-[#0EA5E9] border-[#0EA5E9]/20',
      icon: <Globe className="w-3 h-3" />
    },
    Geth: {
      bg: 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border-[var(--accent-blue)]/20',
      icon: <Globe className="w-3 h-3" />
    },
  };

  const style = styles[displayName] || { bg: 'bg-white/5 text-[#6B7280] border-white/10', icon: <Terminal className="w-3 h-3" /> };

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border ${style.bg}`}>
      {style.icon}
      {displayName}
    </span>
  );
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
              stroke="var(--bg-body)"
              strokeWidth="2"
            />
          </g>
        ))}
        {/* Center hole for donut effect */}
        <circle cx="100" cy="100" r="40" fill="var(--bg-body)" />
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
  const [nodeHealth, setNodeHealth] = useState<NodeHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [mnRes, nodeRes] = await Promise.all([
        fetch(`/api/v1/masternodes/${address}`),
        fetch(`/api/v1/masternodes/${address}/node`),
      ]);
      
      const mnData = await mnRes.json();
      if (!mnData.success) {
        throw new Error(mnData.error || 'Failed to fetch masternode details');
      }
      setDetail(mnData.data);
      
      const nodeData = await nodeRes.json();
      if (nodeData.matched) {
        setNodeHealth(nodeData.node);
      }
    } catch (err: any) {
      console.error('Failed to fetch masternode detail:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [address]);
  
  useEffect(() => {
    fetchDetail();
    const interval = setInterval(fetchDetail, 10000);
    return () => clearInterval(interval);
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
            <Pickaxe className="w-12 h-12 mx-auto mb-4 text-[var(--accent-blue)] animate-pulse" />
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
            <p className="text-[var(--critical)] mb-4">{error || 'Masternode not found'}</p>
            <button
              onClick={() => router.push('/masternodes')}
              className="px-4 py-2 bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] rounded-lg hover:bg-[var(--accent-blue)]/20 transition-colors"
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
              <div className="w-16 h-16 rounded-2xl bg-[var(--accent-blue-glow)] flex items-center justify-center text-[var(--accent-blue)]">
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
              <div className="text-3xl font-bold font-mono-nums text-[var(--accent-blue)]">{detail.stake || '0'}</div>
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
                    <ExternalLink className="w-4 h-4 text-[var(--accent-blue)]" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Node Health Section — shows when coinbase matches a registered node */}
        {nodeHealth && (
          <div className="card-xdc border border-[var(--accent-blue)]/20 bg-gradient-to-r from-[#1E90FF]/5 to-transparent">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  nodeHealth.status === 'healthy' ? 'bg-[var(--success)]/10 text-[var(--success)]' :
                  nodeHealth.status === 'degraded' ? 'bg-[var(--warning)]/10 text-[var(--warning)]' :
                  'bg-[var(--critical)]/10 text-[var(--critical)]'
                }`}>
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#F9FAFB]">Monitored Node</h2>
                  <p className="text-xs text-[#6B7280]">
                    This masternode is running on <span className="text-[var(--accent-blue)] font-medium">{nodeHealth.name}</span> ({nodeHealth.host})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                  nodeHealth.status === 'healthy' ? 'bg-[var(--success)]/10 text-[var(--success)]' :
                  nodeHealth.status === 'degraded' ? 'bg-[var(--warning)]/10 text-[var(--warning)]' :
                  'bg-[var(--critical)]/10 text-[var(--critical)]'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    nodeHealth.status === 'healthy' ? 'bg-[var(--success)] animate-pulse' :
                    nodeHealth.status === 'degraded' ? 'bg-[var(--warning)]' :
                    'bg-[var(--critical)]'
                  }`} />
                  {nodeHealth.status?.charAt(0).toUpperCase() + nodeHealth.status.slice(1)}
                </span>
                <button
                  onClick={() => router.push(`/nodes/${nodeHealth.id}`)}
                  className="px-3 py-1.5 text-sm bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] rounded-lg hover:bg-[var(--accent-blue)]/20 transition-colors"
                >
                  War Room →
                </button>
              </div>
            </div>

            {/* Node Type and Client Type Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              <NodeTypeBadge 
                nodeType={nodeHealth.node_type} 
                confirmed={nodeHealth.node_type === 'masternode'} 
              />
              <ClientTypeBadge clientType={nodeHealth.client_type} />
            </div>

            {/* OS Info if available */}
            {nodeHealth.os_info && (
              <div className="text-xs text-[#6B7280] mb-4 flex items-center gap-2">
                <span className="font-medium">OS:</span>
                {nodeHealth.os_info.release} · {nodeHealth.os_info.arch}
                {nodeHealth.os_info.kernel && <span>· Kernel {nodeHealth.os_info.kernel}</span>}
              </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-[12px] uppercase text-[#6B7280] mb-1">Block Height</div>
                <div className="text-lg font-bold font-mono-nums text-[#F9FAFB]">
                  {Number(nodeHealth.metrics.blockHeight).toLocaleString()}
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-[12px] uppercase text-[#6B7280] mb-1">Peers</div>
                <div className="text-lg font-bold font-mono-nums text-[#F9FAFB]">{nodeHealth.metrics.peerCount}</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-[12px] uppercase text-[#6B7280] mb-1">CPU</div>
                <div className={`text-lg font-bold font-mono-nums ${
                  nodeHealth.metrics.cpuPercent > 80 ? 'text-[var(--critical)]' : 
                  nodeHealth.metrics.cpuPercent > 60 ? 'text-[var(--warning)]' : 'text-[var(--success)]'
                }`}>{nodeHealth.metrics.cpuPercent?.toFixed(1) ?? '—'}%</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-[12px] uppercase text-[#6B7280] mb-1">Memory</div>
                <div className={`text-lg font-bold font-mono-nums ${
                  nodeHealth.metrics.memoryPercent > 85 ? 'text-[var(--critical)]' : 
                  nodeHealth.metrics.memoryPercent > 70 ? 'text-[var(--warning)]' : 'text-[var(--success)]'
                }`}>{nodeHealth.metrics.memoryPercent?.toFixed(1) ?? '—'}%</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-[12px] uppercase text-[#6B7280] mb-1">Disk</div>
                <div className="text-lg font-bold font-mono-nums text-[#F9FAFB]">
                  {nodeHealth.metrics.diskPercent?.toFixed(1) ?? '—'}%
                </div>
                <div className="text-[12px] text-[#6B7280]">
                  {nodeHealth.metrics.diskUsedGb?.toFixed(0) ?? '?'}/{nodeHealth.metrics.diskTotalGb?.toFixed(0) ?? '?'} GB
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-[12px] uppercase text-[#6B7280] mb-1">RPC Latency</div>
                <div className={`text-lg font-bold font-mono-nums ${
                  nodeHealth.metrics.rpcLatencyMs > 500 ? 'text-[var(--critical)]' : 
                  nodeHealth.metrics.rpcLatencyMs > 100 ? 'text-[var(--warning)]' : 'text-[var(--success)]'
                }`}>{nodeHealth.metrics.rpcLatencyMs ?? '—'}ms</div>
              </div>
            </div>

            {/* Client Version + TxPool */}
            <div className="flex flex-wrap gap-4 mt-3 text-xs text-[#6B7280]">
              <span>Client: <span className="text-[#9CA3AF]">{nodeHealth.metrics.clientVersion || 'Unknown'}</span></span>
              <span>TxPool: <span className="text-[#9CA3AF]">{nodeHealth.metrics.txPoolPending ?? 0} pending / {nodeHealth.metrics.txPoolQueued ?? 0} queued</span></span>
              <span>Syncing: <span className={nodeHealth.metrics.isSyncing ? 'text-[var(--warning)]' : 'text-[var(--success)]'}>{nodeHealth.metrics.isSyncing ? 'Yes' : 'No'}</span></span>
            </div>

            {/* Active Incidents */}
            {nodeHealth.incidents.filter(i => i.status === 'active').length > 0 && (
              <div className="mt-4 pt-3 border-t border-white/10">
                <div className="text-xs font-semibold text-[var(--critical)] mb-2">⚠ Active Incidents</div>
                <div className="space-y-1">
                  {nodeHealth.incidents.filter(i => i.status === 'active').map((inc, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-[12px] font-bold ${
                        inc.severity === 'critical' ? 'bg-[var(--critical)]/20 text-[var(--critical)]' :
                        inc.severity === 'warning' ? 'bg-[var(--warning)]/20 text-[var(--warning)]' :
                        'bg-[#6B7280]/20 text-[#6B7280]'
                      }`}>{inc.severity}</span>
                      <span className="text-[#9CA3AF]">{inc.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* No matching node — show masternode type based on contract status */}
        {!nodeHealth && detail && (
          <div className="card-xdc border border-[var(--warning)]/20 bg-gradient-to-r from-[var(--warning)]/5 to-transparent">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--warning)]/10 text-[var(--warning)] flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#F9FAFB]">Unmonitored Node</h2>
                <p className="text-xs text-[#6B7280]">
                  This masternode is not registered in XDCNetOwn monitoring
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {detail.status === 'active' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border bg-[var(--success)]/10 text-[var(--success)] border-[#10B981]/20">
                  <Pickaxe className="w-3 h-3" />
                  ⛏ Masternode (Active)
                </span>
              ) : detail.status === 'standby' ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20">
                  <Clock className="w-3 h-3" />
                  ⏳ Standby
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border bg-[var(--critical)]/10 text-[var(--critical)] border-[#EF4444]/20">
                  <AlertTriangle className="w-3 h-3" />
                  Penalized
                </span>
              )}
            </div>

            <div className="text-sm text-[#6B7280]">
              <p>
                Install the XDCNetOwn agent on this node to monitor its health and performance.
              </p>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card-xdc">
            <div className="flex items-center gap-3 mb-3">
              <Users className="w-5 h-5 text-[var(--accent-blue)]" />
              <span className="text-sm text-[#6B7280]">Voters</span>
            </div>
            <div className="text-2xl font-bold font-mono-nums">{detail.voters.length}</div>
          </div>
          
          <div className="card-xdc">
            <div className="flex items-center gap-3 mb-3">
              <Coins className="w-5 h-5 text-[var(--success)]" />
              <span className="text-sm text-[#6B7280]">Voter Stake</span>
            </div>
            <div className="text-2xl font-bold font-mono-nums">{totalVoterStake.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
          </div>
          
          <div className="card-xdc">
            <div className="flex items-center gap-3 mb-3">
              <Activity className="w-5 h-5 text-[var(--warning)]" />
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
              <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue-glow)] flex items-center justify-center text-[var(--accent-blue)]">
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
                              index < 3 ? 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]' : 'bg-white/5 text-[#6B7280]'
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
                            <span className={share > 10 ? 'text-[var(--accent-blue)]' : 'text-[#6B7280]'}>
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
              <div className="w-10 h-10 rounded-xl bg-[rgba(16,185,129,0.1)] flex items-center justify-center text-[var(--success)]">
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
