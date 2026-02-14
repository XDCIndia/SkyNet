'use client';

import { FileText, CheckCircle2, XCircle, AlertTriangle, Layers, Loader2 } from 'lucide-react';
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
        {data.map((item) => {
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
              style={{
                transition: 'all 0.5s ease-out',
              }}
            />
          );
        })}
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

export default function TxPoolPanel({ status }: TxPoolPanelProps) {
  const isSyncing = status.isSyncing;
  
  const pending = status.txPoolPending || 0;
  const queued = status.txPoolQueued || 0;
  const total = pending + queued;
  
  const donutData = [
    { label: 'Pending', value: pending, color: 'var(--accent-blue)' },
    { label: 'Queued', value: queued, color: 'var(--warning)' },
  ];
  
  const displayPending = useAnimatedNumber(pending, 800);
  const displayQueued = useAnimatedNumber(queued, 800);
  
  // Render syncing state
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
              <span>Node is syncing...</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Loader2 className="w-12 h-12 text-[var(--warning)] animate-spin mb-4" />
          <p className="text-[var(--text-secondary)]">Transaction pool data unavailable while syncing</p>
          <p className="text-sm text-[var(--text-tertiary)] mt-2">TxPool will be available once sync is complete</p>
        </div>
      </div>
    );
  }
  
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
            {total > 0 ? `${formatNumber(total)} total transactions` : '0 transactions (empty pool)'}
          </div>
        </div>
      </div>
      
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
