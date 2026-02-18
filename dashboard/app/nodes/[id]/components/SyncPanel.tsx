'use client';

import { useMemo } from 'react';
import { RefreshCw, Clock, Zap, GitBranch, CheckCircle2 } from 'lucide-react';
import { useAnimatedNumber } from '@/lib/animations';
import { formatNumber, formatDurationLong, getSyncColor } from '@/lib/formatters';
import { Sparkline } from '@/components/charts/Sparkline';
import type { NodeStatus, MetricHistory } from './types';

interface SyncPanelProps {
  status: NodeStatus;
  metrics: MetricHistory[];
}

function ETACountdown({ eta }: { eta: number }) {
  const hours = Math.floor(eta / 60);
  const minutes = Math.floor(eta % 60);
  
  const formatETA = () => {
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return '< 1m';
  };
  
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--accent-blue-glow)] border border-[var(--border-blue-glow)]">
      <div className="relative w-12 h-12">
        <div className="w-12 h-12 rounded-full border-4 border-[var(--accent-blue)] border-t-transparent animate-spin" />
        <Clock className="w-5 h-5 text-[var(--accent-blue)] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
      </div>
      <div>
        <div className="section-header mb-1">Estimated Time to Sync</div>
        <div className="text-2xl font-bold font-mono-nums text-[var(--accent-blue)]">
          {formatETA()}
        </div>
      </div>
    </div>
  );
}

export default function SyncPanel({ status, metrics }: SyncPanelProps) {
  // Calculate sync rate from metrics history
  const syncRatePerMin = useMemo(() => {
    if (metrics.length < 2) return 0;
    const recent = metrics.slice(-10);
    if (recent.length < 2) return 0;
    const first = recent[0];
    const last = recent[recent.length - 1];
    const blockDiff = last.block_height - first.block_height;
    const timeDiff = (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / 1000 / 60;
    return timeDiff > 0 ? Math.round(blockDiff / timeDiff) : 0;
  }, [metrics]);
  
  const displaySyncRate = useAnimatedNumber(syncRatePerMin, 1000);
  
  // Calculate ETA
  const eta = useMemo(() => {
    if (!status.isSyncing || (status.syncPercent || 0) >= 99.9) return null;
    
    const currentBlock = status.blockHeight || 0;
    const highestBlock = status.highestBlock || currentBlock;
    const blocksRemaining = highestBlock - currentBlock;
    
    if (blocksRemaining <= 0) return null;
    if (syncRatePerMin <= 0) return null;
    
    return blocksRemaining / syncRatePerMin;
  }, [syncRatePerMin, status]);
  
  const syncColor = getSyncColor(status.syncPercent || 0);
  
  // Get sync history for sparkline
  const syncHistory = metrics.slice(-30).map(m => m.sync_percent).filter(v => v != null);
  const showSparkline = syncHistory.length >= 2;
  
  return (
    <div className="card-xdc">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-blue)]/20 to-[var(--accent-blue)]/10 flex items-center justify-center">
          <RefreshCw className="w-5 h-5 text-[var(--accent-blue)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Sync & Performance</h2>
          <div className="text-sm text-[var(--text-tertiary)]">Block synchronization metrics</div>
        </div>
      </div>
      
      {/* ETA or Fully Synced */}
      {eta !== null && eta > 0 && status.isSyncing ? (
        <ETACountdown eta={eta} />
      ) : (status.syncPercent ?? 0) >= 99.9 ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--success)]/5 border border-[var(--success)]/15">
          <div className="w-12 h-12 rounded-full bg-[var(--success)]/10 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-[var(--success)]" />
          </div>
          <div>
            <div className="section-header mb-1">Status</div>
            <div className="text-2xl font-bold text-[var(--success)]">Fully Synced</div>
          </div>
        </div>
      ) : null}
      
      {/* Block Trend Sparkline - only show with real historical data */}
      {showSparkline && (
        <div className="mt-5">
          <div className="flex items-center justify-between mb-2">
            <span className="section-header">Sync Rate History</span>
          </div>
          <Sparkline data={syncHistory} color={syncColor} width={300} height={60} />
        </div>
      )}
      
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mt-5">
        <div className="p-4 rounded-xl bg-[var(--bg-hover)]">
          <div className="section-header mb-2 flex items-center gap-1">
            <Zap className="w-3 h-3" /> Sync Rate
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold font-mono-nums text-[var(--text-primary)]">
              {syncRatePerMin > 0 ? formatNumber(displaySyncRate) : '—'}
            </span>
            <span className="text-sm text-[var(--text-tertiary)]">b/min</span>
          </div>
        </div>
        
        <div className="p-4 rounded-xl bg-[var(--bg-hover)]">
          <div className="section-header mb-2 flex items-center gap-1">
            <GitBranch className="w-3 h-3" /> Block Gap
          </div>
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold font-mono-nums text-[var(--text-primary)]">
              {status.highestBlock && status.blockHeight 
                ? formatNumber(status.highestBlock - status.blockHeight)
                : '—'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Sync Progress Bar */}
      {status.isSyncing && (status.syncPercent || 0) < 99.9 && (
        <div className="mt-5 p-4 rounded-xl bg-[var(--bg-hover)]">
          <div className="flex items-center justify-between mb-2">
            <span className="section-header">Sync Progress</span>
            <span className="text-sm font-medium font-mono-nums" style={{ color: syncColor }}>
              {(status.syncPercent || 0).toFixed(2)}%
            </span>
          </div>
          <div className="w-full h-2 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, status.syncPercent || 0)}%`,
                background: `linear-gradient(90deg, ${syncColor}, ${syncColor}80)`,
                boxShadow: `0 0 10px ${syncColor}50`,
              }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-[var(--text-tertiary)]">
            <span className="font-mono-nums">{formatNumber(status.blockHeight || 0)}</span>
            <span className="font-mono-nums" style={{ color: syncColor }}>
              Behind: {(100 - (status.syncPercent || 0)).toFixed(2)}%
            </span>
            <span className="font-mono-nums">{formatNumber(status.highestBlock || 0)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
