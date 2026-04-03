'use client';

/**
 * TopologyMap — Issue #52
 * SVG network topology showing peer connections between fleet nodes.
 * Circles represent nodes; lines represent peer connections.
 */

import { useState, useMemo } from 'react';

export interface TopologyNode {
  id: string;
  name: string;
  clientType: string;
  status: 'online' | 'offline' | 'syncing' | 'unknown';
  peerCount: number;
  blockHeight: number;
  syncPercent: number;
  /** IDs of fleet nodes this node is peered with */
  connectedTo: string[];
  location?: string;
}

interface TopologyMapProps {
  nodes: TopologyNode[];
  width?: number;
  height?: number;
}

const STATUS_COLORS: Record<string, string> = {
  online: '#22c55e',
  syncing: '#eab308',
  offline: '#ef4444',
  unknown: '#6b7280',
};

const CLIENT_ACCENT: Record<string, string> = {
  geth: '#64b5f6',
  erigon: '#ce93d8',
  nethermind: '#80cbc4',
  reth: '#ffb74d',
};

/** Distribute nodes in a circle */
function circleLayout(count: number, cx: number, cy: number, r: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
}

export default function TopologyMap({
  nodes,
  width = 700,
  height = 500,
}: TopologyMapProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(cx, cy) * 0.72;

  const positions = useMemo(() => {
    const layout = circleLayout(nodes.length, cx, cy, radius);
    return Object.fromEntries(nodes.map((n, i) => [n.id, layout[i]]));
  }, [nodes, cx, cy, radius]);

  // Deduplicate edges (A-B and B-A are same edge)
  const edges = useMemo(() => {
    const seen = new Set<string>();
    const result: [string, string][] = [];
    for (const node of nodes) {
      for (const peerId of node.connectedTo) {
        const key = [node.id, peerId].sort().join('|');
        if (!seen.has(key) && positions[peerId]) {
          seen.add(key);
          result.push([node.id, peerId]);
        }
      }
    }
    return result;
  }, [nodes, positions]);

  const activeNode = selected ?? hovered;

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Network Topology</h2>
        <div className="flex gap-4 text-xs text-gray-400">
          {Object.entries(STATUS_COLORS).map(([s, c]) => (
            <span key={s} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full inline-block" style={{ background: c }} />
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full"
          style={{ maxHeight: height }}
        >
          {/* Edges */}
          {edges.map(([aId, bId]) => {
            const a = positions[aId];
            const b = positions[bId];
            const isHighlighted =
              activeNode === aId || activeNode === bId;
            return (
              <line
                key={`${aId}-${bId}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={isHighlighted ? '#22d3ee' : '#374151'}
                strokeWidth={isHighlighted ? 2 : 1}
                strokeOpacity={isHighlighted ? 0.9 : 0.5}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const pos = positions[node.id];
            if (!pos) return null;
            const isActive = activeNode === node.id;
            const isConnected =
              activeNode != null &&
              activeNode !== node.id &&
              (nodes.find((n) => n.id === activeNode)?.connectedTo.includes(node.id) ||
                node.connectedTo.includes(activeNode ?? ''));

            const accent = CLIENT_ACCENT[node.clientType.toLowerCase()] ?? '#9ca3af';
            const statusColor = STATUS_COLORS[node.status] ?? '#6b7280';
            const nodeR = isActive ? 22 : isConnected ? 18 : 14;

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x},${pos.y})`}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHovered(node.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() =>
                  setSelected((prev) => (prev === node.id ? null : node.id))
                }
              >
                {/* Outer ring (status) */}
                <circle
                  r={nodeR + 4}
                  fill="none"
                  stroke={statusColor}
                  strokeWidth={isActive ? 3 : 2}
                  opacity={isActive ? 1 : 0.7}
                />
                {/* Inner fill (client accent) */}
                <circle r={nodeR} fill={accent} opacity={isActive ? 1 : 0.85} />
                {/* Node label */}
                <text
                  textAnchor="middle"
                  dy="0.35em"
                  fontSize={isActive ? 10 : 8}
                  fill="#111"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {node.clientType.slice(0, 4).toUpperCase()}
                </text>
                {/* Name below */}
                <text
                  textAnchor="middle"
                  y={nodeR + 14}
                  fontSize={9}
                  fill={isActive ? '#f3f4f6' : '#9ca3af'}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {node.name.length > 12 ? node.name.slice(0, 11) + '…' : node.name}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detail card for selected/hovered */}
      {activeNode && (() => {
        const n = nodes.find((x) => x.id === activeNode);
        if (!n) return null;
        return (
          <div className="mt-4 bg-gray-700 rounded-lg p-4 text-sm">
            <div className="flex justify-between items-start flex-wrap gap-2">
              <div>
                <p className="text-white font-semibold">{n.name}</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {n.clientType} · {n.status} · {n.location ?? 'unknown location'}
                </p>
              </div>
              <a
                href={`/nodes/${n.id}`}
                className="text-xs text-cyan-400 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                View Node →
              </a>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <p className="text-gray-400 text-xs">Block</p>
                <p className="text-white font-mono text-xs">{n.blockHeight.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Peers</p>
                <p className="text-white font-mono text-xs">{n.peerCount}</p>
              </div>
              <div>
                <p className="text-gray-400 text-xs">Sync</p>
                <p className="text-white font-mono text-xs">{n.syncPercent.toFixed(1)}%</p>
              </div>
            </div>
            {n.connectedTo.length > 0 && (
              <p className="text-gray-400 text-xs mt-2">
                Connected to:{' '}
                {n.connectedTo
                  .map((id) => nodes.find((x) => x.id === id)?.name ?? id)
                  .join(', ')}
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
