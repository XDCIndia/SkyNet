'use client';

/**
 * NethermindPanel — Issue #55
 * Shows XdcStateRootCache hit/miss rate and cache size for Nethermind nodes.
 */

import { NodeStatus } from './types';

interface NethermindMetrics {
  xdcStateRootCache?: {
    hits: number;
    misses: number;
    size: number;
    maxSize: number;
  };
  prunedBlocks?: number;
  dbSize?: string;
  chainLevelCacheSize?: number;
}

interface Props {
  status: NodeStatus | null;
  /** Extra Nethermind-specific metrics from the agent */
  metrics?: NethermindMetrics;
}

function Gauge({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const color =
    pct < 50 ? '#4ade80' : pct < 80 ? '#facc15' : '#f87171';
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-300 mb-1">
        <span>{label}</span>
        <span className="font-mono">
          {value.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between text-sm py-1.5 border-b border-gray-700 last:border-0">
      <span className="text-gray-400">{label}</span>
      <span className="text-white font-mono">{value}</span>
    </div>
  );
}

export default function NethermindPanel({ status, metrics }: Props) {
  if (!status) return null;

  const cache = metrics?.xdcStateRootCache;
  const total = cache ? cache.hits + cache.misses : 0;
  const hitRate = total > 0 ? ((cache!.hits / total) * 100).toFixed(1) : null;
  const missRate = total > 0 ? ((cache!.misses / total) * 100).toFixed(1) : null;

  // Only render for Nethermind clients
  const clientType = String(status.clientType ?? '').toLowerCase();
  if (clientType && clientType !== 'nethermind' && clientType !== 'nm') {
    return null;
  }

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-6 rounded-full" style={{ background: '#fb923c' }} />
        <h2 className="text-lg font-semibold text-white">Nethermind Internals</h2>
      </div>

      {/* XdcStateRootCache */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">
          XdcStateRootCache
        </p>

        {cache ? (
          <div className="space-y-3">
            <Gauge label="Cache Usage" value={cache.size} max={cache.maxSize || 1} />

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-700 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Hit Rate</p>
                <p className="text-2xl font-bold text-green-400">
                  {hitRate != null ? `${hitRate}%` : '—'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {cache.hits.toLocaleString()} hits
                </p>
              </div>
              <div className="bg-gray-700 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-400 mb-1">Miss Rate</p>
                <p className="text-2xl font-bold text-orange-400">
                  {missRate != null ? `${missRate}%` : '—'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {cache.misses.toLocaleString()} misses
                </p>
              </div>
            </div>

            <div className="bg-gray-700 rounded-lg p-3">
              <StatRow label="Cache Size" value={cache.size.toLocaleString()} />
              <StatRow label="Max Cache Size" value={cache.maxSize.toLocaleString()} />
              <StatRow
                label="Total Lookups"
                value={total.toLocaleString()}
              />
            </div>
          </div>
        ) : (
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <p className="text-gray-400 text-sm">Cache metrics not available.</p>
            <p className="text-gray-500 text-xs mt-1">
              Ensure SkyOne agent is running with Nethermind metrics enabled.
            </p>
          </div>
        )}
      </div>

      {/* Other Nethermind metrics */}
      {(metrics?.prunedBlocks != null ||
        metrics?.dbSize != null ||
        metrics?.chainLevelCacheSize != null) && (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
            Additional Stats
          </p>
          <div className="bg-gray-700 rounded-lg p-3">
            {metrics.prunedBlocks != null && (
              <StatRow
                label="Pruned Blocks"
                value={metrics.prunedBlocks.toLocaleString()}
              />
            )}
            {metrics.dbSize != null && (
              <StatRow label="DB Size" value={metrics.dbSize} />
            )}
            {metrics.chainLevelCacheSize != null && (
              <StatRow
                label="Chain Level Cache"
                value={metrics.chainLevelCacheSize.toLocaleString()}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
