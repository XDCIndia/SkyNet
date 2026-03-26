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
  Activity,
  Users,
  Hash,
  Lock,
  Unlock,
  Cpu,
  Globe,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface ValidatorAudit {
  network: string;
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

// ─── RPC helpers (client-side) ────────────────────────────────────────────────
const VALIDATOR = '0x0000000000000000000000000000000000000088';
const BLOCKSIGNER = '0x0000000000000000000000000000000000000089';
const RANDOMIZE = '0x0000000000000000000000000000000000000090';
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

async function rpcCall(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

async function ethCall(url: string, to: string, data: string): Promise<string> {
  return rpcCall(url, 'eth_call', [{ to, data }, 'latest']) as Promise<string>;
}

function hexToInt(hex: string): number {
  if (!hex || hex === '0x') return 0;
  return parseInt(hex, 16);
}

function decodeAddressArray(hex: string): string[] {
  if (!hex || hex.length < 10) return [];
  const data = hex.slice(2);
  if (data.length < 128) return [];
  const arrLen = parseInt(data.slice(64, 128), 16);
  const addrs: string[] = [];
  for (let i = 0; i < arrLen; i++) {
    const start = 128 + i * 64;
    if (start + 64 > data.length) break;
    addrs.push('0x' + data.slice(start + 24, start + 64));
  }
  return addrs;
}

async function fetchAuditData(rpcUrl: string, networkName: string): Promise<ValidatorAudit> {
  const blockHex = await rpcCall(rpcUrl, 'eth_blockNumber', []) as string;
  const blockNumber = hexToInt(blockHex);

  const [candidateCountHex, ownerCountHex, candidatesHex] = await Promise.all([
    ethCall(rpcUrl, VALIDATOR, '0xa9a981a3'),
    ethCall(rpcUrl, VALIDATOR, '0xa9ff959e'),
    ethCall(rpcUrl, VALIDATOR, '0x06a49fce'),
  ]);

  const candidateCount = hexToInt(candidateCountHex);
  const ownerCount = hexToInt(ownerCountHex);
  const candidates = decodeAddressArray(candidatesHex);
  const ghostEntries = candidates.filter(a => a.toLowerCase() === ZERO_ADDR || parseInt(a, 16) === 0).length;
  const candidatesArrayLength = candidates.length;
  const votesNeeded75pct = Math.floor(ownerCount * 0.75) + 1;
  const governanceBroken = votesNeeded75pct > candidateCount;

  const [minCapHex, maxValHex, candDelayHex, voterDelayHex] = await Promise.all([
    ethCall(rpcUrl, VALIDATOR, '0x33aca42f'),
    ethCall(rpcUrl, VALIDATOR, '0x09dfdc2f'),
    ethCall(rpcUrl, VALIDATOR, '0x4d11d8fe'),
    ethCall(rpcUrl, VALIDATOR, '0x6fd55014'),
  ]);

  const minCapWei = BigInt(minCapHex || '0x0');
  const minCandidateCap = (Number(minCapWei) / 1e18).toLocaleString() + ' XDC';
  const maxValidatorNumber = hexToInt(maxValHex);
  const candidateWithdrawDelayBlocks = hexToInt(candDelayHex);
  const voterWithdrawDelayBlocks = hexToInt(voterDelayHex);

  const [bsCode, rzCode] = await Promise.all([
    rpcCall(rpcUrl, 'eth_getCode', [BLOCKSIGNER, 'latest']) as Promise<string>,
    rpcCall(rpcUrl, 'eth_getCode', [RANDOMIZE, 'latest']) as Promise<string>,
  ]);
  const blockSignerHasCode = !!bsCode && bsCode !== '0x' && bsCode.length > 4;
  const randomizeHasCode = !!rzCode && rzCode !== '0x' && rzCode.length > 4;

  let exposedModules: string[] = [];
  let dangerousModules: string[] = [];
  try {
    const modules = await rpcCall(rpcUrl, 'rpc_modules', []) as Record<string, string>;
    exposedModules = Object.keys(modules);
    dangerousModules = exposedModules.filter(m => ['debug', 'admin', 'personal', 'miner'].includes(m));
  } catch { /* not all nodes expose rpc_modules */ }

  return {
    network: networkName,
    rpc: rpcUrl,
    blockNumber,
    candidateCount,
    ownerCount,
    candidatesArrayLength,
    ghostEntries,
    votesNeeded75pct,
    governanceBroken,
    minCandidateCap,
    maxValidatorNumber,
    candidateWithdrawDelayBlocks,
    voterWithdrawDelayBlocks,
    blockSignerHasCode,
    randomizeHasCode,
    exposedModules,
    dangerousModules,
    timestamp: new Date().toISOString(),
  };
}

function buildFindings(audit: ValidatorAudit): Finding[] {
  const findings: Finding[] = [];

  // TOB-XDC-4: ownerCount inflation
  findings.push({
    id: 'TOB-XDC-4',
    title: 'voteInvalidKYC Governance Permanently Broken',
    severity: audit.governanceBroken ? 'critical' : 'pass',
    description: `resign() never decrements ownerCount. Every address that ever proposed a candidate counts forever. Current ownerCount: ${audit.ownerCount.toLocaleString()}, active candidates: ${audit.candidateCount}.`,
    evidence: `Need ${audit.votesNeeded75pct.toLocaleString()} votes (75% of ownerCount) but only ${audit.candidateCount} candidates can vote. ${audit.governanceBroken ? '⛔ UNREACHABLE' : '✅ Reachable'}`,
    fix: 'Activate PR #450 on XinFinOrg/XDPoSChain — change ValidtorV2SMCBlock to a real near-future block number.',
  });

  // Delete bug — ghost entries
  findings.push({
    id: 'TOB-XDC-4-delete',
    title: 'voteInvalidKYC Delete-After-Delete Bug',
    severity: audit.ghostEntries > 0 ? 'critical' : 'pass',
    description: `delete candidates[i] zeroes the slot before delete validatorsState[candidates[i]] reads it — so validatorsState[address(0)] is deleted instead of the actual validator.`,
    evidence: `${audit.ghostEntries} ghost (null) entries found in candidates[] array. Each = one execution of the broken delete path. Invalidated validators could still resign and withdraw stake.`,
    fix: 'Save address before deletion: address candidateAddr = candidates[i]; then delete validatorsState[candidateAddr];',
  });

  // RPC dangerous namespaces
  if (audit.dangerousModules.length > 0) {
    findings.push({
      id: 'TOB-XDC-1',
      title: `Dangerous RPC Namespaces Exposed: ${audit.dangerousModules.join(', ')}`,
      severity: 'critical',
      description: `This node exposes ${audit.dangerousModules.join(', ')} namespace(s) without authentication.`,
      evidence: `Exposed: ${audit.exposedModules.join(', ')}. Dangerous: ${audit.dangerousModules.join(', ')}`,
      fix: 'Restart node with RPC_ADDR=127.0.0.1 and remove debug/admin/personal from RPC_API.',
    });
  } else {
    findings.push({
      id: 'TOB-XDC-1',
      title: 'RPC Namespace Exposure',
      severity: 'pass',
      description: 'No dangerous namespaces (debug/admin/personal/miner) exposed on this node.',
      evidence: `Exposed modules: ${audit.exposedModules.join(', ') || 'none detected'}`,
      fix: '',
    });
  }

  // BlockSigner access control
  findings.push({
    id: 'TOB-XDC-20',
    title: 'BlockSigner Zero Access Control',
    severity: audit.blockSignerHasCode ? 'high' : 'low',
    description: 'BlockSigner.sign() has no require(isCandidate(msg.sender)) check. Any address can submit fake block signatures via exposed RPC nodes.',
    evidence: audit.blockSignerHasCode ? 'Contract deployed at 0x89 — source confirms no caller validation' : 'No contract code at 0x89 on this network',
    fix: 'Add require(XDCValidator(0x88).isCandidate(msg.sender)) to BlockSigner.sign()',
  });

  // XDCRandomize access control
  findings.push({
    id: 'TOB-XDC-21',
    title: 'XDCRandomize Poisonable Inputs',
    severity: audit.randomizeHasCode ? 'high' : 'low',
    description: 'setSecret() only checks block.number timing window — no isCandidate() validation. Anyone can submit secrets during blocks 800–849 of each epoch.',
    evidence: audit.randomizeHasCode ? 'Contract deployed at 0x90 — source confirms no caller validation' : 'No contract code at 0x90',
    fix: 'Add require(XDCValidator(0x88).isCandidate(msg.sender)) to setSecret() and setOpening()',
  });

  // PRNG
  findings.push({
    id: 'TOB-XDC-19',
    title: 'Weak PRNG — Predictable Epoch Randomness',
    severity: 'high',
    description: 'GenM2FromRandomize() seeds math/rand with sum of all masternodes\' public opening values. Anyone can query these values on-chain and predict the next epoch\'s validator ordering.',
    evidence: 'Confirmed in contracts/utils.go: rand.Seed(total) where total = sum of public XDCRandomize openings',
    fix: 'Replace math/rand with crypto/rand in contracts/utils.go',
  });

  return findings;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function SeverityBadge({ severity }: { severity: Finding['severity'] }) {
  const cfg = {
    critical: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', label: 'CRITICAL' },
    high:     { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', label: 'HIGH' },
    medium:   { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', label: 'MEDIUM' },
    low:      { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', label: 'LOW' },
    pass:     { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30', label: 'PASS' },
  }[severity];
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      {cfg.label}
    </span>
  );
}

function StatCard({
  label, value, sub, icon: Icon, color = 'blue',
}: { label: string; value: string | number; sub?: string; icon: React.ElementType; color?: string }) {
  const colors: Record<string, string> = {
    blue:   'text-blue-400 bg-blue-500/10 border-blue-500/20',
    red:    'text-red-400 bg-red-500/10 border-red-500/20',
    green:  'text-green-400 bg-green-500/10 border-green-500/20',
    orange: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  };
  const cls = colors[color] || colors.blue;
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium opacity-80">{label}</span>
      </div>
      <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
      {sub && <div className="text-xs mt-1 opacity-60">{sub}</div>}
    </div>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false);
  const icons = {
    critical: <XCircle className="w-5 h-5 text-red-400" />,
    high:     <AlertTriangle className="w-5 h-5 text-orange-400" />,
    medium:   <Info className="w-5 h-5 text-yellow-400" />,
    low:      <Info className="w-5 h-5 text-blue-400" />,
    pass:     <CheckCircle className="w-5 h-5 text-green-400" />,
  };
  return (
    <div className={`rounded-xl border transition-all ${
      finding.severity === 'critical' ? 'border-red-500/30 bg-red-500/5' :
      finding.severity === 'high'     ? 'border-orange-500/30 bg-orange-500/5' :
      finding.severity === 'pass'     ? 'border-green-500/20 bg-green-500/5' :
                                        'border-[var(--border-subtle)] bg-[var(--bg-card)]'
    }`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        {icons[finding.severity]}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{finding.title}</span>
            <SeverityBadge severity={finding.severity} />
          </div>
          <div className="text-xs text-[var(--text-muted)] mt-0.5 font-mono">{finding.id}</div>
        </div>
        {expanded ? <ChevronDown className="w-4 h-4 opacity-50 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 opacity-50 flex-shrink-0" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-[var(--border-subtle)] pt-3">
          <div>
            <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">DESCRIPTION</div>
            <p className="text-sm">{finding.description}</p>
          </div>
          <div>
            <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">EVIDENCE</div>
            <p className="text-sm font-mono bg-black/20 rounded p-2 text-xs">{finding.evidence}</p>
          </div>
          {finding.fix && (
            <div>
              <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">FIX</div>
              <p className="text-sm text-green-400">{finding.fix}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NetworkAuditPanel({ networkKey, label, rpcUrl }: { networkKey: string; label: string; rpcUrl: string }) {
  const [audit, setAudit] = useState<ValidatorAudit | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAuditData(rpcUrl, label);
      setAudit(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [rpcUrl, label]);

  useEffect(() => { runAudit(); }, [runAudit]);

  const findings = audit ? buildFindings(audit) : [];
  const critical = findings.filter(f => f.severity === 'critical').length;
  const high     = findings.filter(f => f.severity === 'high').length;
  const passed   = findings.filter(f => f.severity === 'pass').length;

  const healthColor = critical > 0 ? 'text-red-400' : high > 0 ? 'text-orange-400' : 'text-green-400';
  const healthIcon  = critical > 0 ? <ShieldAlert className={`w-6 h-6 ${healthColor}`} /> : <ShieldCheck className={`w-6 h-6 ${healthColor}`} />;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-3">
          {healthIcon}
          <div>
            <div className="font-bold">{label}</div>
            <div className="text-xs text-[var(--text-muted)]">{rpcUrl}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {audit && (
            <div className="text-xs text-[var(--text-muted)]">
              Block #{audit.blockNumber.toLocaleString()}
            </div>
          )}
          <button
            onClick={runAudit}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Running...' : 'Re-run'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm">
          ❌ {error}
        </div>
      )}

      {loading && !audit && (
        <div className="p-8 flex flex-col items-center gap-3 text-[var(--text-muted)]">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <div className="text-sm">Running security audit...</div>
        </div>
      )}

      {audit && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 border-b border-[var(--border-subtle)]">
            <StatCard label="Critical"       value={critical}                      icon={ShieldAlert} color={critical > 0 ? 'red' : 'green'} />
            <StatCard label="High"           value={high}                          icon={AlertTriangle} color={high > 0 ? 'orange' : 'green'} />
            <StatCard label="Passed"         value={passed}                        icon={ShieldCheck} color="green" />
            <StatCard label="ownerCount"     value={audit.ownerCount.toLocaleString()} icon={Users}     color={audit.governanceBroken ? 'red' : 'green'} sub={audit.governanceBroken ? 'Governance broken' : 'Healthy'} />
            <StatCard label="Candidates"     value={audit.candidateCount}          icon={Activity}    color="blue" />
            <StatCard label="Ghost Entries"  value={audit.ghostEntries}            icon={Hash}        color={audit.ghostEntries > 0 ? 'orange' : 'green'} sub="in candidates[]" />
          </div>

          {/* Governance status banner */}
          {audit.governanceBroken && (
            <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-red-400 text-sm">Governance Permanently Broken</div>
                <div className="text-xs text-[var(--text-muted)] mt-1">
                  voteInvalidKYC requires {audit.votesNeeded75pct.toLocaleString()} votes (75% of ownerCount={audit.ownerCount.toLocaleString()})
                  but only {audit.candidateCount} candidates can vote. No validator can ever be slashed via on-chain governance.
                </div>
                <div className="text-xs text-green-400 mt-1">
                  Fix: Activate PR #450 — change ValidtorV2SMCBlock from 9999999999 to a real block number.
                </div>
              </div>
            </div>
          )}

          {/* Config summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 border-b border-[var(--border-subtle)]">
            <div className="text-center">
              <div className="text-xs text-[var(--text-muted)]">Min Candidate Cap</div>
              <div className="font-semibold text-sm mt-0.5">{audit.minCandidateCap}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-[var(--text-muted)]">Max Validators</div>
              <div className="font-semibold text-sm mt-0.5">{audit.maxValidatorNumber}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-[var(--text-muted)]">Candidate Withdraw</div>
              <div className="font-semibold text-sm mt-0.5">
                {(audit.candidateWithdrawDelayBlocks * 2 / 86400).toFixed(0)}d ({audit.candidateWithdrawDelayBlocks.toLocaleString()} blocks)
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-[var(--text-muted)]">Voter Withdraw</div>
              <div className="font-semibold text-sm mt-0.5">
                {(audit.voterWithdrawDelayBlocks * 2 / 86400).toFixed(0)}d ({audit.voterWithdrawDelayBlocks.toLocaleString()} blocks)
              </div>
            </div>
          </div>

          {/* RPC modules */}
          {audit.exposedModules.length > 0 && (
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center gap-3 flex-wrap">
              <span className="text-xs text-[var(--text-muted)]">RPC Modules:</span>
              {audit.exposedModules.map(m => (
                <span key={m} className={`text-xs px-2 py-0.5 rounded font-mono border ${
                  ['debug','admin','personal','miner'].includes(m)
                    ? 'bg-red-500/20 text-red-400 border-red-500/30'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)]'
                }`}>{m}</span>
              ))}
            </div>
          )}

          {/* Findings */}
          <div className="p-4 space-y-2">
            <div className="text-sm font-semibold mb-3">Detailed Findings</div>
            {findings.map(f => <FindingCard key={f.id} finding={f} />)}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SecurityAuditPage() {
  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
        {/* Page header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Shield className="w-6 h-6 text-red-400" />
              <h1 className="text-2xl font-bold">Security Audit</h1>
            </div>
            <p className="text-sm text-[var(--text-muted)]">
              Live validation of Prime Numbers Labs findings (March 2026) against XDCValidator contract (0x88) on both networks.
            </p>
          </div>
          <a
            href="https://github.com/AnilChinchawale/AllForOne/blob/main/XINFIN-SECURITY-AUDIT.md"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Full Audit Report
          </a>
        </div>

        {/* Key insight banner */}
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold text-orange-400">Key Finding: </span>
            <span>
              <code className="font-mono text-xs bg-black/20 px-1 rounded">resign()</code> never decrements{' '}
              <code className="font-mono text-xs bg-black/20 px-1 rounded">ownerCount</code>. On mainnet this has
              inflated to 432,000 — making <code className="font-mono text-xs bg-black/20 px-1 rounded">voteInvalidKYC</code> permanently unreachable.
              The fix exists in{' '}
              <a href="https://github.com/XinFinOrg/XDPoSChain/pull/450" target="_blank" className="text-blue-400 hover:underline">
                PR #450
              </a>{' '}
              — only <code className="font-mono text-xs bg-black/20 px-1 rounded">ValidtorV2SMCBlock</code> needs updating.
            </span>
          </div>
        </div>

        {/* Both networks side by side (stacked on mobile) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <NetworkAuditPanel
            networkKey="mainnet"
            label="XDC Mainnet"
            rpcUrl="https://rpc.xdcrpc.com"
          />
          <NetworkAuditPanel
            networkKey="apothem"
            label="Apothem Testnet"
            rpcUrl="https://apothem.xdcrpc.com"
          />
        </div>

        {/* Quick reference */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch className="w-4 h-4 text-blue-400" />
            <span className="font-semibold text-sm">Quick Remediation Reference</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {[
              {
                id: '1',
                color: 'red',
                title: 'Activate V2 Contract (PR #450)',
                code: 'ValidtorV2SMCBlock = big.NewInt(102030000)',
                file: 'common/constants.go',
                link: 'https://github.com/XinFinOrg/XDPoSChain/pull/450',
              },
              {
                id: '2',
                color: 'red',
                title: 'Fix RPC Defaults',
                code: 'HTTPListenAddrFlag.Value = "localhost"',
                file: 'cmd/utils/flags.go',
              },
              {
                id: '3',
                color: 'orange',
                title: 'Fix BFT Broadcast Order',
                code: 'Process before broadcastCh <- vote',
                file: 'eth/bft/bft_handler.go',
              },
              {
                id: '4',
                color: 'orange',
                title: 'Replace math/rand with crypto/rand',
                code: 'cryptoRand.Int(cryptoRand.Reader, max)',
                file: 'contracts/utils.go',
              },
            ].map(item => (
              <div key={item.id} className={`rounded-xl p-3 border ${
                item.color === 'red'    ? 'border-red-500/30 bg-red-500/5' :
                item.color === 'orange' ? 'border-orange-500/30 bg-orange-500/5' :
                                          'border-[var(--border-subtle)] bg-[var(--bg-elevated)]'
              }`}>
                <div className="font-semibold text-xs mb-1">{item.id}. {item.title}</div>
                <code className="text-xs font-mono text-green-400 block mb-1">{item.code}</code>
                <div className="text-xs text-[var(--text-muted)] flex items-center justify-between">
                  <span>{item.file}</span>
                  {item.link && (
                    <a href={item.link} target="_blank" className="flex items-center gap-1 text-blue-400 hover:underline">
                      <ExternalLink className="w-3 h-3" /> PR #450
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
