'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

interface Peer {
  enode: string;
  ip: string;
  port: number;
  clientType: string;
  blockHeight: number;
  name?: string;
  country?: string;
  city?: string;
  latencyMs?: number;
}

function clientColor(c: string) {
  const lc = (c || '').toLowerCase();
  if (lc.includes('geth')) return '#0A84FF';
  if (lc.includes('erigon')) return '#FF9F0A';
  if (lc.includes('nethermind')) return '#BF5AF2';
  if (lc.includes('reth')) return '#30D158';
  return 'rgba(255,255,255,0.4)';
}

export default function V2PeersPage() {
  const [peers, setPeers] = useState<Peer[]>([]);
  const [healthyPeers, setHealthyPeers] = useState<Peer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterClient, setFilterClient] = useState('all');
  const [minBlock, setMinBlock] = useState('');
  const [tab, setTab] = useState<'all' | 'healthy'>('all');
  const [copied, setCopied] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [peersRes, healthyRes] = await Promise.all([
        fetch('/api/v1/peers', { cache: 'no-store' }),
        fetch('/api/v1/peers/healthy', { cache: 'no-store' }),
      ]);
      if (peersRes.ok) {
        const d = await peersRes.json();
        setPeers(d.peers || []);
      }
      if (healthyRes.ok) {
        const d = await healthyRes.json();
        setHealthyPeers(d.peers || []);
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

  const sourcePeers = tab === 'healthy' ? healthyPeers : peers;
  const clientTypes = useMemo(() => ['all', ...new Set(sourcePeers.map(p => p.clientType).filter(Boolean))], [sourcePeers]);

  const filtered = useMemo(() => {
    let r = sourcePeers;
    if (search) r = r.filter(p => p.ip?.includes(search) || p.enode?.includes(search) || p.clientType?.toLowerCase().includes(search.toLowerCase()));
    if (filterClient !== 'all') r = r.filter(p => p.clientType === filterClient);
    if (minBlock) r = r.filter(p => (p.blockHeight || 0) >= Number(minBlock));
    return r;
  }, [sourcePeers, search, filterClient, minBlock]);

  const copyEnode = async (enode: string) => {
    try {
      await navigator.clipboard.writeText(enode);
      setCopied(enode);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  };

  const downloadStaticNodes = () => {
    const enodes = healthyPeers.slice(0, 25).map(p => p.enode).filter(Boolean);
    const blob = new Blob([JSON.stringify(enodes, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'static-nodes.json';
    a.click();
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.05)', borderTop: '2px solid rgba(0,212,255,0.8)', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  const clientDist = useMemo(() => {
    const map: Record<string, number> = {};
    peers.forEach(p => {
      const k = p.clientType || 'unknown';
      map[k] = (map[k] || 0) + 1;
    });
    return map;
  }, [peers]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12, opacity: 0, animation: 'fadeUp .8s ease .1s forwards' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', background: 'linear-gradient(135deg,white 60%,rgba(48,209,88,0.6))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>Peers</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{peers.length} discovered · {healthyPeers.length} healthy</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={downloadStaticNodes}
            style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(48,209,88,0.08)', border: '1px solid rgba(48,209,88,0.2)', color: '#30D158', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ↓ static-nodes.json
          </button>
          <button onClick={fetchData} style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: 'rgba(0,212,255,0.9)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="v2-grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'ALL PEERS', value: peers.length, color: '#0AD4FF', sub: 'discovered' },
          { label: 'HEALTHY', value: healthyPeers.length, color: '#30D158', sub: 'high block height' },
          ...Object.entries(clientDist).slice(0, 2).map(([k, v]) => ({
            label: k.toUpperCase(), value: v, color: clientColor(k), sub: `${((v / peers.length) * 100).toFixed(0)}% of peers`,
          })),
        ].map((c, i) => (
          <div key={i} className="glass-card" style={{ padding: 20, animationDelay: `${i * 0.05}s` }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '.1em', marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs + Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 2, padding: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
          {[{ id: 'all', label: `All (${peers.length})` }, { id: 'healthy', label: `Healthy (${healthyPeers.length})` }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: tab === t.id ? 'rgba(0,212,255,0.1)' : 'transparent', border: tab === t.id ? '1px solid rgba(0,212,255,0.2)' : '1px solid transparent', color: tab === t.id ? '#0AD4FF' : 'rgba(255,255,255,0.4)', transition: 'all 0.2s' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card" style={{ padding: '12px 14px', marginBottom: 14, animationDelay: '0.2s' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by IP or enode..."
            style={{ flex: 1, minWidth: 160, padding: '7px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: 12, outline: 'none' }} />
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontSize: 12, outline: 'none' }}>
            {clientTypes.map(o => <option key={o} value={o}>{o === 'all' ? 'All Clients' : o}</option>)}
          </select>
          <input value={minBlock} onChange={e => setMinBlock(e.target.value)} placeholder="Min block height..."
            type="number"
            style={{ width: 150, padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontSize: 12, outline: 'none' }} />
        </div>
      </div>

      {/* Peers Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden', animationDelay: '0.25s' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['IP', 'Client', 'Block Height', 'Port', 'Enode', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.25)', letterSpacing: '.08em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((p, i) => {
                const cc = clientColor(p.clientType);
                return (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 14px', fontFamily: "'JetBrains Mono',monospace", color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{p.ip || '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: `${cc}15`, color: cc, border: `1px solid ${cc}25`, textTransform: 'capitalize' }}>
                        {p.clientType || 'unknown'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#0AD4FF', fontFamily: "'JetBrains Mono',monospace", fontWeight: 700 }}>
                      {(p.blockHeight || 0).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.35)', fontFamily: "'JetBrains Mono',monospace" }}>{p.port}</td>
                    <td style={{ padding: '10px 14px', color: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono',monospace", fontSize: 10, maxWidth: 200 }}>
                      {p.enode ? p.enode.slice(0, 30) + '…' : '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {p.enode && (
                        <button onClick={() => copyEnode(p.enode)}
                          style={{ padding: '4px 10px', borderRadius: 6, background: copied === p.enode ? 'rgba(48,209,88,0.1)' : 'rgba(0,212,255,0.08)', border: `1px solid ${copied === p.enode ? 'rgba(48,209,88,0.2)' : 'rgba(0,212,255,0.2)'}`, color: copied === p.enode ? '#30D158' : '#0AD4FF', fontSize: 10, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          {copied === p.enode ? '✓ Copied' : 'Copy enode'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>No peers match your filters</div>
          )}
          {filtered.length > 100 && (
            <div style={{ padding: '10px 14px', textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.25)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
              Showing 100 of {filtered.length} peers
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
