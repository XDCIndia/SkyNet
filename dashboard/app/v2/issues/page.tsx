'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

interface Issue {
  id: string;
  repo: string;
  number: number;
  title: string;
  severity: string;
  status: string;
  created_at: string;
  labels: string[];
  body?: string;
  github_url?: string;
  html_url?: string;
}

function severityColor(s: string) {
  if (s === 'critical') return '#FF453A';
  if (s === 'high') return '#FF6B35';
  if (s === 'medium' || s === 'warning') return '#FF9F0A';
  if (s === 'low') return '#30D158';
  return '#0A84FF';
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return 'just now';
}

export default function V2IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRepo, setFilterRepo] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterStatus, setFilterStatus] = useState('open');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/issues', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setIssues(d.issues || []);
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

  const repos = useMemo(() => ['all', ...new Set(issues.map(i => i.repo))], [issues]);
  const severities = useMemo(() => ['all', ...new Set(issues.map(i => i.severity).filter(Boolean))], [issues]);

  const filtered = useMemo(() => {
    let r = issues;
    if (filterStatus !== 'all') r = r.filter(i => i.status === filterStatus);
    if (filterRepo !== 'all') r = r.filter(i => i.repo === filterRepo);
    if (filterSeverity !== 'all') r = r.filter(i => i.severity === filterSeverity);
    if (search) r = r.filter(i => i.title.toLowerCase().includes(search.toLowerCase()) || i.body?.toLowerCase().includes(search.toLowerCase()));
    return r;
  }, [issues, filterRepo, filterSeverity, filterStatus, search]);

  const stats = useMemo(() => ({
    open: issues.filter(i => i.status === 'open').length,
    critical: issues.filter(i => i.severity === 'critical').length,
    high: issues.filter(i => i.severity === 'high').length,
    repos: new Set(issues.map(i => i.repo)).size,
  }), [issues]);

  const toggleExpand = (id: string) => {
    const s = new Set(expanded);
    if (s.has(id)) s.delete(id); else s.add(id);
    setExpanded(s);
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
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', background: 'linear-gradient(135deg,white 60%,rgba(191,90,242,0.6))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>GitHub Issues</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{stats.open} open issues across {stats.repos} repos</p>
        </div>
        <button onClick={fetchData} style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: 'rgba(0,212,255,0.9)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          ↺ Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="v2-grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'OPEN ISSUES', value: stats.open, color: '#0AD4FF', sub: 'need triage' },
          { label: 'CRITICAL', value: stats.critical, color: '#FF453A', sub: 'immediate fix' },
          { label: 'HIGH', value: stats.high, color: '#FF6B35', sub: 'prioritize' },
          { label: 'REPOS', value: stats.repos, color: '#BF5AF2', sub: 'tracked' },
        ].map((c, i) => (
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search issues..."
            style={{ flex: 1, minWidth: 160, padding: '7px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: 12, outline: 'none' }} />
          {[
            { label: 'Status', val: filterStatus, set: setFilterStatus, opts: ['all', 'open', 'resolved', 'closed'] },
            { label: 'Repo', val: filterRepo, set: setFilterRepo, opts: repos },
            { label: 'Severity', val: filterSeverity, set: setFilterSeverity, opts: severities },
          ].map(f => (
            <select key={f.label} value={f.val} onChange={e => f.set(e.target.value)}
              style={{ padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', fontSize: 12, outline: 'none' }}>
              {f.opts.map(o => <option key={o} value={o}>{o === 'all' ? `All ${f.label}` : o}</option>)}
            </select>
          ))}
        </div>
      </div>

      {/* Issues List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 ? (
          <div className="glass-card" style={{ padding: 40, textAlign: 'center', animationDelay: '0.2s' }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>No issues match your filters</div>
          </div>
        ) : filtered.map((issue, i) => {
          const sc = severityColor(issue.severity);
          const isOpen = expanded.has(issue.id);
          const url = issue.github_url || issue.html_url;
          return (
            <div key={issue.id} className="glass-card" style={{ padding: 0, overflow: 'hidden', animationDelay: `${0.2 + i * 0.03}s` }}>
              <div onClick={() => toggleExpand(issue.id)} style={{ padding: '16px 18px', cursor: 'pointer' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      {issue.severity && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: `${sc}15`, color: sc, border: `1px solid ${sc}25`, textTransform: 'uppercase' }}>{issue.severity}</span>
                      )}
                      <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 5, background: 'rgba(191,90,242,0.1)', color: '#BF5AF2', border: '1px solid rgba(191,90,242,0.2)' }}>{issue.repo}</span>
                      {issue.number && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono',monospace" }}>#{issue.number}</span>}
                      {issue.labels?.slice(0, 3).map(l => (
                        <span key={l} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)' }}>{l}</span>
                      ))}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)', lineHeight: 1.4 }}>{issue.title}</div>
                    {!isOpen && issue.body && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {issue.body.replace(/[#*`]/g, '').slice(0, 160)}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{timeAgo(issue.created_at)}</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14, transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>›</span>
                  </div>
                </div>
              </div>
              {isOpen && issue.body && (
                <div style={{ padding: '0 18px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <pre style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '12px 0', fontFamily: 'inherit' }}>
                    {issue.body.replace(/[#*`]/g, '').slice(0, 800)}{issue.body.length > 800 ? '...' : ''}
                  </pre>
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#0A84FF', textDecoration: 'none', padding: '6px 12px', borderRadius: 8, background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.2)' }}>
                      View on GitHub ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
