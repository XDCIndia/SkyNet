'use client';

/**
 * ComparisonTable — Issue #41
 * Side-by-side fleet comparison: block, peers, sync%, disk, score. Sortable.
 */

import { useState } from 'react';

export interface FleetNode {
  id: string;
  name: string;
  clientType: string;
  blockHeight: number;
  networkHeight: number;
  syncPercent: number;
  peerCount: number;
  diskPercent: number;
  diskUsedGb: number;
  diskTotalGb: number;
  healthScore: number;
  status: 'online' | 'offline' | 'syncing' | 'unknown';
  location?: string;
}

type SortKey = keyof Pick<FleetNode, 'name' | 'blockHeight' | 'syncPercent' | 'peerCount' | 'diskPercent' | 'healthScore'>;

interface ComparisonTableProps {
  nodes: FleetNode[];
  networkHeight?: number;
}

function statusDot(status: FleetNode['status']) {
  const map: Record<string, string> = {
    online: 'bg-green-500',
    syncing: 'bg-yellow-500',
    offline: 'bg-red-500',
    unknown: 'bg-gray-500',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${map[status] ?? 'bg-gray-500'}`} />;
}

function scoreColor(score: number) {
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

function diskBar(pct: number) {
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-cyan-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 bg-gray-700 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs">{pct.toFixed(0)}%</span>
    </div>
  );
}

function syncBar(pct: number) {
  const color = pct >= 100 ? 'bg-green-500' : pct >= 90 ? 'bg-cyan-500' : 'bg-yellow-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 bg-gray-700 rounded-full h-1.5">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs">{pct.toFixed(1)}%</span>
    </div>
  );
}

type SortDir = 'asc' | 'desc';

export default function ComparisonTable({ nodes, networkHeight }: ComparisonTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('healthScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

  const topBlock = networkHeight ?? Math.max(...nodes.map((n) => n.networkHeight), 0);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return <span className="text-gray-600">⇅</span>;
    return sortDir === 'asc' ? '▲' : '▼';
  };

  const filtered = nodes
    .filter((n) => n.name.toLowerCase().includes(search.toLowerCase()) || n.clientType.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const av = a[sortKey] as number | string;
      const bv = b[sortKey] as number | string;
      const cmp = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const th = (label: string, key: SortKey) => (
    <th
      className="text-left py-2 pr-4 text-xs text-gray-400 cursor-pointer select-none hover:text-white whitespace-nowrap"
      onClick={() => toggleSort(key)}
    >
      {label} {sortArrow(key)}
    </th>
  );

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-white">Fleet Comparison</h2>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter nodes…"
          className="text-sm bg-gray-700 text-white rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-cyan-500 w-44"
        />
      </div>

      {/* Summary banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Nodes', value: nodes.length },
          { label: 'Online', value: nodes.filter((n) => n.status === 'online').length },
          { label: 'Syncing', value: nodes.filter((n) => n.status === 'syncing').length },
          { label: 'Offline', value: nodes.filter((n) => n.status === 'offline').length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-700 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-xs text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="text-left py-2 pr-4 text-xs text-gray-400 w-4">#</th>
              {th('Node', 'name')}
              <th className="text-left py-2 pr-4 text-xs text-gray-400">Client</th>
              <th className="text-left py-2 pr-4 text-xs text-gray-400">Status</th>
              {th('Block', 'blockHeight')}
              {th('Peers', 'peerCount')}
              {th('Sync', 'syncPercent')}
              {th('Disk', 'diskPercent')}
              {th('Score', 'healthScore')}
            </tr>
          </thead>
          <tbody>
            {filtered.map((node, idx) => (
              <tr
                key={node.id}
                className="border-b border-gray-700/50 hover:bg-gray-700/40 cursor-pointer"
                onClick={() => (window.location.href = `/nodes/${node.id}`)}
              >
                <td className="py-2 pr-4 text-gray-500 text-xs">{idx + 1}</td>
                <td className="py-2 pr-4">
                  <a href={`/nodes/${node.id}`} className="text-cyan-300 hover:underline font-medium">
                    {node.name}
                  </a>
                  {node.location && (
                    <span className="block text-xs text-gray-500">{node.location}</span>
                  )}
                </td>
                <td className="py-2 pr-4">
                  <span className="text-xs bg-gray-700 px-2 py-0.5 rounded-full text-gray-300">
                    {node.clientType}
                  </span>
                </td>
                <td className="py-2 pr-4">
                  <div className="flex items-center gap-1.5">
                    {statusDot(node.status)}
                    <span className="text-xs capitalize">{node.status}</span>
                  </div>
                </td>
                <td className="py-2 pr-4 font-mono text-xs">
                  {node.blockHeight.toLocaleString()}
                  {topBlock > 0 && node.blockHeight < topBlock && (
                    <span className="block text-red-400">
                      -{(topBlock - node.blockHeight).toLocaleString()}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 font-mono text-xs">{node.peerCount}</td>
                <td className="py-2 pr-4">{syncBar(node.syncPercent)}</td>
                <td className="py-2 pr-4">{diskBar(node.diskPercent)}</td>
                <td className="py-2">
                  <span className={`font-bold text-sm ${scoreColor(node.healthScore)}`}>
                    {node.healthScore}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="text-center text-gray-500 py-6 text-sm">No nodes match your filter.</p>
        )}
      </div>
    </div>
  );
}
