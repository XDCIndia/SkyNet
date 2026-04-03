'use client';

/**
 * PeerListPanel — Issue #8
 * Connected peers with enode, client version, and latency.
 */

import { useState } from 'react';
import { Peer } from './types';

interface PeerListPanelProps {
  peers: Peer[];
}

function directionBadge(dir: 'inbound' | 'outbound') {
  return dir === 'inbound' ? (
    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900 text-blue-300">IN</span>
  ) : (
    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900 text-purple-300">OUT</span>
  );
}

function truncateEnode(enode: string) {
  // enode://PUBKEY@IP:PORT  — show first 16 chars of pubkey
  try {
    const inner = enode.replace('enode://', '');
    const [pubkey, addr] = inner.split('@');
    return `enode://${pubkey.slice(0, 16)}…@${addr}`;
  } catch {
    return enode.slice(0, 40) + '…';
  }
}

export default function PeerListPanel({ peers }: PeerListPanelProps) {
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<'ip' | 'client' | 'direction'>('ip');

  const filtered = peers
    .filter((p) => {
      const q = filter.toLowerCase();
      return (
        p.ip.includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.clientVersion.toLowerCase().includes(q) ||
        p.country.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortKey === 'ip') return a.ip.localeCompare(b.ip);
      if (sortKey === 'client') return a.clientVersion.localeCompare(b.clientVersion);
      if (sortKey === 'direction') return a.direction.localeCompare(b.direction);
      return 0;
    });

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-white">
          Connected Peers{' '}
          <span className="text-gray-400 text-sm font-normal">({peers.length})</span>
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter peers…"
            className="text-sm bg-gray-700 text-white rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-cyan-500 w-44"
          />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as typeof sortKey)}
            className="text-sm bg-gray-700 text-white rounded-lg px-2 py-1.5 outline-none"
          >
            <option value="ip">Sort: IP</option>
            <option value="client">Sort: Client</option>
            <option value="direction">Sort: Direction</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-gray-400 text-sm">No peers match your filter.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs border-b border-gray-700">
                <th className="text-left pb-2 pr-4">Dir</th>
                <th className="text-left pb-2 pr-4">IP / Location</th>
                <th className="text-left pb-2 pr-4">Client</th>
                <th className="text-left pb-2 pr-4">Protocols</th>
                <th className="text-left pb-2">Enode</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((peer) => (
                <tr key={peer.id} className="border-b border-gray-700/50 hover:bg-gray-700/40">
                  <td className="py-2 pr-4">{directionBadge(peer.direction)}</td>
                  <td className="py-2 pr-4">
                    <span className="text-white font-mono">{peer.ip}:{peer.port}</span>
                    {peer.city && (
                      <span className="block text-xs text-gray-400">
                        {peer.city}, {peer.country}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className="text-cyan-300 text-xs font-mono"
                      title={peer.clientVersion}
                    >
                      {peer.clientVersion.slice(0, 28)}
                      {peer.clientVersion.length > 28 ? '…' : ''}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <span className="text-gray-300 text-xs">{peer.protocols.join(', ')}</span>
                  </td>
                  <td className="py-2">
                    <span
                      className="text-gray-400 text-xs font-mono cursor-copy"
                      title={peer.enode}
                      onClick={() => navigator.clipboard.writeText(peer.enode)}
                    >
                      {truncateEnode(peer.enode)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
