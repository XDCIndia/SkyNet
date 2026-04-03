'use client';

/**
 * LogViewerPanel — Issue #9
 * Stream recent logs via SkyOne agent with search/filter and auto-scroll.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

interface LogLine {
  ts: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | string;
  msg: string;
  raw: string;
}

interface LogViewerPanelProps {
  nodeId: string;
  skyonePort?: number; // SkyOne agent port (default 7070)
}

function levelColor(level: string) {
  switch (level) {
    case 'ERROR': return 'text-red-400';
    case 'WARN':  return 'text-yellow-400';
    case 'DEBUG': return 'text-gray-500';
    default:      return 'text-green-400';
  }
}

function parseLine(raw: string): LogLine {
  // Try to parse JSON log lines (common in geth/erigon)
  try {
    const obj = JSON.parse(raw);
    return {
      ts: obj.t ?? obj.time ?? obj.ts ?? '',
      level: (obj.lvl ?? obj.level ?? 'INFO').toUpperCase(),
      msg: obj.msg ?? obj.message ?? raw,
      raw,
    };
  } catch {
    // Plain text: try to detect level
    const level =
      /\bERR(OR)?\b/i.test(raw) ? 'ERROR' :
      /\bWARN(ING)?\b/i.test(raw) ? 'WARN' :
      /\bDEBUG\b/i.test(raw) ? 'DEBUG' : 'INFO';
    return { ts: '', level, msg: raw, raw };
  }
}

const MAX_LINES = 500;

export default function LogViewerPanel({ nodeId, skyonePort = 7070 }: LogViewerPanelProps) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startStream = useCallback(async () => {
    setError(null);
    setLines([]);
    setStreaming(true);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      // Fetch logs from our dashboard API which proxies to SkyOne agent
      const url = `/api/v2/nodes/${encodeURIComponent(nodeId)}/logs?port=${skyonePort}&tail=200`;
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.body) throw new Error('No response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n');
        buf = parts.pop() ?? '';
        const newLines = parts.filter(Boolean).map(parseLine);
        setLines((prev) => {
          const next = [...prev, ...newLines];
          return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message ?? 'Stream error');
      }
    } finally {
      setStreaming(false);
    }
  }, [nodeId, skyonePort]);

  const stopStream = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines, autoScroll]);

  const visible = lines.filter((l) => {
    if (levelFilter !== 'ALL' && l.level !== levelFilter) return false;
    if (filter && !l.raw.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-white">Log Viewer</h2>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search logs…"
            className="text-sm bg-gray-700 text-white rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-cyan-500 w-44"
          />
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="text-sm bg-gray-700 text-white rounded-lg px-2 py-1.5 outline-none"
          >
            {['ALL', 'INFO', 'WARN', 'ERROR', 'DEBUG'].map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="accent-cyan-500"
            />
            Auto-scroll
          </label>
          {streaming ? (
            <button
              onClick={stopStream}
              className="text-sm bg-red-700 hover:bg-red-600 text-white rounded-lg px-3 py-1.5"
            >
              Stop
            </button>
          ) : (
            <button
              onClick={startStream}
              className="text-sm bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg px-3 py-1.5"
            >
              {lines.length > 0 ? 'Refresh' : 'Load Logs'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 bg-red-900/40 border border-red-700 rounded-lg px-3 py-2 text-red-300 text-sm">
          ⚠ {error}
        </div>
      )}

      <div
        className="bg-gray-900 rounded-lg p-3 font-mono text-xs overflow-y-auto h-80 space-y-0.5"
        onScroll={() => {}} // handled via autoScroll
      >
        {visible.length === 0 && !streaming && (
          <p className="text-gray-500">
            {lines.length === 0 ? 'Click "Load Logs" to fetch.' : 'No lines match your filter.'}
          </p>
        )}
        {visible.map((line, i) => (
          <div key={i} className="flex gap-2 leading-5 hover:bg-gray-800/60 px-1 rounded">
            {line.ts && (
              <span className="text-gray-600 shrink-0">
                {line.ts.length > 19 ? line.ts.slice(0, 19) : line.ts}
              </span>
            )}
            <span className={`${levelColor(line.level)} shrink-0 w-12`}>{line.level}</span>
            <span className="text-gray-200 break-all">{line.msg}</span>
          </div>
        ))}
        {streaming && (
          <div className="text-cyan-500 animate-pulse">⬇ Streaming…</div>
        )}
        <div ref={bottomRef} />
      </div>

      <p className="text-xs text-gray-500 mt-2">
        Showing {visible.length} / {lines.length} lines (max {MAX_LINES} buffered)
      </p>
    </div>
  );
}
