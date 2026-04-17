'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, RotateCcw, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, Zap, Shield } from 'lucide-react';

interface RestartEvent {
  id: number;
  node_id: string;
  restarted_at: string;
  reason: string | null;
  restart_type: 'soft' | 'hard' | 'recovery';
  result: 'pending' | 'success' | 'failed';
  blocks_before: number | null;
  blocks_after: number | null;
  client_type: string | null;
}

interface RestartHistoryProps {
  nodeId: string;
}

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

function ResultBadge({ result }: { result: RestartEvent['result'] }) {
  const styles: Record<string, string> = {
    success: 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20',
    failed:  'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20',
    pending: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20',
  };
  const icons: Record<string, React.ReactNode> = {
    success: <CheckCircle2 className="w-3 h-3" />,
    failed:  <XCircle className="w-3 h-3" />,
    pending: <Clock className="w-3 h-3 animate-pulse" />,
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${styles[result] ?? styles.pending}`}>
      {icons[result]}
      {result?.charAt(0).toUpperCase() + result.slice(1)}
    </span>
  );
}

function TypeBadge({ type }: { type: RestartEvent['restart_type'] }) {
  const styles: Record<string, string> = {
    soft:     'bg-[#1E90FF]/10 text-[#1E90FF]',
    hard:     'bg-[#8B5CF6]/10 text-[#8B5CF6]',
    recovery: 'bg-[#F59E0B]/10 text-[#F59E0B]',
  };
  return (
    <span className={`px-2 py-0.5 text-xs rounded font-mono ${styles[type] ?? styles.soft}`}>
      {type}
    </span>
  );
}

export default function RestartHistory({ nodeId }: RestartHistoryProps) {
  const [restarts, setRestarts] = useState<RestartEvent[]>([]);
  const [autoHealEnabled, setAutoHealEnabled] = useState(true);
  const [restartCount, setRestartCount] = useState(0);
  const [lastRestartAt, setLastRestartAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const fetchRestarts = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/nodes/${nodeId}/restarts`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setRestarts(data.restarts ?? []);
        setAutoHealEnabled(data.autoHealEnabled ?? true);
        setRestartCount(data.restartCount ?? 0);
        setLastRestartAt(data.lastRestartAt ?? null);
      }
    } catch (err) {
      console.error('[RestartHistory] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    fetchRestarts();
    const interval = setInterval(fetchRestarts, 30_000);
    return () => clearInterval(interval);
  }, [fetchRestarts]);

  const toggleAutoHeal = async () => {
    setToggling(true);
    try {
      const res = await fetch(`/api/v1/nodes/${nodeId}/restarts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoHealEnabled: !autoHealEnabled }),
      });
      if (res.ok) setAutoHealEnabled(!autoHealEnabled);
    } catch (err) {
      console.error('[RestartHistory] toggle error:', err);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="card-xdc">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1E90FF]/10 flex items-center justify-center text-[#1E90FF]">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Auto-Heal &amp; Restart History</h2>
            <p className="text-xs text-[#64748B]">
              {restartCount} total restart{restartCount !== 1 ? 's' : ''}
              {lastRestartAt ? ` · Last: ${formatTimeAgo(lastRestartAt)}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-heal toggle */}
          <div className="flex items-center gap-2">
            <Shield className={`w-4 h-4 ${autoHealEnabled ? 'text-[#10B981]' : 'text-[#64748B]'}`} />
            <span className="text-xs text-[#64748B]">Auto-heal</span>
            <button
              onClick={toggleAutoHeal}
              disabled={toggling}
              className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
                autoHealEnabled ? 'bg-[#10B981]' : 'bg-white/10'
              } ${toggling ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
              title={autoHealEnabled ? 'Disable auto-heal' : 'Enable auto-heal'}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                  autoHealEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchRestarts}
            className="p-1.5 hover:bg-white/10 rounded-lg text-[#64748B] hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Collapse */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 hover:bg-white/10 rounded-lg text-[#64748B] hover:text-white transition-colors"
          >
            {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Auto-heal status banner */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-4 text-xs ${
        autoHealEnabled
          ? 'bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981]'
          : 'bg-white/5 border border-white/10 text-[#64748B]'
      }`}>
        <Zap className="w-3.5 h-3.5" />
        {autoHealEnabled
          ? 'Auto-heal is active — SkyOne will automatically restart this node when a block stall is detected (5+ min, 3+ peers).'
          : 'Auto-heal is disabled — the node will not be restarted automatically on stall.'}
      </div>

      {/* Collapsible timeline */}
      {!collapsed && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-[#64748B]">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Loading restart history…
            </div>
          ) : restarts.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-[#10B981] mb-2" />
              <p className="text-sm text-[#64748B]">No restarts recorded yet</p>
              <p className="text-xs text-[#475569] mt-1">Restart events will appear here when SkyOne triggers auto-heal.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-white/10" />

              <div className="space-y-4 pl-10">
                {restarts.map((r) => (
                  <div key={r.id} className="relative">
                    {/* Timeline dot */}
                    <div className={`absolute -left-[26px] top-2 w-2.5 h-2.5 rounded-full border-2 border-[#0F172A] ${
                      r.result === 'success' ? 'bg-[#10B981]'
                      : r.result === 'failed'  ? 'bg-[#EF4444]'
                      :                          'bg-[#F59E0B] animate-pulse'
                    }`} />

                    <div className="bg-white/5 rounded-lg px-4 py-3 border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <ResultBadge result={r.result} />
                        <TypeBadge type={r.restart_type} />
                        {r.client_type && (
                          <span className="px-2 py-0.5 text-xs rounded bg-white/5 text-[#94A3B8] font-mono">
                            {r.client_type}
                          </span>
                        )}
                        <span className="ml-auto text-xs text-[#64748B]">
                          {formatTimeAgo(r.restarted_at)}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs text-[#94A3B8]">
                        <span>
                          <span className="text-[#64748B]">Reason: </span>
                          <span className="font-medium text-[#F1F5F9]">
                            {r.reason ?? 'unknown'}
                          </span>
                        </span>
                        {r.blocks_before !== null && (
                          <span>
                            <span className="text-[#64748B]">Block before: </span>
                            <span className="font-mono text-[#F1F5F9]">{r.blocks_before.toLocaleString()}</span>
                          </span>
                        )}
                        {r.blocks_after !== null && (
                          <span>
                            <span className="text-[#64748B]">Block after: </span>
                            <span className="font-mono text-[#10B981]">{r.blocks_after.toLocaleString()}</span>
                          </span>
                        )}
                        <span className="text-[#475569]">
                          {new Date(r.restarted_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
