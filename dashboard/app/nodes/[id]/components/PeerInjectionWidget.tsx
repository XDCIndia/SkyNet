'use client';

/**
 * PeerInjectionWidget — Issue #40
 * Shows last peer injection event and allows triggering a new injection.
 * Displays: "Last peer injection: 5 min ago (+12 peers)"
 */

import { useState, useEffect, useCallback } from 'react';
import { Users, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

interface InjectionEvent {
  injectedCount: number;
  failedCount: number;
  source: string;
  injectedAt: string;
}

interface PeerInjectionWidgetProps {
  nodeId: string;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function PeerInjectionWidget({ nodeId }: PeerInjectionWidgetProps) {
  const [latest, setLatest] = useState<InjectionEvent | null>(null);
  const [injecting, setInjecting] = useState(false);
  const [result, setResult] = useState<{ injected: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/nodes/${nodeId}/peer-injection`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setLatest(data.latest);
      }
    } catch {
      // Silently ignore
    }
  }, [nodeId]);

  useEffect(() => {
    fetchLatest();
    const interval = setInterval(fetchLatest, 30_000);
    return () => clearInterval(interval);
  }, [fetchLatest]);

  const handleInject = async () => {
    setInjecting(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch('/api/v2/peers/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, source: 'manual' }),
      });
      const data = await res.json();
      if (data.success) {
        setResult({ injected: data.injected, failed: data.failed });
        await fetchLatest();
      } else {
        setError(data.error ?? 'Injection failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInjecting(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
      <div className="w-8 h-8 rounded-lg bg-[#1E90FF]/10 flex items-center justify-center flex-shrink-0">
        <Users className="w-4 h-4 text-[#1E90FF]" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-white">Peer Injection</div>
        {latest ? (
          <div className="text-xs text-[#64748B]">
            Last:{' '}
            <span className="text-[#10B981]">{timeAgo(latest.injectedAt)}</span>
            {' '}(
            <span className="text-[#1E90FF]">+{latest.injectedCount} peers</span>
            {latest.failedCount > 0 && (
              <span className="text-[#F59E0B]">, {latest.failedCount} failed</span>
            )}
            )
            {' '}<span className="text-[#475569]">[{latest.source}]</span>
          </div>
        ) : (
          <div className="text-xs text-[#475569]">No injection history</div>
        )}

        {/* Result feedback */}
        {result && (
          <div className="flex items-center gap-1 text-xs text-[#10B981] mt-0.5">
            <CheckCircle className="w-3 h-3" />
            Injected {result.injected} peers
            {result.failed > 0 && (
              <span className="text-[#F59E0B]"> ({result.failed} failed)</span>
            )}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-1 text-xs text-[#EF4444] mt-0.5">
            <AlertCircle className="w-3 h-3" />
            {error}
          </div>
        )}
      </div>

      <button
        onClick={handleInject}
        disabled={injecting}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E90FF]/10 hover:bg-[#1E90FF]/20 text-[#1E90FF] text-xs font-medium border border-[#1E90FF]/20 transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${injecting ? 'animate-spin' : ''}`} />
        {injecting ? 'Injecting...' : 'Inject Peers'}
      </button>
    </div>
  );
}
