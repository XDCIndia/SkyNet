'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  XCircle,
  Info,
  GitBranch,
  Users,
  Hash,
  ChevronDown,
  ChevronRight,
  Activity,
  Clock,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AuditData {
  network: string;
  networkKey: string;
  rpc: string;
  blockNumber: number;
  candidateCount: number;
  ownerCount: number;
  candidatesArrayLength: number;
  ghostEntries: number;
  votesNeeded75pct: number;
  governanceBroken: boolean;
  minCandidateCap: string;
  maxValidatorNumber: number;
  candidateWithdrawDelayBlocks: number;
  voterWithdrawDelayBlocks: number;
  blockSignerHasCode: boolean;
  randomizeHasCode: boolean;
  exposedModules: string[];
  dangerousModules: string[];
  timestamp: string;
  error?: string;
}

interface Finding {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'pass';
  description: string;
  evidence: string;
  fix: string;
}

// ─── Build findings from audit data ──────────────────────────────────────────
function buildFindings(d: AuditData): Finding[] {
  return [
    {
      id: 'TOB-XDC-4',
      title: 'voteInvalidKYC Governance Unreachable',
      severity: d.governanceBroken ? 'critical' : 'pass',
      description: `resign() never decrements ownerCount. Every address that ever proposed counts forever. ownerCount=${d.ownerCount.toLocaleString()}, active candidates=${d.candidateCount}.`,
      evidence: `75% of ownerCount = ${d.votesNeeded75pct.toLocaleString()} votes needed. Only ${d.candidateCount} candidates can vote. ${d.governanceBroken ? '⛔ PERMANENTLY UNREACHABLE' : '✅ Reachable'}`,
      fix: 'Activate PR #450: change ValidtorV2SMCBlock from 9999999999 to a real near-future block number.',
    },
    {
      id: 'TOB-XDC-4-delete',
      title: 'voteInvalidKYC Delete-After-Delete Bug',
      severity: d.ghostEntries > 0 ? 'critical' : 'pass',
      description: 'delete candidates[i] zeroes the slot BEFORE delete validatorsState[candidates[i]] reads it — so validatorsState[address(0)] is deleted, not the actual target.',
      evidence: `${d.ghostEntries} ghost (null) entries in candidates[]. Each = one failed invalidation. Affected validators could still resign() and withdraw full stake.`,
      fix: 'Save address first: address addr = candidates[i]; then delete validatorsState[addr];  — fixed in PR #450.',
    },
    {
      id: 'TOB-XDC-1',
      title: d.dangerousModules.length > 0
        ? `Dangerous RPC Namespaces Exposed: ${d.dangerousModules.join(', ')}`
        : 'RPC Namespace Exposure',
      severity: d.dangerousModules.length > 0 ? 'critical' : 'pass',
      description: d.dangerousModules.length > 0
        ? `This node exposes ${d.dangerousModules.join(', ')} without authentication. debug_setHead("0x0") wipes chain state. debug_writeMemProfile writes to arbitrary filesystem paths.`
        : 'No dangerous namespaces exposed on this node.',
      evidence: `Modules: ${d.exposedModules.join(', ') || 'none detected'}`,
      fix: 'Restart with RPC_ADDR=127.0.0.1 and remove debug/admin/personal from RPC_API.',
    },
    {
      id: 'TOB-XDC-20',
      title: 'BlockSigner Zero Access Control',
      severity: d.blockSignerHasCode ? 'high' : 'low',
      description: 'BlockSigner.sign() has no isCandidate() check. Any address can submit fake block signatures via exposed RPC nodes, corrupting reward calculations.',
      evidence: d.blockSignerHasCode ? 'Contract deployed at 0x89. Source confirms no require(isCandidate(msg.sender)).' : 'No contract at 0x89 on this network.',
      fix: 'Add require(XDCValidator(0x88).isCandidate(msg.sender)) to BlockSigner.sign()',
    },
    {
      id: 'TOB-XDC-21',
      title: 'XDCRandomize Poisonable Inputs',
      severity: d.randomizeHasCode ? 'high' : 'low',
      description: 'setSecret() only enforces a block.number timing window — no isCandidate() check. Anyone can submit secrets during blocks 800–849 of each epoch to bias validator selection.',
      evidence: d.randomizeHasCode ? 'Contract deployed at 0x90. Source shows no caller validation in setSecret() or setOpening().' : 'No contract at 0x90.',
      fix: 'Add require(XDCValidator(0x88).isCandidate(msg.sender)) to setSecret() and setOpening()',
    },
    {
      id: 'TOB-XDC-19',
      title: 'Weak PRNG — Predictable Epoch Ordering',
      severity: 'high',
      description: 'GenM2FromRandomize() seeds math/rand with the sum of all masternodes\' public opening values. These are stored on-chain and readable by anyone.',
      evidence: 'Confirmed in contracts/utils.go: rand.Seed(total) where total = sum of XDCRandomize openings. An attacker can compute total and predict the exact M2 shuffle.',
      fix: 'Replace math/rand with crypto/rand throughout contracts/utils.go',
    },
  ];
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SeverityBadge({ s }: { s: Finding['severity'] }) {
  const map = {
    critical: 'bg-[var(--critical)]/20 text-[var(--critical)] border-[var(--critical)]/30',
    high:     'bg-[var(--warning)]/20 text-[var(--warning)] border-[var(--warning)]/30',
    medium:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low:      'bg-blue-500/20 text-blue-400 border-blue-500/30',
    pass:     'bg-[var(--success)]/20 text-[var(--success)] border-[var(--success)]/30',
  }[s];
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${map}`}>
      {s.toUpperCase()}
    </span>
  );
}

function Metric({ label, value, sub, color = '' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl p-3 text-center">
      <div className="text-xs text-[var(--text-tertiary)] mb-1">{label}</div>
      <div className={`font-bold text-lg tabular-nums ${color}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {sub && <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{sub}</div>}
    </div>
  );
}

function FindingRow({ f }: { f: Finding }) {
  const [open, setOpen] = useState(false);
  const icon = {
    critical: <XCircle className="w-4 h-4 text-[var(--critical)] flex-shrink-0" />,
    high:     <AlertTriangle className="w-4 h-4 text-[var(--warning)] flex-shrink-0" />,
    medium:   <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />,
    low:      <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />,
    pass:     <CheckCircle className="w-4 h-4 text-[var(--success)] flex-shrink-0" />,
  }[f.severity];

  const borderColor = {
    critical: 'border-[var(--critical)]/25',
    high:     'border-[var(--warning)]/25',
    medium:   'border-yellow-500/20',
    low:      'border-blue-500/20',
    pass:     'border-[var(--success)]/20',
  }[f.severity];

  const bgColor = {
    critical: 'bg-[var(--critical)]/5',
    high:     'bg-[var(--warning)]/5',
    medium:   'bg-yellow-500/5',
    low:      'bg-blue-500/5',
    pass:     'bg-[var(--success)]/5',
  }[f.severity];

  return (
    <div className={`rounded-xl border ${borderColor} ${bgColor} overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-white/3 transition-colors"
      >
        {icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-[var(--text-primary)]">{f.title}</span>
            <SeverityBadge s={f.severity} />
          </div>
          <div className="text-xs text-[var(--text-tertiary)] font-mono mt-0.5">{f.id}</div>
        </div>
        {open
          ? <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
        }
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 border-t border-white/5 space-y-3">
          <div>
            <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">Description</div>
            <p className="text-sm text-[var(--text-secondary)]">{f.description}</p>
          </div>
          <div>
            <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">Evidence</div>
            <p className="text-xs font-mono bg-black/30 rounded-lg p-2.5 text-[var(--text-secondary)]">{f.evidence}</p>
          </div>
          {f.fix && (
            <div>
              <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">Fix</div>
              <p className="text-sm text-[var(--success)]">{f.fix}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NetworkPanel({ networkKey, label }: { networkKey: string; label: string }) {
  const [data, setData] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/security/audit?network=${networkKey}`);
      const json = await res.json();
      setData(json);
      setLastRun(new Date().toLocaleTimeString());
    } catch (e) {
      setData({ error: (e as Error).message } as AuditData);
    } finally {
      setLoading(false);
    }
  }, [networkKey]);

  useEffect(() => { run(); }, [run]);

  const findings = data && !data.error ? buildFindings(data) : [];
  const nCritical = findings.filter(f => f.severity === 'critical').length;
  const nHigh     = findings.filter(f => f.severity === 'high').length;
  const nPass     = findings.filter(f => f.severity === 'pass').length;

  const healthBadge = nCritical > 0
    ? <span className="flex items-center gap-1 text-xs font-bold text-[var(--critical)]"><ShieldAlert className="w-4 h-4" /> AT RISK</span>
    : nHigh > 0
    ? <span className="flex items-center gap-1 text-xs font-bold text-[var(--warning)]"><AlertTriangle className="w-4 h-4" /> CAUTION</span>
    : <span className="flex items-center gap-1 text-xs font-bold text-[var(--success)]"><ShieldCheck className="w-4 h-4" /> HEALTHY</span>;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl overflow-hidden flex flex-col">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-header)]">
        <div className="flex items-center gap-3">
          <div>
            <div className="font-semibold text-sm">{label}</div>
            {data && !data.error && (
              <div className="text-xs text-[var(--text-tertiary)] font-mono">Block #{data.blockNumber.toLocaleString()}</div>
            )}
          </div>
          {data && !data.error && healthBadge}
        </div>
        <div className="flex items-center gap-2">
          {lastRun && (
            <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
              <Clock className="w-3 h-3" />{lastRun}
            </span>
          )}
          <button
            onClick={run}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20 rounded-lg hover:bg-[var(--accent-blue)]/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Running…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error state */}
      {data?.error && (
        <div className="p-4 bg-[var(--critical)]/10 text-[var(--critical)] text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4 flex-shrink-0" /> {data.error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16 text-[var(--text-tertiary)]">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="text-sm">Querying on-chain data…</span>
        </div>
      )}

      {data && !data.error && (
        <>
          {/* Score row */}
          <div className="grid grid-cols-3 divide-x divide-[var(--border-subtle)] border-b border-[var(--border-subtle)]">
            {[
              { label: 'Critical', val: nCritical, color: nCritical > 0 ? 'text-[var(--critical)]' : 'text-[var(--text-tertiary)]' },
              { label: 'High',     val: nHigh,     color: nHigh > 0 ? 'text-[var(--warning)]' : 'text-[var(--text-tertiary)]' },
              { label: 'Passed',   val: nPass,     color: nPass > 0 ? 'text-[var(--success)]' : 'text-[var(--text-tertiary)]' },
            ].map(({ label, val, color }) => (
              <div key={label} className="flex flex-col items-center py-3">
                <span className={`text-2xl font-bold tabular-nums ${color}`}>{val}</span>
                <span className="text-xs text-[var(--text-tertiary)]">{label}</span>
              </div>
            ))}
          </div>

          {/* Governance broken banner */}
          {data.governanceBroken && (
            <div className="mx-4 mt-4 p-3 rounded-xl bg-[var(--critical)]/8 border border-[var(--critical)]/25 flex gap-3">
              <XCircle className="w-5 h-5 text-[var(--critical)] flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <div className="font-semibold text-[var(--critical)]">Governance Permanently Broken</div>
                <div className="text-[var(--text-secondary)] mt-0.5">
                  voteInvalidKYC requires <span className="font-mono font-bold">{data.votesNeeded75pct.toLocaleString()}</span> votes
                  (75% × ownerCount <span className="font-mono">{data.ownerCount.toLocaleString()}</span>),
                  but only <span className="font-mono font-bold">{data.candidateCount}</span> candidates can vote.
                  No validator can ever be slashed.
                </div>
                <a
                  href="https://github.com/XinFinOrg/XDPoSChain/pull/450"
                  target="_blank"
                  className="text-[var(--accent-blue)] text-xs mt-1 inline-flex items-center gap-1 hover:underline"
                >
                  Fix: Activate PR #450 <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-4">
            <Metric
              label="ownerCount"
              value={data.ownerCount.toLocaleString()}
              sub={data.governanceBroken ? 'Inflated — bug' : 'Healthy'}
              color={data.governanceBroken ? 'text-[var(--critical)]' : 'text-[var(--success)]'}
            />
            <Metric label="Active Candidates" value={data.candidateCount} color="text-[var(--accent-blue)]" />
            <Metric
              label="Ghost Entries"
              value={data.ghostEntries}
              sub="in candidates[]"
              color={data.ghostEntries > 0 ? 'text-[var(--warning)]' : 'text-[var(--success)]'}
            />
            <Metric label="Min Cap" value={`${Number(data.minCandidateCap).toLocaleString()} XDC`} />
            <Metric
              label="Candidate Withdraw"
              value={`${(data.candidateWithdrawDelayBlocks * 2 / 86400).toFixed(0)}d`}
              sub={`${data.candidateWithdrawDelayBlocks.toLocaleString()} blocks`}
            />
            <Metric
              label="Voter Withdraw"
              value={`${(data.voterWithdrawDelayBlocks * 2 / 86400).toFixed(0)}d`}
              sub={`${data.voterWithdrawDelayBlocks.toLocaleString()} blocks`}
            />
          </div>

          {/* RPC modules */}
          {data.exposedModules.length > 0 && (
            <div className="px-4 pb-2 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[var(--text-tertiary)]">Modules:</span>
              {data.exposedModules.map(m => (
                <span
                  key={m}
                  className={`text-xs px-2 py-0.5 rounded font-mono border ${
                    data.dangerousModules.includes(m)
                      ? 'bg-[var(--critical)]/15 text-[var(--critical)] border-[var(--critical)]/30'
                      : 'bg-white/5 text-[var(--text-secondary)] border-[var(--border-subtle)]'
                  }`}
                >
                  {m}
                </span>
              ))}
            </div>
          )}

          {/* Contracts row */}
          <div className="px-4 pb-3 flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
            <span className={`flex items-center gap-1 ${data.blockSignerHasCode ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>
              {data.blockSignerHasCode ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
              BlockSigner 0x89
            </span>
            <span className={`flex items-center gap-1 ${data.randomizeHasCode ? 'text-[var(--warning)]' : 'text-[var(--success)]'}`}>
              {data.randomizeHasCode ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
              XDCRandomize 0x90
            </span>
          </div>

          {/* Findings */}
          <div className="px-4 pb-4 space-y-2 border-t border-[var(--border-subtle)] pt-4">
            <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Findings</div>
            {findings.map(f => <FindingRow key={f.id} f={f} />)}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SecurityPage() {
  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-5 max-w-[1600px] mx-auto">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Shield className="w-5 h-5 text-[var(--critical)]" />
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Security Audit</h1>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              Live on-chain validation of Prime Numbers Labs audit findings (March 2026) — XDCValidator contract 0x88
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/AnilChinchawale/AllForOne/blob/main/XINFIN-SECURITY-AUDIT.md"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg hover:bg-white/5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Audit Report
            </a>
            <a
              href="https://github.com/XinFinOrg/XDPoSChain/pull/450"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/25 rounded-lg hover:bg-[var(--success)]/20 transition-colors"
            >
              <GitBranch className="w-3.5 h-3.5" /> Fix: PR #450
            </a>
          </div>
        </div>

        {/* Key insight */}
        <div className="bg-[var(--warning)]/8 border border-[var(--warning)]/25 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-[var(--warning)] flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-[var(--warning)]">Root Cause: </span>
            <span className="text-[var(--text-secondary)]">
              <code className="font-mono text-xs bg-black/30 px-1 rounded">resign()</code> never decrements{' '}
              <code className="font-mono text-xs bg-black/30 px-1 rounded">ownerCount</code>. On mainnet this has
              accumulated to 432,000+ since genesis, making{' '}
              <code className="font-mono text-xs bg-black/30 px-1 rounded">voteInvalidKYC</code> permanently impossible.
              The fix is already written in{' '}
              <a href="https://github.com/XinFinOrg/XDPoSChain/pull/450" target="_blank"
                className="text-[var(--accent-blue)] hover:underline">PR #450</a>{' '}
              — only <code className="font-mono text-xs bg-black/30 px-1 rounded">ValidtorV2SMCBlock</code> needs to be set to a real block.
            </span>
          </div>
        </div>

        {/* Side-by-side network panels */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <NetworkPanel networkKey="mainnet" label="XDC Mainnet" />
          <NetworkPanel networkKey="apothem" label="Apothem Testnet" />
        </div>

        {/* Remediation quick ref */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch className="w-4 h-4 text-[var(--accent-blue)]" />
            <span className="font-semibold text-sm">Remediation Reference</span>
            <span className="text-xs text-[var(--text-tertiary)] ml-auto">Sorted by impact / effort ratio</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              {
                rank: '1',
                effort: '1 line',
                title: 'Activate V2 Contract',
                code: 'ValidtorV2SMCBlock = big.NewInt(102030000)',
                file: 'common/constants.go',
                link: 'https://github.com/XinFinOrg/XDPoSChain/pull/450',
                color: 'border-[var(--critical)]/30 bg-[var(--critical)]/5',
              },
              {
                rank: '2',
                effort: '1 line',
                title: 'Fix RPC Bind Address',
                code: 'HTTPListenAddrFlag.Value = "localhost"',
                file: 'cmd/utils/flags.go',
                color: 'border-[var(--critical)]/30 bg-[var(--critical)]/5',
              },
              {
                rank: '3',
                effort: '5 min',
                title: 'Fix BFT Broadcast Order',
                code: 'Move broadcastCh after voteHandler()',
                file: 'eth/bft/bft_handler.go',
                color: 'border-[var(--warning)]/30 bg-[var(--warning)]/5',
              },
              {
                rank: '4',
                effort: '2 hours',
                title: 'Replace math/rand',
                code: 'cryptoRand.Int(cryptoRand.Reader, max)',
                file: 'contracts/utils.go',
                color: 'border-[var(--warning)]/30 bg-[var(--warning)]/5',
              },
            ].map(item => (
              <div key={item.rank} className={`rounded-xl p-3 border ${item.color}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-[var(--text-tertiary)]">#{item.rank}</span>
                  <span className="text-xs text-[var(--text-tertiary)] bg-black/20 px-1.5 py-0.5 rounded">{item.effort}</span>
                </div>
                <div className="font-semibold text-xs mb-1.5">{item.title}</div>
                <code className="text-xs font-mono text-[var(--success)] block mb-1.5 break-all">{item.code}</code>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-tertiary)] font-mono truncate">{item.file}</span>
                  {item.link && (
                    <a href={item.link} target="_blank"
                      className="flex items-center gap-0.5 text-xs text-[var(--accent-blue)] hover:underline ml-2 flex-shrink-0">
                      PR #450 <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}
