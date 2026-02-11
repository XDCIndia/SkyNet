'use client';

import { useEffect, useState, useCallback } from 'react';
import Header from '@/components/Header';
import NavigationDock from '@/components/NavigationDock';
import HeroSection from '@/components/HeroSection';
import StatsGrid from '@/components/StatsGrid';
import ConsensusPanel from '@/components/ConsensusPanel';
import SyncPanel from '@/components/SyncPanel';
import TxPoolPanel from '@/components/TxPoolPanel';
import ServerStats from '@/components/ServerStats';
import StoragePanel from '@/components/StoragePanel';
import PeerMap from '@/components/PeerMap';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import type { MetricsData, PeersData } from '@/lib/types';

const REFRESH_INTERVAL = parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL || '10');

const defaultMetrics: MetricsData = {
  blockchain: {
    blockHeight: 0,
    highestBlock: 0,
    syncPercent: 0,
    isSyncing: false,
    peers: 0,
    peersInbound: 0,
    peersOutbound: 0,
    uptime: 0,
    chainId: '50',
    coinbase: '',
    ethstatsName: '',
    clientVersion: '',
  },
  consensus: {
    epoch: 0,
    epochProgress: 0,
    masternodeStatus: 'Inactive',
    signingRate: 0,
    stakeAmount: 0,
    walletBalance: 0,
    totalRewards: 0,
    penalties: 0,
  },
  sync: {
    syncRate: 0,
    reorgsAdd: 0,
    reorgsDrop: 0,
  },
  txpool: {
    pending: 0,
    queued: 0,
    slots: 0,
    valid: 0,
    invalid: 0,
    underpriced: 0,
  },
  server: {
    cpuUsage: 0,
    memoryUsed: 0,
    memoryTotal: 16 * 1024 * 1024 * 1024,
    diskUsed: 0,
    diskTotal: 500 * 1024 * 1024 * 1024,
    goroutines: 0,
    sysLoad: 0,
    procLoad: 0,
  },
  storage: {
    chainDataSize: 0,
    diskReadRate: 0,
    diskWriteRate: 0,
    compactTime: 0,
    trieCacheHitRate: 0,
    trieCacheMiss: 0,
  },
  network: {
    totalPeers: 0,
    inboundTraffic: 0,
    outboundTraffic: 0,
    dialSuccess: 0,
    dialTotal: 0,
    eth100Traffic: 0,
    eth63Traffic: 0,
    connectionErrors: 0,
  },
  timestamp: new Date().toISOString(),
};

const defaultPeers: PeersData = {
  peers: [],
  countries: {},
  totalPeers: 0,
};

// Skeleton loading component
function Skeleton({ className }: { className?: string }) {
  return <div className={`skeleton ${className || ''}`} />;
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      <header className="header-obsidian sticky top-0 z-50">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between px-4 lg:px-6 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div>
              <Skeleton className="w-32 h-6 mb-1" />
              <Skeleton className="w-24 h-4" />
            </div>
          </div>
          <Skeleton className="w-40 h-10 rounded-full hidden md:block" />
          <div className="flex items-center gap-4">
            <Skeleton className="w-20 h-8 rounded-lg" />
          </div>
        </div>
      </header>
      
      <main className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
        <div className="card-hero mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div>
              <Skeleton className="w-32 h-4 mb-3" />
              <Skeleton className="w-48 h-12 mb-2" />
              <Skeleton className="w-36 h-4" />
            </div>
            <div className="flex justify-center">
              <Skeleton className="w-32 h-32 rounded-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="w-full h-20 rounded-xl" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card-xdc">
              <Skeleton className="w-10 h-10 rounded-xl mb-3" />
              <Skeleton className="w-20 h-4 mb-2" />
              <Skeleton className="w-28 h-8" />
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="card-xdc">
            <Skeleton className="w-full h-40 rounded-xl" />
          </div>
          <div className="card-xdc">
            <Skeleton className="w-full h-40 rounded-xl" />
          </div>
        </div>
        
        <div className="card-xdc">
          <Skeleton className="w-full h-[400px] rounded-xl" />
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  const [metrics, setMetrics] = useState<MetricsData>(defaultMetrics);
  const [peers, setPeers] = useState<PeersData>(defaultPeers);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  
  // WebSocket connection for live data
  const { metrics: wsMetrics, peers: wsPeers, connected: wsConnected, error: wsError } = useWebSocket();

  const fetchData = useCallback(async () => {
    try {
      setError(null);

      const [metricsRes, peersRes] = await Promise.all([
        fetch('/api/metrics', { cache: 'no-store' }),
        fetch('/api/peers', { cache: 'no-store' }),
      ]);

      if (!metricsRes.ok) {
        throw new Error(`Metrics API error: ${metricsRes.status}`);
      }

      const metricsData = await metricsRes.json();

      if (metricsData.error) {
        throw new Error(metricsData.error);
      }

      setMetrics(metricsData);

      if (peersRes.ok) {
        const peersData = await peersRes.json();
        // Use live peers data if available
        if (peersData.live) {
          setPeers({
            peers: peersData.live.peers.map((p: any) => ({
              id: p.id,
              name: p.name,
              ip: p.ip,
              port: p.port,
              country: p.country,
              countryCode: p.country?.toLowerCase() || 'unknown',
              city: p.city,
              lat: p.lat,
              lon: p.lon,
              isp: p.asn,
              inbound: p.direction === 'inbound',
            })),
            countries: peersData.live.countries,
            totalPeers: peersData.live.totalPeers,
          });
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
      setCountdown(REFRESH_INTERVAL);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchData();
    const intervalId = setInterval(fetchData, REFRESH_INTERVAL * 1000);
    return () => clearInterval(intervalId);
  }, [fetchData]);

  // Countdown timer
  useEffect(() => {
    const countdownId = setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(countdownId);
  }, []);

  // Update metrics from WebSocket when available
  useEffect(() => {
    if (wsMetrics) {
      // Merge WS data with existing metrics
      setMetrics(prev => ({
        ...prev,
        blockchain: {
          ...prev.blockchain,
          peers: (wsMetrics as any).data?.[0]?.peer_count || prev.blockchain.peers,
          blockHeight: (wsMetrics as any).data?.[0]?.block_height || prev.blockchain.blockHeight,
          syncPercent: (wsMetrics as any).data?.[0]?.sync_percent || prev.blockchain.syncPercent,
          isSyncing: (wsMetrics as any).data?.[0]?.is_syncing || prev.blockchain.isSyncing,
        },
        server: {
          ...prev.server,
          cpuUsage: (wsMetrics as any).data?.[0]?.cpu_percent || prev.server.cpuUsage,
          memoryUsed: (wsMetrics as any).data?.[0]?.memory_percent 
            ? (wsMetrics as any).data[0].memory_percent / 100 * prev.server.memoryTotal
            : prev.server.memoryUsed,
        },
        timestamp: new Date().toISOString(),
      }));
    }
  }, [wsMetrics]);

  // Update peers from WebSocket when available
  useEffect(() => {
    if (wsPeers) {
      // WebSocket provides peer stats, not full peer list
    }
  }, [wsPeers]);

  // Combine WS and HTTP errors
  useEffect(() => {
    if (wsError) {
      setError(wsError);
    }
  }, [wsError]);

  if (loading) {
    return <LoadingState />;
  }

  return (
    <div className="min-h-screen bg-[#0A0E1A]">
      <Header
        lastUpdated={metrics.timestamp}
        connected={wsConnected}
        nextRefresh={countdown}
        refreshInterval={REFRESH_INTERVAL}
        blockHeight={metrics.blockchain.blockHeight}
        peers={metrics.blockchain.peers}
        isSyncing={metrics.blockchain.isSyncing}
        coinbase={metrics.blockchain.coinbase}
        ethstatsName={metrics.blockchain.ethstatsName}
      />

      <NavigationDock />

      <main className="max-w-[1440px] mx-auto px-4 lg:px-6 py-6">
        {/* Live indicator */}
        {wsConnected && (
          <div className="mb-4 flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#10B981] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#10B981]"></span>
            </span>
            <span className="text-sm text-[#10B981] font-medium">Live</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[#EF4444] animate-fade-in">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        <div className="space-y-8">
          <section id="blockchain">
            <HeroSection data={metrics.blockchain} />
          </section>

          <section>
            <StatsGrid metrics={metrics} />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2">
              <ConsensusPanel data={metrics.consensus} />
            </div>
            <div className="xl:col-span-1">
              <SyncPanel data={metrics.sync} blockchain={metrics.blockchain} />
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TxPoolPanel data={metrics.txpool} />
            <ServerStats data={metrics.server} />
          </section>

          <section>
            <StoragePanel data={metrics.storage} />
          </section>

          <section>
            <PeerMap peers={peers} />
          </section>
        </div>
      </main>

      <footer className="border-t border-[rgba(255,255,255,0.06)] mt-8 py-6">
        <div className="max-w-[1440px] mx-auto px-4 text-center text-sm text-[#6B7280]">
          <p>XDC Node Dashboard &copy; {new Date().getFullYear()}</p>
          <p className="mt-1">
            Built with Next.js 14 &middot; {wsConnected ? 'WebSocket Live' : `Auto-refresh every ${REFRESH_INTERVAL}s`}
          </p>
        </div>
      </footer>
    </div>
  );
}
