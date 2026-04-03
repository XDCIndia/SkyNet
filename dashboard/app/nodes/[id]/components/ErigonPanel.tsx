'use client';

/**
 * ErigonPanel — Issue #56
 * Shows both sentry ports (eth/63 + eth/68) and peer count per sentry
 * for Erigon XDC nodes.
 */

import { NodeStatus } from './types';

interface SentryInfo {
  port: number;
  protocol: string;
  peerCount: number;
  status: 'online' | 'offline' | 'unknown';
  inboundPeers?: number;
  outboundPeers?: number;
}

interface ErigonMetrics {
  sentry63?: SentryInfo;
  sentry68?: SentryInfo;
  stageSyncStage?: string;
  stageSyncProgress?: number;
  batchSize?: string;
  cacheSize?: string;
}

interface Props {
  status: NodeStatus | null;
  metrics?: ErigonMetrics;
}

function SentryCard({ info, label }: { info: SentryInfo; label: string }) {
  const statusColor =
    info.status === 'online'
      ? 'text-green-400'
      : info.status === 'offline'
      ? 'text-red-400'
      : 'text-yellow-400';
  const dotColor =
    info.status === 'online'
      ? 'bg-green-400'
      : info.status === 'offline'
      ? 'bg-red-400'
      : 'bg-yellow-400';

  return (
    <div className="bg-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-white font-medium text-sm">{label}</p>
          <p className="text-gray-400 text-xs font-mono">:{info.port}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          <span className={`text-xs ${statusColor}`}>{info.status}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Protocol</span>
          <span className="text-cyan-300 font-mono">{info.protocol}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Total Peers</span>
          <span className="text-white font-mono font-bold">{info.peerCount}</span>
        </div>
        {info.inboundPeers != null && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">↓ Inbound</span>
            <span className="text-white font-mono">{info.inboundPeers}</span>
          </div>
        )}
        {info.outboundPeers != null && (
          <div className="flex justify-between text-xs">
            <span className="text-gray-400">↑ Outbound</span>
            <span className="text-white font-mono">{info.outboundPeers}</span>
          </div>
        )}
      </div>

      {/* Mini peer bar */}
      {info.peerCount > 0 && (
        <div className="mt-3">
          <div className="w-full bg-gray-600 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-purple-400 transition-all duration-500"
              style={{ width: `${Math.min(100, (info.peerCount / 50) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-500 mt-0.5 text-right">
            {info.peerCount}/50 max
          </p>
        </div>
      )}
    </div>
  );
}

export default function ErigonPanel({ status, metrics }: Props) {
  if (!status) return null;

  // Only render for Erigon clients
  const clientType = String(status.clientType ?? '').toLowerCase();
  if (clientType && clientType !== 'erigon') {
    return null;
  }

  // Defaults if metrics not provided
  const sentry63: SentryInfo = metrics?.sentry63 ?? {
    port: 30303,
    protocol: 'eth/63',
    peerCount: 0,
    status: 'unknown',
  };
  const sentry68: SentryInfo = metrics?.sentry68 ?? {
    port: 30304,
    protocol: 'eth/68',
    peerCount: 0,
    status: 'unknown',
  };

  const totalPeers = sentry63.peerCount + sentry68.peerCount;

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2 h-6 rounded-full bg-purple-500" />
        <h2 className="text-lg font-semibold text-white">Erigon Dual-Sentry</h2>
        <span className="ml-auto text-xs bg-gray-700 rounded-full px-3 py-1 text-gray-300">
          {totalPeers} total peers
        </span>
      </div>

      {/* Dual sentry cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <SentryCard info={sentry63} label="Sentry 1 (Legacy)" />
        <SentryCard info={sentry68} label="Sentry 2 (Modern)" />
      </div>

      {/* Stage sync */}
      {(metrics?.stageSyncStage != null || metrics?.stageSyncProgress != null) && (
        <div className="bg-gray-700 rounded-lg p-3 mb-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Stage Sync</p>
          {metrics?.stageSyncStage && (
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Current Stage</span>
              <span className="text-purple-300 font-mono">{metrics.stageSyncStage}</span>
            </div>
          )}
          {metrics?.stageSyncProgress != null && (
            <>
              <div className="flex justify-between text-xs text-gray-300 mb-1">
                <span>Progress</span>
                <span className="font-mono">{metrics.stageSyncProgress.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-600 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-purple-500 transition-all duration-500"
                  style={{ width: `${metrics.stageSyncProgress}%` }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* Erigon settings */}
      {(metrics?.batchSize || metrics?.cacheSize) && (
        <div className="bg-gray-700 rounded-lg p-3">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Configuration</p>
          {metrics.batchSize && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Batch Size</span>
              <span className="text-white font-mono">{metrics.batchSize}</span>
            </div>
          )}
          {metrics.cacheSize && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Cache Size</span>
              <span className="text-white font-mono">{metrics.cacheSize}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
