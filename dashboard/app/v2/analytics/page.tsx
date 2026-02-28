'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

interface AnalyticsPoint {
  time: string;
  [key: string]: any;
}

function Sparkline({ data, color = '#0AD4FF', height = 60, fillOpacity = 0.1 }: { data: number[]; color?: string; height?: number; fillOpacity?: number }) {
  if (!data || data.length < 2) {
    return <div style={{ height, background: 'rgba(255,255,255,0.02)', borderRadius: 6 }} />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 400, h = height;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(' ');
  const area = `M 0,${h} L ${pts.split(' ').map((p, i) => {
    const [x, y] = p.split(',');
    return `${x},${y}`;
  }).join(' L ')} L ${w},${h} Z`;

  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#grad-${color.replace('#', '')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LineChart({ series, labels, height = 180 }: { series: { name: string; data: number[]; color: string }[]; labels: string[]; height?: number }) {
  if (!series.length || !series[0].data.length) {
    return <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>No data available</div>;
  }

  const allValues = series.flatMap(s => s.data);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const w = 600, h = height;
  const pad = { t: 10, r: 10, b: 30, l: 45 };
  const cw = w - pad.l - pad.r;
  const ch = h - pad.t - pad.b;
  const n = series[0].data.length;

  const getX = (i: number) => pad.l + (i / (n - 1)) * cw;
  const getY = (v: number) => pad.t + ch - ((v - min) / range) * ch;

  const gridLines = 4;
  const labelStep = Math.max(1, Math.floor(n / 6));

  return (
    <div>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
        {/* Grid */}
        {Array.from({ length: gridLines + 1 }, (_, i) => {
          const y = pad.t + (i / gridLines) * ch;
          const val = max - (i / gridLines) * range;
          return (
            <g key={i}>
              <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
              <text x={pad.l - 6} y={y + 4} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize="9">
                {val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* Series */}
        {series.map(s => {
          const pts = s.data.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');
          return (
            <polyline key={s.name} points={pts} fill="none" stroke={s.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          );
        })}

        {/* X labels */}
        {labels.filter((_, i) => i % labelStep === 0).map((l, idx) => {
          const i = idx * labelStep;
          return (
            <text key={idx} x={getX(i)} y={h - 6} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="8">
              {new Date(l).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8 }}>
        {series.map(s => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 14, height: 2, background: s.color, borderRadius: 1 }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>{s.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const METRIC_DEFS = [
  { id: 'blocks', label: 'Block Height', color: '#0AD4FF', unit: 'blocks' },
  { id: 'peers', label: 'Peer Count', color: '#30D158', unit: 'peers' },
  { id: 'cpu', label: 'CPU Usage', color: '#FF9F0A', unit: '%' },
  { id: 'memory', label: 'Memory', color: '#BF5AF2', unit: '%' },
  { id: 'disk', label: 'Disk', color: '#FF453A', unit: '%' },
  { id: 'uptime', label: 'Uptime', color: '#0A84FF', unit: '%' },
];

export default function V2AnalyticsPage() {
  const [data, setData] = useState<AnalyticsPoint[]>([]);
  const [fleetData, setFleetData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<string>('blocks');
  const [range, setRange] = useState<string>('24h');

  const fetchData = useCallback(async () => {
    try {
      const [analyticsRes, fleetRes] = await Promise.all([
        fetch(`/api/v1/analytics?metric=${selectedMetric}&range=${range}`, { cache: 'no-store' }),
        fetch('/api/v1/fleet/status', { cache: 'no-store' }),
      ]);

      if (analyticsRes.ok) {
        const d = await analyticsRes.json();
        setData(d.timeseries || d.data?.timeseries || []);
      }
      if (fleetRes.ok) {
        const d = await fleetRes.json();
        setFleetData(d.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedMetric, range]);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 15000);
    return () => clearInterval(t);
  }, [fetchData]);

  const nodes = fleetData?.nodes || [];
  const healthScore = fleetData?.healthScore || 0;

  // Build chart series from fleet nodes (per-node block height)
  const blockSeries = useMemo(() => {
    if (nodes.length === 0) return [];
    // Show up to 5 nodes
    return nodes.slice(0, 5).map((n: any, i: number) => ({
      name: n.name || `Node ${i + 1}`,
      data: [n.blockHeight || 0],
      color: ['#0AD4FF', '#30D158', '#FF9F0A', '#BF5AF2', '#FF453A'][i % 5],
    }));
  }, [nodes]);

  // Analytics timeseries
  const chartSeries = useMemo(() => {
    if (data.length === 0) return [];
    const metric = METRIC_DEFS.find(m => m.id === selectedMetric);
    if (!metric) return [];

    // Try to find keys in the timeseries
    const firstPoint = data[0];
    const keys = Object.keys(firstPoint).filter(k => k !== 'time');
    return keys.slice(0, 5).map((k, i) => ({
      name: k,
      data: data.map(d => Number(d[k]) || 0),
      color: ['#0AD4FF', '#30D158', '#FF9F0A', '#BF5AF2', '#FF453A'][i % 5],
    }));
  }, [data, selectedMetric]);

  const chartLabels = data.map(d => d.time);

  const summaryStats = useMemo(() => {
    if (nodes.length === 0) return null;
    const avgCpu = nodes.reduce((s: number, n: any) => s + (n.cpuPercent || 0), 0) / nodes.length;
    const avgMem = nodes.reduce((s: number, n: any) => s + (n.memoryPercent || 0), 0) / nodes.length;
    const avgDisk = nodes.reduce((s: number, n: any) => s + (n.diskPercent || 0), 0) / nodes.length;
    const avgPeers = nodes.reduce((s: number, n: any) => s + (n.peerCount || 0), 0) / nodes.length;
    const maxBlock = Math.max(...nodes.map((n: any) => n.blockHeight || 0));
    return { avgCpu, avgMem, avgDisk, avgPeers, maxBlock };
  }, [nodes]);

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
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', background: 'linear-gradient(135deg,white 60%,rgba(0,212,255,0.6))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>Analytics</h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Fleet performance metrics · auto-refresh 15s</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['24h', '7d', '30d'].map(r => (
            <button key={r} onClick={() => setRange(r)}
              style={{ padding: '7px 14px', borderRadius: 9, background: range === r ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${range === r ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.08)'}`, color: range === r ? '#0AD4FF' : 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      {summaryStats && (
        <div className="v2-grid-4" style={{ marginBottom: 20 }}>
          {[
            { label: 'HEALTH SCORE', value: `${healthScore}%`, color: healthScore >= 90 ? '#30D158' : healthScore >= 70 ? '#FF9F0A' : '#FF453A', sub: 'fleet health' },
            { label: 'MAX BLOCK', value: summaryStats.maxBlock.toLocaleString(), color: '#0AD4FF', sub: 'network tip' },
            { label: 'AVG PEERS', value: summaryStats.avgPeers.toFixed(1), color: '#30D158', sub: 'per node' },
            { label: 'AVG CPU', value: `${summaryStats.avgCpu.toFixed(1)}%`, color: summaryStats.avgCpu > 80 ? '#FF453A' : summaryStats.avgCpu > 60 ? '#FF9F0A' : '#30D158', sub: 'fleet average' },
          ].map((c, i) => (
            <div key={c.label} className="glass-card" style={{ padding: 20, animationDelay: `${i * 0.05}s` }}>
              <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '.1em', marginBottom: 8 }}>{c.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: c.color }}>{c.value}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{c.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Resource Averages */}
      {summaryStats && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 16, animationDelay: '0.2s' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 16, letterSpacing: '.06em' }}>FLEET RESOURCE AVERAGES</div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'CPU', value: summaryStats.avgCpu, color: '#FF9F0A' },
              { label: 'Memory', value: summaryStats.avgMem, color: '#BF5AF2' },
              { label: 'Disk', value: summaryStats.avgDisk, color: '#FF453A' },
            ].map(r => (
              <div key={r.label} style={{ flex: 1, minWidth: 100 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{r.label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: r.color }}>{r.value.toFixed(1)}%</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(r.value, 100)}%`, background: r.color, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metric Selector + Chart */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 16, animationDelay: '0.25s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>Timeseries Chart</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {METRIC_DEFS.map(m => (
              <button key={m.id} onClick={() => setSelectedMetric(m.id)}
                style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: selectedMetric === m.id ? `${m.color}18` : 'rgba(255,255,255,0.03)', border: `1px solid ${selectedMetric === m.id ? m.color + '40' : 'rgba(255,255,255,0.07)'}`, color: selectedMetric === m.id ? m.color : 'rgba(255,255,255,0.4)', transition: 'all 0.2s' }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        {chartSeries.length > 0 ? (
          <LineChart series={chartSeries} labels={chartLabels} height={200} />
        ) : (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
            No analytics data for this time range. Historical metrics are collected over time.
          </div>
        )}
      </div>

      {/* Per-Node Block Heights */}
      <div className="glass-card" style={{ padding: 20, animationDelay: '0.3s' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 16, letterSpacing: '.06em' }}>CURRENT BLOCK HEIGHTS BY NODE</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {nodes.slice(0, 15).map((n: any, i: number) => {
            const maxBH = Math.max(...nodes.map((x: any) => x.blockHeight || 0));
            const pct = maxBH > 0 ? ((n.blockHeight || 0) / maxBH) * 100 : 0;
            const colors = ['#0AD4FF', '#30D158', '#FF9F0A', '#BF5AF2', '#FF453A', '#0A84FF', '#FF6B35'];
            const c = colors[i % colors.length];
            return (
              <div key={n.id || i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 120, fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>{n.name}</div>
                <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: c, borderRadius: 3, transition: 'width 0.5s ease' }} />
                </div>
                <div style={{ width: 90, fontSize: 11, color: c, fontWeight: 700, textAlign: 'right', fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>{(n.blockHeight || 0).toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
