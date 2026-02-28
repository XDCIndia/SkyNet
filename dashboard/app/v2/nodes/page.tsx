'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';

interface Node {
  id: string;
  name: string;
  host: string;
  clientType: string;
  clientVersion: string;
  nodeType: string;
  status: string;
  blockHeight: number;
  peakBlock: number;
  fleetMaxBlock: number;
  syncPercent: number;
  peerCount: number;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  lastSeen: string;
  network: string;
  stallHours: number;
  blockDiff: number;
  prevBlock: number;
  os_info?: any;
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

function clientColor(c: string) {
  const lc = c.toLowerCase();
  if (lc.includes('geth')) return '#0A84FF';
  if (lc.includes('erigon')) return '#FF9F0A';
  if (lc.includes('nethermind')) return '#BF5AF2';
  if (lc.includes('reth')) return '#30D158';
  return 'rgba(255,255,255,0.4)';
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

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)' }}></span>
        <span style={{ fontSize: 9, color, fontWeight: 600 }}>{Math.round(value)}%</span>
      </div>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(value, 100)}%`, background: color, borderRadius: 2 }} />
      </div>
    </div>
  );
}

export default function V2NodesPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterClient, setFilterClient] = useState('all');
  const [filterNetwork, setFilterNetwork] = useState('all');
  const [sortBy, setSortBy] = useState<'name' | 'blockHeight' | 'syncPercent'>('blockHeight');

  const fetchNodes = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/fleet/status', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) setNodes(data.data?.nodes || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNodes();
    const t = setInterval(fetchNodes, 15000);
    return () => clearInterval(t);
  }, [fetchNodes]);

  const stats = useMemo(() => ({
    total: nodes.length,
    healthy: nodes.filter(n => n.status === 'healthy').length,
    syncing: nodes.filter(n => n.status === 'syncing').length,
    offline: nodes.filter(n => n.status === 'offline').length,
  }), [nodes]);

  const clientTypes = useMemo(() => [...new Set(nodes.map(n => n.clientType))], [nodes]);
  const networks = useMemo(() => [...new Set(nodes.map(n => n.network))], [nodes]);

  const filtered = useMemo(() => {
    let r = nodes;
    if (search) r = r.filter(n => n.name.toLowerCase().includes(search.toLowerCase()) || n.host?.toLowerCase().includes(search.toLowerCase()));
    if (filterStatus !== 'all') r = r.filter(n => n.status === filterStatus);
    if (filterClient !== 'all') r = r.filter(n => n.clientType === filterClient);
    if (filterNetwork !== 'all') r = r.filter(n => n.network === filterNetwork);
    return [...r].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'syncPercent') return b.syncPercent - a.syncPercent;
      return b.blockHeight - a.blockHeight;
    });
  }, [nodes, search, filterStatus, filterClient, filterNetwork, sortBy]);

  const statCards = [
    { label: 'TOTAL NODES', value: stats.total, color: '#0AD4FF', sub: 'fleet nodes' },
    { label: 'HEALTHY', value: stats.healthy, color: '#30D158', sub: `${stats.total ? ((stats.healthy / stats.total) * 100).toFixed(0) : 0}% of fleet` },
    { label: 'SYNCING', value: stats.syncing, color: '#FF9F0A', sub: 'catching up' },
    { label: 'OFFLINE', value: stats.offline, color: '#FF453A', sub: 'needs attention' },
  ];

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
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', background: 'linear-gradient(135deg,white 60%,rgba(0,212,255,0.6))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>Fleet Nodes</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{nodes.length} nodes monitored · auto-refresh 15s</p>
        </div>
        <button onClick={fetchNodes} style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: 'rgba(0,212,255,0.9)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          ↺ Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="v2-grid-4" style={{ marginBottom: 20 }}>
        {statCards.map((c, i) => (
          <div key={c.label} className="glass-card" style={{ padding: 20, animationDelay: `${i * 0.05}s` }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '.1em', marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding: '14px 16px', marginBottom: 16, animationDelay: '0.2s' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search nodes..."
            style={{ flex: 1, minWidth: 160, padding: '7px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: 12, outline: 'none' }}
          />
          {[
            { label: 'Status', val: filterStatus, set: setFilterStatus, opts: ['all', 'healthy', 'syncing', 'degraded', 'offline'] },
            { label: 'Client', val: filterClient, set: setFilterClient, opts: ['all', ...clientTypes] },
            { label: 'Network', val: filterNetwork, set: setFilterNetwork, opts: ['all', ...networks] },
          ].map(f => (
            <select key={f.label} value={f.val} onChange={e => f.set(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontSize: 12, outline: 'none' }}>
              {f.opts.map(o => <option key={o} value={o}>{o === 'all' ? `All ${f.label}` : o}</option>)}
            </select>
          ))}
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            style={{ padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontSize: 12, outline: 'none' }}>
            <option value="blockHeight">Sort: Block Height</option>
            <option value="syncPercent">Sort: Sync %</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>
      </div>

      {/* Node Grid */}
      <div className="v2-nodes-grid">
        {filtered.map((node, i) => {
          const sc = statusColor(node.status);
          const cc = clientColor(node.clientType);
          return (
            <Link key={node.id} href={`/v2/nodes/${node.id}`} style={{ textDecoration: 'none' }}>
              <div className="glass-card" style={{ padding: 18, animationDelay: `${0.25 + i * 0.03}s`, cursor: 'pointer' }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2, fontFamily: "'JetBrains Mono',monospace" }}>{node.host}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: sc, boxShadow: `0 0 6px ${sc}`, animation: node.status !== 'healthy' ? 'pulse 2s ease infinite' : 'none' }} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: sc, textTransform: 'uppercase', letterSpacing: '.06em' }}>{node.status}</span>
                  </div>
                </div>

                {/* Client + network */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: `${cc}18`, color: cc, border: `1px solid ${cc}30`, textTransform: 'capitalize' }}>
                    {node.clientType}
                  </span>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {node.network || 'mainnet'}
                  </span>
                </div>

                {/* Block height */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 3, letterSpacing: '.06em' }}>BLOCK HEIGHT</div>
                  <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.04em', color: '#0AD4FF', fontFamily: "'JetBrains Mono',monospace" }}>
                    {(node.blockHeight || 0).toLocaleString()}
                  </div>
                </div>

                {/* Sync bar */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Sync</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: node.syncPercent >= 99.9 ? '#30D158' : node.syncPercent >= 90 ? '#FF9F0A' : '#FF453A' }}>
                      {(node.syncPercent || 0).toFixed(2)}%
                    </span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(node.syncPercent || 0, 100)}%`, background: node.syncPercent >= 99.9 ? '#30D158' : node.syncPercent >= 90 ? '#FF9F0A' : '#FF453A', borderRadius: 3, transition: 'width 0.5s ease' }} />
                  </div>
                </div>

                {/* Resource bars */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  {[
                    { label: 'CPU', val: node.cpuPercent },
                    { label: 'MEM', val: node.memoryPercent },
                    { label: 'DISK', val: node.diskPercent },
                  ].map(r => (
                    <div key={r.label} style={{ flex: 1 }}>
                      <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginBottom: 3, letterSpacing: '.06em' }}>{r.label}</div>
                      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${Math.min(r.val || 0, 100)}%`, background: resourceColor(r.val || 0), borderRadius: 2 }} />
                      </div>
                      <div style={{ fontSize: 9, color: resourceColor(r.val || 0), textAlign: 'center', marginTop: 2, fontWeight: 600 }}>{Math.round(r.val || 0)}%</div>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                  <span>{node.peerCount} peers</span>
                  <span>{timeAgo(node.lastSeen || new Date().toISOString())}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
          No nodes match your filters
        </div>
      )}
    </div>
  );
}
