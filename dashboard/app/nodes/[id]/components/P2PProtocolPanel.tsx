'use client';

/**
 * P2PProtocolPanel — Issue #11
 * Shows protocol versions (eth/62, eth/63, eth/100 / XDC snap, etc.) per peer.
 */

import { useMemo } from 'react';
import { Network, Users } from 'lucide-react';
import type { Peer } from './types';

interface P2PProtocolPanelProps {
  peers: Peer[];
}

interface ProtocolStat {
  protocol: string;
  count: number;
  pct: number;
  color: string;
}

const PROTOCOL_COLORS: Record<string, string> = {
  'eth/62':    '#3B82F6',
  'eth/63':    '#6366F1',
  'eth/64':    '#8B5CF6',
  'eth/65':    '#A855F7',
  'eth/66':    '#EC4899',
  'eth/67':    '#F43F5E',
  'eth/68':    '#F97316',
  'eth/100':   '#10B981',
  'xdcsnap/1': '#1E90FF',
  'snap/1':    '#22D3EE',
};

function getProtocolColor(proto: string): string {
  return PROTOCOL_COLORS[proto] ?? '#64748B';
}

function PeerRow({ peer }: { peer: Peer }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white truncate">{peer.name || peer.ip}</div>
        <div className="text-xs text-[#64748B] font-mono truncate">{peer.ip}:{peer.port}</div>
      </div>
      <div className="flex flex-wrap gap-1 justify-end">
        {(peer.protocols ?? []).map(proto => (
          <span
            key={proto}
            className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border"
            style={{
              color: getProtocolColor(proto),
              borderColor: `${getProtocolColor(proto)}40`,
              backgroundColor: `${getProtocolColor(proto)}10`,
            }}
          >
            {proto}
          </span>
        ))}
        {(!peer.protocols || peer.protocols.length === 0) && (
          <span className="text-[10px] text-[#475569]">—</span>
        )}
      </div>
      <span
        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
          peer.direction === 'inbound'
            ? 'bg-[#10B981]/10 text-[#10B981]'
            : 'bg-[#1E90FF]/10 text-[#1E90FF]'
        }`}
      >
        {peer.direction}
      </span>
    </div>
  );
}

export default function P2PProtocolPanel({ peers }: P2PProtocolPanelProps) {
  const stats = useMemo<ProtocolStat[]>(() => {
    if (!peers.length) return [];
    const counts = new Map<string, number>();
    for (const peer of peers) {
      for (const proto of peer.protocols ?? []) {
        counts.set(proto, (counts.get(proto) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([protocol, count]) => ({
        protocol,
        count,
        pct: Math.round((count / peers.length) * 100),
        color: getProtocolColor(protocol),
      }));
  }, [peers]);

  const inbound = peers.filter(p => p.direction === 'inbound').length;
  const outbound = peers.filter(p => p.direction === 'outbound').length;

  if (!peers.length) {
    return (
      <div className="card-xdc">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#1E90FF]/10 flex items-center justify-center">
            <Network className="w-5 h-5 text-[#1E90FF]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">P2P Protocol Versions</h2>
            <p className="text-xs text-[#64748B]">Multi-client protocol negotiation</p>
          </div>
        </div>
        <div className="text-center py-8 text-[#64748B] text-sm">No peers connected</div>
      </div>
    );
  }

  return (
    <div className="card-xdc">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-[#1E90FF]/10 flex items-center justify-center">
          <Network className="w-5 h-5 text-[#1E90FF]" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold">P2P Protocol Versions</h2>
          <p className="text-xs text-[#64748B]">Protocol negotiation across {peers.length} peers</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[#64748B]">
          <Users className="w-3.5 h-3.5" />
          <span>{inbound} in / {outbound} out</span>
        </div>
      </div>

      {/* Protocol distribution */}
      {stats.length > 0 && (
        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] mb-4">
          <div className="text-xs uppercase text-[#64748B] tracking-wider mb-3">Protocol Distribution</div>
          <div className="space-y-2">
            {stats.map(s => (
              <div key={s.protocol} className="flex items-center gap-3">
                <span
                  className="text-xs font-mono font-medium w-20 flex-shrink-0"
                  style={{ color: s.color }}
                >
                  {s.protocol}
                </span>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                  />
                </div>
                <span className="text-xs text-[#94A3B8] w-12 text-right">
                  {s.count} ({s.pct}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Peer list with protocols */}
      <div className="max-h-80 overflow-y-auto">
        {peers.slice(0, 50).map(peer => (
          <PeerRow key={peer.id} peer={peer} />
        ))}
        {peers.length > 50 && (
          <div className="text-center text-xs text-[#64748B] pt-2">
            + {peers.length - 50} more peers
          </div>
        )}
      </div>
    </div>
  );
}
