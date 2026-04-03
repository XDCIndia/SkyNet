'use client';

/**
 * NodeComparison — Issue #54
 * Select 2–3 nodes and view side-by-side metrics comparison.
 */

import { useEffect, useState } from 'react';

interface NodeSummary {
  id: string;
  name: string;
  client_type?: string;
  client_version?: string;
  block_height?: number;
  peer_count?: number;
  sync_percent?: number;
  is_syncing?: boolean;
  cpu_percent?: number;
  memory_percent?: number;
  disk_percent?: number;
  uptime?: number;
  is_active?: boolean;
}

interface Props {
  nodes?: NodeSummary[];
}

const MAX_SELECT = 3;

function StatCell({
  label,
  values,
  format = (v: any) => String(v ?? '—'),
  highlight = false,
}: {
  label: string;
  values: (string | number | null | undefined)[];
  format?: (v: any) => string;
  highlight?: boolean;
}) {
  // Find best value index for highlighting
  const numericVals = values.map((v) => (v != null ? Number(v) : null));
  const maxVal = Math.max(...numericVals.filter((v) => v != null) as number[]);

  return (
    <tr className="border-b border-gray-700">
      <td className="text-gray-400 text-xs py-2 pr-4 whitespace-nowrap">{label}</td>
      {values.map((v, i) => {
        const isMax = highlight && numericVals[i] === maxVal && maxVal > 0;
        return (
          <td
            key={i}
            className={`text-xs py-2 px-2 font-mono text-center ${
              isMax ? 'text-green-400 font-bold' : 'text-white'
            }`}
          >
            {format(v)}
          </td>
        );
      })}
    </tr>
  );
}

export default function NodeComparison({ nodes: propNodes }: Props) {
  const [allNodes, setAllNodes] = useState<NodeSummary[]>(propNodes ?? []);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(!propNodes);

  useEffect(() => {
    if (propNodes) return;
    setLoading(true);
    fetch('/api/fleet')
      .then((r) => r.json())
      .then((json) => setAllNodes(json.nodes ?? json ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [propNodes]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= MAX_SELECT) return prev; // cap at MAX_SELECT
      return [...prev, id];
    });
  };

  const comparedNodes = allNodes.filter((n) => selected.includes(n.id));

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-3">Node Comparison</h2>
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-lg font-semibold text-white mb-4">Node Comparison</h2>
      <p className="text-xs text-gray-400 mb-3">
        Select up to {MAX_SELECT} nodes to compare side-by-side.
      </p>

      {/* Node selector chips */}
      <div className="flex flex-wrap gap-2 mb-5">
        {allNodes.map((n) => {
          const isSelected = selected.includes(n.id);
          const disabled = !isSelected && selected.length >= MAX_SELECT;
          return (
            <button
              key={n.id}
              onClick={() => !disabled && toggleSelect(n.id)}
              className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                isSelected
                  ? 'bg-cyan-600 border-cyan-500 text-white'
                  : disabled
                  ? 'bg-gray-700 border-gray-600 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-cyan-600'
              }`}
            >
              {n.name}
            </button>
          );
        })}
      </div>

      {/* Comparison table */}
      {comparedNodes.length >= 2 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="text-left text-xs text-gray-400 py-2 pr-4">Metric</th>
                {comparedNodes.map((n) => (
                  <th
                    key={n.id}
                    className="text-center text-xs text-cyan-300 py-2 px-2 font-medium"
                  >
                    {n.name}
                    <br />
                    <span className="text-gray-500 font-normal text-[10px]">
                      {n.client_type ?? 'unknown'}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <StatCell
                label="Client Version"
                values={comparedNodes.map((n) => n.client_version)}
                format={(v) => v ?? '—'}
              />
              <StatCell
                label="Block Height"
                values={comparedNodes.map((n) => n.block_height)}
                format={(v) => (v != null ? Number(v).toLocaleString() : '—')}
                highlight
              />
              <StatCell
                label="Sync %"
                values={comparedNodes.map((n) => n.sync_percent)}
                format={(v) => (v != null ? `${Number(v).toFixed(1)}%` : '—')}
                highlight
              />
              <StatCell
                label="Syncing"
                values={comparedNodes.map((n) => n.is_syncing)}
                format={(v) => (v ? '🔄 Yes' : '✅ No')}
              />
              <StatCell
                label="Peers"
                values={comparedNodes.map((n) => n.peer_count)}
                format={(v) => (v != null ? String(v) : '—')}
                highlight
              />
              <StatCell
                label="CPU %"
                values={comparedNodes.map((n) => n.cpu_percent)}
                format={(v) => (v != null ? `${Number(v).toFixed(1)}%` : '—')}
              />
              <StatCell
                label="Memory %"
                values={comparedNodes.map((n) => n.memory_percent)}
                format={(v) => (v != null ? `${Number(v).toFixed(1)}%` : '—')}
              />
              <StatCell
                label="Disk %"
                values={comparedNodes.map((n) => n.disk_percent)}
                format={(v) => (v != null ? `${Number(v).toFixed(1)}%` : '—')}
              />
              <StatCell
                label="Status"
                values={comparedNodes.map((n) => n.is_active)}
                format={(v) => (v ? '🟢 Online' : '🔴 Offline')}
              />
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-gray-700 rounded-lg p-4 text-center">
          <p className="text-gray-400 text-sm">
            {selected.length === 0
              ? 'Select at least 2 nodes above to compare.'
              : 'Select one more node to start comparison.'}
          </p>
        </div>
      )}
    </div>
  );
}
