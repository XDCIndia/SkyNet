'use client';

import { useState, useEffect, useCallback } from 'react';

interface Alert {
  id: string;
  node_id: string;
  node_name: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  status: string;
  detected_at: string;
  resolved_at: string | null;
}

interface AlertRule {
  id: string;
  name: string;
  description?: string;
  conditionType: string;
  thresholdValue: number;
  durationMinutes: number;
  severity: 'critical' | 'warning' | 'info';
  isActive: boolean;
}

function severityColor(s: string) {
  if (s === 'critical') return '#FF453A';
  if (s === 'warning') return '#FF9F0A';
  return '#0A84FF';
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return `${s}s ago`;
}

export default function V2AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'rules' | 'history'>('active');
  const [showNewRule, setShowNewRule] = useState(false);
  const [newRule, setNewRule] = useState({ name: '', conditionType: 'node_offline', thresholdValue: 5, durationMinutes: 5, severity: 'warning' as const });

  const fetchData = useCallback(async () => {
    try {
      const [alertsRes, rulesRes] = await Promise.all([
        fetch('/api/v1/alerts', { cache: 'no-store' }),
        fetch('/api/v1/alerts/rules', { cache: 'no-store' }),
      ]);
      if (alertsRes.ok) {
        const d = await alertsRes.json();
        setAlerts(d.alerts || []);
      }
      if (rulesRes.ok) {
        const d = await rulesRes.json();
        setRules(d.data || d.rules || []);
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

  const activeAlerts = alerts.filter(a => a.status === 'active' || a.status === 'firing');
  const resolvedAlerts = alerts.filter(a => a.status === 'resolved');
  const critical = activeAlerts.filter(a => a.severity === 'critical');
  const warnings = activeAlerts.filter(a => a.severity === 'warning');

  const handleCreateRule = async () => {
    try {
      await fetch('/api/v1/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule),
      });
      setShowNewRule(false);
      fetchData();
    } catch (e) {
      console.error(e);
    }
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
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', background: 'linear-gradient(135deg,white 60%,rgba(255,69,58,0.6))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>Alerts</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Monitor fleet health · auto-refresh 15s</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowNewRule(true)} style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(0,132,255,0.1)', border: '1px solid rgba(0,132,255,0.25)', color: '#0A84FF', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            + New Rule
          </button>
          <button onClick={fetchData} style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: 'rgba(0,212,255,0.9)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="v2-grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'ACTIVE ALERTS', value: activeAlerts.length, color: activeAlerts.length > 0 ? '#FF453A' : '#30D158', sub: 'need attention' },
          { label: 'CRITICAL', value: critical.length, color: '#FF453A', sub: 'immediate action' },
          { label: 'WARNINGS', value: warnings.length, color: '#FF9F0A', sub: 'monitor closely' },
          { label: 'RULES', value: rules.length, color: '#BF5AF2', sub: `${rules.filter(r => r.isActive).length} active` },
        ].map((c, i) => (
          <div key={c.label} className="glass-card" style={{ padding: 20, animationDelay: `${i * 0.05}s` }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '.1em', marginBottom: 8 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, padding: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: 12, width: 'fit-content', border: '1px solid rgba(255,255,255,0.06)' }}>
        {[
          { id: 'active', label: `Active (${activeAlerts.length})` },
          { id: 'rules', label: `Rules (${rules.length})` },
          { id: 'history', label: `History (${resolvedAlerts.length})` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id as any)}
            style={{ padding: '7px 16px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: tab === t.id ? 'rgba(0,212,255,0.1)' : 'transparent', border: tab === t.id ? '1px solid rgba(0,212,255,0.2)' : '1px solid transparent', color: tab === t.id ? '#0AD4FF' : 'rgba(255,255,255,0.4)', transition: 'all 0.2s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Active Alerts */}
      {tab === 'active' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {activeAlerts.length === 0 ? (
            <div className="glass-card" style={{ padding: 40, textAlign: 'center', animationDelay: '0.2s' }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
              <div style={{ fontSize: 14, color: '#30D158', fontWeight: 600 }}>All clear! No active alerts</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Fleet is operating normally</div>
            </div>
          ) : activeAlerts.map((alert, i) => {
            const sc = severityColor(alert.severity);
            return (
              <div key={alert.id} className="glass-card" style={{ padding: 18, animationDelay: `${0.2 + i * 0.04}s`, borderLeft: `3px solid ${sc}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: `${sc}15`, color: sc, border: `1px solid ${sc}25`, textTransform: 'uppercase', letterSpacing: '.08em' }}>{alert.severity}</span>
                      <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)', textTransform: 'uppercase' }}>{alert.type}</span>
                      {alert.node_name && <span style={{ fontSize: 10, color: '#0AD4FF' }}>{alert.node_name}</span>}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 4 }}>{alert.title}</div>
                    {alert.description && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{alert.description}</div>}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>{timeAgo(alert.detected_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rules */}
      {tab === 'rules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rules.length === 0 ? (
            <div className="glass-card" style={{ padding: 40, textAlign: 'center', animationDelay: '0.2s' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>No alert rules configured</div>
              <button onClick={() => setShowNewRule(true)} style={{ padding: '8px 20px', borderRadius: 10, background: 'rgba(0,132,255,0.1)', border: '1px solid rgba(0,132,255,0.25)', color: '#0A84FF', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                Create First Rule
              </button>
            </div>
          ) : rules.map((rule, i) => {
            const sc = severityColor(rule.severity);
            return (
              <div key={rule.id} className="glass-card" style={{ padding: 18, animationDelay: `${0.2 + i * 0.04}s`, opacity: rule.isActive ? undefined : 0.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: `${sc}15`, color: sc, border: `1px solid ${sc}25`, textTransform: 'uppercase' }}>{rule.severity}</span>
                      {!rule.isActive && <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 5, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>INACTIVE</span>}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 4 }}>{rule.name}</div>
                    {rule.description && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{rule.description}</div>}
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6 }}>
                      {rule.conditionType} &gt; {rule.thresholdValue} · for {rule.durationMinutes}min
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* History */}
      {tab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {resolvedAlerts.length === 0 ? (
            <div className="glass-card" style={{ padding: 40, textAlign: 'center', animationDelay: '0.2s' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>No resolved alerts</div>
            </div>
          ) : resolvedAlerts.map((alert, i) => {
            const sc = severityColor(alert.severity);
            return (
              <div key={alert.id} className="glass-card" style={{ padding: 16, animationDelay: `${0.2 + i * 0.03}s`, opacity: 0.7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 5, background: `${sc}10`, color: sc, textTransform: 'uppercase' }}>{alert.severity}</span>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>{alert.title}</span>
                    {alert.node_name && <span style={{ fontSize: 10, color: 'rgba(0,212,255,0.6)' }}>{alert.node_name}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 9, padding: '2px 8px', borderRadius: 5, background: 'rgba(48,209,88,0.1)', color: '#30D158', fontWeight: 700 }}>RESOLVED</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{alert.resolved_at ? timeAgo(alert.resolved_at) : 'unknown'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Rule Modal */}
      {showNewRule && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div style={{ background: 'rgba(6,8,12,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: 0 }}>New Alert Rule</h3>
              <button onClick={() => setShowNewRule(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Rule Name', key: 'name', type: 'text', placeholder: 'e.g. Node Offline Alert' },
              ].map(f => (
                <div key={f.key}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{f.label}</div>
                  <input
                    type={f.type} placeholder={f.placeholder} value={(newRule as any)[f.key]}
                    onChange={e => setNewRule({ ...newRule, [f.key]: e.target.value })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Condition</div>
                <select value={newRule.conditionType} onChange={e => setNewRule({ ...newRule, conditionType: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: 13, outline: 'none' }}>
                  {['node_offline', 'sync_behind', 'disk_usage', 'peer_count', 'cpu_usage', 'memory_usage'].map(c => (
                    <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, l => l?.toUpperCase())}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Threshold</div>
                  <input type="number" value={newRule.thresholdValue} onChange={e => setNewRule({ ...newRule, thresholdValue: Number(e.target.value) })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Duration (min)</div>
                  <input type="number" value={newRule.durationMinutes} onChange={e => setNewRule({ ...newRule, durationMinutes: Number(e.target.value) })}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>Severity</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['critical', 'warning', 'info'] as const).map(s => (
                    <button key={s} onClick={() => setNewRule({ ...newRule, severity: s })}
                      style={{ flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', background: newRule.severity === s ? `${severityColor(s)}20` : 'rgba(255,255,255,0.04)', border: `1px solid ${newRule.severity === s ? severityColor(s) + '40' : 'rgba(255,255,255,0.08)'}`, color: newRule.severity === s ? severityColor(s) : 'rgba(255,255,255,0.4)', transition: 'all 0.2s' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button onClick={() => setShowNewRule(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                <button onClick={handleCreateRule} style={{ flex: 1, padding: '10px 0', borderRadius: 10, background: 'rgba(0,132,255,0.15)', border: '1px solid rgba(0,132,255,0.3)', color: '#0A84FF', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Create Rule</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
