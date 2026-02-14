'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, 
  AlertCircle,
  CheckCircle2,
  Terminal,
  Wrench,
  Activity,
  HardDrive,
  Cpu,
  Network,
  Settings,
  ChevronDown,
  ChevronUp,
  Play,
  RefreshCw,
} from 'lucide-react';
import type { NodeStatus } from './types';

interface DiagnosticResult {
  name: string;
  category: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: string;
}

interface DiagnosticsData {
  results: DiagnosticResult[];
  summary: {
    pass: number;
    warn: number;
    fail: number;
  };
  timestamp: string;
}

interface TroubleshootPanelProps {
  nodeId: string;
  status: NodeStatus;
}

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  infrastructure: HardDrive,
  node: Activity,
  network: Network,
  resources: Cpu,
  configuration: Settings,
};

const categoryLabels: Record<string, string> = {
  infrastructure: 'Infrastructure',
  node: 'Node Status',
  network: 'Network',
  resources: 'Resources',
  configuration: 'Configuration',
};

export default function TroubleshootPanel({ nodeId, status }: TroubleshootPanelProps) {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const runDiagnostics = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // For now, generate diagnostics from the status data
      // In a real implementation, this would call an API endpoint
      const results: DiagnosticResult[] = [
        {
          name: 'RPC Connection',
          category: 'network',
          status: status.rpcLatencyMs ? 'pass' : 'fail',
          message: status.rpcLatencyMs ? `Connected (${status.rpcLatencyMs}ms)` : 'Not connected',
        },
        {
          name: 'Block Sync',
          category: 'node',
          status: status.isSyncing ? 'warn' : 'pass',
          message: status.isSyncing ? `Syncing ${status.syncPercent.toFixed(1)}%` : 'Fully synced',
        },
        {
          name: 'Peer Count',
          category: 'network',
          status: (status.peerCount || 0) > 0 ? 'pass' : 'fail',
          message: `${status.peerCount || 0} peers connected`,
        },
        {
          name: 'CPU Usage',
          category: 'resources',
          status: (status.system?.cpuPercent || 0) > 80 ? 'warn' : 'pass',
          message: `${status.system?.cpuPercent || 0}% CPU usage`,
        },
        {
          name: 'Memory Usage',
          category: 'resources',
          status: (status.system?.memoryPercent || 0) > 80 ? 'warn' : 'pass',
          message: `${status.system?.memoryPercent || 0}% memory usage`,
        },
        {
          name: 'Disk Usage',
          category: 'resources',
          status: (status.system?.diskPercent || 0) > 90 ? 'fail' : (status.system?.diskPercent || 0) > 80 ? 'warn' : 'pass',
          message: `${status.system?.diskPercent || 0}% disk used`,
        },
        {
          name: 'Client Version',
          category: 'configuration',
          status: status.clientVersion ? 'pass' : 'warn',
          message: status.clientVersion || 'Unknown',
        },
        {
          name: 'Coinbase Set',
          category: 'configuration',
          status: status.coinbase && status.coinbase !== '0x0' ? 'pass' : 'warn',
          message: status.coinbase && status.coinbase !== '0x0' ? 'Configured' : 'Not configured',
        },
      ];
      
      const summary = {
        pass: results.filter(r => r.status === 'pass').length,
        warn: results.filter(r => r.status === 'warn').length,
        fail: results.filter(r => r.status === 'fail').length,
      };
      
      setData({
        results,
        summary,
        timestamp: new Date().toISOString(),
      });
      setLastRun(new Date());
    } catch (err) {
      console.error('Failed to run diagnostics:', err);
      setError(err instanceof Error ? err.message : 'Failed to run diagnostics');
    } finally {
      setLoading(false);
    }
  }, [status]);

  // Run diagnostics on mount and when status changes
  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  const toggleExpand = (name: string) => {
    setExpandedChecks(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle2 className="w-5 h-5 text-[var(--success)]" />;
      case 'warn':
        return <AlertTriangle className="w-5 h-5 text-[var(--warning)]" />;
      case 'fail':
        return <AlertCircle className="w-5 h-5 text-[var(--critical)]" />;
      default:
        return <Activity className="w-5 h-5 text-[var(--text-tertiary)]" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass':
        return 'bg-[var(--success)]/10 border-[var(--success)]/20 text-[var(--success)]';
      case 'warn':
        return 'bg-[var(--warning)]/10 border-[var(--warning)]/20 text-[var(--warning)]';
      case 'fail':
        return 'bg-[var(--critical)]/10 border-[var(--critical)]/20 text-[var(--critical)]';
      default:
        return 'bg-[var(--bg-hover)] border-[var(--border-subtle)] text-[var(--text-tertiary)]';
    }
  };

  // Group results by category
  const groupedResults = data?.results.reduce((acc, result) => {
    if (!acc[result.category]) {
      acc[result.category] = [];
    }
    acc[result.category].push(result);
    return acc;
  }, {} as Record<string, DiagnosticResult[]>) || {};

  const overallStatus = data?.summary 
    ? data.summary.fail > 0 ? 'fail' : data.summary.warn > 0 ? 'warn' : 'pass'
    : null;

  return (
    <div className="card-xdc">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--warning)]/20 to-[var(--critical)]/10 flex items-center justify-center">
            <Wrench className="w-5 h-5 text-[var(--warning)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Diagnostics</h2>
            <p className="text-sm text-[var(--text-tertiary)]">
              {lastRun 
                ? `Last run: ${lastRun.toLocaleTimeString()}` 
                : 'System health checks'}
            </p>
          </div>
        </div>

        <button
          onClick={runDiagnostics}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--bg-card-hover)] text-[var(--text-primary)] text-sm transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Diagnostics
            </>
          )}
        </button>
      </div>

      {/* Summary Cards */}
      {data?.summary && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3 rounded-lg bg-[var(--success)]/10 border border-[var(--success)]/20 text-center">
            <div className="text-2xl font-bold text-[var(--success)]">{data.summary.pass}</div>
            <div className="text-xs text-[var(--success)]/70">Passing</div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--warning)]/10 border border-[var(--warning)]/20 text-center">
            <div className="text-2xl font-bold text-[var(--warning)]">{data.summary.warn}</div>
            <div className="text-xs text-[var(--warning)]/70">Warnings</div>
          </div>
          <div className="p-3 rounded-lg bg-[var(--critical)]/10 border border-[var(--critical)]/20 text-center">
            <div className="text-2xl font-bold text-[var(--critical)]">{data.summary.fail}</div>
            <div className="text-xs text-[var(--critical)]/70">Failed</div>
          </div>
        </div>
      )}

      {/* Overall Status */}
      {overallStatus && (
        <div className={`p-4 rounded-lg mb-6 flex items-center gap-3 ${getStatusColor(overallStatus)}`}>
          {getStatusIcon(overallStatus)}
          <div>
            <div className="font-medium">
              {overallStatus === 'pass' ? 'All systems operational'
                : overallStatus === 'warn' ? 'Some issues detected'
                : 'Critical issues found'}
            </div>
            <div className="text-sm opacity-70">
              {data?.summary?.fail && data.summary.fail > 0 
                ? `${data?.summary?.fail ?? 0} check(s) failed` 
                : data?.summary?.warn && data.summary.warn > 0 
                ? `${data?.summary?.warn ?? 0} warning(s)` 
                : 'All checks passed'}
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="p-4 rounded-lg bg-[var(--critical)]/10 border border-[var(--critical)]/20 text-[var(--critical)] mb-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>Failed to run diagnostics: {error}</span>
          </div>
        </div>
      )}

      {/* Results by Category */}
      <div className="space-y-4">
        {Object.entries(groupedResults).map(([category, results]) => {
          const Icon = categoryIcons[category] || Terminal;
          const hasIssues = results.some(r => r.status === 'fail' || r.status === 'warn');
          
          return (
            <div key={category} className="border border-[var(--border-subtle)] rounded-lg overflow-hidden">
              <div className={`flex items-center gap-2 px-4 py-3 bg-[var(--bg-hover)] ${hasIssues ? 'border-l-2 border-l-[var(--warning)]' : ''}`}>
                <Icon className="w-4 h-4 text-[var(--accent-blue)]" />
                <span className="font-medium text-[var(--text-primary)] capitalize">
                  {categoryLabels[category] || category}
                </span>
                <span className="text-xs text-[var(--text-tertiary)] ml-auto">
                  {results.filter(r => r.status === 'pass').length}/{results.length} passing
                </span>
              </div>
              
              <div className="divide-y divide-[var(--border-subtle)]">
                {results.map((result) => (
                  <div key={result.name} className="bg-[var(--bg-body)]">
                    <button
                      onClick={() => toggleExpand(result.name)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-[var(--bg-hover)] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(result.status)}
                        <div className="text-left">
                          <div className="text-sm font-medium text-[var(--text-primary)]">
                            {result.name}
                          </div>
                          <div className="text-xs text-[var(--text-tertiary)]">
                            {result.message}
                          </div>
                        </div>
                      </div>
                      
                      {result.details && (
                        expandedChecks.has(result.name) ? (
                          <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
                        )
                      )}
                    </button>
                    
                    {expandedChecks.has(result.name) && result.details && (
                      <div className="px-4 pb-3">
                        <div className="p-3 rounded bg-[var(--bg-card)] text-xs text-[var(--text-secondary)] font-mono">
                          {result.details}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {loading && !data && (
        <div className="text-center py-8 text-[var(--text-tertiary)]">
          Running diagnostics...
        </div>
      )}
    </div>
  );
}
