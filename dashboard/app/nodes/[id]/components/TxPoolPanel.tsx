'use client';

import { FileText, CheckCircle2, XCircle, AlertTriangle, Layers, Loader2, Info } from 'lucide-react';
import { useAnimatedNumber } from '@/lib/animations';
import { formatNumber } from '@/lib/formatters';
import type { NodeStatus } from './types';

interface TxPoolPanelProps {
  status: NodeStatus;
}

function DonutChart({ 
  data, 
  size = 120, 
  strokeWidth = 12 
}: { 
  data: { label: string; value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  let currentOffset = 0;
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {total === 0 ? (
          // Empty state ring
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={strokeWidth}
          />
        ) : (
          data.map((item) => {
            const percentage = total > 0 ? item.value / total : 0;
            const dashArray = percentage * circumference;
            const offset = currentOffset;
            currentOffset += dashArray;
            
            return (
              <circle
                key={item.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashArray} ${circumference - dashArray}`}
                strokeDashoffset={-offset}
                style={{ transition: 'all 0.5s ease-out' }}
              />
            );
          })
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold font-mono-nums text-[var(--text-primary)]">
          {formatNumber(total)}
        </span>
        <span className="text-xs text-[var(--text-tertiary)]">Total</span>
      </div>
    </div>
  );
}

function SyncProgressBar({ blockHeight, networkHeight, syncPercent }: {
  blockHeight?: number;
  networkHeight?: number;
  syncPercent?: number;
}) {
  const pct = syncPercent ?? (
    blockHeight && networkHeight && networkHeight > 0
      ? Math.min(100, (blockHeight / networkHeight) * 100)
      : 0
  );

  const color = pct >= 99 ? '#10B981' : pct >= 90 ? '#F59E0B' : '#1E90FF';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[var(--text-secondary)]">Sync Progress</span>
        <span className="font-semibold font-mono-nums" style={{ color }}>{pct.toFixed(2)}%</span>
      </div>
      <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
        />
      </div>
      {blockHeight !== undefined && networkHeight !== undefined && networkHeight > 0 && (
        <div className="flex justify-between text-xs text-[var(--text-tertiary)] font-mono-nums">
          <span>Block {blockHeight.toLocaleString()}</span>
          <span>of {networkHeight.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}

export default function TxPoolPanel({ status }: TxPoolPanelProps) {
  const isSyncing = status.isSyncing;
  
  const pending = status.txPoolPending || 0;
  const queued = status.txPoolQueued || 0;
  const total = pending + queued;

  const blockHeight = status.blockHeight;
  const networkHeight = status.networkHeight;
  const syncPercent = status.syncPercent;
  
  const donutData = [
    { label: 'Pending', value: pending, color: 'var(--accent-blue)' },
    { label: 'Queued', value: queued, color: 'var(--warning)' },
  ];
  
  const displayPending = useAnimatedNumber(pending, 800);
  const displayQueued = useAnimatedNumber(queued, 800);

  // Compute sync pct for display
  const pct = syncPercent ?? (
    blockHeight && networkHeight && networkHeight > 0
      ? Math.min(100, (blockHeight / networkHeight) * 100)
      : 0
  );

  // Render syncing state — improved
  if (isSyncing) {
    return (
      <div className="card-xdc">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-blue)]/20 to-[var(--success)]/10 flex items-center justify-center">
            <FileText className="w-5 h-5 text-[var(--accent-blue)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Transaction Pool</h2>
            <div className="flex items-center gap-2 text-sm text-[var(--warning)]">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Syncing — {pct.toFixed(2)}% complete</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {/* Informative message */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--warning)]/5 border border-[var(--warning)]/20">
            <Info className="w-4 h-4 text-[var(--warning)] mt-0.5 shrink-0" />
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Transaction pool populates after sync reaches chain tip.{' '}
              {blockHeight !== undefined && networkHeight !== undefined && networkHeight > 0 ? (
                <>Currently at block <span className="font-semibold text-[var(--text-primary)] font-mono-nums">{blockHeight.toLocaleString()}</span> of <span className="font-semibold text-[var(--text-primary)] font-mono-nums">{networkHeight.toLocaleString()}</span> (<span className="font-semibold text-[var(--warning)]">{pct.toFixed(1)}%</span>)</>
              ) : (
                <>Waiting for sync data...</>
              )}
            </p>
          </div>

          {/* Sync progress bar */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <SyncProgressBar
              blockHeight={blockHeight}
              networkHeight={networkHeight}
              syncPercent={syncPercent}
            />
          </div>

          {/* Remaining blocks / ETA hints */}
          {blockHeight !== undefined && networkHeight !== undefined && networkHeight > blockHeight && (
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white/5 text-center">
                <div className="text-xs text-[var(--text-tertiary)] mb-1">Blocks Remaining</div>
                <div className="text-lg font-bold font-mono-nums text-[var(--warning)]">
                  {(networkHeight - blockHeight).toLocaleString()}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-white/5 text-center">
                <div className="text-xs text-[var(--text-tertiary)] mb-1">Sync Progress</div>
                <div className="text-lg font-bold font-mono-nums text-[var(--accent-blue)]">
                  {pct.toFixed(2)}%
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Empty pool state (not syncing but 0 transactions)
  const isEmpty = total === 0;

  return (
    <div className="card-xdc">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-blue)]/20 to-[var(--success)]/10 flex items-center justify-center">
          <FileText className="w-5 h-5 text-[var(--accent-blue)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Transaction Pool</h2>
          <div className="text-sm text-[var(--text-tertiary)]">
            {total > 0 ? `${formatNumber(total)} total transactions` : 'Pool is empty'}
          </div>
        </div>
      </div>

      {/* Empty pool notice for non-mining nodes */}
      {isEmpty && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--success)]/5 border border-[var(--success)]/20 mb-5">
          <Info className="w-4 h-4 text-[var(--success)] mt-0.5 shrink-0" />
          <p className="text-sm text-[var(--text-secondary)]">
            Transaction pool is empty — this is normal for non-mining nodes
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut Chart */}
        <div className="flex items-center justify-center">
          <DonutChart data={donutData} size={140} strokeWidth={14} />
        </div>
        
        {/* Stats List */}
        <div className="space-y-3">
          {donutData.map((item) => (
            <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-hover)]">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color, boxShadow: `0 0 6px ${item.color}60` }}
                />
                <span className="text-sm text-[var(--text-secondary)]">{item.label}</span>
              </div>
              <span className="text-lg font-semibold font-mono-nums text-[var(--text-primary)]">
                {item.value === 0 ? (
                  <span className="text-[var(--text-tertiary)]">0</span>
                ) : (
                  formatNumber(item.value)
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
      
      {/* TX Validation Stats */}
      <div className="grid grid-cols-3 gap-3 mt-5">
        <div className="p-3 rounded-xl bg-[var(--success)]/5 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <CheckCircle2 className="w-3 h-3 text-[var(--success)]" />
            <span className="section-header">Valid</span>
          </div>
          <div className="text-lg font-semibold font-mono-nums text-[var(--success)]">
            —
          </div>
        </div>
        
        <div className="p-3 rounded-xl bg-[var(--critical)]/5 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <XCircle className="w-3 h-3 text-[var(--critical)]" />
            <span className="section-header">Invalid</span>
          </div>
          <div className="text-lg font-semibold font-mono-nums text-[var(--critical)]">
            —
          </div>
        </div>
        
        <div className="p-3 rounded-xl bg-[var(--warning)]/5 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <AlertTriangle className="w-3 h-3 text-[var(--warning)]" />
            <span className="section-header">Underpriced</span>
          </div>
          <div className="text-lg font-semibold font-mono-nums text-[var(--warning)]">
            —
          </div>
        </div>
      </div>
    </div>
  );
}
