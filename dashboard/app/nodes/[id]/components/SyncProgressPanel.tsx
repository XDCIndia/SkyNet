'use client';

/**
 * SyncProgressPanel — Issue #7
 * Visual sync progress bar, blocks/sec rate, ETA, and sync history chart.
 */

import { NodeStatus, MetricHistory } from './types';

interface SyncProgressPanelProps {
  status: NodeStatus | null;
  history: MetricHistory[];
}

function formatEta(seconds: number): string {
  if (seconds <= 0) return 'Done';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

function MiniChart({ data }: { data: { t: string; v: number }[] }) {
  if (data.length < 2) return null;
  const vals = data.map((d) => d.v);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const W = 400;
  const H = 60;

  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((d.v - min) / range) * H;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="mt-4">
      <p className="text-xs text-gray-400 mb-1">Sync % — last {data.length} samples</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke="#22d3ee"
          strokeWidth="2"
          points={points}
        />
        {/* shade under line */}
        <polygon
          fill="#22d3ee22"
          points={`0,${H} ${points} ${W},${H}`}
        />
      </svg>
    </div>
  );
}

export default function SyncProgressPanel({ status, history }: SyncProgressPanelProps) {
  if (!status) {
    return (
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-2">Sync Progress</h2>
        <p className="text-gray-400 text-sm">No data available.</p>
      </div>
    );
  }

  const {
    syncPercent,
    isSyncing,
    blockHeight,
    networkHeight,
    highestBlock,
  } = status;

  const target = highestBlock ?? networkHeight;
  const blocksLeft = target > blockHeight ? target - blockHeight : 0;

  // Estimate blocks/sec from last two history points
  let blocksPerSec: number | null = null;
  let etaSeconds: number | null = null;
  if (history.length >= 2) {
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    const dt =
      (new Date(last.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 1000;
    const db = last.block_height - prev.block_height;
    if (dt > 0 && db > 0) {
      blocksPerSec = db / dt;
      etaSeconds = blocksPerSec > 0 ? blocksLeft / blocksPerSec : null;
    }
  }

  const chartData = history.map((h) => ({
    t: h.timestamp,
    v: h.sync_percent ?? 0,
  }));

  const barColor =
    syncPercent >= 100
      ? 'bg-green-500'
      : syncPercent >= 90
      ? 'bg-cyan-500'
      : 'bg-yellow-500';

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-white mb-4">Sync Progress</h2>

      {/* Big progress bar */}
      <div className="mb-2 flex justify-between text-sm text-gray-300">
        <span>{isSyncing ? 'Syncing…' : syncPercent >= 100 ? 'Synced ✓' : 'Behind'}</span>
        <span className="font-mono">{syncPercent.toFixed(2)}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-4 mb-4">
        <div
          className={`${barColor} h-4 rounded-full transition-all duration-700`}
          style={{ width: `${Math.min(syncPercent, 100)}%` }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 text-sm mb-2">
        <div className="bg-gray-700 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">Local Block</p>
          <p className="text-white font-mono">{blockHeight.toLocaleString()}</p>
        </div>
        <div className="bg-gray-700 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">Network Block</p>
          <p className="text-white font-mono">{target.toLocaleString()}</p>
        </div>
        <div className="bg-gray-700 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">Blocks/sec</p>
          <p className="text-white font-mono">
            {blocksPerSec != null ? blocksPerSec.toFixed(2) : '—'}
          </p>
        </div>
        <div className="bg-gray-700 rounded-lg p-3">
          <p className="text-gray-400 text-xs mb-1">ETA</p>
          <p className="text-white font-mono">
            {etaSeconds != null ? formatEta(etaSeconds) : syncPercent >= 100 ? '—' : 'Calculating…'}
          </p>
        </div>
      </div>

      <MiniChart data={chartData} />
    </div>
  );
}
