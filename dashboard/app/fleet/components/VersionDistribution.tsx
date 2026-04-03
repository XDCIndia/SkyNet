'use client';

/**
 * VersionDistribution — Issue #53
 * Pie/bar chart showing client type + version distribution across fleet.
 */

import { useEffect, useState } from 'react';

interface VersionBucket {
  clientType: string;
  clientVersion: string;
  count: number;
}

interface Props {
  /** Pre-fetched data (optional). If not provided, fetched from API. */
  data?: VersionBucket[];
}

const CLIENT_COLORS: Record<string, string> = {
  gp5: '#22d3ee',
  erigon: '#a78bfa',
  nethermind: '#fb923c',
  reth: '#4ade80',
  unknown: '#6b7280',
};

function clientColor(type: string): string {
  return CLIENT_COLORS[type.toLowerCase()] ?? CLIENT_COLORS.unknown;
}

export default function VersionDistribution({ data: propData }: Props) {
  const [data, setData] = useState<VersionBucket[]>(propData ?? []);
  const [loading, setLoading] = useState(!propData);
  const [view, setView] = useState<'bar' | 'pie'>('bar');

  useEffect(() => {
    if (propData) return;
    setLoading(true);
    fetch('/api/fleet')
      .then((r) => r.json())
      .then((json) => {
        // Aggregate client_type + client_version from fleet nodes
        const buckets = new Map<string, number>();
        const nodes: any[] = json.nodes ?? json ?? [];
        for (const node of nodes) {
          const key = `${node.client_type ?? 'unknown'}__${node.client_version ?? 'unknown'}`;
          buckets.set(key, (buckets.get(key) ?? 0) + 1);
        }
        setData(
          [...buckets.entries()].map(([k, count]) => {
            const [clientType, clientVersion] = k.split('__');
            return { clientType, clientVersion, count };
          })
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [propData]);

  const total = data.reduce((s, b) => s + b.count, 0);

  // Aggregate by clientType for simplified view
  const byType = new Map<string, number>();
  for (const b of data) {
    byType.set(b.clientType, (byType.get(b.clientType) ?? 0) + b.count);
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-3">Client Version Distribution</h2>
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-3">Client Version Distribution</h2>
        <p className="text-gray-400 text-sm">No data available.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Client Version Distribution</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setView('bar')}
            className={`px-3 py-1 rounded text-xs ${view === 'bar' ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            Bar
          </button>
          <button
            onClick={() => setView('pie')}
            className={`px-3 py-1 rounded text-xs ${view === 'pie' ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300'}`}
          >
            Pie
          </button>
        </div>
      </div>

      {view === 'bar' ? (
        <BarView data={data} total={total} />
      ) : (
        <PieView byType={byType} total={total} />
      )}

      {/* Version breakdown table */}
      <div className="mt-4">
        <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide">Version Breakdown</p>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {data
            .sort((a, b) => b.count - a.count)
            .map((b) => (
              <div
                key={`${b.clientType}-${b.clientVersion}`}
                className="flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: clientColor(b.clientType) }}
                  />
                  <span className="text-gray-300 font-mono">
                    {b.clientType}@{b.clientVersion}
                  </span>
                </div>
                <span className="text-white font-mono">
                  {b.count} ({((b.count / total) * 100).toFixed(0)}%)
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bar chart
// ─────────────────────────────────────────────────────────────────────────────

function BarView({ data, total }: { data: VersionBucket[]; total: number }) {
  const sorted = [...data].sort((a, b) => b.count - a.count);
  return (
    <div className="space-y-2">
      {sorted.map((b) => {
        const pct = (b.count / total) * 100;
        return (
          <div key={`${b.clientType}-${b.clientVersion}`}>
            <div className="flex justify-between text-xs text-gray-300 mb-0.5">
              <span>
                <span style={{ color: clientColor(b.clientType) }}>{b.clientType}</span>{' '}
                <span className="text-gray-500">v{b.clientVersion}</span>
              </span>
              <span className="font-mono">
                {b.count} node{b.count !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: clientColor(b.clientType) }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Pie chart (SVG)
// ─────────────────────────────────────────────────────────────────────────────

function PieView({ byType, total }: { byType: Map<string, number>; total: number }) {
  const SIZE = 160;
  const R = 60;
  const CX = SIZE / 2;
  const CY = SIZE / 2;

  const slices: JSX.Element[] = [];
  let cumAngle = -Math.PI / 2; // start from top

  const entries = [...byType.entries()].sort((a, b) => b[1] - a[1]);

  for (const [type, count] of entries) {
    const angle = (count / total) * 2 * Math.PI;
    const x1 = CX + R * Math.cos(cumAngle);
    const y1 = CY + R * Math.sin(cumAngle);
    const x2 = CX + R * Math.cos(cumAngle + angle);
    const y2 = CY + R * Math.sin(cumAngle + angle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const d = `M${CX},${CY} L${x1},${y1} A${R},${R} 0 ${largeArc},1 ${x2},${y2} Z`;
    slices.push(<path key={type} d={d} fill={clientColor(type)} opacity={0.85} />);
    cumAngle += angle;
  }

  return (
    <div className="flex items-center gap-6">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-32 h-32 flex-shrink-0">
        {slices}
      </svg>
      <div className="space-y-1">
        {entries.map(([type, count]) => (
          <div key={type} className="flex items-center gap-2 text-xs">
            <span
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ background: clientColor(type) }}
            />
            <span className="text-gray-300 capitalize">{type}</span>
            <span className="text-white font-mono ml-1">
              {count} ({((count / total) * 100).toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
