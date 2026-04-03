'use client';

import { useState, useEffect } from 'react';
import { Database, TrendingUp, Clock, Server, ChevronDown, ChevronUp } from 'lucide-react';
import { Sparkline } from '@/components/charts/Sparkline';

interface DBCurrent {
  dbEngine: string | null;
  totalSize: number | null;
  chaindataSize: number | null;
  ancientSize: number | null;
  stateSize: number | null;
  diskTotalGb: number | null;
  diskUsedGb: number | null;
  collectedAt: string;
}

interface DBHistoryPoint {
  recordedAt: string;
  totalSize: number | null;
  chaindataSize: number | null;
  ancientSize: number | null;
}

interface DBData {
  current: DBCurrent | null;
  history: DBHistoryPoint[];
  growthRatePerDay: number | null;
  estDaysToFill: number | null;
}

interface DatabasePanelProps {
  nodeId: string;
  dbEngine?: string | null;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

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

function formatGrowthRate(bytesPerDay: number | null): string {
  if (!bytesPerDay || bytesPerDay <= 0) return '—';
  return `~${formatBytes(bytesPerDay)}/day`;
}

// ─── Engine Badge ─────────────────────────────────────────────────────────────

const ENGINE_STYLES: Record<string, { bg: string; color: string; icon: string }> = {
  LevelDB:  { bg: 'bg-[#10B981]/10', color: 'text-[#10B981]', icon: '🟢' },
  PebbleDB: { bg: 'bg-[#10B981]/10', color: 'text-[#10B981]', icon: '🪨' },
  MDBX:     { bg: 'bg-[#F59E0B]/10', color: 'text-[#F59E0B]', icon: '⚡' },
  RocksDB:  { bg: 'bg-[#8B5CF6]/10', color: 'text-[#8B5CF6]', icon: '🪨' },
};

function EngineBadge({ engine }: { engine: string | null | undefined }) {
  if (!engine) return <span className="text-[var(--text-tertiary)]">—</span>;
  const style = ENGINE_STYLES[engine] || { bg: 'bg-white/10', color: 'text-[#94A3B8]', icon: '🗄️' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${style.bg} ${style.color} border-current/20`}>
      <span>{style.icon}</span>
      {engine}
    </span>
  );
}

// ─── Stacked Bar ──────────────────────────────────────────────────────────────

interface StackedBarProps {
  chaindata: number;
  ancient: number;
  state: number;
  total: number;
}

function StackedBar({ chaindata, ancient, state, total }: StackedBarProps) {
  if (total <= 0) return null;

  // ancient is INSIDE chaindata — show net chaindata (minus ancient), ancient, state, other
  const chaindataNet = Math.max(0, chaindata - ancient);
  const other = Math.max(0, total - chaindata - state);

  const segments = [
    { label: 'Chaindata', value: chaindataNet, color: '#3B82F6' },
    { label: 'Ancient', value: ancient, color: '#10B981' },
    { label: 'State', value: state, color: '#8B5CF6' },
    { label: 'Other', value: other, color: '#64748B' },
  ].filter((s) => s.value > 0);

  return (
    <div className="space-y-2">
      {/* Bar */}
      <div className="flex h-4 rounded-full overflow-hidden gap-0.5">
        {segments.map((seg) => (
          <div
            key={seg.label}
            title={`${seg.label}: ${formatBytes(seg.value)}`}
            className="h-full transition-all duration-500"
            style={{
              width: `${(seg.value / total) * 100}%`,
              backgroundColor: seg.color,
              minWidth: seg.value > 0 ? '4px' : '0',
            }}
          />
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: seg.color }} />
            <span className="text-[var(--text-secondary)]">{seg.label}</span>
            <span className="font-medium text-[var(--text-primary)]">{formatBytes(seg.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DatabasePanel({ nodeId, dbEngine }: DatabasePanelProps) {
  const [data, setData] = useState<DBData | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/v1/nodes/${nodeId}/database`, { cache: 'no-store' });
        if (res.ok && mounted) {
          setData(await res.json());
        }
      } catch {
        // Silently fail — panel shows no-data state
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [nodeId]);

  const current = data?.current;
  const history = data?.history ?? [];

  // Sparkline data: total size over time
  const sparkData = history
    .map((h) => h.totalSize ?? 0)
    .filter((v) => v > 0);

  // Derive engine from prop fallback → API data
  const engine = current?.dbEngine ?? dbEngine ?? null;

  if (loading) {
    return (
      <div className="card-xdc animate-pulse">
        <div className="h-6 w-48 bg-white/10 rounded mb-4" />
        <div className="h-24 bg-white/5 rounded" />
      </div>
    );
  }

  // If no DB data at all, show a minimal placeholder
  if (!current) {
    return (
      <div className="card-xdc">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue)]/10 flex items-center justify-center">
            <Database className="w-5 h-5 text-[var(--accent-blue)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">Database Deep-Dive <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full uppercase tracking-wide">New</span></h2>
            <p className="text-sm text-[var(--text-tertiary)]">No DB metrics yet — SkyOne agent collecting on next cycle</p>
          </div>
        </div>
        {engine && (
          <div className="mt-3 flex items-center gap-2">
            <span className="section-header">Engine:</span>
            <EngineBadge engine={engine} />
          </div>
        )}
      </div>
    );
  }

  const totalSize = current.totalSize ?? 0;
  const chaindataSize = current.chaindataSize ?? 0;
  const ancientSize = current.ancientSize ?? 0;
  const stateSize = current.stateSize ?? 0;

  return (
    <div className="card-xdc">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-[var(--accent-blue)]/10 flex items-center justify-center">
          <Database className="w-5 h-5 text-[var(--accent-blue)]" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">Database Deep-Dive <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full uppercase tracking-wide">New</span></h2>
          <div className="text-sm text-[var(--text-tertiary)]">
            On-chain data breakdown &amp; growth tracking
          </div>
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="p-2 rounded-lg hover:bg-white/10 text-[var(--text-tertiary)] transition-colors"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Section 1: Overview Cards (2×2) */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {/* Total DB Size */}
            <div className="p-4 rounded-xl bg-[var(--accent-blue)]/5 border border-[var(--accent-blue)]/10">
              <div className="section-header mb-1 flex items-center gap-1">
                <Server className="w-3.5 h-3.5" /> Total DB Size
              </div>
              <div className="text-2xl font-bold font-mono-nums text-[var(--text-primary)]">
                {formatBytes(totalSize)}
              </div>
            </div>

            {/* DB Engine */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="section-header mb-1 flex items-center gap-1">
                <Database className="w-3.5 h-3.5" /> Engine
              </div>
              <div className="mt-1">
                <EngineBadge engine={engine} />
              </div>
            </div>

            {/* Growth Rate */}
            <div className="p-4 rounded-xl bg-[#10B981]/5 border border-[#10B981]/10">
              <div className="section-header mb-1 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" /> Growth Rate
              </div>
              <div className="text-lg font-semibold font-mono-nums text-[#10B981]">
                {formatGrowthRate(data?.growthRatePerDay ?? null)}
              </div>
            </div>

            {/* Est. Time to Fill */}
            <div className="p-4 rounded-xl bg-[#F59E0B]/5 border border-[#F59E0B]/10">
              <div className="section-header mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Est. Disk Full
              </div>
              <div className="text-lg font-semibold font-mono-nums text-[#F59E0B]">
                {data?.estDaysToFill
                  ? `~${data.estDaysToFill} days`
                  : '—'}
              </div>
            </div>
          </div>

          {/* Section 2: Size Breakdown Stacked Bar */}
          {totalSize > 0 && (
            <div className="mb-5 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="section-header mb-3">Size Breakdown</div>
              <StackedBar
                chaindata={chaindataSize}
                ancient={ancientSize}
                state={stateSize}
                total={totalSize}
              />
            </div>
          )}

          {/* Section 3: Growth Chart */}
          {sparkData.length >= 2 && (
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
              <div className="section-header mb-3">DB Size — Last 7 Days</div>
              <Sparkline
                data={sparkData}
                color="var(--accent-blue)"
                height={70}
                width={500}
              />
              <div className="flex justify-between text-xs text-[var(--text-tertiary)] mt-1">
                <span>{formatBytes(sparkData[0])}</span>
                <span>{formatBytes(sparkData[sparkData.length - 1])}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
