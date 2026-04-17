'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { formatTimeAgo } from '@/lib/formatters';
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  ExternalLink,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Filter,
  X,
  Clock,
  Server,
  Cpu,
  HardDrive,
  MemoryStick,
  Wifi,
  FileCode,
  Github,
  GitPullRequest,
  Check,
  TrendingUp,
  TrendingDown,
  Activity,
  Calendar
} from 'lucide-react';

type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
type IssueStatus = 'open' | 'resolved';
type IssueType = 'sync_stall' | 'peer_drop' | 'disk_critical' | 'rpc_error' | 'bad_block' | 'container_crash' | 'other';

interface Issue {
  id: string;
  node_id: string;
  node_name: string;
  type: IssueType;
  severity: IssueSeverity;
  title: string;
  description: string | null;
  diagnostics: {
    blockHeight?: number;
    peerCount?: number;
    cpuPercent?: number;
    memoryPercent?: number;
    diskPercent?: number;
    clientVersion?: string;
    clientType?: string;
    rpcLatencyMs?: number;
    isSyncing?: boolean;
    syncPercent?: number;
    recentErrors?: string[];
    logs?: string;
  };
  status: IssueStatus;
  github_issue_url: string | null;
  github_pr_url: string | null;
  solution_code: string | null;
  solution_description: string | null;
  duplicate_of: string | null;
  occurrence_count: number;
  first_seen: string;
  last_seen: string;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  node_ip: string | null;
  client_type: string | null;
  client_version: string | null;
  node_role: string | null;
}

interface Summary {
  open: number;
  critical: number;
  high: number;
  resolved: number;
  total: number;
}

interface ResolutionStats {
  avgResolutionTime: string;
  openCount: number;
  resolvedCount: number;
  bySeverity: Record<IssueSeverity, { open: number; resolved: number }>;
}

interface TrendData {
  date: string;
  opened: number;
  resolved: number;
}

const severityConfig: Record<IssueSeverity, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  critical: {
    icon: <AlertCircle className="w-4 h-4" />,
    color: 'text-[#EF4444]',
    bg: 'bg-[#EF4444]/10',
    border: 'border-[#EF4444]/20',
  },
  high: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'text-[#F59E0B]',
    bg: 'bg-[#F59E0B]/10',
    border: 'border-[#F59E0B]/20',
  },
  medium: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'text-[#FB923C]',
    bg: 'bg-[#FB923C]/10',
    border: 'border-[#FB923C]/20',
  },
  low: {
    icon: <Info className="w-4 h-4" />,
    color: 'text-[#1E90FF]',
    bg: 'bg-[#1E90FF]/10',
    border: 'border-[#1E90FF]/20',
  },
  info: {
    icon: <Info className="w-4 h-4" />,
    color: 'text-[#64748B]',
    bg: 'bg-[#64748B]/10',
    border: 'border-[#64748B]/20',
  },
};

const typeLabels: Record<IssueType, string> = {
  sync_stall: 'Sync Stall',
  peer_drop: 'Peer Drop',
  disk_critical: 'Disk Critical',
  rpc_error: 'RPC Error',
  bad_block: 'Bad Block',
  container_crash: 'Container Crash',
  other: 'Other',
};

function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  const config = severityConfig[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold ${config.color} ${config.bg} border ${config.border}`}>
      {config.icon}
      {severity??.toUpperCase()}
    </span>
  );
}

function StatusBadge({ status }: { status: IssueStatus }) {
  if (status === 'open') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold text-[#EF4444] bg-[#EF4444]/10 border border-[#EF4444]/20">
        <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-pulse" />
        Open
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/20">
      <CheckCircle2 className="w-3.5 h-3.5" />
      Resolved
    </span>
  );
}

function formatDuration(from: string, to?: string): string {
  const start = new Date(from).getTime();
  const end = to ? new Date(to).getTime() : Date.now();
  const diff = end - start;
  
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Issue Timeline Component
function IssueTimeline({ issue }: { issue: Issue }) {
  const events = [
    { label: 'Created', time: issue.created_at, icon: <Clock className="w-4 h-4" />, color: 'text-[#64748B]' },
    { label: 'First Seen', time: issue.first_seen, icon: <AlertCircle className="w-4 h-4" />, color: 'text-[#F59E0B]' },
    ...(issue.last_seen !== issue.first_seen ? [{ label: 'Last Seen', time: issue.last_seen, icon: <Activity className="w-4 h-4" />, color: 'text-[#1E90FF]' }] : []),
    ...(issue.resolved_at ? [{ label: 'Resolved', time: issue.resolved_at, icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-[#10B981]' }] : []),
  ];

  return (
    <div className="flex items-center gap-2 mt-3 overflow-x-auto">
      {events.map((event, i) => (
        <>
          <div key={event.label} className="flex items-center gap-2 flex-shrink-0">
            <div className={`p-1.5 rounded ${event.color} bg-white/5`}>
              {event.icon}
            </div>
            <div className="text-xs">
              <div className="text-[var(--text-tertiary)]">{event.label}</div>
              <div className={event.color}>{formatTimeAgo(event.time)}</div>
            </div>
          </div>
          {i < events.length - 1 && (
            <div className="w-6 h-px bg-white/10 flex-shrink-0" />
          )}
        </>
      ))}
    </div>
  );
}

// Trends Chart Component
function TrendsChart({ data }: { data: TrendData[] }) {
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map(d => Math.max(d.opened, d.resolved)), 1);
  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 30, bottom: 40, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const getX = (i: number) => padding.left + (i / (data.length - 1 || 1)) * chartWidth;
  const getY = (val: number) => padding.top + chartHeight - (val / maxValue) * chartHeight;

  const openedPoints = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.opened)}`).join(' ');
  const resolvedPoints = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d.resolved)}`).join(' ');

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[400px]">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line
            key={t}
            x1={padding.left}
            y1={padding.top + t * chartHeight}
            x2={width - padding.right}
            y2={padding.top + t * chartHeight}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
        ))}

        {/* Opened line */}
        <path d={openedPoints} fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
        
        {/* Resolved line */}
        <path d={resolvedPoints} fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeDasharray="4,4" />

        {/* Data points */}
        {data.map((d, i) => (
          <>
            <circle key={`opened-${i}`} cx={getX(i)} cy={getY(d.opened)} r="4" fill="#EF4444" />
            <circle key={`resolved-${i}`} cx={getX(i)} cy={getY(d.resolved)} r="4" fill="#10B981" />
          </>
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={getX(i)}
            y={height - 10}
            textAnchor="middle"
            fill="#64748B"
            fontSize="10"
          >
            {new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </text>
        ))}

        {/* Y-axis label */}
        <text x="20" y={height / 2} textAnchor="middle" fill="#64748B" fontSize="10" transform={`rotate(-90, 20, ${height / 2})`}>
          Issues
        </text>
      </svg>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-[#EF4444] rounded" />
          <span className="text-xs text-[var(--text-tertiary)]">Opened</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-[#10B981] rounded border-dashed" style={{ borderTop: '2px dashed #10B981' }} />
          <span className="text-xs text-[var(--text-tertiary)]">Resolved</span>
        </div>
      </div>
    </div>
  );
}

// Resolution Stats Cards
function ResolutionStats({ stats }: { stats: ResolutionStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-[#111827]/50 border border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-[#1E90FF]" />
          <span className="text-xs text-[#64748B]">Avg Resolution</span>
        </div>
        <div className="text-2xl font-bold text-[#F1F5F9]">{stats.avgResolutionTime}</div>
      </div>

      <div className="bg-[#111827]/50 border border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-[#EF4444]" />
          <span className="text-xs text-[#64748B]">Open</span>
        </div>
        <div className="text-2xl font-bold text-[#EF4444]">{stats.openCount}</div>
      </div>

      <div className="bg-[#111827]/50 border border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
          <span className="text-xs text-[#64748B]">Resolved</span>
        </div>
        <div className="text-2xl font-bold text-[#10B981]">{stats.resolvedCount}</div>
      </div>

      <div className="bg-[#111827]/50 border border-white/10 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-[#F59E0B]" />
          <span className="text-xs text-[#64748B]">Resolution Rate</span>
        </div>
        <div className="text-2xl font-bold text-[#F59E0B]">
          {stats.resolvedCount + stats.openCount > 0 
            ? Math.round((stats.resolvedCount / (stats.resolvedCount + stats.openCount)) * 100) 
            : 0}%
        </div>
      </div>
    </div>
  );
}

// Severity Breakdown
function SeverityBreakdown({ bySeverity }: { bySeverity: ResolutionStats['bySeverity'] }) {
  const severities: IssueSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
  
  return (
    <div className="bg-[#111827]/50 border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-[#64748B]" />
        <span className="text-sm font-medium text-[#F1F5F9]">By Severity</span>
      </div>
      
      <div className="space-y-3">
        {severities.map(sev => {
          const data = bySeverity[sev] || { open: 0, resolved: 0 };
          const total = data.open + data.resolved;
          if (total === 0) return null;
          
          return (
            <div key={sev} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${severityConfig[sev].color.replace('text-', 'bg-')}`} />
                <span className="text-sm text-[#F1F5F9] capitalize">{sev}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#EF4444]">{data.open} open</span>
                <span className="text-xs text-[#10B981]">{data.resolved} resolved</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IssueCard({ 
  issue, 
  onResolve, 
  isResolving 
}: { 
  issue: Issue; 
  onResolve: (id: string) => void;
  isResolving: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  const diagnostics = issue.diagnostics || {};
  const hasSolution = issue.solution_description || issue.solution_code;

  return (
    <div className="bg-[#111827]/50 border border-white/10 rounded-xl overflow-hidden">
      <div 
        className="p-3 sm:p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="mt-0.5 flex-shrink-0">
              {expanded ? (
                <ChevronDown className="w-5 h-5 text-[#64748B]" />
              ) : (
                <ChevronRight className="w-5 h-5 text-[#64748B]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <SeverityBadge severity={issue.severity} />
                <span className="px-2 py-0.5 bg-white/5 rounded text-xs text-[#64748B]">
                  {typeLabels[issue.type]}
                </span>
                {issue.occurrence_count > 1 && (
                  <span className="px-2 py-0.5 bg-[#F59E0B]/10 text-[#F59E0B] rounded text-xs">
                    {issue.occurrence_count}×
                  </span>
                )}
                {issue.duplicate_of && (
                  <span className="px-2 py-0.5 bg-[#64748B]/20 text-[#64748B] rounded text-xs">
                    Duplicate
                  </span>
                )}
              </div>
              
              <h3 className="text-sm font-medium text-[#F1F5F9] mt-2 line-clamp-2">
                {issue.title}
              </h3>
              
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-[#64748B]">
                <span className="flex items-center gap-1">
                  <Server className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[120px] sm:max-w-none">{issue.node_name || 'Unknown'}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTimeAgo(issue.last_seen)}
                </span>
                <span className="hidden sm:flex items-center gap-1">
                  <span className="text-[#64748B]">Duration: </span>
                  {formatDuration(issue.first_seen, issue.resolved_at || undefined)}
                </span>
              </div>

              {/* Timeline - hidden on small mobile */}
              <div className="hidden sm:block">
                <IssueTimeline issue={issue} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-7 sm:ml-0">
            <StatusBadge status={issue.status} />
            {issue.status === 'open' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve(issue.id);
                }}
                disabled={isResolving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#10B981]/10 hover:bg-[#10B981]/20 text-[#10B981] rounded-lg text-xs font-medium transition-colors disabled:opacity-50 min-h-[44px] sm:min-h-0"
              >
                {isResolving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span className="hidden sm:inline">Resolving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Resolve</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-white/10">
          <div className="pt-4 space-y-4">
            {/* Description */}
            {issue.description && (
              <div>
                <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Description</h4>
                <p className="text-sm text-[#F1F5F9]/80">{issue.description}</p>
              </div>
            )}

            {/* Diagnostics Grid */}
            <div>
              <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Diagnostics</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {diagnostics.blockHeight !== undefined && (
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-xs text-[#64748B]">Block Height</div>
                    <div className="text-sm font-mono text-[#F1F5F9]">{diagnostics.blockHeight.toLocaleString()}</div>
                  </div>
                )}
                {diagnostics.peerCount !== undefined && (
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-xs text-[#64748B]">Peers</div>
                    <div className={`text-sm font-mono ${diagnostics.peerCount < 3 ? 'text-[#EF4444]' : 'text-[#F1F5F9]'}`}>
                      {diagnostics.peerCount}
                    </div>
                  </div>
                )}
                {diagnostics.cpuPercent !== undefined && (
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-xs text-[#64748B] flex items-center gap-1">
                      <Cpu className="w-3 h-3" /> CPU
                    </div>
                    <div className={`text-sm font-mono ${diagnostics.cpuPercent > 80 ? 'text-[#EF4444]' : 'text-[#F1F5F9]'}`}>
                      {diagnostics.cpuPercent}%
                    </div>
                  </div>
                )}
                {diagnostics.memoryPercent !== undefined && (
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-xs text-[#64748B] flex items-center gap-1">
                      <MemoryStick className="w-3 h-3" /> Memory
                    </div>
                    <div className={`text-sm font-mono ${diagnostics.memoryPercent > 90 ? 'text-[#EF4444]' : 'text-[#F1F5F9]'}`}>
                      {diagnostics.memoryPercent}%
                    </div>
                  </div>
                )}
                {diagnostics.diskPercent !== undefined && (
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-xs text-[#64748B] flex items-center gap-1">
                      <HardDrive className="w-3 h-3" /> Disk
                    </div>
                    <div className={`text-sm font-mono ${diagnostics.diskPercent > 85 ? 'text-[#EF4444]' : diagnostics.diskPercent > 70 ? 'text-[#F59E0B]' : 'text-[#F1F5F9]'}`}>
                      {diagnostics.diskPercent}%
                    </div>
                  </div>
                )}
                {diagnostics.rpcLatencyMs !== undefined && (
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-xs text-[#64748B] flex items-center gap-1">
                      <Wifi className="w-3 h-3" /> RPC Latency
                    </div>
                    <div className="text-sm font-mono text-[#F1F5F9]">{diagnostics.rpcLatencyMs}ms</div>
                  </div>
                )}
                {diagnostics.syncPercent !== undefined && (
                  <div className="bg-white/5 rounded-lg p-3">
                    <div className="text-xs text-[#64748B]">Sync Progress</div>
                    <div className={`text-sm font-mono ${diagnostics.syncPercent >= 99 ? 'text-[#10B981]' : 'text-[#F59E0B]'}`}>
                      {diagnostics.syncPercent}%
                    </div>
                  </div>
                )}
                <div className="bg-white/5 rounded-lg p-3">
                  <div className="text-xs text-[#64748B]">Client</div>
                  <div className="text-sm text-[#F1F5F9]">{diagnostics.clientType || issue.client_type || 'Unknown'}</div>
                </div>
              </div>
            </div>

            {/* Recent Errors */}
            {diagnostics.recentErrors && diagnostics.recentErrors.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Recent Errors</h4>
                <div className="bg-black/30 rounded-lg p-3 space-y-1">
                  {diagnostics.recentErrors.map((err, idx) => (
                    <div key={idx} className="text-xs font-mono text-[#EF4444]">
                      {err}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Solution Section */}
            {hasSolution && (
              <div className="bg-[#1E90FF]/5 border border-[#1E90FF]/20 rounded-lg overflow-hidden">
                <button
                  onClick={() => setShowSolution(!showSolution)}
                  className="w-full flex items-center justify-between p-3 hover:bg-[#1E90FF]/10 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-[#1E90FF]" />
                    <span className="text-sm font-medium text-[#1E90FF]">Suggested Solution</span>
                  </div>
                  {showSolution ? (
                    <ChevronDown className="w-4 h-4 text-[#64748B]" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-[#64748B]" />
                  )}
                </button>
                
                {showSolution && (
                  <div className="px-3 pb-3 space-y-3">
                    {issue.solution_description && (
                      <p className="text-sm text-[#F1F5F9]/80">{issue.solution_description}</p>
                    )}
                    
                    {issue.solution_code && (
                      <div className="bg-black/50 rounded-lg p-3 overflow-x-auto">
                        <pre className="text-xs font-mono text-[#F1F5F9]/80 whitespace-pre">{issue.solution_code}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* GitHub Links */}
            <div className="flex items-center gap-3">
              {issue.github_issue_url && (
                <a
                  href={issue.github_issue_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-[#F1F5F9] rounded-lg text-xs transition-colors"
                >
                  <Github className="w-3.5 h-3.5" />
                  GitHub Issue
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {issue.github_pr_url && (
                <a
                  href={issue.github_pr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-[#F1F5F9] rounded-lg text-xs transition-colors"
                >
                  <GitPullRequest className="w-3.5 h-3.5" />
                  Pull Request
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function IssuesPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [summary, setSummary] = useState<Summary>({ open: 0, critical: 0, high: 0, resolved: 0, total: 0 });
  const [resolutionStats, setResolutionStats] = useState<ResolutionStats | null>(null);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'all'>('open');
  const [severityFilter, setSeverityFilter] = useState<IssueSeverity | 'all'>('all');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);

  const fetchIssues = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (severityFilter !== 'all') params.append('severity', severityFilter);
      params.append('limit', '100');

      const res = await fetch(`/api/v1/issues?${params}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setIssues(data.data);
        setSummary(data.summary);
        
        // Fetch resolution stats
        const statsRes = await fetch('/api/v1/issues/resolution-stats', { cache: 'no-store' });
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setResolutionStats(statsData.data);
        }
        
        // Fetch trends
        const trendsRes = await fetch('/api/v1/issues/trends?days=7', { cache: 'no-store' });
        if (trendsRes.ok) {
          const trendsData = await trendsRes.json();
          setTrends(trendsData.data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch issues:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter]);

  useEffect(() => {
    fetchIssues();
    const interval = setInterval(fetchIssues, 30000);
    return () => clearInterval(interval);
  }, [fetchIssues]);

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    try {
      const res = await fetch(`/api/v1/issues/${id}/resolve`, { method: 'POST' });
      if (res.ok) {
        setToast({ message: 'Issue resolved successfully', type: 'success' });
        fetchIssues();
      } else {
        const err = await res.json();
        setToast({ message: err.error || 'Failed to resolve issue', type: 'error' });
      }
    } catch (err) {
      setToast({ message: 'Failed to resolve issue', type: 'error' });
    } finally {
      setResolvingId(null);
    }
  };

  const filteredIssues = useMemo(() => {
    return issues.filter(issue => {
      if (statusFilter !== 'all' && issue.status !== statusFilter) return false;
      if (severityFilter !== 'all' && issue.severity !== severityFilter) return false;
      return true;
    });
  }, [issues, statusFilter, severityFilter]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#F1F5F9]">Issues</h1>
            <p className="text-[#64748B] mt-1">Automated issue detection and resolution tracking</p>
          </div>
          <button
            onClick={fetchIssues}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Resolution Stats */}
        {resolutionStats && <ResolutionStats stats={resolutionStats} />}

        {/* Trends Chart & Severity Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#111827]/50 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-[#1E90FF]" />
              <span className="text-lg font-semibold text-[#F1F5F9]">Issue Trends (7 Days)</span>
            </div>
            <TrendsChart data={trends} />
          </div>
          
          {resolutionStats && <SeverityBreakdown bySeverity={resolutionStats.bySeverity} />}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-[#111827]/50 border border-white/10 rounded-xl p-4">
            <div className="text-xs text-[#64748B] uppercase tracking-wider">Open Issues</div>
            <div className="text-2xl font-bold text-[#F1F5F9] mt-1">{summary.open}</div>
          </div>
          <div className="bg-[#111827]/50 border border-[#EF4444]/20 rounded-xl p-4">
            <div className="text-xs text-[#EF4444] uppercase tracking-wider">Critical</div>
            <div className="text-2xl font-bold text-[#EF4444] mt-1">{summary.critical}</div>
          </div>
          <div className="bg-[#111827]/50 border border-[#F59E0B]/20 rounded-xl p-4">
            <div className="text-xs text-[#F59E0B] uppercase tracking-wider">High</div>
            <div className="text-2xl font-bold text-[#F59E0B] mt-1">{summary.high}</div>
          </div>
          <div className="bg-[#111827]/50 border border-[#10B981]/20 rounded-xl p-4">
            <div className="text-xs text-[#10B981] uppercase tracking-wider">Resolved</div>
            <div className="text-2xl font-bold text-[#10B981] mt-1">{summary.resolved}</div>
          </div>
          <div className="bg-[#111827]/50 border border-white/10 rounded-xl p-4">
            <div className="text-xs text-[#64748B] uppercase tracking-wider">Total</div>
            <div className="text-2xl font-bold text-[#F1F5F9] mt-1">{summary.total}</div>
          </div>
        </div>

        {/* Filters - Collapsible on mobile */}
        <div className="bg-[#111827]/50 border border-white/10 rounded-xl overflow-hidden">
          <button
            onClick={() => setFiltersExpanded(!filtersExpanded)}
            className="w-full flex items-center justify-between p-3 sm:hidden"
          >
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#64748B]" />
              <span className="text-sm text-[#F1F5F9]">Filters</span>
              {(statusFilter !== 'all' || severityFilter !== 'all') && (
                <span className="w-2 h-2 rounded-full bg-[#1E90FF]" />
              )}
            </div>
            {filtersExpanded ? <ChevronDown className="w-4 h-4 text-[#64748B]" /> : <ChevronRight className="w-4 h-4 text-[#64748B]" />}
          </button>
          
          <div className={`${filtersExpanded ? 'block' : 'hidden'} sm:block p-3 sm:p-0 border-t sm:border-t-0 border-white/10`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <Filter className="w-4 h-4 text-[#64748B]" />
                <span className="text-sm text-[#64748B]">Filters:</span>
              </div>
              
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as IssueStatus | 'all')}
                className="w-full sm:w-auto bg-white/5 border border-white/10 rounded-lg px-3 py-2 sm:py-1.5 text-sm focus:outline-none focus:border-[#1E90FF] min-h-[44px]"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </select>

              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as IssueSeverity | 'all')}
                className="w-full sm:w-auto bg-white/5 border border-white/10 rounded-lg px-3 py-2 sm:py-1.5 text-sm focus:outline-none focus:border-[#1E90FF] min-h-[44px]"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="info">Info</option>
              </select>

              {(statusFilter !== 'all' || severityFilter !== 'all') && (
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setSeverityFilter('all');
                  }}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs text-[#64748B] hover:text-[#F1F5F9] transition-colors"
                >
                  <X className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Issues List */}
        <div className="space-y-3">
          {loading && filteredIssues.length === 0 ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 mx-auto mb-4 text-[#64748B] animate-spin" />
              <p className="text-[#64748B]">Loading issues...</p>
            </div>
          ) : filteredIssues.length === 0 ? (
            <div className="text-center py-12 bg-[#111827]/30 border border-white/10 rounded-xl">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-[#10B981]" />
              <p className="text-[#F1F5F9] font-medium">No issues found</p>
              <p className="text-[#64748B] text-sm mt-1">
                {statusFilter === 'open' ? 'All systems operational!' : 'No issues match the current filters.'}
              </p>
            </div>
          ) : (
            filteredIssues.map((issue) => (
              <IssueCard
                key={issue.id}
                issue={issue}
                onResolve={handleResolve}
                isResolving={resolvingId === issue.id}
              />
            ))
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 ${
          toast.type === 'success' ? 'bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981]' : 'bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444]'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="opacity-70 hover:opacity-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </DashboardLayout>
  );
}
