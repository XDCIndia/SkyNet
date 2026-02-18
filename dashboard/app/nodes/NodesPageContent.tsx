'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Server, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import ClientDistributionChart from '@/components/ClientDistributionChart';
import NetworkFilter from '@/components/NetworkFilter';
import type { SkyNetNode, FleetStatus } from '@/lib/types';

/**
 * SkyNet Nodes Page Content Component
 * Displays fleet overview with stats, client distribution, network filter, and node cards
 * Auto-refreshes every 30 seconds
 */
export default function NodesPageContent() {
  const [nodes, setNodes] = useState<SkyNetNode[]>([]);
  const searchParams = useSearchParams();
  const [fleetStatus, setFleetStatus] = useState<FleetStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterNetwork, setFilterNetwork] = useState(() => searchParams.get('network') || 'all');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Sync filter to URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (filterNetwork !== 'all') params.set('network', filterNetwork);
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [filterNetwork]);

  // Fetch fleet status
  const fetchFleetStatus = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/v1/fleet/status', { cache: 'no-store' });
      
      if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch fleet status');
      }
      
      const apiNodes = data.data?.nodes || [];
      
      // Map API response to SkyNetNode interface
      const mappedNodes: SkyNetNode[] = apiNodes.map((node: any) => ({
        id: node.id || '',
        name: node.name || 'Unknown',
        status: node.status || 'offline',
        clientType: node.clientType || node.client_type || 'unknown',
        clientVersion: node.clientVersion || node.client_version || 'Unknown',
        blockHeight: node.blockHeight || 0,
        peerCount: node.peerCount || 0,
        syncPercent: node.syncPercent ?? 0,
        network: node.network || 'mainnet',
        region: node.region || 'unknown',
        lastSeen: node.lastSeen || new Date().toISOString(),
        uptime: node.uptime || 0,
        cpuPercent: node.cpuPercent ?? 0,
        memoryPercent: node.memoryPercent ?? 0,
        diskPercent: node.diskPercent ?? 0,
      }));
      
      setNodes(mappedNodes);
      
      // Calculate fleet status
      const fleetMaxBlock = Math.max(...mappedNodes.map(n => n.blockHeight), 0);
      const healthyCount = mappedNodes.filter(n => n.status === 'healthy').length;
      const syncingCount = mappedNodes.filter(n => n.status === 'syncing').length;
      const offlineCount = mappedNodes.filter(n => n.status === 'offline').length;
      
      // Calculate client distribution
      const clientCounts: Record<string, number> = {};
      mappedNodes.forEach(node => {
        const client = node.clientType.toLowerCase();
        clientCounts[client] = (clientCounts[client] || 0) + 1;
      });
      
      const clientColors: Record<string, string> = {
        geth: '#1E90FF',
        nethermind: '#10B981',
        erigon: '#F59E0B',
        unknown: '#6B7280',
      };
      
      const clientDistribution = Object.entries(clientCounts).map(([type, count]) => ({
        type,
        count,
        color: clientColors[type] || '#6B7280',
        percentage: (count / mappedNodes.length) * 100,
      }));
      
      setFleetStatus({
        totalNodes: mappedNodes.length,
        healthyNodes: healthyCount,
        syncingNodes: syncingCount,
        offlineNodes: offlineCount,
        fleetMaxBlock,
        clientDistribution,
      });
      
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching fleet status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch fleet status');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchFleetStatus();
  }, [fetchFleetStatus]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchFleetStatus();
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchFleetStatus]);

  // Filter nodes by network
  const filteredNodes = useMemo(() => {
    if (filterNetwork === 'all') {
      return nodes;
    }
    return nodes.filter(node => node.network === filterNetwork);
  }, [nodes, filterNetwork]);

  // Stats based on filtered nodes
  const stats = useMemo(() => {
    const healthy = filteredNodes.filter(n => n.status === 'healthy').length;
    const syncing = filteredNodes.filter(n => n.status === 'syncing').length;
    const offline = filteredNodes.filter(n => n.status === 'offline').length;
    const avgSyncPercent = filteredNodes.length > 0
      ? filteredNodes.reduce((sum, n) => sum + n.syncPercent, 0) / filteredNodes.length
      : 0;
    
    return {
      total: filteredNodes.length,
      healthy,
      syncing,
      offline,
      avgSyncPercent,
    };
  }, [filteredNodes]);

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-[rgba(16,185,129,0.15)] text-[#10B981] border-[rgba(16,185,129,0.3)]';
      case 'syncing':
        return 'bg-[rgba(245,158,11,0.15)] text-[#F59E0B] border-[rgba(245,158,11,0.3)]';
      case 'offline':
        return 'bg-[rgba(239,68,68,0.15)] text-[#EF4444] border-[rgba(239,68,68,0.3)]';
      default:
        return 'bg-[rgba(107,114,128,0.15)] text-[#6B7280] border-[rgba(107,114,128,0.3)]';
    }
  };

  // Get client badge color
  const getClientColor = (clientType: string) => {
    const client = clientType.toLowerCase();
    switch (client) {
      case 'geth':
        return 'bg-[rgba(30,144,255,0.15)] text-[#1E90FF]';
      case 'nethermind':
        return 'bg-[rgba(16,185,129,0.15)] text-[#10B981]';
      case 'erigon':
        return 'bg-[rgba(245,158,11,0.15)] text-[#F59E0B]';
      default:
        return 'bg-[rgba(107,114,128,0.15)] text-[#6B7280]';
    }
  };

  // Format time ago
  const formatTimeAgo = (timestamp: string): string => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#1E90FF] animate-spin" />
          <p className="text-sm text-[#6B7280]">Loading fleet status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3 max-w-md text-center">
          <div className="w-16 h-16 rounded-xl bg-[rgba(239,68,68,0.15)] flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-[#EF4444]" />
          </div>
          <h3 className="text-lg font-semibold text-[#F9FAFB]">Failed to Load Fleet Status</h3>
          <p className="text-sm text-[#6B7280]">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              fetchFleetStatus();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1E90FF] text-white hover:bg-[#1E90FF]/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#F9FAFB]">SkyNet Nodes</h1>
          <p className="text-sm text-[#6B7280] mt-1">
            Monitor and manage XDC fleet nodes
            {lastUpdated && (
              <span className="ml-2">
                • Last updated {formatTimeAgo(lastUpdated.toISOString())}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <NetworkFilter value={filterNetwork} onChange={setFilterNetwork} />
          <button
            onClick={fetchFleetStatus}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#1E90FF] text-white hover:bg-[#1E90FF]/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border bg-[#111827] border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-3 mb-2">
            <Server className="w-5 h-5 text-[#1E90FF]" />
            <span className="text-sm text-[#6B7280]">Total Nodes</span>
          </div>
          <div className="text-2xl font-bold text-[#F9FAFB]">{stats.total}</div>
        </div>

        <div className="p-4 rounded-xl border bg-[#111827] border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="w-5 h-5 text-[#10B981]" />
            <span className="text-sm text-[#6B7280]">Healthy</span>
          </div>
          <div className="text-2xl font-bold text-[#10B981]">{stats.healthy}</div>
          <div className="text-xs text-[#6B7280] mt-1">
            {stats.total > 0 ? ((stats.healthy / stats.total) * 100).toFixed(1) : 0}% of fleet
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-[#111827] border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="w-5 h-5 text-[#F59E0B]" />
            <span className="text-sm text-[#6B7280]">Syncing</span>
          </div>
          <div className="text-2xl font-bold text-[#F59E0B]">{stats.syncing}</div>
          <div className="text-xs text-[#6B7280] mt-1">
            Avg: {stats.avgSyncPercent.toFixed(1)}% synced
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-[#111827] border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
            <span className="text-sm text-[#6B7280]">Offline</span>
          </div>
          <div className="text-2xl font-bold text-[#EF4444]">{stats.offline}</div>
          <div className="text-xs text-[#6B7280] mt-1">
            {stats.total > 0 ? ((stats.offline / stats.total) * 100).toFixed(1) : 0}% of fleet
          </div>
        </div>
      </div>

      {/* Client Distribution Chart */}
      {fleetStatus && fleetStatus.clientDistribution.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border bg-[#111827] border-[rgba(255,255,255,0.06)]">
            <h3 className="text-lg font-semibold text-[#F9FAFB] mb-4">Client Distribution</h3>
            <ClientDistributionChart
              data={fleetStatus.clientDistribution}
              total={stats.total}
            />
          </div>

          {/* Fleet Max Block */}
          <div className="p-4 rounded-xl border bg-[#111827] border-[rgba(255,255,255,0.06)]">
            <h3 className="text-lg font-semibold text-[#F9FAFB] mb-4">Fleet Status</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-[rgba(30,144,255,0.1)]">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-[#1E90FF]" />
                  <span className="text-sm text-[#F9FAFB]">Max Block Height</span>
                </div>
                <span className="text-lg font-bold font-mono text-[#1E90FF]">
                  {fleetStatus.fleetMaxBlock.toLocaleString()}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[rgba(16,185,129,0.1)]">
                  <div className="text-xs text-[#6B7280] mb-1">Healthy Nodes</div>
                  <div className="text-xl font-bold text-[#10B981]">
                    {fleetStatus.healthyNodes}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[rgba(245,158,11,0.1)]">
                  <div className="text-xs text-[#6B7280] mb-1">Syncing Nodes</div>
                  <div className="text-xl font-bold text-[#F59E0B]">
                    {fleetStatus.syncingNodes}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[rgba(239,68,68,0.1)]">
                  <div className="text-xs text-[#6B7280] mb-1">Offline Nodes</div>
                  <div className="text-xl font-bold text-[#EF4444]">
                    {fleetStatus.offlineNodes}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[rgba(107,114,128,0.1)]">
                  <div className="text-xs text-[#6B7280] mb-1">Total Nodes</div>
                  <div className="text-xl font-bold text-[#F9FAFB]">
                    {fleetStatus.totalNodes}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Node Cards Grid */}
      <div>
        <h3 className="text-lg font-semibold text-[#F9FAFB] mb-4">
          Nodes {filterNetwork !== 'all' && `(${filterNetwork})`}
        </h3>
        
        {filteredNodes.length === 0 ? (
          <div className="flex items-center justify-center py-12 rounded-xl border bg-[#111827] border-[rgba(255,255,255,0.06)]">
            <p className="text-sm text-[#6B7280]">
              No nodes found {filterNetwork !== 'all' && `on ${filterNetwork}`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {filteredNodes.map((node) => (
              <div
                key={node.id}
                className="p-4 rounded-xl border bg-[#111827] border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)] transition-all"
              >
                {/* Node Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-[#F9FAFB] truncate">{node.name}</h4>
                    <p className="text-xs text-[#6B7280]">{node.id.slice(0, 8)}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${getStatusColor(
                      node.status
                    )}`}
                  >
                    {node.status}
                  </span>
                </div>

                {/* Client Badge */}
                <div className="mb-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getClientColor(
                      node.clientType
                    )}`}
                  >
                    {node.clientType}
                  </span>
                  <span className="ml-2 text-xs text-[#6B7280]">{node.clientVersion}</span>
                </div>

                {/* Block Height */}
                <div className="mb-3 p-2 rounded-lg bg-[rgba(30,144,255,0.1)]">
                  <div className="text-xs text-[#6B7280] mb-1">Block Height</div>
                  <div className="text-lg font-bold font-mono text-[#1E90FF]">
                    {node.blockHeight.toLocaleString()}
                  </div>
                </div>

                {/* Sync Progress */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-[#6B7280]">Sync Progress</span>
                    <span className="text-[#F9FAFB] font-semibold">
                      {node.syncPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        node.syncPercent > 99
                          ? 'bg-[#10B981]'
                          : node.syncPercent >= 90
                          ? 'bg-[#F59E0B]'
                          : 'bg-[#EF4444]'
                      }`}
                      style={{ width: `${Math.min(node.syncPercent, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Peers */}
                <div className="flex items-center justify-between text-xs text-[#6B7280] mb-2">
                  <span>Peers</span>
                  <span className="text-[#F9FAFB] font-medium">{node.peerCount}</span>
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between text-xs text-[#6B7280]">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimeAgo(node.lastSeen)}
                  </span>
                  <span className="capitalize">{node.network}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}
