'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Layers, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ComparisonPanelProps {
  currentNodeId: string;
  currentNodeName: string;
}

interface FleetNode {
  id: string;
  name: string;
  blockHeight?: number;
  syncPercent?: number;
  peerCount?: number;
  status?: string;
  lastSeen?: string;
  state_scheme?: string;
  client_type?: string;
  network?: string;
}

interface ParsedNodeName {
  server: string;
  client: string;
  network: string;
  suffix: string;
  raw: string;
}

function parseNodeName(name: string): ParsedNodeName {
  // Pattern: {server}-{client}-{network}-{suffix}
  // Examples: xdc02-gp5-mainnet-109, prod-erigon-apothem-213, xdc01-nm-mainnet-125
  const parts = name.split('-');
  if (parts.length >= 4) {
    return {
      server: parts[0],
      client: parts[1],
      network: parts[2],
      suffix: parts.slice(3).join('-'),
      raw: name,
    };
  } else if (parts.length === 3) {
    return { server: parts[0], client: parts[1], network: parts[2], suffix: '', raw: name };
  } else if (parts.length === 2) {
    return { server: parts[0], client: parts[1], network: '', suffix: '', raw: name };
  }
  return { server: name, client: '', network: '', suffix: '', raw: name };
}

function getClientStyle(client: string): { bg: string; text: string; label: string } {
  const c = client.toLowerCase();
  if (c === 'gp5' || c === 'geth-pr5') return { bg: 'bg-sky-500/15', text: 'text-sky-400', label: 'GP5' };
  if (c === 'geth' || c === 'xdc') return { bg: 'bg-blue-500/15', text: 'text-blue-400', label: client.toUpperCase() };
  if (c === 'erigon') return { bg: 'bg-orange-500/15', text: 'text-orange-400', label: 'Erigon' };
  if (c === 'nm' || c === 'nethermind') return { bg: 'bg-purple-500/15', text: 'text-purple-400', label: c === 'nm' ? 'NM' : 'Nethermind' };
  if (c === 'reth') return { bg: 'bg-green-500/15', text: 'text-green-400', label: 'Reth' };
  return { bg: 'bg-white/10', text: 'text-[#94A3B8]', label: client.toUpperCase() || '?' };
}

function getNetworkStyle(network: string): { bg: string; text: string } {
  const n = network.toLowerCase();
  if (n === 'mainnet') return { bg: 'bg-blue-500/15', text: 'text-blue-400' };
  if (n === 'apothem' || n === 'testnet') return { bg: 'bg-purple-500/15', text: 'text-purple-400' };
  return { bg: 'bg-white/10', text: 'text-[#94A3B8]' };
}

function getNodeStatus(lastSeen?: string, statusStr?: string): 'healthy' | 'syncing' | 'offline' {
  if (statusStr === 'syncing') return 'syncing';
  if (!lastSeen) return 'offline';
  const diff = Date.now() - new Date(lastSeen).getTime();
  if (diff < 2 * 60 * 1000) return 'healthy';
  if (diff < 5 * 60 * 1000) return 'syncing';
  return 'offline';
}

function StatusDot({ status }: { status: 'healthy' | 'syncing' | 'offline' }) {
  const classes = {
    healthy: 'bg-[#10B981]',
    syncing: 'bg-[#F59E0B] animate-pulse',
    offline: 'bg-[#EF4444] animate-pulse',
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${classes[status]}`} />;
}

function formatBlockHeight(n: number) {
  if (!n) return '—';
  return n.toLocaleString();
}

function BlockDelta({ current, other }: { current: number; other: number }) {
  if (!current || !other) return null;
  const delta = other - current;
  if (Math.abs(delta) < 10) return <span className="text-xs text-[#64748B]">≈ same</span>;
  const formatted = Math.abs(delta).toLocaleString();
  if (delta > 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-[#10B981]">
        <TrendingUp className="w-3 h-3" />+{formatted} ahead
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-xs text-[#EF4444]">
      <TrendingDown className="w-3 h-3" />-{formatted} behind
    </span>
  );
}

function getBlockHeightColor(blockHeight: number, maxHeight: number): string {
  if (!blockHeight || !maxHeight) return 'text-[#94A3B8]';
  const delta = maxHeight - blockHeight;
  if (delta <= 10) return 'text-[#10B981]';
  if (delta <= 500) return 'text-[#F59E0B]';
  return 'text-[#EF4444]';
}

function NodeCard({
  node,
  parsed,
  isCurrent,
  maxBlockHeight,
  currentBlockHeight,
}: {
  node: FleetNode;
  parsed: ParsedNodeName;
  isCurrent: boolean;
  maxBlockHeight: number;
  currentBlockHeight: number;
}) {
  const nodeStatus = getNodeStatus(node.lastSeen, node.status);
  const clientStyle = getClientStyle(parsed.client);
  const networkStyle = getNetworkStyle(parsed.network);
  const blockHeight = node.blockHeight ?? 0;
  const syncPct = node.syncPercent ?? 0;
  const stateScheme = node.state_scheme;
  const isPBSS = stateScheme === 'path';
  const blockColor = getBlockHeightColor(blockHeight, maxBlockHeight);

  return (
    <div
      className={`relative flex-shrink-0 w-56 rounded-xl p-4 border transition-all duration-300 bg-white/5 ${
        isCurrent
          ? 'border-[#1E90FF]/60 shadow-[0_0_16px_rgba(30,144,255,0.25)] ring-1 ring-[#1E90FF]/30'
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      {isCurrent && (
        <span className="absolute -top-2 left-3 px-2 py-0.5 bg-[#1E90FF] text-white text-[10px] font-semibold rounded-full">
          This Node
        </span>
      )}

      {/* Node name */}
      <Link
        href={`/nodes/${node.id}`}
        className="block text-sm font-semibold text-[#F1F5F9] hover:text-[#1E90FF] transition-colors truncate mb-2"
        title={node.name}
      >
        {node.name}
      </Link>

      {/* Badges row */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${clientStyle.bg} ${clientStyle.text}`}>
          {clientStyle.label}
        </span>
        {parsed.network && (
          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${networkStyle.bg} ${networkStyle.text}`}>
            {parsed.network}
          </span>
        )}
        {stateScheme && (
          <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${isPBSS ? 'bg-purple-500/15 text-purple-400' : 'bg-green-500/15 text-green-400'}`}>
            {isPBSS ? 'PBSS' : 'HBSS'}
          </span>
        )}
        <StatusDot status={nodeStatus} />
      </div>

      {/* Block height */}
      <div className="mb-2">
        <div className="text-[10px] text-[#64748B] uppercase tracking-wider mb-0.5">Block Height</div>
        <div className={`text-base font-bold font-mono ${blockColor}`}>
          {formatBlockHeight(blockHeight)}
        </div>
        {!isCurrent && currentBlockHeight > 0 && blockHeight > 0 && (
          <BlockDelta current={currentBlockHeight} other={blockHeight} />
        )}
      </div>

      {/* Sync progress */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-[10px] text-[#64748B] uppercase tracking-wider mb-1">
          <span>Sync</span>
          <span>{syncPct.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${syncPct >= 99.9 ? 'bg-[#10B981]' : syncPct > 90 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'}`}
            style={{ width: `${Math.min(100, syncPct)}%` }}
          />
        </div>
      </div>

      {/* Peer count */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#64748B]">Peers</span>
        <span className={`font-mono font-semibold ${(node.peerCount ?? 0) > 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
          {node.peerCount ?? 0}
        </span>
      </div>
    </div>
  );
}

export default function ComparisonPanel({ currentNodeId, currentNodeName }: ComparisonPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const [nodes, setNodes] = useState<FleetNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFleet() {
      try {
        const res = await fetch('/api/v1/fleet/status', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const allNodes: FleetNode[] = data?.data?.nodes ?? data?.nodes ?? [];
        setNodes(allNodes);
      } catch (e) {
        setError('Failed to load fleet data');
      } finally {
        setLoading(false);
      }
    }

    fetchFleet();
    const iv = setInterval(fetchFleet, 30000);
    return () => clearInterval(iv);
  }, []);

  const currentParsed = parseNodeName(currentNodeName);

  // Find the current node's block height from fleet data
  const currentFleetNode = nodes.find((n) => n.id === currentNodeId || n.name === currentNodeName);
  const currentBlockHeight = currentFleetNode?.blockHeight ?? 0;

  // Same server group
  const sameServerNodes = nodes.filter((n) => {
    if (!n.name) return false;
    const p = parseNodeName(n.name);
    return p.server === currentParsed.server;
  });

  // Same client, different network group (if enough nodes)
  const sameClientNodes = nodes.filter((n) => {
    if (!n.name) return false;
    const p = parseNodeName(n.name);
    return (
      p.client === currentParsed.client &&
      p.server === currentParsed.server &&
      p.network !== currentParsed.network &&
      p.network !== ''
    );
  });

  // Max block height across same-server group for color coding
  const maxBlockHeight = Math.max(
    ...sameServerNodes.map((n) => n.blockHeight ?? 0).filter(Boolean),
    currentBlockHeight,
  );

  const hasComparisons = sameServerNodes.length > 1 || sameClientNodes.length > 0;

  if (loading) {
    return (
      <div className="card-xdc animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10" />
          <div className="h-5 bg-white/10 rounded w-40" />
        </div>
      </div>
    );
  }

  if (error || !hasComparisons) {
    // Silently hide if no peers to compare or error loading
    return null;
  }

  return (
    <div className="card-xdc">
      {/* Header */}
      <button
        className="flex items-center justify-between w-full"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1E90FF]/10 flex items-center justify-center">
            <Layers className="w-5 h-5 text-[#1E90FF]" />
          </div>
          <div className="text-left">
            <h2 className="text-lg font-semibold">Fleet Comparison</h2>
            <p className="text-xs text-[#64748B]">
              {sameServerNodes.length} node{sameServerNodes.length !== 1 ? 's' : ''} on server{' '}
              <span className="text-[#F1F5F9] font-medium">{currentParsed.server}</span>
            </p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-[#64748B]" />
        ) : (
          <ChevronDown className="w-5 h-5 text-[#64748B]" />
        )}
      </button>

      {expanded && (
        <div className="mt-5 space-y-6">
          {/* Same Server Group */}
          {sameServerNodes.length > 1 && (
            <div>
              <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1E90FF]" />
                Same Server — {currentParsed.server}
              </div>
              {/* Horizontal scroll on mobile, grid on desktop */}
              <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:overflow-x-visible md:pb-0 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
                {sameServerNodes.map((n) => {
                  const parsed = parseNodeName(n.name);
                  const isCurrent = n.id === currentNodeId || n.name === currentNodeName;
                  return (
                    <NodeCard
                      key={n.id || n.name}
                      node={n}
                      parsed={parsed}
                      isCurrent={isCurrent}
                      maxBlockHeight={maxBlockHeight}
                      currentBlockHeight={currentBlockHeight}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Same Client, Different Network */}
          {sameClientNodes.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6]" />
                Same Client ({currentParsed.client.toUpperCase()}) — Cross Network
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:overflow-x-visible md:pb-0 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
                {/* Current node first */}
                {currentFleetNode && (
                  <NodeCard
                    key={currentFleetNode.id || currentFleetNode.name}
                    node={currentFleetNode}
                    parsed={currentParsed}
                    isCurrent={true}
                    maxBlockHeight={maxBlockHeight}
                    currentBlockHeight={currentBlockHeight}
                  />
                )}
                {sameClientNodes.map((n) => {
                  const parsed = parseNodeName(n.name);
                  return (
                    <NodeCard
                      key={n.id || n.name}
                      node={n}
                      parsed={parsed}
                      isCurrent={false}
                      maxBlockHeight={maxBlockHeight}
                      currentBlockHeight={currentBlockHeight}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
