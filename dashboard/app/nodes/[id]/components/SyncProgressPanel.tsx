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
  if (seconds < 60) return `~${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const m = Math.round(seconds / 60);
    return `~${m}m`;
  }
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.round((seconds % 86400) / 3600);
  return h > 0 ? `~${d}d ${h}h` : `~${d}d`;
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

  // Issue #51: Rolling average blocks/sec over last 5 minutes of history
  let blocksPerSec: number | null = null;
  let etaSeconds: number | null = null;
  if (history.length >= 2) {
    const now = new Date(history[history.length - 1].timestamp).getTime();
    const windowMs = 5 * 60 * 1000; // 5 minutes
    const windowPoints = history.filter(
      (h) => now - new Date(h.timestamp).getTime() <= windowMs
    );

    if (windowPoints.length >= 2) {
      const oldest = windowPoints[0];
      const newest = windowPoints[windowPoints.length - 1];
      const dtWindow =
        (new Date(newest.timestamp).getTime() - new Date(oldest.timestamp).getTime()) / 1000;
      const dbWindow = newest.block_height - oldest.block_height;
      if (dtWindow > 0 && dbWindow > 0) {
        blocksPerSec = dbWindow / dtWindow;
        etaSeconds = blocksPerSec > 0 ? blocksLeft / blocksPerSec : null;
      }
    } else {
      // Fallback: last two points
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
          <p className="text-gray-400 text-xs mb-1">ETA (5-min avg)</p>
          <p className="text-white font-mono">
            {etaSeconds != null
              ? etaSeconds <= 0
                ? 'Synced ✓'
                : `Synced in ${formatEta(etaSeconds)}`
              : syncPercent >= 100
              ? 'Synced ✓'
              : 'Calculating…'}
          </p>
        </div>
      </div>

      <MiniChart data={chartData} />
    </div>
  );
}
