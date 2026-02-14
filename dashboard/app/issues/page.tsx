'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
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
      {severity.toUpperCase()}
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

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
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
        className="p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {expanded ? (
              <ChevronDown className="w-5 h-5 text-[#64748B] flex-shrink-0 mt-0.5" />
            ) : (
              <ChevronRight className="w-5 h-5 text-[#64748B] flex-shrink-0 mt-0.5" />
            )}
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
              
              <h3 className="text-sm font-medium text-[#F1F5F9] mt-2 truncate">
                {issue.title}
              </h3>
              
              <div className="flex items-center gap-4 mt-2 text-xs text-[#64748B]">
                <span className="flex items-center gap-1">
                  <Server className="w-3.5 h-3.5" />
                  {issue.node_name || 'Unknown'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {formatTimeAgo(issue.last_seen)}
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-[#64748B]">Duration: </span>
                  {formatDuration(issue.first_seen, issue.resolved_at || undefined)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge status={issue.status} />
            {issue.status === 'open' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onResolve(issue.id);
                }}
                disabled={isResolving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#10B981]/10 hover:bg-[#10B981]/20 text-[#10B981] rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
              >
                {isResolving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Resolving...
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Resolve
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

            {/* Metadata */}
            <div className="pt-2 border-t border-white/10 flex items-center gap-4 text-xs text-[#64748B]">
              <span>First seen: {new Date(issue.first_seen).toLocaleString()}</span>
              <span>Last seen: {new Date(issue.last_seen).toLocaleString()}</span>
              {issue.resolved_at && (
                <span className="text-[#10B981]">Resolved: {new Date(issue.resolved_at).toLocaleString()}</span>
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
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<IssueStatus | 'all'>('open');
  const [severityFilter, setSeverityFilter] = useState<IssueSeverity | 'all'>('all');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#64748B]" />
            <span className="text-sm text-[#64748B]">Filters:</span>
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as IssueStatus | 'all')}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1E90FF]"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as IssueSeverity | 'all')}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#1E90FF]"
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
