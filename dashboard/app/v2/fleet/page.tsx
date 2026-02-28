'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';

interface FleetNode {
  id: string;
  name: string;
  host: string;
  clientType: string;
  status: string;
  blockHeight: number;
  syncPercent: number;
  peerCount: number;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  lastSeen: string;
  network: string;
}

function statusColor(s: string) {
  if (s === 'healthy') return '#30D158';
  if (s === 'syncing') return '#0AD4FF';
  if (s === 'degraded') return '#FF9F0A';
  return '#FF453A';
}

function resourceColor(v: number) {
  if (v < 50) return '#30D158';
  if (v < 80) return '#FF9F0A';
  return '#FF453A';
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return `${s}s ago`;
}

export default function V2FleetPage() {
  const [nodes, setNodes] = useState<FleetNode[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedHosts, setExpandedHosts] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const [fleetRes, alertsRes] = await Promise.all([
        fetch('/api/v1/fleet/overview', { cache: 'no-store' }),
        fetch('/api/v1/alerts', { cache: 'no-store' }),
      ]);
      if (fleetRes.ok) {
        const d = await fleetRes.json();
        const n = d.data?.nodes || [];
        setNodes(n);
        // Auto-expand all hosts
        const hosts = new Set<string>(n.map((node: FleetNode) => node.host || 'unknown'));
        setExpandedHosts(hosts);
      }
      if (alertsRes.ok) {
        const d = await alertsRes.json();
        setAlerts(d.alerts || []);
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

  // Group nodes by host
  const grouped = useMemo(() => {
    const map: Record<string, FleetNode[]> = {};
    nodes.forEach(n => {
      const h = n.host || 'unknown';
      if (!map[h]) map[h] = [];
      map[h].push(n);
    });
    return map;
  }, [nodes]);

  const stats = useMemo(() => ({
    total: nodes.length,
    healthy: nodes.filter(n => n.status === 'healthy').length,
    syncing: nodes.filter(n => n.status === 'syncing').length,
    offline: nodes.filter(n => n.status === 'offline').length,
    hosts: Object.keys(grouped).length,
  }), [nodes, grouped]);

  const activeAlerts = alerts.filter(a => a.status === 'active' || a.status === 'firing');
  const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');

  const toggleSelect = (id: string) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  };

  const toggleHost = (host: string) => {
    const s = new Set(expandedHosts);
    if (s.has(host)) s.delete(host); else s.add(host);
    setExpandedHosts(s);
  };

  const selectAll = () => setSelected(new Set(nodes.map(n => n.id)));
  const clearSelection = () => setSelected(new Set());

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.05)', borderTop: '2px solid rgba(0,212,255,0.8)', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12, opacity: 0, animation: 'fadeUp .8s ease .1s forwards' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', background: 'linear-gradient(135deg,white 60%,rgba(0,212,255,0.6))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>Fleet Management</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{stats.hosts} servers · {stats.total} nodes · auto-refresh 15s</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {selected.size > 0 && (
            <>
              <span style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: 'rgba(0,212,255,0.9)', fontSize: 12, fontWeight: 600 }}>
                {selected.size} selected
              </span>
              <button onClick={clearSelection} style={{ padding: '8px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer' }}>
                Clear
              </button>
            </>
          )}
          <button onClick={fetchData} style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: 'rgba(0,212,255,0.9)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="v2-grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'SERVERS', value: stats.hosts, color: '#BF5AF2', sub: 'unique hosts' },
          { label: 'HEALTHY', value: stats.healthy, color: '#30D158', sub: `${stats.total ? ((stats.healthy / stats.total) * 100).toFixed(0) : 0}% of fleet` },
          { label: 'SYNCING', value: stats.syncing, color: '#0AD4FF', sub: 'catching up' },
          { label: 'ALERTS', value: activeAlerts.length, color: criticalAlerts.length > 0 ? '#FF453A' : '#FF9F0A', sub: `${criticalAlerts.length} critical` },
        ].map((c, i) => (
          <div key={c.label} className="glass-card" style={{ padding: 20, animationDelay: `${i * 0.05}s` }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '.1em', marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="glass-card" style={{ padding: '12px 16px', marginBottom: 16, animationDelay: '0.2s' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>Bulk actions for {selected.size} selected:</span>
            {[
              { label: '⟳ Restart Selected', color: '#0A84FF' },
              { label: '↑ Update Selected', color: '#30D158' },
              { label: '⊘ Force Sync', color: '#FF9F0A' },
            ].map(a => (
              <button key={a.label} onClick={() => alert('Action: ' + a.label + ' — implement via API')}
                style={{ padding: '6px 14px', borderRadius: 8, background: `${a.color}15`, border: `1px solid ${a.color}30`, color: a.color, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grouped by Host */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
        {Object.entries(grouped).map(([host, hostNodes], gi) => {
          const isExpanded = expandedHosts.has(host);
          const hostHealthy = hostNodes.filter(n => n.status === 'healthy').length;
          const hostOffline = hostNodes.filter(n => n.status === 'offline').length;
          const allSelected = hostNodes.every(n => selected.has(n.id));
          return (
            <div key={host} className="glass-card" style={{ padding: 0, overflow: 'hidden', animationDelay: `${0.2 + gi * 0.04}s` }}>
              {/* Host header */}
              <div
                onClick={() => toggleHost(host)}
                style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', borderBottom: isExpanded ? '1px solid rgba(255,255,255,0.06)' : 'none', background: 'rgba(255,255,255,0.01)' }}
              >
                <div
                  onClick={e => { e.stopPropagation(); if (allSelected) hostNodes.forEach(n => { const s = new Set(selected); s.delete(n.id); setSelected(s); }); else { const s = new Set(selected); hostNodes.forEach(n => s.add(n.id)); setSelected(s); }}}
                  style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${allSelected ? '#0AD4FF' : 'rgba(255,255,255,0.2)'}`, background: allSelected ? 'rgba(0,212,255,0.2)' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#0AD4FF' }}
                >
                  {allSelected ? '✓' : ''}
                </div>
                <div style={{ fontSize: 16 }}>🖥️</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'white', fontFamily: "'JetBrains Mono',monospace" }}>{host}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                    {hostNodes.length} nodes · {hostHealthy} healthy{hostOffline > 0 ? ` · ${hostOffline} offline` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {hostNodes.map(n => (
                    <div key={n.id} style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor(n.status) }} title={n.name} />
                  ))}
                </div>
                <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.3)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>›</span>
              </div>

              {/* Nodes in this host */}
              {isExpanded && (
                <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {hostNodes.map(node => {
                    const sc = statusColor(node.status);
                    const isSel = selected.has(node.id);
                    return (
                      <div key={node.id}
                        style={{ padding: '12px 14px', borderRadius: 12, background: isSel ? 'rgba(0,212,255,0.04)' : 'rgba(255,255,255,0.02)', border: `1px solid ${isSel ? 'rgba(0,212,255,0.2)' : 'rgba(255,255,255,0.05)'}`, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        <div
                          onClick={() => toggleSelect(node.id)}
                          style={{ width: 16, height: 16, borderRadius: 4, border: `1px solid ${isSel ? '#0AD4FF' : 'rgba(255,255,255,0.15)'}`, background: isSel ? 'rgba(0,212,255,0.2)' : 'transparent', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#0AD4FF' }}
                        >
                          {isSel ? '✓' : ''}
                        </div>
                        <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                          <Link href={`/v2/nodes/${node.id}`} style={{ textDecoration: 'none' }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{node.name}</div>
                          </Link>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono',monospace", marginTop: 2 }}>{node.clientType}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: sc }} />
                          <span style={{ fontSize: 10, color: sc, fontWeight: 700, textTransform: 'uppercase' }}>{node.status}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#0AD4FF', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                          #{(node.blockHeight || 0).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                          {(node.syncPercent || 0).toFixed(1)}% sync
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          {[
                            { l: 'CPU', v: node.cpuPercent },
                            { l: 'MEM', v: node.memoryPercent },
                            { l: 'DSK', v: node.diskPercent },
                          ].map(r => (
                            <div key={r.l} style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', marginBottom: 2 }}>{r.l}</div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: resourceColor(r.v || 0) }}>{Math.round(r.v || 0)}%</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' }}>
                          {timeAgo(node.lastSeen || new Date().toISOString())}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Incident Panel */}
      {activeAlerts.length > 0 && (
        <div className="glass-card" style={{ padding: 20, animationDelay: '0.4s' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 16, letterSpacing: '.06em' }}>ACTIVE INCIDENTS ({activeAlerts.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeAlerts.slice(0, 10).map((a, i) => {
              const sc = a.severity === 'critical' ? '#FF453A' : a.severity === 'warning' ? '#FF9F0A' : '#0A84FF';
              return (
                <div key={i} style={{ padding: '10px 14px', borderRadius: 10, background: `${sc}08`, border: `1px solid ${sc}20`, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: sc, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{a.title}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{a.node_name}</div>
                  </div>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: `${sc}15`, color: sc, textTransform: 'uppercase', flexShrink: 0 }}>{a.severity}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
