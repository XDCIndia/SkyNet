'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return `${s}s ago`;
}

function resourceColor(v: number) {
  if (v < 50) return '#30D158';
  if (v < 80) return '#FF9F0A';
  return '#FF453A';
}

function statusColor(s: string) {
  if (s === 'healthy') return '#30D158';
  if (s === 'syncing') return '#0AD4FF';
  if (s === 'degraded') return '#FF9F0A';
  return '#FF453A';
}

function MetricCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="glass-card" style={{ padding: 18, animationDelay: '0.1s' }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '.1em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', color: color || 'white' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Sparkline({ data, color = '#0AD4FF', height = 40 }: { data: number[]; color?: string; height?: number }) {
  if (!data || data.length < 2) return <div style={{ height, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 200, h = height;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ResourceBar({ label, value }: { label: string; value: number }) {
  const c = resourceColor(value);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: c }}>{value.toFixed(1)}%</span>
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(value, 100)}%`, background: c, borderRadius: 3, transition: 'width 0.5s ease', transformOrigin: 'left', animation: 'barGrow 0.8s ease forwards' }} />
      </div>
    </div>
  );
}

export default function V2NodeDetailPage() {
  const params = useParams();
  const nodeId = params.id as string;

  const [node, setNode] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [peers, setPeers] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, alertsRes] = await Promise.all([
        fetch(`/api/v1/nodes/${nodeId}`, { cache: 'no-store' }),
        fetch(`/api/v1/alerts?nodeId=${nodeId}`, { cache: 'no-store' }),
      ]);

      if (statusRes.ok) {
        const d = await statusRes.json();
        setNode(d.node || d.data || d);
        setStatus(d.status || d.data || d);
      } else {
        setError('Node not found');
      }

      if (alertsRes.ok) {
        const d = await alertsRes.json();
        setAlerts((d.alerts || []).filter((a: any) => a.node_id === nodeId));
      }

      // Try to get peers
      try {
        const peersRes = await fetch(`/api/v1/nodes/${nodeId}/peers`, { cache: 'no-store' });
        if (peersRes.ok) {
          const d = await peersRes.json();
          setPeers(d.peers || []);
        }
      } catch {}

      // Try metrics history
      try {
        const mRes = await fetch(`/api/v1/nodes/${nodeId}/metrics/history?hours=6`, { cache: 'no-store' });
        if (mRes.ok) {
          const d = await mRes.json();
          setMetrics(d.history || []);
        }
      } catch {}
    } catch (e) {
      setError('Failed to fetch node data');
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

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

  if (error || !node) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 16, color: '#FF453A', marginBottom: 12 }}>{error || 'Node not found'}</div>
        <Link href="/v2/nodes" style={{ color: '#0AD4FF', fontSize: 13 }}>← Back to Nodes</Link>
      </div>
    );
  }

  const nodeData = node;
  const s = status || node;
  const sc = statusColor(s.status || nodeData.status || 'offline');
  const blockSpark = metrics.map((m: any) => m.block_height || 0);
  const peerSpark = metrics.map((m: any) => m.peer_count || 0);
  const cpuSpark = metrics.map((m: any) => m.cpu_percent || 0);
  const activeAlerts = alerts.filter((a: any) => a.status === 'active' || a.status === 'firing');

  return (
    <div>
      {/* Back + Header */}
      <div style={{ marginBottom: 24, opacity: 0, animation: 'fadeUp .8s ease .1s forwards' }}>
        <Link href="/v2/nodes" style={{ color: 'rgba(0,212,255,0.7)', fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 16 }}>
          ← Back to Nodes
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            ⬡
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', background: 'linear-gradient(135deg,white 60%,rgba(0,212,255,0.6))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
              {nodeData.name}
            </h1>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono',monospace" }}>{nodeData.host}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: sc, animation: (s.status || nodeData.status) !== 'healthy' ? 'pulse 2s ease infinite' : 'none' }} />
                <span style={{ fontSize: 10, color: sc, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.status || nodeData.status}</span>
              </div>
              <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.06)', textTransform: 'capitalize' }}>
                {s.clientType || nodeData.clientType || nodeData.client_type || 'unknown'}
              </span>
            </div>
          </div>
          {activeAlerts.length > 0 && (
            <div style={{ marginLeft: 'auto', padding: '4px 12px', borderRadius: 8, background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.2)', fontSize: 11, color: '#FF453A', fontWeight: 600 }}>
              {activeAlerts.length} active alert{activeAlerts.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="v2-grid-4" style={{ marginBottom: 16 }}>
        <MetricCard label="BLOCK HEIGHT" value={(s.blockHeight || nodeData.blockHeight || 0).toLocaleString()} color="#0AD4FF" />
        <MetricCard label="SYNC" value={`${(s.syncPercent || nodeData.syncPercent || 0).toFixed(2)}%`} color={s.syncPercent >= 99.9 ? '#30D158' : '#FF9F0A'} />
        <MetricCard label="PEERS" value={s.peerCount || nodeData.peerCount || 0} color="#30D158" />
        <MetricCard label="LAST SEEN" value={timeAgo(s.lastSeen || nodeData.lastSeen || new Date().toISOString())} color="rgba(255,255,255,0.7)" />
      </div>

      {/* Resource Usage + Sparklines */}
      <div className="v2-grid-2" style={{ marginBottom: 16 }}>
        <div className="glass-card" style={{ padding: 20, animationDelay: '0.15s' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 16, letterSpacing: '.06em' }}>RESOURCE USAGE</div>
          <ResourceBar label="CPU" value={s.cpuPercent || nodeData.cpuPercent || 0} />
          <ResourceBar label="Memory" value={s.memoryPercent || nodeData.memoryPercent || 0} />
          <ResourceBar label="Disk" value={s.diskPercent || nodeData.diskPercent || 0} />
        </div>

        <div className="glass-card" style={{ padding: 20, animationDelay: '0.2s' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 16, letterSpacing: '.06em' }}>TRENDS (6h)</div>
          {metrics.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(0,212,255,0.6)', marginBottom: 4 }}>Block Height</div>
                <Sparkline data={blockSpark} color="#0AD4FF" height={36} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(48,209,88,0.6)', marginBottom: 4 }}>Peer Count</div>
                <Sparkline data={peerSpark} color="#30D158" height={36} />
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'rgba(255,159,10,0.6)', marginBottom: 4 }}>CPU %</div>
                <Sparkline data={cpuSpark} color="#FF9F0A" height={36} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
              No metrics history available
            </div>
          )}
        </div>
      </div>

      {/* Alerts + Peers */}
      <div className="v2-grid-2" style={{ marginBottom: 16 }}>
        {/* Incidents */}
        <div className="glass-card" style={{ padding: 20, animationDelay: '0.25s' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 16, letterSpacing: '.06em' }}>INCIDENTS</div>
          {alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(48,209,88,0.7)', fontSize: 12 }}>✓ No incidents</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
              {alerts.map((a: any, i) => {
                const sc2 = a.severity === 'critical' ? '#FF453A' : a.severity === 'warning' ? '#FF9F0A' : '#0A84FF';
                return (
                  <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: `${sc2}08`, border: `1px solid ${sc2}20` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: sc2, textTransform: 'uppercase', letterSpacing: '.06em' }}>{a.severity}</span>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>{timeAgo(a.detected_at || new Date().toISOString())}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{a.title}</div>
                    {a.description && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{a.description}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Peers */}
        <div className="glass-card" style={{ padding: 20, animationDelay: '0.3s' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 16, letterSpacing: '.06em' }}>PEERS ({peers.length})</div>
          {peers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>No peers discovered</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              {peers.slice(0, 20).map((p: any, i) => (
                <div key={i} style={{ padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontFamily: "'JetBrains Mono',monospace' "}}>{p.ip || p.enode?.slice(0, 20) || 'unknown'}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 1 }}>{p.clientType || 'unknown'}</div>
                  </div>
                  <div style={{ fontSize: 10, color: '#0AD4FF', fontFamily: "'JetBrains Mono',monospace" }}>{(p.blockHeight || 0).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* System Info */}
      <div className="glass-card" style={{ padding: 20, animationDelay: '0.35s' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 16, letterSpacing: '.06em' }}>SYSTEM INFORMATION</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {[
            { label: 'Node ID', value: nodeData.id?.slice(0, 16) + '...' },
            { label: 'Client', value: s.clientType || nodeData.clientType || nodeData.client_type || '—' },
            { label: 'Version', value: (s.clientVersion || nodeData.clientVersion || nodeData.client_version || '—').slice(0, 24) },
            { label: 'Network', value: nodeData.network || s.network || 'mainnet' },
            { label: 'Node Type', value: nodeData.nodeType || s.nodeType || '—' },
            { label: 'Peak Block', value: (nodeData.peakBlock || s.peakBlock || 0).toLocaleString() },
          ].map((item, i) => (
            <div key={i} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginBottom: 4, letterSpacing: '.08em', textTransform: 'uppercase' }}>{item.label}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600, fontFamily: "'JetBrains Mono',monospace", wordBreak: 'break-all' }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
