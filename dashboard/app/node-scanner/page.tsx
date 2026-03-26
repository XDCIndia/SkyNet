'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Server, Shield, RefreshCw, Clock, XCircle, CheckCircle,
  AlertTriangle, Globe, ExternalLink, Copy, Check, Download,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface NodeScanEntry {
  ip: string;
  sources: string[];
  rpcOpen: boolean;
  rpcPort: number;
  wsOpen: boolean;
  p2pOpen: boolean;
  exposedModules: string[];
  dangerousModules: string[];
  securityScore: number;
  securityLabel: 'secure' | 'caution' | 'risk';
  isp: string;
  org: string;
  country: string;
  countryCode: string;
  city: string;
  findings: string[];
  validatorAddress: string;
  validatorName: string;
  validatorRole: 'active' | 'standby' | 'penalized' | 'fullnode' | 'unknown';
  isCandidate: boolean;
}

interface EthstatsNode {
  name: string;
  blockNumber: number;
  peers: number;
  active: boolean;
  syncing: boolean;
  latency: number;
  uptime: number;
  miner?: string;
}

interface MasternodeEntry {
  address: string;
  owner: string;
  stakeXDC: number;
  role: 'active' | 'standby' | 'penalized' | 'candidate';
}

interface ScanResult {
  scannedAt: string;
  totalIPs: number;
  openRpc: number;
  openWs: number;
  debugExposed: number;
  uniqueProviders: number;
  nodes: NodeScanEntry[];
  masternodeList?: MasternodeEntry[];
  activeCount: number;
  standbyCount: number;
  penalizedCount?: number;
  activeMNOpen?: number;
  standbyOpen?: number;
  fullnodeOpen?: number;
  cached?: boolean;
  error?: string;
  ethstats?: {
    totalNodes: number;
    activeNodes: number;
    syncingNodes: number;
    maxBlock: number;
    nodes: EthstatsNode[];
    error?: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="p-1 hover:bg-white/10 rounded transition-colors">
      {copied ? <Check className="w-3 h-3 text-[var(--success)]" /> : <Copy className="w-3 h-3 text-[var(--text-tertiary)]" />}
    </button>
  );
}

function flagEmoji(cc: string) {
  if (!cc || cc.length !== 2) return '🌐';
  return String.fromCodePoint(...[...cc.toUpperCase()].map(c => 0x1F1E0 + c.charCodeAt(0) - 65));
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function NodeScannerPage() {
  const [network, setNetwork] = useState<'mainnet' | 'apothem'>('mainnet');
  const [data, setData] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'risk' | 'open' | 'masternode' | 'fullnode'>('all');
  const [sortBy, setSortBy] = useState<'score' | 'ip' | 'provider'>('score');
  const [ethFilter, setEthFilter] = useState<'all' | 'active' | 'syncing' | 'stale'>('all');

  const runScan = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ network });
      if (force) params.set('refresh', '1');
      const res = await fetch(`/api/security/nodes?${params}`);
      setData(await res.json());
    } catch (e) {
      setData({ error: (e as Error).message } as ScanResult);
    } finally {
      setLoading(false);
    }
  }, [network]);

  useEffect(() => { runScan(); }, [runScan]);

  const downloadCSV = () => {
    if (!data?.nodes) return;
    const atRisk = data.nodes.filter(n => n.securityLabel !== 'secure');
    const headers = ['IP','Security Score','Label','RPC Open','RPC Port','WS Open','P2P Open','ISP','Org','Country','City','Exposed Modules','Dangerous Modules','Findings','Sources'];
    const rows = atRisk.map(n => [
      n.ip,
      n.securityScore,
      n.securityLabel,
      n.rpcOpen ? 'YES' : 'NO',
      (n as NodeScanEntry & {rpcPort?: number}).rpcPort || '',
      n.wsOpen ? 'YES' : 'NO',
      n.p2pOpen ? 'YES' : 'NO',
      `"${(n.isp || '').replace(/"/g, '""')}"`,
      `"${(n.org || '').replace(/"/g, '""')}"`,
      n.country,
      n.city,
      `"${n.exposedModules.join(', ')}"`,
      `"${n.dangerousModules.join(', ')}"`,
      `"${n.findings.join('; ')}"`,
      `"${n.sources.join('; ')}"`,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xdc-at-risk-nodes-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scoreColor = (s: number) => s >= 80 ? 'text-[var(--success)]' : s >= 50 ? 'text-[var(--warning)]' : 'text-[var(--critical)]';
  const scoreBg = (l: string) => ({ secure: 'bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/25', caution: 'bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/25', risk: 'bg-[var(--critical)]/15 text-[var(--critical)] border-[var(--critical)]/25' }[l] || '');

  const filteredNodes = (data?.nodes || [])
    .filter(n => {
      if (filter === 'risk') return n.securityLabel !== 'secure';
      if (filter === 'open') return n.rpcOpen || n.wsOpen;
      if (filter === 'masternode') return n.validatorRole === 'active' || n.validatorRole === 'standby' || n.validatorRole === 'penalized';
      if (filter === 'fullnode') return n.validatorRole === 'fullnode' || n.validatorRole === 'unknown';
      return true;
    })
    .sort((a, b) => sortBy === 'score' ? a.securityScore - b.securityScore : sortBy === 'ip' ? a.ip.localeCompare(b.ip) : (a.isp || '').localeCompare(b.isp || ''));

  const maxBlock = data?.ethstats?.maxBlock || 0;
  const ethNodes = (data?.ethstats?.nodes || []).filter(n => {
    if (ethFilter === 'active') return n.active && !n.syncing;
    if (ethFilter === 'syncing') return n.syncing;
    if (ethFilter === 'stale') return maxBlock - n.blockNumber > 100;
    return true;
  });

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-5 max-w-[1600px] mx-auto">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Server className="w-5 h-5 text-[var(--accent-blue)]" />
              <h1 className="text-xl font-bold">Node Security Scanner</h1>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              Live network node discovery via ethstats WebSocket + P2P peer probing · TCP port scan · geolocation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg p-0.5 gap-0.5">
              {(['mainnet', 'apothem'] as const).map(n => (
                <button key={n} onClick={() => { setNetwork(n); setData(null); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${network === n ? 'bg-[var(--accent-blue)] text-white' : 'text-[var(--text-secondary)] hover:bg-white/5'}`}>
                  {n === 'mainnet' ? 'Mainnet' : 'Apothem'}
                </button>
              ))}
            </div>
            {data?.scannedAt && (
              <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(data.scannedAt).toLocaleTimeString()}
                {data.cached && ' (cached)'}
              </span>
            )}
            <button onClick={() => runScan(true)} disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20 rounded-lg hover:bg-[var(--accent-blue)]/20 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'Scanning…' : 'Rescan'}
            </button>
          </div>
        </div>

        {data?.error && (
          <div className="p-4 bg-[var(--critical)]/10 border border-[var(--critical)]/25 rounded-xl text-[var(--critical)] text-sm flex items-center gap-2">
            <XCircle className="w-4 h-4 flex-shrink-0" /> {data.error}
          </div>
        )}

        {loading && !data && (
          <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl flex flex-col items-center justify-center py-20 gap-3 text-[var(--text-tertiary)]">
            <RefreshCw className="w-8 h-8 animate-spin" />
            <div className="text-sm">Connecting to ethstats + discovering peers…</div>
            <div className="text-xs">First scan takes ~30 seconds</div>
          </div>
        )}

        {data && !data.error && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {[
                { label: 'Active MN', value: data.activeCount, color: 'text-[var(--success)]' },
                { label: 'Standby', value: data.standbyCount, color: 'text-[var(--warning)]' },
                { label: 'Penalized', value: data.penalizedCount || 0, color: data.penalizedCount ? 'text-[var(--critical)]' : 'text-[var(--text-tertiary)]' },
                { label: 'IPs Probed', value: data.totalIPs, color: 'text-[var(--accent-blue)]' },
                { label: 'RPC Open', value: data.openRpc, color: data.openRpc > 0 ? 'text-[var(--critical)]' : 'text-[var(--success)]', sub: data.totalIPs > 0 ? Math.round(data.openRpc/data.totalIPs*100) + '%' : '' },
                { label: 'MN Open RPC', value: (data.activeMNOpen || 0) + (data.standbyOpen || 0), color: 'text-[var(--critical)]' },
                { label: 'Debug Exposed', value: data.debugExposed, color: data.debugExposed > 0 ? 'text-[var(--critical)]' : 'text-[var(--success)]' },
                { label: 'Ethstats Nodes', value: data.ethstats?.totalNodes || 0, color: 'text-[var(--accent-blue)]' },
              ].map(({ label, value, color, sub }) => (
                <div key={label} className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl p-3 text-center">
                  <div className="text-xs text-[var(--text-tertiary)] mb-1">{label}</div>
                  <div className={`text-lg font-bold tabular-nums ${color}`}>{value}</div>
                </div>
              ))}
            </div>

            {/* ═══ Ethstats Network Nodes ═══ */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl overflow-hidden">
              <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-header)] gap-3">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[var(--accent-blue)]" />
                  <span className="font-semibold text-sm">Network Nodes — stats.xinfin.network</span>
                </div>
                <div className="flex items-center gap-1">
                  {(['all', 'active', 'syncing', 'stale'] as const).map(f => (
                    <button key={f} onClick={() => setEthFilter(f)}
                      className={`px-2.5 py-1 text-xs rounded transition-colors ${ethFilter === f ? 'bg-[var(--accent-blue)] text-white' : 'text-[var(--text-secondary)] hover:bg-white/5'}`}>
                      {f === 'all' ? `All (${data.ethstats?.totalNodes || 0})` : f === 'active' ? `Active (${data.ethstats?.activeNodes || 0})` : f === 'syncing' ? `Syncing (${data.ethstats?.syncingNodes || 0})` : 'Stale'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-[var(--bg-header)] z-10">
                    <tr className="border-b border-[var(--border-subtle)]">
                      {['#', 'Node Name', 'Block', 'Behind', 'Peers', 'Status', 'Latency', 'Uptime'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-[var(--text-tertiary)] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {ethNodes.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-[var(--text-tertiary)]">No nodes match filter</td></tr>
                    )}
                    {ethNodes.map((node, idx) => {
                      const behind = maxBlock - node.blockNumber;
                      const isStale = behind > 100;
                      return (
                        <tr key={node.name} className={`hover:bg-white/3 transition-colors ${isStale ? 'bg-[var(--warning)]/5' : ''}`}>
                          <td className="px-3 py-1.5 text-[var(--text-tertiary)] tabular-nums">{idx + 1}</td>
                          <td className="px-3 py-1.5 font-mono text-[var(--text-primary)] max-w-[220px] truncate" title={node.name}>{node.name}</td>
                          <td className="px-3 py-1.5 tabular-nums">{node.blockNumber.toLocaleString()}</td>
                          <td className="px-3 py-1.5 tabular-nums">
                            {behind === 0 ? <span className="text-[var(--success)]">0</span> : <span className={isStale ? 'text-[var(--critical)]' : 'text-[var(--warning)]'}>-{behind.toLocaleString()}</span>}
                          </td>
                          <td className="px-3 py-1.5 tabular-nums">{node.peers}</td>
                          <td className="px-3 py-1.5">
                            {node.active && !node.syncing ? <span className="text-[var(--success)]">● Active</span>
                              : node.syncing ? <span className="text-[var(--warning)]">◐ Syncing</span>
                              : <span className="text-[var(--critical)]">○ Offline</span>}
                          </td>
                          <td className="px-3 py-1.5 tabular-nums text-[var(--text-tertiary)]">{node.latency}ms</td>
                          <td className="px-3 py-1.5 tabular-nums text-[var(--text-tertiary)]">{node.uptime}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ═══ Masternode Validation ═══ */}
            {data.masternodeList && data.masternodeList.length > 0 && (
              <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl overflow-hidden">
                <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-header)] gap-3">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[var(--accent-blue)]" />
                    <span className="font-semibold text-sm">Masternode Validation — On-Chain Data</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
                    <span className="text-[var(--success)]">● {data.masternodeList.filter(m => m.role === 'active').length} active</span>
                    <span className="text-[var(--warning)]">● {data.masternodeList.filter(m => m.role === 'standby').length} standby</span>
                    <span className="text-[var(--critical)]">● {data.masternodeList.filter(m => m.role === 'penalized').length} penalized</span>
                    <span>Total: {data.masternodeList.length} candidates</span>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[var(--bg-header)] z-10">
                      <tr className="border-b border-[var(--border-subtle)]">
                        {['#', 'Role', 'Candidate Address', 'Owner Address', 'Stake (XDC)'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-semibold text-[var(--text-tertiary)] whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {data.masternodeList.map((mn, idx) => (
                        <tr key={mn.address} className={`hover:bg-white/3 transition-colors ${mn.role === 'penalized' ? 'bg-[var(--critical)]/5' : ''}`}>
                          <td className="px-3 py-1.5 text-[var(--text-tertiary)] tabular-nums">{idx + 1}</td>
                          <td className="px-3 py-1.5">
                            <span className={`px-2 py-0.5 rounded border text-xs font-medium ${
                              mn.role === 'active' ? 'bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/25' :
                              mn.role === 'standby' ? 'bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/25' :
                              mn.role === 'penalized' ? 'bg-[var(--critical)]/15 text-[var(--critical)] border-[var(--critical)]/25' :
                              'bg-white/5 text-[var(--text-tertiary)] border-[var(--border-subtle)]'
                            }`}>{mn.role}</span>
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-1">
                              <a href={`https://xdcscan.com/address/${mn.address}`} target="_blank" className="font-mono text-[var(--accent-blue)] hover:underline">{mn.address.slice(0,10)}...{mn.address.slice(-8)}</a>
                              <CopyBtn text={mn.address} />
                            </div>
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex items-center gap-1">
                              <a href={`https://xdcscan.com/address/${mn.owner}`} target="_blank" className="font-mono text-[var(--text-secondary)] hover:underline">{mn.owner.slice(0,10)}...{mn.owner.slice(-8)}</a>
                              <CopyBtn text={mn.owner} />
                            </div>
                          </td>
                          <td className="px-3 py-1.5 tabular-nums font-mono text-right">{mn.stakeXDC.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ═══ Port Security Scan ═══ */}
            <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl overflow-hidden">
              <div className="flex flex-wrap items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-header)] gap-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[var(--critical)]" />
                  <span className="font-semibold text-sm">Port Security Scan — {data.totalIPs} IPs Probed</span>
                  {data.nodes.filter(n => n.securityLabel !== 'secure').length > 0 && (
                    <button onClick={downloadCSV}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-[var(--critical)]/10 text-[var(--critical)] border border-[var(--critical)]/25 rounded-lg hover:bg-[var(--critical)]/20 transition-colors ml-2">
                      <Download className="w-3.5 h-3.5" />
                      CSV ({data.nodes.filter(n => n.securityLabel !== 'secure').length} at risk)
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {(['all', 'risk', 'open', 'masternode', 'fullnode'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)}
                      className={`px-2.5 py-1 text-xs rounded transition-colors ${filter === f ? 'bg-[var(--accent-blue)] text-white' : 'text-[var(--text-secondary)] hover:bg-white/5'}`}>
                      {f === 'all' ? 'All' : f === 'risk' ? '⚠️ At Risk' : f === 'open' ? '🔓 Open' : f === 'masternode' ? '🏛️ MasterNode' : '🖥️ FullNode'}
                    </button>
                  ))}
                  <span className="text-xs text-[var(--text-tertiary)] ml-2">Sort:</span>
                  {(['score', 'ip', 'provider'] as const).map(s => (
                    <button key={s} onClick={() => setSortBy(s)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${sortBy === s ? 'text-[var(--accent-blue)] font-semibold' : 'hover:bg-white/5 text-[var(--text-tertiary)]'}`}>
                      {s === 'score' ? 'Score' : s === 'ip' ? 'IP' : 'Provider'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-header)]">
                      {['Score', 'IP Address', 'Validator', 'Role', 'Provider', 'Location', 'RPC', 'WS', 'Modules', 'Findings'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-[var(--text-tertiary)] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {filteredNodes.length === 0 && (
                      <tr><td colSpan={10} className="px-4 py-8 text-center text-[var(--text-tertiary)]">No nodes match filter</td></tr>
                    )}
                    {filteredNodes.map(node => (
                      <tr key={node.ip} className={`hover:bg-white/3 transition-colors ${node.securityLabel === 'risk' ? 'bg-[var(--critical)]/3' : ''}`} title={node.validatorName || ''}>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`font-bold text-sm tabular-nums ${scoreColor(node.securityScore)}`}>{node.securityScore}</span>
                          <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded border ${scoreBg(node.securityLabel)}`}>
                            {node.securityLabel === 'secure' ? '✓' : node.securityLabel === 'caution' ? '⚠' : '✗'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[var(--text-primary)]">{node.ip}</td>
                        <td className="px-3 py-2.5">
                          {node.validatorAddress ? (
                            <a href={`https://xdcscan.com/address/${node.validatorAddress}`} target="_blank" className="font-mono text-xs text-[var(--accent-blue)] hover:underline">{node.validatorAddress.slice(0,8)}…{node.validatorAddress.slice(-6)}</a>
                          ) : <span className="text-[var(--text-tertiary)]">—</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded border text-xs font-medium ${
                            node.validatorRole === 'active' ? 'bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/25' :
                            node.validatorRole === 'standby' ? 'bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/25' :
                            node.validatorRole === 'penalized' ? 'bg-[var(--critical)]/15 text-[var(--critical)] border-[var(--critical)]/25' :
                            node.validatorRole === 'fullnode' ? 'bg-blue-500/15 text-blue-400 border-blue-500/25' :
                            'bg-white/5 text-[var(--text-tertiary)] border-[var(--border-subtle)]'
                          }`}>{node.validatorRole === 'active' ? 'MN' : node.validatorRole === 'standby' ? 'Standby' : node.validatorRole === 'penalized' ? 'Pen' : node.validatorRole === 'fullnode' ? 'Full' : '?'}</span>
                        </td>
                        <td className="px-3 py-2.5 max-w-[160px] truncate text-[var(--text-secondary)]" title={node.org || node.isp}>{node.org || node.isp || '—'}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{flagEmoji(node.countryCode)} {node.city || node.country || '—'}</td>
                        <td className="px-3 py-2.5 text-center">{node.rpcOpen ? <span className="text-[var(--critical)] font-bold">OPEN</span> : <span className="text-[var(--success)]">✓</span>}</td>
                        <td className="px-3 py-2.5 text-center">{node.wsOpen ? <span className="text-[var(--warning)] font-bold">OPEN</span> : <span className="text-[var(--success)]">✓</span>}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {node.exposedModules.length === 0 && <span className="text-[var(--text-tertiary)]">—</span>}
                            {node.exposedModules.map(m => (
                              <span key={m} className={`px-1.5 py-0.5 rounded font-mono border ${node.dangerousModules.includes(m) ? 'bg-[var(--critical)]/15 text-[var(--critical)] border-[var(--critical)]/30' : 'bg-white/5 text-[var(--text-tertiary)] border-[var(--border-subtle)]'}`}>{m}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          {node.findings.length === 0 ? <span className="text-[var(--success)]">✓</span> : <span className="text-[var(--critical)]">{node.findings.length}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Source note */}
            <div className="text-xs text-[var(--text-tertiary)] bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-3">
              <span className="font-semibold">Data sources:</span> Ethstats WS (ws://45.82.64.150:3000) for {data.ethstats?.totalNodes || 0} node names + block data.
              P2P peer lists from local XDC clients for {data.totalIPs} IP addresses. Geolocation via ip-api.com.
              Results cached for 10 minutes.
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
