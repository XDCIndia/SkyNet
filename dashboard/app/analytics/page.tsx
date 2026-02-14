'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { 
  BarChart3, 
  Calendar, 
  TrendingUp, 
  Activity,
  Clock,
  Wifi,
  Cpu,
  HardDrive,
  Server,
  RefreshCw,
  ChevronDown
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

interface AnalyticsData {
  metric: string;
  range: string;
  interval: string;
  timeseries: Array<{
    time: string;
    [key: string]: any;
  }>;
  summary: {
    nodeCount: number;
    earliest: string;
    latest: string;
    totalMetrics: number;
  };
}

type MetricType = 'uptime' | 'peers' | 'blocks' | 'latency' | 'cpu' | 'memory' | 'disk';
type TimeRange = '24h' | '7d' | '30d' | '90d';

const METRICS: { id: MetricType; label: string; icon: React.ReactNode; color: string; unit: string }[] = [
  { id: 'uptime', label: 'Node Uptime', icon: <Activity className="w-4 h-4" />, color: '#10B981', unit: '%' },
  { id: 'peers', label: 'Peer Count', icon: <Wifi className="w-4 h-4" />, color: '#1E90FF', unit: 'peers' },
  { id: 'blocks', label: 'Block Height', icon: <Server className="w-4 h-4" />, color: '#8B5CF6', unit: 'blocks' },
  { id: 'latency', label: 'Response Latency', icon: <Clock className="w-4 h-4" />, color: '#F59E0B', unit: 'ms' },
  { id: 'cpu', label: 'CPU Usage', icon: <Cpu className="w-4 h-4" />, color: '#EF4444', unit: '%' },
  { id: 'memory', label: 'Memory Usage', icon: <Server className="w-4 h-4" />, color: '#EC4899', unit: '%' },
  { id: 'disk', label: 'Disk Usage', icon: <HardDrive className="w-4 h-4" />, color: '#14B8A6', unit: '%' },
];

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
];

// SVG Line Chart Component
function LineChart({ data, xKey, yKey, color, height = 200 }: { 
  data: any[]; 
  xKey: string; 
  yKey: string;
  color: string;
  height?: number;
}) {
  if (data.length === 0) return null;

  const padding = { top: 10, right: 10, bottom: 30, left: 50 };
  const chartWidth = 800;
  const chartHeight = height;
  const width = chartWidth - padding.left - padding.right;
  const drawHeight = chartHeight - padding.top - padding.bottom;

  // Get min/max for scaling
  const yValues = data.map(d => d[yKey]).filter(v => v != null);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const yRange = maxY - minY || 1;

  // Scale functions
  const scaleX = (i: number) => padding.left + (i / (data.length - 1 || 1)) * width;
  const scaleY = (v: number) => padding.top + drawHeight - ((v - minY) / yRange) * drawHeight;

  // Generate path
  const pathD = data.map((d, i) => {
    const x = scaleX(i);
    const y = scaleY(d[yKey] ?? minY);
    return `${i === 0 ? 'M' : 'L'}${x},${y}`;
  }).join(' ');

  // Generate area path (for fill)
  const areaD = `${pathD} L${scaleX(data.length - 1)},${padding.top + drawHeight} L${padding.left},${padding.top + drawHeight} Z`;

  // Y-axis ticks
  const yTicks = 5;
  const tickValues = Array.from({ length: yTicks + 1 }, (_, i) => 
    minY + (yRange * i) / yTicks
  );

  return (
    <svg 
      viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id={`gradient-${yKey}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.05"/>
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {tickValues.map((tick, i) => (
        <line
          key={i}
          x1={padding.left}
          y1={scaleY(tick)}
          x2={padding.left + width}
          y2={scaleY(tick)}
          stroke="var(--border-subtle)"
          strokeWidth="1"
          strokeDasharray="4,4"
        />
      ))}

      {/* Area fill */}
      <path
        d={areaD}
        fill={`url(#gradient-${yKey})`}
      />

      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Data points */}
      {data.map((d, i) => (
        <circle
          key={i}
          cx={scaleX(i)}
          cy={scaleY(d[yKey] ?? minY)}
          r="3"
          fill={color}
          stroke="var(--bg-card)"
          strokeWidth="2"
        />
      ))}

      {/* Y-axis labels */}
      {tickValues.map((tick, i) => (
        <text
          key={i}
          x={padding.left - 10}
          y={scaleY(tick) + 4}
          textAnchor="end"
          fill="var(--text-tertiary)"
          fontSize="10"
        >
          {tick.toFixed(1)}
        </text>
      ))}

      {/* X-axis labels (show first, middle, last) */}
      {[0, Math.floor(data.length / 2), data.length - 1].map(i => (
        <text
          key={i}
          x={scaleX(i)}
          y={chartHeight - 5}
          textAnchor="middle"
          fill="var(--text-tertiary)"
          fontSize="10"
        >
          {new Date(data[i][xKey]).toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric',
            hour: data.length <= 24 ? 'numeric' : undefined,
          })}
        </text>
      ))}

      {/* Axes */}
      <line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={padding.top + drawHeight}
        stroke="var(--border-subtle)"
        strokeWidth="1"
      />
      <line
        x1={padding.left}
        y1={padding.top + drawHeight}
        x2={padding.left + width}
        y2={padding.top + drawHeight}
        stroke="var(--border-subtle)"
        strokeWidth="1"
      />
    </svg>
  );
}

// SVG Bar Chart Component
function BarChart({ data, xKey, yKey, color, height = 200 }: { 
  data: any[]; 
  xKey: string; 
  yKey: string;
  color: string;
  height?: number;
}) {
  if (data.length === 0) return null;

  const padding = { top: 10, right: 10, bottom: 30, left: 50 };
  const chartWidth = 800;
  const chartHeight = height;
  const width = chartWidth - padding.left - padding.right;
  const drawHeight = chartHeight - padding.top - padding.bottom;

  const yValues = data.map(d => d[yKey]).filter(v => v != null);
  const maxY = Math.max(...yValues, 1);

  const barWidth = (width / data.length) * 0.8;
  const barGap = (width / data.length) * 0.2;

  const scaleY = (v: number) => padding.top + drawHeight - (v / maxY) * drawHeight;
  const scaleX = (i: number) => padding.left + i * (width / data.length) + barGap / 2;

  return (
    <svg 
      viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Bars */}
      {data.map((d, i) => {
        const barHeight = (d[yKey] ?? 0) / maxY * drawHeight;
        return (
          <rect
            key={i}
            x={scaleX(i)}
            y={scaleY(d[yKey] ?? 0)}
            width={barWidth}
            height={barHeight}
            fill={color}
            rx="2"
            opacity="0.8"
          />
        );
      })}

      {/* Y-axis labels */}
      {Array.from({ length: 5 }, (_, i) => {
        const value = (maxY * i) / 4;
        return (
          <text
            key={i}
            x={padding.left - 10}
            y={scaleY(value) + 4}
            textAnchor="end"
            fill="var(--text-tertiary)"
            fontSize="10"
          >
            {value.toFixed(0)}
          </text>
        );
      })}

      {/* X-axis labels */}
      {[0, Math.floor(data.length / 2), data.length - 1].map(i => (
        <text
          key={i}
          x={scaleX(i) + barWidth / 2}
          y={chartHeight - 5}
          textAnchor="middle"
          fill="var(--text-tertiary)"
          fontSize="10"
        >
          {new Date(data[i][xKey]).toLocaleDateString(undefined, { 
            month: 'short', 
            day: 'numeric' 
          })}
        </text>
      ))}

      {/* Axes */}
      <line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={padding.top + drawHeight}
        stroke="var(--border-subtle)"
        strokeWidth="1"
      />
      <line
        x1={padding.left}
        y1={padding.top + drawHeight}
        x2={padding.left + width}
        y2={padding.top + drawHeight}
        stroke="var(--border-subtle)"
        strokeWidth="1"
      />
    </svg>
  );
}

export default function AnalyticsPage() {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('uptime');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const metricConfig = METRICS.find(m => m.id === selectedMetric)!;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/analytics?metric=${selectedMetric}&range=${timeRange}`);
      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setData(result.data);
        }
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMetric, timeRange]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate stats from timeseries data
  const stats = useMemo(() => {
    if (!data?.timeseries?.length) return null;

    const series = data.timeseries;
    let values: number[] = [];

    // Extract values based on metric type
    switch (selectedMetric) {
      case 'uptime':
        values = series.map(d => d.uptime_pct).filter(v => v != null);
        break;
      case 'peers':
        values = series.map(d => d.avg_peers).filter(v => v != null);
        break;
      case 'blocks':
        values = series.map(d => d.blocks_synced).filter(v => v != null);
        break;
      case 'latency':
        values = series.map(d => d.avg_latency).filter(v => v != null);
        break;
      case 'cpu':
      case 'memory':
      case 'disk':
        values = series.map(d => d[`avg_${selectedMetric}`]).filter(v => v != null);
        break;
    }

    if (values.length === 0) return null;

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { avg, min, max, count: values.length };
  }, [data, selectedMetric]);

  // Get chart data key
  const getChartDataKey = () => {
    switch (selectedMetric) {
      case 'uptime': return 'uptime_pct';
      case 'peers': return 'avg_peers';
      case 'blocks': return 'blocks_synced';
      case 'latency': return 'avg_latency';
      case 'cpu': return 'avg_cpu';
      case 'memory': return 'avg_memory';
      case 'disk': return 'avg_disk';
      default: return 'value';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--purple)]/20 to-[var(--accent-blue)]/20 flex items-center justify-center border border-[var(--purple)]/30">
              <BarChart3 className="w-5 h-5 text-[var(--purple)]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Analytics</h1>
              <p className="text-sm text-[var(--text-tertiary)]">Historical metrics and trends</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Time Range Selector */}
            <div className="relative">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                className="appearance-none px-4 py-2 pr-10 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
              >
                {TIME_RANGES.map(range => (
                  <option key={range.value} value={range.value}>{range.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] pointer-events-none" />
            </div>

            <button
              onClick={fetchData}
              disabled={loading}
              className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 text-[var(--text-tertiary)] ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Metric Selector */}
        <div className="flex flex-wrap gap-2">
          {METRICS.map(metric => (
            <button
              key={metric.id}
              onClick={() => setSelectedMetric(metric.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                selectedMetric === metric.id
                  ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-blue)]/50'
              }`}
            >
              <span style={{ color: metric.color }}>{metric.icon}</span>
              {metric.label}
            </button>
          ))}
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] p-4">
              <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">Average</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] font-mono-nums">
                {stats.avg.toFixed(2)}
                <span className="text-sm text-[var(--text-tertiary)] ml-1">{metricConfig.unit}</span>
              </p>
            </div>

            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] p-4">
              <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">Minimum</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] font-mono-nums">
                {stats.min.toFixed(2)}
                <span className="text-sm text-[var(--text-tertiary)] ml-1">{metricConfig.unit}</span>
              </p>
            </div>

            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] p-4">
              <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">Maximum</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] font-mono-nums">
                {stats.max.toFixed(2)}
                <span className="text-sm text-[var(--text-tertiary)] ml-1">{metricConfig.unit}</span>
              </p>
            </div>

            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] p-4">
              <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider">Data Points</p>
              <p className="text-2xl font-bold text-[var(--text-primary)] font-mono-nums">
                {stats.count.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Main Chart */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" style={{ color: metricConfig.color }} />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{metricConfig.label} Over Time</h2>
            </div>
            <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
              <Calendar className="w-4 h-4" />
              {data?.summary?.earliest && new Date(data.summary.earliest).toLocaleDateString()} 
              {' - '}
              {data?.summary?.latest && new Date(data.summary.latest).toLocaleDateString()}
            </div>
          </div>

          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-[var(--accent-blue)]/30 border-t-[var(--accent-blue)] rounded-full animate-spin" />
            </div>
          ) : data?.timeseries?.length ? (
            <div className="h-64 md:h-80">
              <LineChart
                data={data.timeseries}
                xKey="time"
                yKey={getChartDataKey()}
                color={metricConfig.color}
              />
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-[var(--text-tertiary)]">
              <Activity className="w-12 h-12 mb-4 opacity-50" />
              <p>No data available for this time range</p>
            </div>
          )}
        </div>

        {/* Secondary Charts Grid */}
        {(data?.timeseries?.length ?? 0) > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Min/Max Range Chart for applicable metrics */}
            {data && (selectedMetric === 'peers' || selectedMetric === 'latency' || selectedMetric === 'cpu' || selectedMetric === 'memory' || selectedMetric === 'disk') && (
              <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] p-6">
                <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Min/Max Range</h3>
                <div className="h-48">
                  <BarChart
                    data={data.timeseries}
                    xKey="time"
                    yKey={`max_${selectedMetric === 'peers' ? 'peers' : selectedMetric === 'latency' ? 'latency' : selectedMetric}`}
                    color={metricConfig.color}
                    height={180}
                  />
                </div>
              </div>
            )}

            {/* Summary Info */}
            <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] p-6">
              <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-4">Summary</h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-tertiary)]">Time Range</span>
                  <span className="text-sm text-[var(--text-primary)]">{TIME_RANGES.find(r => r.value === timeRange)?.label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-tertiary)]">Interval</span>
                  <span className="text-sm text-[var(--text-primary)]">{data?.interval}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-tertiary)]">Monitored Nodes</span>
                  <span className="text-sm text-[var(--text-primary)]">{data?.summary?.nodeCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-tertiary)]">Total Metrics</span>
                  <span className="text-sm text-[var(--text-primary)]">{(data?.summary?.totalMetrics || 0).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-tertiary)]">Last Updated</span>
                  <span className="text-sm text-[var(--text-primary)]">
                    {data?.summary?.latest && new Date(data.summary.latest).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
