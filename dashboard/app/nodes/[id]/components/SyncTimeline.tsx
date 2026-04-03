'use client';

/**
 * SyncTimeline — Issue #10
 * History chart of block height over time (sparkline/area chart).
 * Uses MetricHistory data from the node detail page.
 */

import { useMemo } from 'react';
import { TrendingUp, Clock } from 'lucide-react';
import type { MetricHistory } from './types';

interface SyncTimelineProps {
  metrics: MetricHistory[];
  networkHeight?: number;
}

function formatBlockNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function SyncTimeline({ metrics, networkHeight }: SyncTimelineProps) {
  const data = useMemo(() => {
    if (!metrics.length) return [];
    // Sort ascending by timestamp
    return [...metrics]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .filter(m => m.block_height > 0);
  }, [metrics]);

  if (!data.length) {
    return (
      <div className="card-xdc">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#1E90FF]/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-[#1E90FF]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">Sync Timeline <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full uppercase tracking-wide">New</span></h2>
            <p className="text-xs text-[#64748B]">Block height over time</p>
          </div>
        </div>
        <div className="h-32 flex items-center justify-center text-[#64748B] text-sm">
          No historical data yet — collecting...
        </div>
      </div>
    );
  }

  const heights = data.map(d => d.block_height);
  const minH = Math.min(...heights);
  const maxH = Math.max(...heights);
  const range = maxH - minH || 1;

  // Compute SVG polyline points
  const WIDTH = 600;
  const HEIGHT = 120;
  const PADDING = { top: 10, bottom: 20, left: 0, right: 0 };
  const innerW = WIDTH - PADDING.left - PADDING.right;
  const innerH = HEIGHT - PADDING.top - PADDING.bottom;

  const points = data.map((d, i) => {
    const x = PADDING.left + (i / Math.max(data.length - 1, 1)) * innerW;
    const y = PADDING.top + innerH - ((d.block_height - minH) / range) * innerH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  // Area fill path
  const firstX = PADDING.left;
  const lastX = PADDING.left + innerW;
  const bottomY = PADDING.top + innerH;
  const areaPath = `M${firstX},${bottomY} ` + points.join(' L') + ` L${lastX},${bottomY} Z`;

  const latest = data[data.length - 1];
  const oldest = data[0];
  const blockGain = latest.block_height - oldest.block_height;
  const timeMs = new Date(latest.timestamp).getTime() - new Date(oldest.timestamp).getTime();
  const bps = timeMs > 0 ? (blockGain / (timeMs / 1000)).toFixed(2) : null;

  // Sample some labels for x-axis (every ~25% through)
  const labelIndices = [0, Math.floor(data.length * 0.33), Math.floor(data.length * 0.66), data.length - 1];

  return (
    <div className="card-xdc">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#1E90FF]/10 flex items-center justify-center">
          <TrendingUp className="w-5 h-5 text-[#1E90FF]" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">Sync Timeline <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full uppercase tracking-wide">New</span></h2>
          <p className="text-xs text-[#64748B]">Block height over time — last {data.length} samples</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#64748B]">
          <Clock className="w-3.5 h-3.5" />
          {formatTime(latest.timestamp)}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
          <div className="text-[10px] uppercase text-[#64748B] mb-1">Current Block</div>
          <div className="font-bold font-mono text-[#1E90FF]">{formatBlockNum(latest.block_height)}</div>
        </div>
        <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
          <div className="text-[10px] uppercase text-[#64748B] mb-1">Gain (window)</div>
          <div className="font-bold font-mono text-[#10B981]">+{formatBlockNum(blockGain)}</div>
        </div>
        <div className="p-3 rounded-lg bg-white/5 border border-white/5 text-center">
          <div className="text-[10px] uppercase text-[#64748B] mb-1">Avg Speed</div>
          <div className="font-bold font-mono text-[#F59E0B]">{bps ? `${bps} b/s` : '—'}</div>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="w-full overflow-hidden rounded-lg bg-white/[0.02] border border-white/[0.06] p-3">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          style={{ height: HEIGHT }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="syncgrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1E90FF" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#1E90FF" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Network height reference line */}
          {networkHeight != null && networkHeight > maxH && (
            <line
              x1={PADDING.left}
              y1={PADDING.top}
              x2={PADDING.left + innerW}
              y2={PADDING.top}
              stroke="#EF4444"
              strokeWidth="1"
              strokeDasharray="4,4"
              opacity="0.5"
            />
          )}

          {/* Area fill */}
          <path d={areaPath} fill="url(#syncgrad)" />

          {/* Line */}
          <polyline
            points={points.join(' ')}
            fill="none"
            stroke="#1E90FF"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Dots at ends */}
          {[data[0], data[data.length - 1]].map((d, i) => {
            const idx = i === 0 ? 0 : data.length - 1;
            const x = PADDING.left + (idx / Math.max(data.length - 1, 1)) * innerW;
            const y = PADDING.top + innerH - ((d.block_height - minH) / range) * innerH;
            return (
              <circle key={i} cx={x} cy={y} r="4" fill="#1E90FF" />
            );
          })}
        </svg>

        {/* X-axis labels */}
        <div className="flex justify-between text-[10px] text-[#475569] mt-1 px-1">
          {labelIndices.filter((idx, i, arr) => arr.indexOf(idx) === i).map(idx => (
            <span key={idx}>{formatTime(data[idx].timestamp)}</span>
          ))}
        </div>
      </div>

      {/* Y-axis range */}
      <div className="flex justify-between text-[10px] text-[#475569] mt-1 px-1">
        <span>Min: {formatBlockNum(minH)}</span>
        {networkHeight != null && (
          <span className="text-[#EF4444]">Network: {formatBlockNum(networkHeight)}</span>
        )}
        <span>Max: {formatBlockNum(maxH)}</span>
      </div>
    </div>
  );
}
