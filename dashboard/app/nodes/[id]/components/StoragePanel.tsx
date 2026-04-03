'use client';

import { HardDrive, Database, TrendingUp, Gauge, ArrowUpDown, Server, MapPin, AlertCircle, Zap } from 'lucide-react';
import { formatBytes } from '@/lib/formatters';
import { Sparkline } from '@/components/charts/Sparkline';
import type { NodeStatus, MetricHistory } from './types';

interface StoragePanelProps {
  status: NodeStatus;
  metrics: MetricHistory[];
}

function StorageTypeIcon({ type }: { type: string }) {
  if (type.includes('NVMe')) return <Zap className="w-4 h-4 text-[#10B981]" />;
  if (type.includes('SSD')) return <Server className="w-4 h-4 text-[#3B82F6]" />;
  return <HardDrive className="w-4 h-4 text-[#F59E0B]" />;
}

function IOPSGauge({ iops }: { iops: number }) {
  // Typical max: NVMe ~100K, SSD ~50K, HDD ~200
  const maxIops = iops > 50000 ? 200000 : iops > 1000 ? 100000 : 1000;
  const pct = Math.min(100, (iops / maxIops) * 100);
  const color = iops > 50000 ? '#10B981' : iops > 5000 ? '#3B82F6' : '#F59E0B';

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
      <div className="flex items-center gap-2 mb-3">
        <Gauge className="w-4 h-4 text-[var(--warning)]" />
        <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] font-medium">IOPS Estimate</span>
      </div>
      <div className="text-2xl font-bold font-mono-nums mb-2" style={{ color }}>
        {iops >= 1000 ? `${(iops / 1000).toFixed(1)}K` : iops}
        <span className="text-sm font-normal text-[var(--text-tertiary)] ml-1">IOPS</span>
      </div>
      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function DiskUsageBar({ usedGb, totalGb }: { usedGb: number; totalGb: number }) {
  const pct = totalGb > 0 ? Math.min(100, (usedGb / totalGb) * 100) : 0;
  const color = pct > 90 ? '#EF4444' : pct > 75 ? '#F59E0B' : '#10B981';

  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] font-medium">Disk Usage</span>
        <span className="text-sm font-semibold font-mono-nums" style={{ color }}>
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="flex justify-between text-xs text-[var(--text-tertiary)] font-mono-nums">
        <span>{usedGb.toFixed(1)} GB used</span>
        <span>{totalGb.toFixed(1)} GB total</span>
      </div>
    </div>
  );
}

function ChainVsDbBar({ chainDataBytes, databaseBytes }: { chainDataBytes: number; databaseBytes: number }) {
  const total = databaseBytes > 0 ? databaseBytes : chainDataBytes;
  if (total === 0) return null;

  const chainPct = Math.min(100, (chainDataBytes / total) * 100);
  const overheadBytes = databaseBytes > chainDataBytes ? databaseBytes - chainDataBytes : 0;
  const overheadPct = Math.min(100, (overheadBytes / total) * 100);

  return (
    <div className="space-y-3">
      <div className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] font-medium">Storage Distribution</div>

      {/* Stacked bar */}
      <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden flex">
        <div
          className="h-full transition-all duration-500 bg-purple-500"
          style={{ width: `${chainPct}%` }}
          title={`Chain data: ${formatBytes(chainDataBytes)}`}
        />
        {overheadPct > 0 && (
          <div
            className="h-full transition-all duration-500 bg-blue-400/60"
            style={{ width: `${overheadPct}%` }}
            title={`DB overhead: ${formatBytes(overheadBytes)}`}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-purple-500 shrink-0" />
          <div>
            <div className="text-[var(--text-tertiary)]">Chain Data</div>
            <div className="font-semibold font-mono-nums text-[var(--text-primary)]">{formatBytes(chainDataBytes)}</div>
          </div>
        </div>
        {databaseBytes > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-blue-400/60 shrink-0" />
            <div>
              <div className="text-[var(--text-tertiary)]">Total DB</div>
              <div className="font-semibold font-mono-nums text-[var(--text-primary)]">{formatBytes(databaseBytes)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StoragePanel({ status, metrics }: StoragePanelProps) {
  const storage = status.storage;

  // Check if we have real storage data
  const diskUsedGb = storage?.diskUsedGb ?? 0;
  const diskTotalGb = storage?.diskTotalGb ?? 0;
  const chainDataSize = storage?.chainDataSize ?? 0;
  const databaseSize = storage?.databaseSize ?? 0;
  const storageType = storage?.storageType;
  const iopsEstimate = storage?.iopsEstimate ?? 0;
  const mountPoint = storage?.mountPoint;

  const hasRealData = diskTotalGb > 0 || chainDataSize > 0 || databaseSize > 0;

  // Convert to bytes if the values look like GB (< 100000) rather than bytes
  const chainDataBytes = chainDataSize > 1000 ? chainDataSize : chainDataSize * 1024 * 1024 * 1024;
  const databaseBytes = databaseSize > 1000 ? databaseSize : databaseSize * 1024 * 1024 * 1024;

  // Storage history for sparkline
  const storageHistory = metrics
    .slice(-30)
    .map(m => m.chain_data_size || m.database_size || 0)
    .filter(v => v > 0);

  // Storage type styling
  const storageTypeStyle =
    storageType?.includes('NVMe') ? { bg: 'bg-[#10B981]/10', text: 'text-[#10B981]', border: 'border-[#10B981]/20' } :
    storageType?.includes('SSD') ? { bg: 'bg-[#3B82F6]/10', text: 'text-[#3B82F6]', border: 'border-[#3B82F6]/20' } :
    { bg: 'bg-[#F59E0B]/10', text: 'text-[#F59E0B]', border: 'border-[#F59E0B]/20' };

  return (
    <div className="card-xdc">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--purple)]/20 to-[var(--pink)]/10 flex items-center justify-center">
          <HardDrive className="w-5 h-5 text-[var(--purple)]" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Storage &amp; Database</h2>
          <div className="text-sm text-[var(--text-tertiary)] flex items-center gap-2 flex-wrap">
            <span>Chain data metrics</span>
            {storageType && storageType !== 'unknown' && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border flex items-center gap-1 ${storageTypeStyle.bg} ${storageTypeStyle.text} ${storageTypeStyle.border}`}>
                <StorageTypeIcon type={storageType} />
                {storageType}
                {iopsEstimate > 0 && ` · ~${iopsEstimate >= 1000 ? `${(iopsEstimate / 1000).toFixed(1)}K` : iopsEstimate} IOPS`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* No data fallback */}
      {!hasRealData ? (
        <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--warning)]/10 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-[var(--warning)]" />
          </div>
          <div>
            <p className="text-[var(--text-secondary)] font-medium">Storage metrics unavailable</p>
            <p className="text-sm text-[var(--text-tertiary)] mt-1">
              Ensure SkyOne agent v2 is running on this node
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Storage Type prominent display */}
          {storageType && storageType !== 'unknown' && (
            <div className={`flex items-center gap-3 p-4 rounded-xl border ${storageTypeStyle.bg} ${storageTypeStyle.border}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-white/5`}>
                <StorageTypeIcon type={storageType} />
              </div>
              <div>
                <div className={`text-lg font-bold ${storageTypeStyle.text}`}>{storageType}</div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  {storageType.includes('NVMe') ? 'High-performance NVMe — optimal for blockchain workloads' :
                   storageType.includes('SSD') ? 'SSD storage — good performance for sync and state access' :
                   'HDD storage — consider upgrading for better sync performance'}
                </div>
              </div>
            </div>
          )}

          {/* IOPS Gauge */}
          {iopsEstimate > 0 && <IOPSGauge iops={iopsEstimate} />}

          {/* Disk Usage Progress Bar */}
          {diskTotalGb > 0 && <DiskUsageBar usedGb={diskUsedGb} totalGb={diskTotalGb} />}

          {/* Mount Point */}
          {mountPoint && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
              <MapPin className="w-4 h-4 text-[var(--accent-blue)] shrink-0" />
              <div>
                <div className="text-xs text-[var(--text-tertiary)]">Mount Point</div>
                <div className="text-sm font-mono text-[var(--text-primary)]">{mountPoint}</div>
              </div>
            </div>
          )}

          {/* Chain Data vs Database bar chart */}
          {(chainDataBytes > 0 || databaseBytes > 0) && (
            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
              <ChainVsDbBar chainDataBytes={chainDataBytes} databaseBytes={databaseBytes} />
            </div>
          )}

          {/* Storage Growth Sparkline */}
          {storageHistory.length >= 2 && (
            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-[var(--warning)]" />
                <span className="text-xs uppercase tracking-wide text-[var(--text-tertiary)] font-medium">Storage Growth</span>
              </div>
              <Sparkline
                data={storageHistory}
                color="var(--warning)"
                height={60}
                width={300}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
