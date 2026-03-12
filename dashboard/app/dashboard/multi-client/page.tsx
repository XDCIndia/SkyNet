'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Server, 
  Cpu, 
  HardDrive, 
  Users, 
  Activity,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Layers
} from 'lucide-react';

interface Node {
  id: string;
  name: string;
  client_type: string;
  latest_block: number;
  peer_count: number;
  is_syncing: boolean;
  sync_percent?: number;
  cpu_percent?: number;
  memory_percent?: number;
  status: string;
  last_heartbeat: string;
}

interface GroupedNodes {
  [serverName: string]: {
    [clientType: string]: Node | null;
  };
}

const CLIENT_TYPES = ['geth', 'erigon', 'nethermind', 'reth'];
const CLIENT_LABELS: { [key: string]: string } = {
  geth: 'Geth (GP5)',
  erigon: 'Erigon',
  nethermind: 'Nethermind',
  reth: 'Reth'
};

export default function MultiClientPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchNodes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/nodes?limit=100');
      if (!res.ok) throw new Error('Failed to fetch nodes');
      const data = await res.json();
      if (data.success) {
        setNodes(data.nodes || []);
        setLastUpdated(new Date());
        setError(null);
      } else {
        throw new Error(data.error || 'Failed to fetch nodes');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNodes();
    const interval = setInterval(fetchNodes, 30000);
    return () => clearInterval(interval);
  }, []);

  // Group nodes by server (extract server prefix from name like "xdc01-gp5" -> "xdc01")
  const groupedNodes: GroupedNodes = useMemo(() => {
    const grouped: GroupedNodes = {};
    
    nodes.forEach(node => {
      // Extract server name (e.g., "xdc01" from "xdc01-gp5" or "xdc01.erigon")
      const serverMatch = node.name.match(/^([a-zA-Z0-9]+)[-.]/);
      const serverName = serverMatch ? serverMatch[1] : node.name;
      
      if (!grouped[serverName]) {
        grouped[serverName] = {};
      }
      
      const clientType = node.client_type?.toLowerCase() || 'unknown';
      // Map client types
      let normalizedType = clientType;
      if (clientType.includes('geth') || clientType === 'xdc') normalizedType = 'geth';
      else if (clientType.includes('erigon')) normalizedType = 'erigon';
      else if (clientType.includes('nethermind') || clientType === 'nm') normalizedType = 'nethermind';
      else if (clientType.includes('reth')) normalizedType = 'reth';
      
      if (CLIENT_TYPES.includes(normalizedType)) {
        grouped[serverName][normalizedType] = node;
      }
    });
    
    return grouped;
  }, [nodes]);

  // Calculate block height differences for a server group
  const getBlockHeightStats = (clients: { [clientType: string]: Node | null }) => {
    const heights: number[] = [];
    CLIENT_TYPES.forEach(type => {
      const node = clients[type];
      if (node?.latest_block) {
        heights.push(node.latest_block);
      }
    });
    
    if (heights.length < 2) return { max: 0, min: 0, diff: 0 };
    
    const max = Math.max(...heights);
    const min = Math.min(...heights);
    return { max, min, diff: max - min };
  };

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString();
  };

  const formatPercent = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '-';
    return `${num.toFixed(1)}%`;
  };

  const getBlockHeightClass = (height: number | null, diff: number) => {
    if (!height) return 'text-gray-400';
    if (diff > 100) return 'text-red-500 font-bold';
    if (diff > 10) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getHealthIcon = (diff: number) => {
    if (diff > 100) return <AlertTriangle className="w-5 h-5 text-red-500" />;
    if (diff > 10) return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    return <CheckCircle className="w-5 h-5 text-green-500" />;
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Layers className="w-6 h-6 text-[var(--accent-blue)]" />
            Multi-Client Comparison
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Compare metrics across different XDC clients on the same servers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-muted)]">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchNodes}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-blue)] text-white rounded-lg hover:bg-[var(--accent-blue)]/90 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500">
          {error}
        </div>
      )}

      {/* Legend */}
      <div className="mb-6 flex flex-wrap items-center gap-4 text-sm">
        <span className="text-[var(--text-muted)]">Block height difference:</span>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span className="text-[var(--text-secondary)]">≤ 10 blocks (healthy)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="text-[var(--text-secondary)]">11-100 blocks (warning)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-[var(--text-secondary)]">&gt; 100 blocks (critical)</span>
        </div>
      </div>

      {/* Comparison Tables */}
      {Object.keys(groupedNodes).length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)]">
          {loading ? 'Loading nodes...' : 'No nodes found with matching client types'}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedNodes).map(([serverName, clients]) => {
            const { diff } = getBlockHeightStats(clients);
            const hasMultipleClients = Object.values(clients).filter(Boolean).length >= 2;
            
            return (
              <div key={serverName} className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                {/* Server Header */}
                <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Server className="w-5 h-5 text-[var(--accent-blue)]" />
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">{serverName}</h2>
                    <span className="px-2 py-0.5 bg-[var(--bg-hover)] rounded text-xs text-[var(--text-muted)]">
                      {Object.values(clients).filter(Boolean).length} clients
                    </span>
                  </div>
                  {hasMultipleClients && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--text-secondary)]">Height diff:</span>
                      <span className={`text-sm font-medium ${diff > 100 ? 'text-red-500' : diff > 10 ? 'text-yellow-500' : 'text-green-500'}`}>
                        {diff.toLocaleString()} blocks
                      </span>
                      {getHealthIcon(diff)}
                    </div>
                  )}
                </div>

                {/* Metrics Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[var(--bg-hover)]">
                        <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider sticky left-0 bg-[var(--bg-hover)]">
                          Metric
                        </th>
                        {CLIENT_TYPES.map(type => (
                          <th key={type} className="px-4 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider min-w-[140px]">
                            {CLIENT_LABELS[type]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {/* Block Height */}
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-[var(--text-secondary)] sticky left-0 bg-[var(--bg-card)]">
                          Block Height
                        </td>
                        {CLIENT_TYPES.map(type => {
                          const node = clients[type];
                          return (
                            <td key={type} className="px-4 py-3 text-center">
                              <span className={getBlockHeightClass(node?.latest_block, diff)}>
                                {formatNumber(node?.latest_block)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Peers */}
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-[var(--text-secondary)] sticky left-0 bg-[var(--bg-card)] flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          Peers
                        </td>
                        {CLIENT_TYPES.map(type => {
                          const node = clients[type];
                          const peers = node?.peer_count;
                          const peerClass = peers === null || peers === undefined 
                            ? 'text-gray-400' 
                            : peers < 5 
                              ? 'text-red-500' 
                              : peers < 10 
                                ? 'text-yellow-500' 
                                : 'text-green-500';
                          return (
                            <td key={type} className="px-4 py-3 text-center">
                              <span className={peerClass}>
                                {formatNumber(peers)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Sync % */}
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-[var(--text-secondary)] sticky left-0 bg-[var(--bg-card)] flex items-center gap-2">
                          <Activity className="w-4 h-4" />
                          Sync %
                        </td>
                        {CLIENT_TYPES.map(type => {
                          const node = clients[type];
                          const sync = node?.sync_percent;
                          const isSyncing = node?.is_syncing;
                          return (
                            <td key={type} className="px-4 py-3 text-center">
                              {node ? (
                                <span className={isSyncing ? 'text-yellow-500' : sync === 100 ? 'text-green-500' : 'text-[var(--text-secondary)]'}>
                                  {isSyncing ? (sync ? `${sync.toFixed(1)}%` : 'Syncing...') : '100%'}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>

                      {/* CPU % */}
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-[var(--text-secondary)] sticky left-0 bg-[var(--bg-card)] flex items-center gap-2">
                          <Cpu className="w-4 h-4" />
                          CPU %
                        </td>
                        {CLIENT_TYPES.map(type => {
                          const node = clients[type];
                          const cpu = node?.cpu_percent;
                          const cpuClass = cpu === null || cpu === undefined 
                            ? 'text-gray-400' 
                            : cpu > 80 
                              ? 'text-red-500' 
                              : cpu > 50 
                                ? 'text-yellow-500' 
                                : 'text-green-500';
                          return (
                            <td key={type} className="px-4 py-3 text-center">
                              <span className={cpuClass}>
                                {formatPercent(cpu)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Memory % */}
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-[var(--text-secondary)] sticky left-0 bg-[var(--bg-card)] flex items-center gap-2">
                          <HardDrive className="w-4 h-4" />
                          RAM %
                        </td>
                        {CLIENT_TYPES.map(type => {
                          const node = clients[type];
                          const mem = node?.memory_percent;
                          const memClass = mem === null || mem === undefined 
                            ? 'text-gray-400' 
                            : mem > 90 
                              ? 'text-red-500' 
                              : mem > 70 
                                ? 'text-yellow-500' 
                                : 'text-green-500';
                          return (
                            <td key={type} className="px-4 py-3 text-center">
                              <span className={memClass}>
                                {formatPercent(mem)}
                              </span>
                            </td>
                          );
                        })}
                      </tr>

                      {/* Status */}
                      <tr>
                        <td className="px-4 py-3 text-sm font-medium text-[var(--text-secondary)] sticky left-0 bg-[var(--bg-card)]">
                          Status
                        </td>
                        {CLIENT_TYPES.map(type => {
                          const node = clients[type];
                          const status = node?.status;
                          return (
                            <td key={type} className="px-4 py-3 text-center">
                              {node ? (
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                                  status === 'healthy' 
                                    ? 'bg-green-500/20 text-green-500' 
                                    : status === 'warning'
                                      ? 'bg-yellow-500/20 text-yellow-500'
                                      : 'bg-red-500/20 text-red-500'
                                }`}>
                                  {status || 'unknown'}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-xs">-</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
