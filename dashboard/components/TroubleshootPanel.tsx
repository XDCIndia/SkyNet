'use client';

import { useState, useMemo } from 'react';
import { 
  AlertTriangle, 
  AlertCircle,
  Info,
  CheckCircle2,
  XCircle,
  Terminal,
  BookOpen,
  Clock,
  Zap,
  Play,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
  Filter,
  ExternalLink,
  Wrench,
  Activity,
  HardDrive,
  Cpu,
  Network,
  Database,
  Users
} from 'lucide-react';

// Types
type AlertSeverity = 'critical' | 'warning' | 'info';
type AlertStatus = 'active' | 'acknowledged' | 'resolved';

interface Alert {
  id: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string;
  timestamp: string;
  nodeId: string;
  nodeName: string;
  metric?: string;
  value?: string;
  threshold?: string;
  suggestedFix?: string;
  runbookUrl?: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info';
  message: string;
  nodeId: string;
  component: string;
}

interface DiagnosticCommand {
  id: string;
  name: string;
  description: string;
  command: string;
  category: 'sync' | 'peers' | 'resources' | 'consensus' | 'database';
}

interface DetectedIssue {
  id: string;
  type: string;
  severity: AlertSeverity;
  description: string;
  affectedNodes: string[];
  detectedAt: string;
  confidence: number;
  suggestedFixes: {
    description: string;
    command?: string;
    autoFix: boolean;
  }[];
  runbookLink?: string;
}

// Mock Data
const mockAlerts: Alert[] = [
  {
    id: 'alert-001',
    severity: 'critical',
    status: 'active',
    title: 'Node Sync Stalled',
    description: 'Block height has not increased for over 5 minutes',
    timestamp: '2026-02-11T14:25:00Z',
    nodeId: 'mn-003',
    nodeName: 'Masternode Gamma',
    metric: 'block_height',
    value: '99,234,520',
    threshold: '5 min without change',
    suggestedFix: 'Check peer connectivity and disk space. Run: xdc peers add-bootstrap',
    runbookUrl: '/docs/runbooks/sync-stall'
  },
  {
    id: 'alert-002',
    severity: 'critical',
    status: 'active',
    title: 'Disk Usage Critical',
    description: 'Disk usage has exceeded 92% threshold',
    timestamp: '2026-02-11T14:20:00Z',
    nodeId: 'mn-002',
    nodeName: 'Masternode Beta',
    metric: 'disk_usage_percent',
    value: '92%',
    threshold: '90%',
    suggestedFix: 'Prune old data or expand volume. Run: xdc maintenance prune',
    runbookUrl: '/docs/runbooks/disk-full'
  },
  {
    id: 'alert-003',
    severity: 'warning',
    status: 'active',
    title: 'High Memory Usage',
    description: 'Memory usage is approaching critical threshold',
    timestamp: '2026-02-11T14:15:00Z',
    nodeId: 'arch-001',
    nodeName: 'Archive Node',
    metric: 'memory_usage_percent',
    value: '85%',
    threshold: '80%',
    suggestedFix: 'Consider reducing cache size or restarting the node',
    runbookUrl: '/docs/runbooks/high-memory'
  },
  {
    id: 'alert-004',
    severity: 'warning',
    status: 'acknowledged',
    title: 'Low Peer Count',
    description: 'Node has fewer peers than recommended minimum',
    timestamp: '2026-02-11T14:10:00Z',
    nodeId: 'mn-003',
    nodeName: 'Masternode Gamma',
    metric: 'peer_count',
    value: '12',
    threshold: '> 25',
    suggestedFix: 'Add bootstrap peers. Run: xdc peers discover --aggressive',
    runbookUrl: '/docs/runbooks/peer-drop'
  },
  {
    id: 'alert-005',
    severity: 'info',
    status: 'resolved',
    title: 'Scheduled Maintenance',
    description: 'Node completed scheduled database compaction',
    timestamp: '2026-02-11T13:00:00Z',
    nodeId: 'rpc-001',
    nodeName: 'RPC Node Primary',
  }
];

const mockLogs: LogEntry[] = [
  {
    id: 'log-001',
    timestamp: '2026-02-11T14:29:58Z',
    level: 'error',
    message: 'Failed to import block #99234567: invalid merkle root',
    nodeId: 'mn-003',
    component: 'blockchain'
  },
  {
    id: 'log-002',
    timestamp: '2026-02-11T14:29:45Z',
    level: 'error',
    message: 'Database write failed: no space left on device',
    nodeId: 'mn-002',
    component: 'database'
  },
  {
    id: 'log-003',
    timestamp: '2026-02-11T14:29:30Z',
    level: 'warn',
    message: 'Dropped peer 192.168.1.50: connection timeout after 30s',
    nodeId: 'mn-003',
    component: 'p2p'
  },
  {
    id: 'log-004',
    timestamp: '2026-02-11T14:29:15Z',
    level: 'warn',
    message: 'Memory usage approaching threshold: 85% of 64GB',
    nodeId: 'arch-001',
    component: 'system'
  },
  {
    id: 'log-005',
    timestamp: '2026-02-11T14:29:00Z',
    level: 'warn',
    message: 'Slow block processing: block #99234566 took 3.2s',
    nodeId: 'mn-001',
    component: 'blockchain'
  },
  {
    id: 'log-006',
    timestamp: '2026-02-11T14:28:45Z',
    level: 'info',
    message: 'Epoch #110234 started, validator set updated',
    nodeId: 'mn-001',
    component: 'consensus'
  }
];

const mockDiagnosticCommands: DiagnosticCommand[] = [
  {
    id: 'diag-001',
    name: 'Check Sync Status',
    description: 'Display current block height and sync progress',
    command: 'xdc sync status',
    category: 'sync'
  },
  {
    id: 'diag-002',
    name: 'List Peers',
    description: 'Show all connected peers with details',
    command: 'xdc peers list --details',
    category: 'peers'
  },
  {
    id: 'diag-003',
    name: 'Check Disk Usage',
    description: 'Display disk usage for data directory',
    command: 'xdc metrics disk',
    category: 'resources'
  },
  {
    id: 'diag-004',
    name: 'View Recent Logs',
    description: 'Show last 50 log entries with errors highlighted',
    command: 'xdc logs --tail 50 --highlight errors',
    category: 'sync'
  },
  {
    id: 'diag-005',
    name: 'Test RPC Connection',
    description: 'Verify RPC endpoint is responding',
    command: 'curl -X POST http://localhost:8545 -H "Content-Type: application/json" -d \'{"jsonrpc":"2.0","method":"eth_blockNumber","id":1}\'',
    category: 'sync'
  },
  {
    id: 'diag-006',
    name: 'Check Consensus Status',
    description: 'Show masternode consensus participation',
    command: 'xdc consensus status',
    category: 'consensus'
  },
  {
    id: 'diag-007',
    name: 'Database Stats',
    description: 'Show database size and compaction status',
    command: 'xdc db stats',
    category: 'database'
  },
  {
    id: 'diag-008',
    name: 'Add Bootstrap Peers',
    description: 'Connect to known bootstrap nodes',
    command: 'xdc peers add-bootstrap',
    category: 'peers'
  }
];

const mockDetectedIssues: DetectedIssue[] = [
  {
    id: 'issue-001',
    type: 'Sync Stall',
    severity: 'critical',
    description: 'Node mn-003 has not produced new blocks for 5+ minutes. Likely cause: low peer count combined with potential state corruption.',
    affectedNodes: ['mn-003'],
    detectedAt: '2026-02-11T14:25:00Z',
    confidence: 92,
    suggestedFixes: [
      {
        description: 'Add bootstrap peers to improve connectivity',
        command: 'xdc peers add-bootstrap',
        autoFix: true
      },
      {
        description: 'Clear trie cache and restart',
        command: 'xdc maintenance clear-cache && xdc restart',
        autoFix: false
      },
      {
        description: 'Rollback to last known good state',
        command: 'xdc sync rollback 100',
        autoFix: false
      }
    ],
    runbookLink: '/docs/runbooks/sync-stall'
  },
  {
    id: 'issue-002',
    type: 'Disk Full',
    severity: 'critical',
    description: 'Node mn-002 disk usage at 92%. Database writes may fail soon, causing sync to halt.',
    affectedNodes: ['mn-002'],
    detectedAt: '2026-02-11T14:20:00Z',
    confidence: 100,
    suggestedFixes: [
      {
        description: 'Prune old blockchain data',
        command: 'xdc maintenance prune --keep-blocks 1000000',
        autoFix: true
      },
      {
        description: 'Clean old logs',
        command: 'find /data/xdcchain/logs -name "*.log" -mtime +7 -delete',
        autoFix: true
      },
      {
        description: 'Expand volume (manual)',
        autoFix: false
      }
    ],
    runbookLink: '/docs/runbooks/disk-full'
  },
  {
    id: 'issue-003',
    type: 'Memory Pressure',
    severity: 'warning',
    description: 'Archive node approaching memory limit. May cause OOM kill if not addressed.',
    affectedNodes: ['arch-001'],
    detectedAt: '2026-02-11T14:15:00Z',
    confidence: 78,
    suggestedFixes: [
      {
        description: 'Reduce cache size in config',
        command: 'xdc config set cache.size 32768',
        autoFix: false
      },
      {
        description: 'Schedule graceful restart during low traffic',
        autoFix: false
      }
    ],
    runbookLink: '/docs/runbooks/high-memory'
  }
];

export default function TroubleshootPanel() {
  const [activeTab, setActiveTab] = useState<'alerts' | 'issues' | 'logs' | 'diagnostics'>('alerts');
  const [alertFilter, setAlertFilter] = useState<AlertSeverity | 'all'>('all');
  const [logFilter, setLogFilter] = useState<'all' | 'error' | 'warn'>('all');
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter alerts
  const filteredAlerts = useMemo(() => {
    return mockAlerts.filter(alert => {
      if (alertFilter !== 'all' && alert.severity !== alertFilter) return false;
      if (searchQuery && !alert.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [alertFilter, searchQuery]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return mockLogs.filter(log => {
      if (logFilter !== 'all' && log.level !== logFilter) return false;
      if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [logFilter, searchQuery]);

  // Stats
  const alertStats = useMemo(() => ({
    critical: mockAlerts.filter(a => a.severity === 'critical' && a.status === 'active').length,
    warning: mockAlerts.filter(a => a.severity === 'warning' && a.status === 'active').length,
    info: mockAlerts.filter(a => a.severity === 'info' && a.status === 'active').length,
  }), []);

  const handleCopyCommand = async (command: string, id: string) => {
    await navigator.clipboard.writeText(command);
    setCopiedCommand(id);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  const handleRunDiagnostic = (command: DiagnosticCommand) => {
    console.log('Running diagnostic:', command.command);
    // TODO: Connect to actual execution API
  };

  const handleApplyFix = (fix: { description: string; command?: string; autoFix: boolean }) => {
    if (fix.command) {
      console.log('Applying fix:', fix.command);
      // TODO: Connect to actual execution API
    }
  };

  const getSeverityConfig = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return { 
          icon: XCircle, 
          color: 'text-[var(--critical)]', 
          bg: 'bg-[rgba(239,68,68,0.15)]',
          border: 'border-[rgba(239,68,68,0.3)]'
        };
      case 'warning':
        return { 
          icon: AlertTriangle, 
          color: 'text-[var(--warning)]', 
          bg: 'bg-[rgba(245,158,11,0.15)]',
          border: 'border-[rgba(245,158,11,0.3)]'
        };
      case 'info':
        return { 
          icon: Info, 
          color: 'text-[var(--accent-blue)]', 
          bg: 'bg-[rgba(30,144,255,0.15)]',
          border: 'border-[rgba(30,144,255,0.3)]'
        };
    }
  };

  const getLogLevelConfig = (level: 'error' | 'warn' | 'info') => {
    switch (level) {
      case 'error':
        return { color: 'text-[var(--critical)]', bg: 'bg-[rgba(239,68,68,0.15)]' };
      case 'warn':
        return { color: 'text-[var(--warning)]', bg: 'bg-[rgba(245,158,11,0.15)]' };
      case 'info':
        return { color: 'text-[#6B7280]', bg: 'bg-[rgba(107,114,128,0.15)]' };
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'sync': return Activity;
      case 'peers': return Users;
      case 'resources': return Cpu;
      case 'consensus': return Network;
      case 'database': return Database;
      default: return Terminal;
    }
  };

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className="card-xdc">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#EF4444]/20 to-[#F59E0B]/10 flex items-center justify-center">
            <Wrench className="w-5 h-5 text-[var(--critical)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#F9FAFB]">DevOps Troubleshooting</h2>
            <p className="text-sm text-[#6B7280]">Diagnose and fix issues in seconds</p>
          </div>
        </div>

        {/* Alert Summary */}
        <div className="flex items-center gap-3">
          {alertStats.critical > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.3)]">
              <XCircle className="w-4 h-4 text-[var(--critical)]" />
              <span className="text-sm font-medium text-[var(--critical)]">{alertStats.critical} Critical</span>
            </div>
          )}
          {alertStats.warning > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(245,158,11,0.15)] border border-[rgba(245,158,11,0.3)]">
              <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />
              <span className="text-sm font-medium text-[var(--warning)]">{alertStats.warning} Warning</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-[rgba(255,255,255,0.06)] pb-4">
        {[
          { id: 'alerts', label: 'Active Alerts', icon: AlertCircle, count: mockAlerts.filter(a => a.status === 'active').length },
          { id: 'issues', label: 'Auto-Detected Issues', icon: Zap, count: mockDetectedIssues.length },
          { id: 'logs', label: 'Recent Logs', icon: Terminal, count: filteredLogs.length },
          { id: 'diagnostics', label: 'Diagnostics', icon: Play },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[var(--accent-blue)] text-white'
                : 'bg-[var(--bg-card)] text-[#9CA3AF] hover:text-[#F9FAFB] border border-[rgba(255,255,255,0.06)]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                activeTab === tab.id ? 'bg-white/20' : 'bg-[rgba(255,255,255,0.1)]'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Search alerts, logs, or issues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-[var(--bg-card)] border border-[rgba(255,255,255,0.06)] text-[#F9FAFB] placeholder-[#6B7280] text-sm focus:outline-none focus:border-[var(--accent-blue)]"
          />
        </div>
      </div>

      {/* Alerts Tab */}
      {activeTab === 'alerts' && (
        <div>
          {/* Alert Filters */}
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-[#6B7280]" />
            {(['all', 'critical', 'warning', 'info'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setAlertFilter(filter)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  alertFilter === filter
                    ? 'bg-[rgba(30,144,255,0.25)] text-[var(--accent-blue)]'
                    : 'text-[#6B7280] hover:text-[#F9FAFB]'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>

          {/* Alert List */}
          <div className="space-y-3">
            {filteredAlerts.map((alert) => {
              const config = getSeverityConfig(alert.severity);
              const Icon = config.icon;
              
              return (
                <div 
                  key={alert.id} 
                  className={`p-4 rounded-xl border ${config.border} ${config.bg}`}
                >
                  <div className="flex items-start gap-3">
                    <Icon className={`w-5 h-5 ${config.color} mt-0.5`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="font-medium text-[#F9FAFB]">{alert.title}</h4>
                        <span className="text-xs text-[#6B7280]">{formatTimestamp(alert.timestamp)}</span>
                      </div>
                      <p className="text-sm text-[#9CA3AF] mb-2">{alert.description}</p>
                      
                      <div className="flex items-center gap-4 text-xs text-[#6B7280] mb-3">
                        <span>Node: <span className="text-[#F9FAFB]">{alert.nodeName}</span></span>
                        {alert.metric && (
                          <span>Metric: <span className="text-[#F9FAFB]">{alert.metric}</span></span>
                        )}
                        {alert.value && (
                          <span>Value: <span className={config.color}>{alert.value}</span></span>
                        )}
                      </div>

                      {alert.suggestedFix && (
                        <div className="p-3 rounded-lg bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.06)]">
                          <div className="text-xs text-[#6B7280] mb-1">Suggested Fix:</div>
                          <p className="text-sm text-[#F9FAFB]">{alert.suggestedFix}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-3">
                        {alert.runbookUrl && (
                          <a 
                            href={alert.runbookUrl}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(30,144,255,0.15)] text-[var(--accent-blue)] text-xs hover:bg-[rgba(30,144,255,0.25)] transition-colors"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            View Runbook
                          </a>
                        )}
                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.1)] text-[#F9FAFB] text-xs hover:bg-[rgba(255,255,255,0.15)] transition-colors">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Acknowledge
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Auto-Detected Issues Tab */}
      {activeTab === 'issues' && (
        <div className="space-y-4">
          {mockDetectedIssues.map((issue) => {
            const config = getSeverityConfig(issue.severity);
            const Icon = config.icon;
            const isExpanded = expandedIssue === issue.id;

            return (
              <div 
                key={issue.id} 
                className={`rounded-xl border ${config.border} overflow-hidden`}
              >
                {/* Issue Header */}
                <div 
                  className={`p-4 ${config.bg} cursor-pointer`}
                  onClick={() => setExpandedIssue(isExpanded ? null : issue.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Icon className={`w-5 h-5 ${config.color} mt-0.5`} />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-[#F9FAFB]">{issue.type}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${config.bg} ${config.color}`}>
                            {issue.confidence}% confidence
                          </span>
                        </div>
                        <p className="text-sm text-[#9CA3AF]">{issue.description}</p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-[#6B7280]">
                          <span>Affected: {issue.affectedNodes.join(', ')}</span>
                          <span>•</span>
                          <span>Detected: {formatTimestamp(issue.detectedAt)}</span>
                        </div>
                      </div>
                    </div>
                    <button className="p-1 text-[#6B7280]">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="p-4 bg-[var(--bg-card)] border-t border-[rgba(255,255,255,0.06)]">
                    <h5 className="text-sm font-medium text-[#F9FAFB] mb-3">Suggested Fixes</h5>
                    <div className="space-y-2">
                      {issue.suggestedFixes.map((fix, i) => (
                        <div 
                          key={i} 
                          className="flex items-start justify-between p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]"
                        >
                          <div className="flex-1">
                            <p className="text-sm text-[#F9FAFB]">{fix.description}</p>
                            {fix.command && (
                              <code className="block mt-2 p-2 rounded bg-[var(--bg-body)] text-xs text-[var(--accent-blue)] font-mono">
                                {fix.command}
                              </code>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {fix.command && (
                              <button 
                                onClick={() => handleCopyCommand(fix.command!, `fix-${issue.id}-${i}`)}
                                className="p-1.5 rounded hover:bg-[rgba(255,255,255,0.1)] text-[#6B7280] hover:text-[#F9FAFB] transition-colors"
                              >
                                {copiedCommand === `fix-${issue.id}-${i}` ? <Check className="w-4 h-4 text-[var(--success)]" /> : <Copy className="w-4 h-4" />}
                              </button>
                            )}
                            {fix.autoFix && (
                              <button 
                                onClick={() => handleApplyFix(fix)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(16,185,129,0.15)] text-[var(--success)] text-xs hover:bg-[rgba(16,185,129,0.25)] transition-colors"
                              >
                                <Zap className="w-3.5 h-3.5" />
                                Auto-Fix
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {issue.runbookLink && (
                      <a 
                        href={issue.runbookLink}
                        className="inline-flex items-center gap-1.5 mt-4 text-sm text-[var(--accent-blue)] hover:underline"
                      >
                        <BookOpen className="w-4 h-4" />
                        View Full Runbook
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div>
          {/* Log Filters */}
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-4 h-4 text-[#6B7280]" />
            {(['all', 'error', 'warn'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setLogFilter(filter)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  logFilter === filter
                    ? 'bg-[rgba(30,144,255,0.25)] text-[var(--accent-blue)]'
                    : 'text-[#6B7280] hover:text-[#F9FAFB]'
                }`}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>

          {/* Log List */}
          <div className="rounded-xl border border-[rgba(255,255,255,0.06)] overflow-hidden">
            <div className="bg-[var(--bg-card)] p-3 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)]">
              <span className="text-xs text-[#6B7280]">Recent Logs (Last 5 minutes)</span>
              <button className="flex items-center gap-1.5 text-xs text-[var(--accent-blue)] hover:underline">
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>
            <div className="divide-y divide-[rgba(255,255,255,0.03)] max-h-[400px] overflow-y-auto">
              {filteredLogs.map((log) => {
                const config = getLogLevelConfig(log.level);
                
                return (
                  <div key={log.id} className="p-3 hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                    <div className="flex items-start gap-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.color}`}>
                        {log.level.toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-[#F9FAFB] font-mono break-all">{log.message}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-[#6B7280]">
                          <span>{formatTimestamp(log.timestamp)}</span>
                          <span>•</span>
                          <span>{log.nodeId}</span>
                          <span>•</span>
                          <span>{log.component}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics Tab */}
      {activeTab === 'diagnostics' && (
        <div>
          <p className="text-sm text-[#6B7280] mb-4">Quick diagnostic commands to troubleshoot common issues.</p>
          
          {/* Commands by Category */}
          {['sync', 'peers', 'resources', 'consensus', 'database'].map((category) => {
            const commands = mockDiagnosticCommands.filter(c => c.category === category);
            if (commands.length === 0) return null;
            
            const CategoryIcon = getCategoryIcon(category);
            
            return (
              <div key={category} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <CategoryIcon className="w-4 h-4 text-[var(--accent-blue)]" />
                  <h3 className="text-sm font-medium text-[#F9FAFB] capitalize">{category}</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {commands.map((cmd) => (
                    <div 
                      key={cmd.id} 
                      className="p-4 rounded-xl bg-[var(--bg-card)] border border-[rgba(255,255,255,0.06)] hover:border-[rgba(30,144,255,0.3)] transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-[#F9FAFB]">{cmd.name}</h4>
                          <p className="text-xs text-[#6B7280] mt-0.5">{cmd.description}</p>
                        </div>
                      </div>
                      <code className="block p-2 rounded bg-[var(--bg-body)] text-xs text-[var(--accent-blue)] font-mono mb-3 overflow-x-auto">
                        {cmd.command}
                      </code>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleCopyCommand(cmd.command, cmd.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.1)] text-[#F9FAFB] text-xs hover:bg-[rgba(255,255,255,0.15)] transition-colors"
                        >
                          {copiedCommand === cmd.id ? <Check className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedCommand === cmd.id ? 'Copied!' : 'Copy'}
                        </button>
                        <button 
                          onClick={() => handleRunDiagnostic(cmd)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(30,144,255,0.15)] text-[var(--accent-blue)] text-xs hover:bg-[rgba(30,144,255,0.25)] transition-colors"
                        >
                          <Play className="w-3.5 h-3.5" />
                          Run
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {activeTab === 'alerts' && filteredAlerts.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle2 className="w-12 h-12 text-[var(--success)] mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[#F9FAFB] mb-2">All Clear!</h3>
          <p className="text-[#6B7280]">No active alerts matching your filters.</p>
        </div>
      )}
    </div>
  );
}
