'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

interface Masternode {
  address: string;
  name?: string;
  stake?: string;
  stakeRaw?: string;
  isActive?: boolean;
  isStandby?: boolean;
  status?: string;
  lastActivity?: string;
  voterCount?: number;
  rank?: number;
}

function statusColor(m: Masternode) {
  if (m.isActive || m.status === 'active') return '#30D158';
  if (m.isStandby || m.status === 'standby') return '#0AD4FF';
  return '#FF453A';
}

function statusLabel(m: Masternode) {
  if (m.isActive || m.status === 'active') return 'ACTIVE';
  if (m.isStandby || m.status === 'standby') return 'STANDBY';
  return m.status?.toUpperCase() || 'UNKNOWN';
}

function timeAgo(ts: string) {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'just now';
}

function fmtStake(stake?: string) {
  if (!stake) return '—';
  const n = parseFloat(stake);
  if (isNaN(n)) return stake;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

const PAGE_SIZE = 25;

export default function V2MasternodesPage() {
  const [masternodes, setMasternodes] = useState<Masternode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/masternodes', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setMasternodes(d.masternodes || []);
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

  const stats = useMemo(() => ({
    active: masternodes.filter(m => m.isActive || m.status === 'active').length,
    standby: masternodes.filter(m => m.isStandby || m.status === 'standby').length,
    total: masternodes.length,
    totalStake: masternodes.reduce((s, m) => s + (parseFloat(m.stake || m.stakeRaw || '0') || 0), 0),
  }), [masternodes]);

  const filtered = useMemo(() => {
    let r = masternodes;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(m => m.address?.toLowerCase().includes(q) || m.name?.toLowerCase().includes(q));
    }
    if (filterStatus !== 'all') {
      if (filterStatus === 'active') r = r.filter(m => m.isActive || m.status === 'active');
      if (filterStatus === 'standby') r = r.filter(m => m.isStandby || m.status === 'standby');
    }
    return r;
  }, [masternodes, search, filterStatus]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const copyAddress = async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr.replace(/^0x/, 'xdc'));
      setCopied(addr);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };

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
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', background: 'linear-gradient(135deg,white 60%,rgba(255,159,10,0.6))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>Masternodes</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{stats.active} active · {stats.standby} standby · {stats.total} total</p>
        </div>
        <button onClick={fetchData} style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: 'rgba(0,212,255,0.9)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          ↺ Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="v2-grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'ACTIVE', value: stats.active, color: '#30D158', sub: 'block producers' },
          { label: 'STANDBY', value: stats.standby, color: '#0AD4FF', sub: 'on reserve' },
          { label: 'TOTAL', value: stats.total, color: 'white', sub: 'all masternodes' },
          { label: 'TOTAL STAKE', value: fmtStake(stats.totalStake.toString()) + ' XDC', color: '#FF9F0A', sub: 'staked in consensus' },
        ].map((c, i) => (
          <div key={c.label} className="glass-card" style={{ padding: 20, animationDelay: `${i * 0.05}s` }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '.1em', marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding: '12px 14px', marginBottom: 14, animationDelay: '0.2s' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search by address or name..."
            style={{ flex: 1, minWidth: 200, padding: '7px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: 12, outline: 'none' }} />
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
            style={{ padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontSize: 12, outline: 'none' }}>
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="standby">Standby Only</option>
          </select>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>{filtered.length} results</span>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden', animationDelay: '0.25s' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Rank', 'Address', 'Name', 'Status', 'Stake', 'Last Activity', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.25)', letterSpacing: '.08em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((mn, i) => {
                const sc = statusColor(mn);
                const sl = statusLabel(mn);
                const rank = mn.rank || ((page - 1) * PAGE_SIZE + i + 1);
                const xdcAddr = mn.address?.replace(/^0x/, 'xdc') || '—';
                return (
                  <tr key={mn.address || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>#{rank}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: '#0AD4FF' }}>
                          {xdcAddr.slice(0, 10)}…{xdcAddr.slice(-6)}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.6)', maxWidth: 140, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mn.name || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: `${sc}15`, color: sc, border: `1px solid ${sc}25`, textTransform: 'uppercase' }}>{sl}</span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#FF9F0A', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                      {fmtStake(mn.stake || mn.stakeRaw)} XDC
                    </td>
                    <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
                      {mn.lastActivity ? timeAgo(mn.lastActivity) : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <button onClick={() => copyAddress(mn.address || '')}
                        style={{ padding: '3px 9px', borderRadius: 6, background: copied === mn.address ? 'rgba(48,209,88,0.1)' : 'rgba(0,212,255,0.06)', border: `1px solid ${copied === mn.address ? 'rgba(48,209,88,0.2)' : 'rgba(0,212,255,0.15)'}`, color: copied === mn.address ? '#30D158' : '#0AD4FF', fontSize: 10, cursor: 'pointer' }}>
                        {copied === mn.address ? '✓' : 'Copy'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {paginated.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>No masternodes match your search</div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 12 }}>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}>Page {page} of {totalPages} · {filtered.length} total</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setPage(1)} disabled={page === 1}
                style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: page === 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', cursor: page === 1 ? 'default' : 'pointer', fontSize: 11 }}>
                ⟪
              </button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: '5px 12px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: page === 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', cursor: page === 1 ? 'default' : 'pointer', fontSize: 11 }}>
                ‹ Prev
              </button>
              {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + idx;
                return (
                  <button key={p} onClick={() => setPage(p)}
                    style={{ padding: '5px 10px', borderRadius: 7, background: p === page ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${p === page ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.08)'}`, color: p === page ? '#0AD4FF' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 11 }}>
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: '5px 12px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: page === totalPages ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', cursor: page === totalPages ? 'default' : 'pointer', fontSize: 11 }}>
                Next ›
              </button>
              <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                style={{ padding: '5px 10px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: page === totalPages ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.6)', cursor: page === totalPages ? 'default' : 'pointer', fontSize: 11 }}>
                ⟫
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
