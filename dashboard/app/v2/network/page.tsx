'use client';

import { useState, useEffect, useCallback } from 'react';

interface NetworkStats {
  bestBlock: number;
  avgBlockTime: number;
  gasPrice: string;
  gasLimit: number;
  activeNodes: number;
  totalTransactions: number;
  tps: number;
  pendingTxs: number;
  epoch?: { number: number; progress: number; blocksRemaining: number };
  lastBlocks?: Array<{ number: number; hash: string; txCount: number; gasUsed: number; gasLimit: number; time: string; miner: string }>;
  blockTimes?: number[];
  txsPerBlock?: number[];
  timestamp?: string;
}

function MiniBlockTimeChart({ data }: { data: number[] }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const w = 200, h = 40;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 6) - 3}`).join(' ');
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke="#0AD4FF" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function StatCard({ label, value, sub, color, icon }: { label: string; value: string | number; sub?: string; color?: string; icon?: string }) {
  return (
    <div className="glass-card" style={{ padding: 20, animationDelay: '0.1s' }}>
      {icon && <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>}
      <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '.1em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', color: color || 'white' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function V2NetworkPage() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [masternodeCount, setMasternodeCount] = useState<{ active: number; standby: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [netRes, mnRes] = await Promise.all([
        fetch('/api/v1/network/stats', { cache: 'no-store' }),
        fetch('/api/v1/masternodes', { cache: 'no-store' }),
      ]);

      if (netRes.ok) {
        const d = await netRes.json();
        setStats(d.data || d);
      }
      if (mnRes.ok) {
        const d = await mnRes.json();
        const mns = d.masternodes || [];
        setMasternodeCount({
          active: mns.filter((m: any) => m.isActive || m.status === 'active').length,
          standby: mns.filter((m: any) => m.isStandby || m.status === 'standby').length,
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 15000);
    return () => clearInterval(t);
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.05)', borderTop: '2px solid rgba(0,212,255,0.8)', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  const epoch = stats?.epoch;
  const lastBlocks = stats?.lastBlocks || [];

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12, opacity: 0, animation: 'fadeUp .8s ease .1s forwards' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', background: 'linear-gradient(135deg,white 60%,rgba(10,132,255,0.6))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>Network Stats</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>XDC Network live metrics · auto-refresh 15s</p>
        </div>
        <button onClick={fetchData} style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: 'rgba(0,212,255,0.9)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          ↺ Refresh
        </button>
      </div>

      {/* Main Stats */}
      <div className="v2-grid-4" style={{ marginBottom: 16 }}>
        <StatCard label="BEST BLOCK" value={(stats?.bestBlock || 0).toLocaleString()} color="#0AD4FF" icon="⛓" sub="network tip" />
        <StatCard label="TPS" value={(stats?.tps || 0).toFixed(2)} color="#30D158" icon="⚡" sub="transactions/sec" />
        <StatCard label="ACTIVE NODES" value={stats?.activeNodes || 0} color="#BF5AF2" icon="⬡" sub="online validators" />
        <StatCard label="PENDING TXS" value={(stats?.pendingTxs || 0).toLocaleString()} color="#FF9F0A" icon="⏳" sub="in mempool" />
      </div>

      <div className="v2-grid-4" style={{ marginBottom: 16 }}>
        <StatCard label="AVG BLOCK TIME" value={`${(stats?.avgBlockTime || 0).toFixed(2)}s`} color="#0AD4FF" sub="target: 2s" />
        <StatCard label="TOTAL TXS" value={stats?.totalTransactions ? `${(stats.totalTransactions / 1e6).toFixed(2)}M` : '0'} color="#30D158" sub="all time" />
        <StatCard label="ACTIVE MASTERNODES" value={masternodeCount?.active || 0} color="#FF9F0A" sub={`${masternodeCount?.standby || 0} standby`} />
        <StatCard label="GAS PRICE" value={stats?.gasPrice || '0'} color="#BF5AF2" sub="gwei" />
      </div>

      {/* Epoch Progress */}
      {epoch && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 16, animationDelay: '0.2s' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '.06em' }}>EPOCH PROGRESS</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#0AD4FF', marginTop: 4 }}>Epoch #{epoch.number}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'white' }}>{Math.round(epoch.progress * 100)}%</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{epoch.blocksRemaining?.toLocaleString()} blocks remaining</div>
            </div>
          </div>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(epoch.progress * 100, 100)}%`, background: 'linear-gradient(90deg,#0AD4FF,#0A84FF)', borderRadius: 4, transition: 'width 0.5s ease' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
            <span>Start</span>
            <span>{Math.round(epoch.progress * 100)}% complete</span>
            <span>End</span>
          </div>
        </div>
      )}

      {/* Block time chart */}
      {stats?.blockTimes && stats.blockTimes.length > 0 && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 16, animationDelay: '0.25s' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 12, letterSpacing: '.06em' }}>BLOCK TIME TREND</div>
          <MiniBlockTimeChart data={stats.blockTimes} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
            <span>Min: {Math.min(...stats.blockTimes).toFixed(1)}s</span>
            <span>Avg: {(stats.blockTimes.reduce((a, b) => a + b, 0) / stats.blockTimes.length).toFixed(2)}s</span>
            <span>Max: {Math.max(...stats.blockTimes).toFixed(1)}s</span>
          </div>
        </div>
      )}

      {/* Recent Blocks */}
      {lastBlocks.length > 0 && (
        <div className="glass-card" style={{ padding: 20, animationDelay: '0.3s' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 14, letterSpacing: '.06em' }}>RECENT BLOCKS</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {['Block', 'Hash', 'Txs', 'Gas Used', 'Time'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.25)', letterSpacing: '.08em', textTransform: 'uppercase', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lastBlocks.slice(0, 10).map((b, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '8px 10px', color: '#0AD4FF', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>#{b.number?.toLocaleString()}</td>
                    <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.4)', fontFamily: "'JetBrains Mono',monospace", fontSize: 10 }}>{b.hash?.slice(0, 14)}…</td>
                    <td style={{ padding: '8px 10px', color: '#30D158', fontWeight: 600 }}>{b.txCount}</td>
                    <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.5)' }}>{b.gasUsed ? `${(b.gasUsed / 1e6).toFixed(1)}M` : '0'}</td>
                    <td style={{ padding: '8px 10px', color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                      {b.time ? new Date(b.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Health indicators */}
      <div className="glass-card" style={{ padding: 20, marginTop: 16, animationDelay: '0.35s' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 14, letterSpacing: '.06em' }}>NETWORK HEALTH INDICATORS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {[
            { label: 'Block Production', ok: (stats?.avgBlockTime || 0) < 5, detail: `${(stats?.avgBlockTime || 0).toFixed(2)}s avg` },
            { label: 'Active Masternodes', ok: (masternodeCount?.active || 0) >= 100, detail: `${masternodeCount?.active || 0}/108 required` },
            { label: 'TPS', ok: (stats?.tps || 0) >= 0, detail: `${(stats?.tps || 0).toFixed(2)} tx/s` },
            { label: 'Pending Txs', ok: (stats?.pendingTxs || 0) < 10000, detail: `${(stats?.pendingTxs || 0).toLocaleString()} pending` },
          ].map((ind, i) => (
            <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: ind.ok ? 'rgba(48,209,88,0.06)' : 'rgba(255,69,58,0.06)', border: `1px solid ${ind.ok ? 'rgba(48,209,88,0.15)' : 'rgba(255,69,58,0.15)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: ind.ok ? '#30D158' : '#FF453A' }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{ind.label}</span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{ind.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
