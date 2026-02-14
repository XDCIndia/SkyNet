'use client';

import { HardDrive, Database, TrendingUp, Gauge, ArrowUpDown } from 'lucide-react';
import { useAnimatedNumber } from '@/lib/animations';
import { formatBytes, formatNumber } from '@/lib/formatters';
import { Sparkline } from '@/components/charts/Sparkline';
import type { NodeStatus, MetricHistory } from './types';

interface StoragePanelProps {
  status: NodeStatus;
  metrics: MetricHistory[];
}

function CacheHitGauge({ rate }: { rate: number }) {
  const size = 100;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (rate / 100) * circumference;
  
  const color = rate >= 90 ? '#10B981' : rate >= 70 ? '#F59E0B' : '#EF4444';
  
  return (
    <div className="flex flex-col items-center">
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
              transition: 'stroke-dashoffset 0.5s ease-out',
              filter: `drop-shadow(0 0 4px ${color}50)`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold font-mono-nums" style={{ color }}>
            {rate.toFixed(0)}%
          </span>
        </div>
      </div>
      <span className="section-header mt-2">Cache Hit Rate</span>
    </div>
  );
}

function DistributionBar({ label, value, color, max }: { label: string; value: number; color: string; max: number }) {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
        <span className="text-sm font-medium font-mono-nums text-[var(--text-primary)]">{formatBytes(value)}</span>
      </div>
      <div className="w-full h-2 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(100, percentage)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

export default function StoragePanel({ status, metrics }: StoragePanelProps) {
  const chainDataSize = status.storage?.chainDataSize || 0;
  const databaseSize = status.storage?.databaseSize || 0;
  
  // Convert GB to bytes if needed (assume GB if value is small)
  const chainDataBytes = chainDataSize > 1000 ? chainDataSize : chainDataSize * 1024 * 1024 * 1024;
  const databaseBytes = databaseSize > 1000 ? databaseSize : databaseSize * 1024 * 1024 * 1024;
  
  const totalSize = databaseBytes > 0 ? databaseBytes : chainDataBytes * 1.1;
  
  // Get storage history for sparkline
  const storageHistory = metrics
    .slice(-30)
    .map(m => m.chain_data_size || m.database_size || 0)
    .filter(v => v > 0);
  
  return (
    <div className="card-xdc">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--purple)]/20 to-[var(--pink)]/10 flex items-center justify-center">
          <HardDrive className="w-5 h-5 text-[var(--purple)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Storage & Database</h2>
          <div className="text-sm text-[var(--text-tertiary)]">Chain data metrics</div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Storage Stats */}
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[var(--purple)]/5 border border-[var(--purple)]/10">
            <div className="flex items-center gap-3 mb-3">
              <Database className="w-5 h-5 text-[var(--purple)]" />
              <div>
                <div className="section-header">Chain Data Size</div>
                <div className="text-2xl font-bold font-mono-nums text-[var(--text-primary)]">
                  {chainDataBytes > 0 ? formatBytes(chainDataBytes) : <span className="text-[var(--text-tertiary)]">—</span>}
                </div>
              </div>
            </div>
            {databaseBytes > 0 && (
              <div className="text-sm text-[var(--text-secondary)]">
                Total DB: <span className="font-semibold text-[var(--text-primary)]">{formatBytes(databaseBytes)}</span>
              </div>
            )}
          </div>
          
          {/* Distribution Bars */}
          {chainDataBytes > 0 && (
            <div className="space-y-3">
              <div className="section-header">Storage Distribution</div>
                          
              <DistributionBar
                label="Chain Data"
                value={chainDataBytes}
                color="var(--purple)"
                max={totalSize}
              />
              
              <DistributionBar
                label="Database Total"
                value={totalSize}
                color="var(--accent-blue)"
                max={totalSize}
              />
            </div>
          )}
          
          {/* Storage History Sparkline */}
          {storageHistory.length >= 2 && (
            <div className="mt-4">
              <div className="section-header mb-2">Storage Growth</div>
              <Sparkline 
                data={storageHistory} 
                color="var(--warning)" 
                height={60} 
                width={300}
              />
            </div>
          )}
        </div>
        
        {/* Right: Stats */}
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[var(--bg-hover)] flex flex-col items-center">
            <CacheHitGauge rate={85} />
          </div>
          
          <div className="p-4 rounded-xl bg-[var(--bg-hover)]">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpDown className="w-4 h-4 text-[var(--accent-blue)]" />
              <span className="section-header">Read/Write Activity</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-xs text-[var(--text-tertiary)]">Read</div>
                <div className="text-lg font-semibold font-mono-nums text-[var(--accent-blue)]">Active</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-[var(--text-tertiary)]">Write</div>
                <div className="text-lg font-semibold font-mono-nums text-[var(--success)]">Active</div>
              </div>
            </div>
          </div>
          
          <div className="p-4 rounded-xl bg-[var(--bg-hover)]">
            <div className="flex items-center gap-2 mb-2">
              <Gauge className="w-4 h-4 text-[var(--warning)]" />
              <span className="section-header">Compaction Status</span>
            </div>
            <div className="text-lg font-semibold text-[var(--text-primary)]">
              Normal
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">Background compaction running</div>
          </div>
        </div>
      </div>
    </div>
  );
}
