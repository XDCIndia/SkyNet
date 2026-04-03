'use client';

/**
 * ChainDataPanel — Issues #3/#4
 * Shows headers/bodies/receipts/state/freezer breakdown from SkyOne chain-stats data.
 */

import { useState, useEffect } from 'react';
import { Layers, Archive, FileText, Database, HardDrive } from 'lucide-react';

interface ChainStats {
  headers?: number | null;
  bodies?: number | null;
  receipts?: number | null;
  stateEntries?: number | null;
  freezerBlocks?: number | null;
  chaindataSize?: number | null;
  ancientSize?: number | null;
  stateSize?: number | null;
  collectedAt?: string | null;
}

interface ChainDataPanelProps {
  nodeId: string;
  status?: {
    database?: {
      totalSize?: number;
      chaindata?: number;
      ancient?: number;
    };
    storage?: {
      chainDataSize?: number;
    };
  } | null;
}

function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit++;
  }
  return `${size.toFixed(unit >= 3 ? 1 : 0)} ${units[unit]}`;
}

function formatCount(n: number | null | undefined): string {
  if (n == null || n <= 0) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className={`p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center`} style={{ background: `${color}20` }}>
          <Icon className="w-3 h-3" style={{ color }} />
        </div>
        <span className="text-[11px] uppercase tracking-wider font-medium text-[#64748B]">{label}</span>
      </div>
      <div className="text-xl font-bold font-mono" style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-xs text-[#64748B] mt-0.5">{sub}</div>}
    </div>
  );
}

export default function ChainDataPanel({ nodeId, status }: ChainDataPanelProps) {
  const [stats, setStats] = useState<ChainStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchStats = async () => {
      try {
        // Try to get chain stats from the node database API
        const res = await fetch(`/api/v1/nodes/${nodeId}/database`, { cache: 'no-store' });
        if (res.ok && mounted) {
          const data = await res.json();
          // Map DB data into chain stats shape
          setStats({
            chaindataSize: data.current?.chaindataSize ?? null,
            ancientSize: data.current?.ancientSize ?? null,
            stateSize: data.current?.stateSize ?? null,
            collectedAt: data.current?.collectedAt ?? null,
          });
        }
      } catch {
        // Silently degrade
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 60_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [nodeId]);

  // Derive from status prop as fallback
  const chaindata = stats?.chaindataSize ?? status?.database?.chaindata ?? status?.storage?.chainDataSize ?? null;
  const ancient = stats?.ancientSize ?? status?.database?.ancient ?? null;
  const stateSize = stats?.stateSize ?? null;

  // Derive live chaindata (non-frozen) = chaindata - ancient
  const liveChaindata = chaindata != null && ancient != null ? Math.max(0, chaindata - ancient) : null;

  if (loading) {
    return (
      <div className="card-xdc animate-pulse">
        <div className="h-6 w-48 bg-white/10 rounded mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-white/5 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const noData = chaindata == null && ancient == null && stateSize == null;

  return (
    <div className="card-xdc">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-[#3B82F6]/10 flex items-center justify-center">
          <Layers className="w-5 h-5 text-[#3B82F6]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">Chain Data Breakdown <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full uppercase tracking-wide">New</span></h2>
          <p className="text-sm text-[#64748B]">
            Headers / bodies / receipts / state / freezer
          </p>
        </div>
        {stats?.collectedAt && (
          <span className="ml-auto text-xs text-[#64748B]">
            {new Date(stats.collectedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {noData ? (
        <div className="py-8 text-center text-[#64748B] text-sm">
          <Database className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>No chain data stats available.</p>
          <p className="text-xs mt-1">SkyOne agent will collect on next cycle.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            <StatCard
              icon={Layers}
              label="Live Chaindata"
              value={formatBytes(liveChaindata)}
              sub="headers + bodies + receipts"
              color="#3B82F6"
            />
            <StatCard
              icon={Archive}
              label="Freezer (Ancient)"
              value={formatBytes(ancient)}
              sub="immutable chain history"
              color="#10B981"
            />
            <StatCard
              icon={Database}
              label="State (Trie)"
              value={formatBytes(stateSize)}
              sub="current world state"
              color="#8B5CF6"
            />
            <StatCard
              icon={HardDrive}
              label="Total Chaindata"
              value={formatBytes(chaindata)}
              sub="live + freezer"
              color="#F59E0B"
            />
            <StatCard
              icon={FileText}
              label="Freezer Ratio"
              value={
                chaindata != null && ancient != null && chaindata > 0
                  ? `${((ancient / chaindata) * 100).toFixed(1)}%`
                  : '—'
              }
              sub="archived / total"
              color="#64748B"
            />
          </div>

          {/* Visual breakdown bar */}
          {chaindata != null && chaindata > 0 && (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="text-xs text-[#64748B] mb-2 uppercase tracking-wider">Size breakdown</div>
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                {liveChaindata != null && liveChaindata > 0 && (
                  <div
                    className="h-full"
                    style={{ width: `${(liveChaindata / chaindata) * 100}%`, backgroundColor: '#3B82F6', minWidth: 4 }}
                    title={`Live: ${formatBytes(liveChaindata)}`}
                  />
                )}
                {ancient != null && ancient > 0 && (
                  <div
                    className="h-full"
                    style={{ width: `${(ancient / chaindata) * 100}%`, backgroundColor: '#10B981', minWidth: 4 }}
                    title={`Freezer: ${formatBytes(ancient)}`}
                  />
                )}
                {stateSize != null && stateSize > 0 && chaindata > 0 && (
                  <div
                    className="h-full"
                    style={{ width: `${Math.min(100, (stateSize / (chaindata + stateSize)) * 100)}%`, backgroundColor: '#8B5CF6', minWidth: 4 }}
                    title={`State: ${formatBytes(stateSize)}`}
                  />
                )}
              </div>
              <div className="flex flex-wrap gap-3 mt-2">
                {[
                  { label: 'Live', color: '#3B82F6', value: formatBytes(liveChaindata) },
                  { label: 'Freezer', color: '#10B981', value: formatBytes(ancient) },
                  { label: 'State', color: '#8B5CF6', value: formatBytes(stateSize) },
                ].filter(s => s.value !== '—').map(s => (
                  <div key={s.label} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
                    <span className="text-[#94A3B8]">{s.label}</span>
                    <span className="font-medium text-white">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
