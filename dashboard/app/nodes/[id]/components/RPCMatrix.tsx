'use client';

import { useState, useMemo } from 'react';
import { Code2, ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import type { NodeDetail, NodeStatus } from './types';

interface RPCMatrixProps {
  node: NodeDetail;
  status: NodeStatus;
}

type SupportLevel = 'yes' | 'no' | 'partial';

interface RPCMethod {
  name: string;
  namespace: string;
  geth: SupportLevel;
  erigon: SupportLevel;
  nethermind: SupportLevel;
  reth: SupportLevel;
}

const RPC_METHODS: RPCMethod[] = [
  // eth
  { name: 'eth_blockNumber',           namespace: 'eth',    geth: 'yes', erigon: 'yes', nethermind: 'yes', reth: 'yes' },
  { name: 'eth_getBlockByNumber',      namespace: 'eth',    geth: 'yes', erigon: 'yes', nethermind: 'yes', reth: 'yes' },
  { name: 'eth_getLogs',               namespace: 'eth',    geth: 'yes', erigon: 'yes', nethermind: 'yes', reth: 'yes' },
  { name: 'eth_call',                  namespace: 'eth',    geth: 'yes', erigon: 'yes', nethermind: 'yes', reth: 'yes' },
  { name: 'eth_estimateGas',           namespace: 'eth',    geth: 'yes', erigon: 'yes', nethermind: 'yes', reth: 'yes' },
  { name: 'eth_sendRawTransaction',    namespace: 'eth',    geth: 'yes', erigon: 'yes', nethermind: 'yes', reth: 'yes' },
  // debug
  { name: 'debug_traceTransaction',    namespace: 'debug',  geth: 'yes', erigon: 'yes', nethermind: 'yes', reth: 'no' },
  { name: 'debug_traceBlockByNumber',  namespace: 'debug',  geth: 'yes', erigon: 'yes', nethermind: 'yes', reth: 'no' },
  // admin
  { name: 'admin_peers',               namespace: 'admin',  geth: 'yes', erigon: 'yes', nethermind: 'partial', reth: 'no' },
  { name: 'admin_addPeer',             namespace: 'admin',  geth: 'yes', erigon: 'yes', nethermind: 'no',  reth: 'no' },
  { name: 'admin_nodeInfo',            namespace: 'admin',  geth: 'yes', erigon: 'yes', nethermind: 'no',  reth: 'no' },
  // net
  { name: 'net_peerCount',             namespace: 'net',    geth: 'yes', erigon: 'yes', nethermind: 'yes', reth: 'yes' },
  // txpool
  { name: 'txpool_status',             namespace: 'txpool', geth: 'yes', erigon: 'yes', nethermind: 'yes', reth: 'yes' },
  { name: 'txpool_content',            namespace: 'txpool', geth: 'yes', erigon: 'yes', nethermind: 'yes', reth: 'no' },
  // xdpos
  { name: 'xdpos_getMasternodesByNumber',      namespace: 'xdpos',  geth: 'yes', erigon: 'no', nethermind: 'no', reth: 'no' },
  { name: 'xdpos_getV2BlockSignersByNumber',   namespace: 'xdpos',  geth: 'yes', erigon: 'no', nethermind: 'no', reth: 'no' },
  // erigon
  { name: 'erigon_getHeaderByNumber',  namespace: 'erigon', geth: 'no',  erigon: 'yes', nethermind: 'no',  reth: 'no' },
];

const NAMESPACES = ['eth', 'debug', 'admin', 'net', 'txpool', 'xdpos', 'erigon'];

const NAMESPACE_COLORS: Record<string, string> = {
  eth:      'text-[#1E90FF] bg-[#1E90FF]/10',
  debug:    'text-[#F59E0B] bg-[#F59E0B]/10',
  admin:    'text-[#EF4444] bg-[#EF4444]/10',
  net:      'text-[#10B981] bg-[#10B981]/10',
  txpool:   'text-[#8B5CF6] bg-[#8B5CF6]/10',
  xdpos:    'text-[#06B6D4] bg-[#06B6D4]/10',
  erigon:   'text-[#F97316] bg-[#F97316]/10',
};

const CLIENTS = [
  { key: 'geth',       label: 'Geth/GP5',   color: '#1E90FF' },
  { key: 'erigon',     label: 'Erigon',     color: '#F97316' },
  { key: 'nethermind', label: 'Nethermind', color: '#8B5CF6' },
  { key: 'reth',       label: 'Reth',       color: '#10B981' },
] as const;

type ClientKey = typeof CLIENTS[number]['key'];

function SupportBadge({ level }: { level: SupportLevel }) {
  if (level === 'yes') {
    return (
      <div className="flex items-center justify-center">
        <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
      </div>
    );
  }
  if (level === 'partial') {
    return (
      <div className="flex items-center justify-center" title="Partial support">
        <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center">
      <XCircle className="w-4 h-4 text-[#EF4444]/60" />
    </div>
  );
}

function resolveClientKey(node: NodeDetail, status: NodeStatus): ClientKey {
  const ct = (status.clientType || node.client_type || '').toLowerCase();
  if (ct.includes('erigon')) return 'erigon';
  if (ct.includes('nethermind')) return 'nethermind';
  if (ct.includes('reth')) return 'reth';
  return 'geth'; // geth, gp5, xdc all map to geth column
}

function getClientLabel(key: ClientKey): string {
  return CLIENTS.find(c => c.key === key)?.label ?? 'Geth/GP5';
}

function countSupported(clientKey: ClientKey): { supported: number; total: number } {
  const supported = RPC_METHODS.filter(m => m[clientKey] === 'yes' || m[clientKey] === 'partial').length;
  return { supported, total: RPC_METHODS.length };
}

export default function RPCMatrix({ node, status }: RPCMatrixProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const clientKey = useMemo(() => resolveClientKey(node, status), [node, status]);
  const clientLabel = getClientLabel(clientKey);
  const { supported, total } = countSupported(clientKey);

  return (
    <div className="card-xdc">
      {/* Header */}
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsExpanded(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1E90FF]/10 flex items-center justify-center text-[#1E90FF]">
            <Code2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">RPC Compatibility</h2>
            <p className="text-xs text-[#64748B]">
              <span className="font-mono text-[#10B981] font-bold">{supported}</span>
              <span className="text-[#475569]">/{total}</span>
              <span className="ml-1">methods supported for {clientLabel}</span>
            </p>
          </div>
        </div>
        <button className="p-2 text-[#64748B] hover:text-white transition-colors rounded-lg hover:bg-white/5">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-5">
          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-white/5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left px-4 py-3 text-[#64748B] font-medium text-xs uppercase tracking-wider w-1/3">
                    Method
                  </th>
                  {CLIENTS.map(client => (
                    <th
                      key={client.key}
                      className={`text-center px-4 py-3 text-xs font-medium uppercase tracking-wider transition-colors ${
                        client.key === clientKey
                          ? 'bg-[#1E90FF]/10 text-[#1E90FF]'
                          : 'text-[#64748B]'
                      }`}
                      style={client.key === clientKey ? { color: client.color } : {}}
                    >
                      <span className="flex flex-col items-center gap-0.5">
                        {client.label}
                        {client.key === clientKey && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{ background: `${client.color}20`, color: client.color }}
                          >
                            THIS NODE
                          </span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {NAMESPACES.map(ns => {
                  const methods = RPC_METHODS.filter(m => m.namespace === ns);
                  if (methods.length === 0) return null;
                  return methods.map((method, idx) => (
                    <tr
                      key={method.name}
                      className={`border-b border-white/5 transition-colors hover:bg-white/5 ${
                        idx === 0 ? 'border-t border-white/10' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {idx === 0 && (
                            <span
                              className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded mr-1 ${
                                NAMESPACE_COLORS[ns] ?? 'text-[#64748B] bg-white/10'
                              }`}
                            >
                              {ns}
                            </span>
                          )}
                          {idx !== 0 && <span className="w-[50px]" />}
                          <code className="text-xs text-[#94A3B8] font-mono">{method.name}</code>
                        </div>
                      </td>
                      {CLIENTS.map(client => (
                        <td
                          key={client.key}
                          className={`px-4 py-2.5 ${
                            client.key === clientKey
                              ? 'bg-[#1E90FF]/5'
                              : ''
                          }`}
                        >
                          <SupportBadge level={method[client.key as ClientKey]} />
                        </td>
                      ))}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="mt-3 flex items-center justify-between text-xs text-[#475569]">
            <span>
              Legend:{' '}
              <CheckCircle2 className="w-3 h-3 text-[#10B981] inline-block mx-1" /> Supported{' '}
              <AlertTriangle className="w-3 h-3 text-[#F59E0B] inline-block mx-1" /> Partial{' '}
              <XCircle className="w-3 h-3 text-[#EF4444]/60 inline-block mx-1" /> Unsupported
            </span>
            <span>Based on client type: <strong className="text-[#94A3B8]">{clientLabel}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
