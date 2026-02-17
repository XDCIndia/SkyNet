'use client';

import { useMemo } from 'react';
import { 
  Blocks, 
  Zap, 
  Clock, 
  Globe, 
  CheckCircle2,
  Cpu,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';
import { useAnimatedNumber } from '@/lib/animations';
import { formatDurationLong, getSyncColor, formatNumber, formatBytes } from '@/lib/formatters';
import type { NodeDetail, NodeStatus, MetricHistory } from './types';
import { Sparkline } from '@/components/charts/Sparkline';

interface HeroSectionProps {
  node: NodeDetail;
  status: NodeStatus;
  metrics: MetricHistory[];
}

function CircularProgress({ 
  percentage, 
  size = 120, 
  strokeWidth = 8,
  label = 'Sync'
}: { 
  percentage: number; 
  size?: number; 
  strokeWidth?: number;
  label?: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  const color = getSyncColor(percentage);
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.06)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.5s ease-out, stroke 0.3s ease',
            filter: `drop-shadow(0 0 6px ${color}40)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold font-mono-nums" style={{ color }}>
          {percentage.toFixed(1)}%
        </span>
        <span className="text-xs text-[#6B7280]">{label}</span>
      </div>
    </div>
  );
}

function getClientIcon(clientType?: string): string {
  const type = clientType?.toLowerCase() || '';
  if (type.includes('nethermind')) return '🟣';
  if (type.includes('erigon')) return '🔶';
  if (type.includes('geth')) return '🟢';
  return '🔷';
}

function getClientName(clientType?: string): string {
  const type = clientType?.toLowerCase() || '';
  if (type.includes('nethermind')) return 'Nethermind';
  if (type.includes('erigon')) return 'Erigon';
  if (type.includes('geth')) return 'Geth';
  return 'XDC';
}

function getNodeTypeLabel(nodeType?: string, syncMode?: string): string {
  if (!nodeType) return 'Full Node';
  const type = nodeType.toLowerCase();
  if (type.includes('archive')) return 'Archive Node';
  if (type.includes('fast') || syncMode === 'fast') return 'Fast Sync';
  if (type.includes('snap') || syncMode === 'snap') return 'Snap Sync';
  if (type.includes('masternode')) return 'Masternode';
  return 'Full Node';
}

function formatSyncETA(minutes: number): string {
  if (minutes < 60) return `~${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours < 24) return `~${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `~${days}d ${remainingHours}h`;
}

export default function HeroSection({ node, status, metrics }: HeroSectionProps) {
  const displayBlockHeight = useAnimatedNumber(status.blockHeight || 0, 1500);
  const displayPeers = useAnimatedNumber(status.peerCount || 0, 1000);
  
  const syncColor = getSyncColor(status.syncPercent || 0);
  
  // Calculate sync stats
  const blockHistory = useMemo(() => {
    return metrics.slice(-30).map(m => m.block_height).filter(Boolean);
  }, [metrics]);
  
  const showSparkline = blockHistory.length >= 2;
  
  // Calculate blocks per minute from history
  const blocksPerMinute = useMemo(() => {
    if (metrics.length < 2) return 0;
    const recent = metrics.slice(-10);
    if (recent.length < 2) return 0;
    const first = recent[0];
    const last = recent[recent.length - 1];
    const blockDiff = last.block_height - first.block_height;
    const timeDiff = (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / 1000 / 60;
    return timeDiff > 0 ? Math.round(blockDiff / timeDiff) : 0;
  }, [metrics]);
  
  // Calculate ETA
  const estimatedMinutes = useMemo(() => {
    if (!status.isSyncing || blocksPerMinute <= 0) return 0;
    const remaining = (status.networkHeight || status.highestBlock || 0) - (status.blockHeight || 0);
    return remaining / blocksPerMinute;
  }, [status.isSyncing, blocksPerMinute, status.networkHeight, status.highestBlock, status.blockHeight]);
  
  const showETA = status.isSyncing && estimatedMinutes > 0;
  
  // Calculate block increase
  const blockIncrease = useMemo(() => {
    if (metrics.length < 2) return 0;
    const recent = metrics.slice(-5);
    if (recent.length < 2) return 0;
    return recent[recent.length - 1].block_height - recent[0].block_height;
  }, [metrics]);
  
  // Get trend
  const getTrend = () => {
    if (metrics.length < 2) return null;
    const prev = metrics[metrics.length - 2]?.block_height || 0;
    const curr = status.blockHeight || 0;
    if (curr > prev) return 'up';
    if (curr < prev) return 'down';
    return 'same';
  };
  
  const trend = getTrend();

  return (
    <div className="card-hero">
      {/* Client Type & Node Type Badges */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--accent-blue-glow)] border border-[var(--border-blue-glow)]">
          <span className="text-xl">{getClientIcon(status.clientType || node.client_type)}</span>
          <span className="text-sm font-semibold text-[var(--accent-blue)]">{getClientName(status.clientType || node.client_type)}</span>
        </div>
        <div className="px-4 py-2 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-subtle)]">
          <span className="text-sm font-medium text-[var(--text-secondary)]">
            {getNodeTypeLabel(status.nodeType || node.node_type, status.syncMode || node.sync_mode)}
          </span>
        </div>
        {!status.isSyncing ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--success)]/10 border border-[var(--success)]/20">
            <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
            <span className="text-xs font-medium text-[var(--success)]">Synced</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--warning)]/10 border border-[var(--warning)]/20">
            <Zap className="w-4 h-4 text-[var(--warning)] animate-pulse" />
            <span className="text-xs font-medium text-[var(--warning)]">Syncing</span>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Left: Block Height */}
        <div className="lg:col-span-5 flex flex-col justify-center">
          <div className="section-header mb-2">
            <span>Current Block Height</span>
            {status.networkHeight > 0 && status.blockHeight < status.networkHeight && (
              <span className="text-xs font-normal text-[var(--text-tertiary)] ml-2">{'/ '}{formatNumber(status.networkHeight)} network</span>
            )}
          </div>
          <div className="flex items-baseline gap-3">
            <div className="text-4xl lg:text-5xl font-bold font-mono-nums text-[var(--text-primary)]">
              {status.blockHeight > 0 ? formatNumber(displayBlockHeight) : '—'}
            </div>
            {trend && (
              <div className={`flex items-center gap-1 text-sm ${
                trend === 'up' ? 'text-[var(--success)]' : 
                trend === 'down' ? 'text-[var(--critical)]' : 'text-[var(--text-tertiary)]'
              }`}>
                {trend === 'up' ? <TrendingUp className="w-5 h-5" /> : 
                 trend === 'down' ? <TrendingDown className="w-5 h-5" /> : 
                 <Minus className="w-5 h-5" />}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 text-sm mb-3">
            <span className="text-[var(--text-tertiary)]">Network:</span>
            <span className="font-mono-nums text-[var(--text-secondary)]">
              {(status.networkHeight ?? 0) > 0 ? formatNumber(status.networkHeight) : '—'}
            </span>
          </div>
          
          {/* Block Increase */}
          {blockIncrease > 0 && (
            <div className="flex items-center gap-3 text-sm mb-1">
              <span className="text-[var(--success)] font-semibold">+{blockIncrease} blocks</span>
              <span className="text-[var(--text-tertiary)]">in last {Math.min(metrics.length, 10)} updates</span>
            </div>
          )}
          
          {/* Blocks Per Minute */}
          {blocksPerMinute > 0 && (
            <div className="flex items-center gap-2 text-sm mb-2">
              <span className="text-[var(--accent-blue)] font-semibold">~{blocksPerMinute} blocks/min</span>
              <span className="text-[var(--text-tertiary)]">sync speed</span>
            </div>
          )}
          
          {/* Sync ETA */}
          {showETA && (
            <div className="mt-3 px-3 py-2 rounded-lg bg-[var(--accent-blue-glow)] border border-[var(--border-blue-glow)]">
              <div className="text-xs text-[var(--text-tertiary)] mb-1">Estimated time remaining</div>
              <div className="text-lg font-bold text-[var(--accent-blue)]">{formatSyncETA(estimatedMinutes)}</div>
              <div className="text-xs text-[var(--text-secondary)] mt-1">
                {status.syncMode === 'archive' ? 'Archive sync — all historical states preserved' :
                 status.syncMode === 'fast' || status.syncMode === 'snap' ? 'Fast sync — downloading state' :
                 'Full sync — verifying all blocks'}
              </div>
            </div>
          )}
          
          {/* Sparkline - only show with real historical data */}
          {showSparkline && (
            <div className="mt-4">
              <Sparkline data={blockHistory} color={syncColor} width={240} height={50} />
            </div>
          )}
        </div>
        
        {/* Center: Sync Progress */}
        <div className="lg:col-span-3 flex flex-col items-center justify-center">
          <CircularProgress percentage={status.syncPercent || 0} size={140} strokeWidth={10} />
          
          {status.isSyncing && (status.syncPercent || 0) < 99.9 && (
            <div className="mt-3 text-center">
              <span className="text-xs text-[var(--text-tertiary)]">Syncing in progress...</span>
            </div>
          )}
        </div>
        
        {/* Right: Peers + Stats */}
        <div className="lg:col-span-4 grid grid-cols-1 gap-4">
          <div className="flex items-center justify-between p-4 rounded-xl bg-[var(--accent-blue-glow)] border border-[var(--border-blue-glow)]">
            <div>
              <div className="section-header mb-1">Peers Connected</div>
              <div className="text-3xl font-bold font-mono-nums text-[var(--accent-blue)]">
                {status.peerCount > 0 ? formatNumber(displayPeers) : '—'}
              </div>
            </div>
            <div className="text-right text-xs">
              <div className="text-[var(--success)]">↓ {status.activePeers || 0}</div>
              <div className="text-[var(--accent-blue)]">↑ {(status.peerCount || 0) - (status.activePeers || 0)}</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[var(--bg-hover)]">
              <div className="section-header mb-1">Uptime</div>
              <div className="text-lg font-semibold text-[var(--text-primary)]">
                {formatDurationLong(status.uptime || 0)}
              </div>
            </div>
            
            <div className="p-4 rounded-xl bg-[var(--bg-hover)]">
              <div className="section-header mb-1">Network</div>
              <div className="text-lg font-semibold font-mono-nums text-[var(--text-primary)]">
                {status.chainId || '50'}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-[var(--bg-hover)]">
              <div className="section-header mb-1">RPC Latency</div>
              <div className="text-lg font-semibold font-mono-nums text-[var(--text-primary)]">
                {status.rpcLatencyMs ? `${status.rpcLatencyMs}ms` : '—'}
              </div>
            </div>
            
            <div className="p-4 rounded-xl bg-[var(--bg-hover)]">
              <div className="section-header mb-1">Gas Price</div>
              <div className="text-lg font-semibold font-mono-nums text-[var(--text-primary)]">
                {status.gasPrice ? `${(BigInt(status.gasPrice) / BigInt(1e9)).toString()} Gwei` : '—'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
