'use client';

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Shield, ShieldAlert, ShieldCheck, AlertTriangle, RefreshCw,
  ExternalLink, CheckCircle, XCircle, Info, GitBranch,
  ChevronDown, ChevronRight, Clock, Copy, Check,
  ArrowRight, Database, Code2, AlertCircle, Users, Hash,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface KycFlowStep {
  step: number;
  fn: string;
  status: 'ok' | 'broken';
  description: string;
  selector: string;
}

interface KycGovernance {
  ownerCount: number;
  candidateCount: number;
  threshold75pct: number;
  maxPossibleVotes: number;
  deficitVotes: number;
  governanceBroken: boolean;
  ghostEntries: number;
  activeCandidatesSample: string[];
  flowSteps: KycFlowStep[];
  validationQuery: {
    rpc: string;
    contract: string;
    getOwnerCount: { selector: string; result: number };
    candidateCount: { selector: string; result: number };
    candidatesArrayLength: number;
    ghostEntries: number;
  };
}

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
  kycGovernance: KycGovernance;
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

function buildFindings(d: AuditData): Finding[] {
  return [
    {
      id: 'TOB-XDC-4',
      title: 'voteInvalidKYC Governance Unreachable',
      severity: d.governanceBroken ? 'critical' : 'pass',
      description: `resign() never decrements ownerCount. ownerCount=${d.ownerCount.toLocaleString()}, active candidates=${d.candidateCount}. Governance threshold is permanently unreachable.`,
      evidence: `Need ${d.votesNeeded75pct.toLocaleString()} votes (75% × ${d.ownerCount.toLocaleString()}). Only ${d.candidateCount} candidates can vote. ${d.governanceBroken ? '⛔ PERMANENTLY UNREACHABLE' : '✅ Reachable'}`,
      fix: 'Activate PR #450: change ValidtorV2SMCBlock from big.NewInt(9999999999) to a real near-future block.',
    },
    {
      id: 'TOB-XDC-4-delete',
      title: 'voteInvalidKYC Delete-After-Delete Bug',
      severity: d.ghostEntries > 0 ? 'critical' : 'pass',
      description: 'delete candidates[i] zeroes the slot BEFORE delete validatorsState[candidates[i]] reads it — deleting validatorsState[address(0)] instead of the target.',
      evidence: `${d.ghostEntries} ghost entries in candidates[]. Each = one failed invalidation. Affected validators can still resign() and withdraw their full stake.`,
      fix: 'Save address first: address addr = candidates[i]; delete candidates[i]; delete validatorsState[addr]; — already fixed in PR #450.',
    },
    {
      id: 'TOB-XDC-1',
      title: d.dangerousModules.length > 0 ? `Dangerous Namespaces Exposed: ${d.dangerousModules.join(', ')}` : 'RPC Namespace Check',
      severity: d.dangerousModules.length > 0 ? 'critical' : 'pass',
      description: d.dangerousModules.length > 0
        ? `debug_setHead("0x0") wipes chain state. debug_writeMemProfile writes to arbitrary filesystem paths.`
        : 'No dangerous namespaces exposed on this node.',
      evidence: `Modules: ${d.exposedModules.join(', ') || 'none detected'}`,
      fix: 'Set RPC_ADDR=127.0.0.1 and remove debug/admin from RPC_API.',
    },
    {
      id: 'TOB-XDC-20',
      title: 'BlockSigner Zero Access Control',
      severity: d.blockSignerHasCode ? 'high' : 'low',
      description: 'BlockSigner.sign() has no isCandidate() check. Any address can submit fake block signatures via exposed RPC.',
      evidence: d.blockSignerHasCode ? 'Contract at 0x89 — no require(isCandidate(msg.sender))' : 'No contract at 0x89 on this network',
      fix: 'Add require(XDCValidator(0x88).isCandidate(msg.sender)) to BlockSigner.sign()',
    },
    {
      id: 'TOB-XDC-21',
      title: 'XDCRandomize Poisonable Inputs',
      severity: d.randomizeHasCode ? 'high' : 'low',
      description: 'setSecret() only enforces block.number window — anyone can poison validator randomness during blocks 800–849.',
      evidence: d.randomizeHasCode ? 'Contract at 0x90 — no caller validation' : 'No contract at 0x90',
      fix: 'Add require(XDCValidator(0x88).isCandidate(msg.sender)) to setSecret() and setOpening()',
    },
    {
      id: 'TOB-XDC-19',
      title: 'Weak PRNG — Predictable Epoch Ordering',
      severity: 'high',
      description: 'GenM2FromRandomize() seeds math/rand with sum of all masternodes\' public opening values stored on-chain.',
      evidence: 'Confirmed in contracts/utils.go: rand.Seed(total). Anyone can compute total from XDCRandomize openings and predict M2 shuffle.',
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
  return <span className={`text-xs font-bold px-2 py-0.5 rounded border ${map}`}>{s.toUpperCase()}</span>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <button onClick={copy} className="p-1 hover:bg-white/10 rounded transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />}
    </button>
  );
}

function FindingRow({ f }: { f: Finding }) {
  const [open, setOpen] = useState(false);
  const icon = { critical: <XCircle className="w-4 h-4 text-[var(--critical)] flex-shrink-0" />, high: <AlertTriangle className="w-4 h-4 text-[var(--warning)] flex-shrink-0" />, medium: <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />, low: <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />, pass: <CheckCircle className="w-4 h-4 text-[var(--success)] flex-shrink-0" /> }[f.severity];
  const border = { critical: 'border-[var(--critical)]/25 bg-[var(--critical)]/5', high: 'border-[var(--warning)]/25 bg-[var(--warning)]/5', medium: 'border-yellow-500/20 bg-yellow-500/5', low: 'border-blue-500/20 bg-blue-500/5', pass: 'border-[var(--success)]/20 bg-[var(--success)]/5' }[f.severity];
  return (
    <div className={`rounded-xl border ${border} overflow-hidden`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 p-3.5 text-left hover:bg-white/3 transition-colors">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{f.title}</span>
            <SeverityBadge s={f.severity} />
          </div>
          <div className="text-xs text-[var(--text-tertiary)] font-mono mt-0.5">{f.id}</div>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-white/5 space-y-3">
          {[['Description', f.description, false], ['Evidence', f.evidence, true], f.fix ? ['Fix', f.fix, false] : null].filter(Boolean).map(([label, val, mono]) => (
            <div key={label as string}>
              <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">{label as string}</div>
              <p className={`text-sm ${mono ? 'font-mono bg-black/30 rounded-lg p-2.5 text-xs text-[var(--text-secondary)]' : label === 'Fix' ? 'text-[var(--success)]' : 'text-[var(--text-secondary)]'}`}>{val as string}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── KYC Governance Flow Section ─────────────────────────────────────────────
function KycGovernanceSection({ data }: { data: AuditData }) {
  const { kycGovernance: kyc } = data;
  const [showValidation, setShowValidation] = useState(false);

  const pctAchievable = Math.min(100, Math.round((kyc.maxPossibleVotes / kyc.threshold75pct) * 100));

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-header)]">
        <Shield className="w-5 h-5 text-[var(--accent-blue)]" />
        <div>
          <div className="font-semibold">KYC Governance Flow</div>
          <div className="text-xs text-[var(--text-tertiary)]">{data.network} — Live on-chain data via {data.rpc.includes('ankr') ? 'Ankr Public RPC' : data.rpc}</div>
        </div>
        <div className="ml-auto">
          {kyc.governanceBroken
            ? <span className="flex items-center gap-1 text-xs font-bold text-[var(--critical)] bg-[var(--critical)]/10 border border-[var(--critical)]/25 px-2.5 py-1 rounded-full"><XCircle className="w-3.5 h-3.5" /> GOVERNANCE BROKEN</span>
            : <span className="flex items-center gap-1 text-xs font-bold text-[var(--success)] bg-[var(--success)]/10 border border-[var(--success)]/25 px-2.5 py-1 rounded-full"><CheckCircle className="w-3.5 h-3.5" /> GOVERNANCE OK</span>
          }
        </div>
      </div>

      <div className="p-5 space-y-5">

        {/* Quorum visualization */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold">voteInvalidKYC Quorum Status</span>
            <span className="text-xs text-[var(--text-tertiary)]">75% of ownerCount required</span>
          </div>
          <div className="flex items-end gap-4 mb-3">
            <div className="text-center">
              <div className="text-3xl font-bold tabular-nums text-[var(--accent-blue)]">{kyc.candidateCount}</div>
              <div className="text-xs text-[var(--text-tertiary)] mt-0.5">Max possible votes</div>
            </div>
            <div className="flex-1 pb-2">
              <div className="relative h-6 bg-black/30 rounded-full overflow-hidden">
                {/* Achievable bar */}
                <div
                  className="absolute left-0 top-0 h-full bg-[var(--accent-blue)] rounded-full transition-all"
                  style={{ width: `${pctAchievable}%` }}
                />
                {/* 75% marker */}
                <div className="absolute top-0 h-full w-0.5 bg-white/50" style={{ left: '75%' }} />
                <div className="absolute top-1/2 -translate-y-1/2 text-xs font-bold text-white px-2" style={{ left: '1%' }}>
                  {pctAchievable}% of needed
                </div>
              </div>
              <div className="flex justify-between text-xs text-[var(--text-tertiary)] mt-1">
                <span>0</span>
                <span className="text-[var(--warning)]">75% threshold = {kyc.threshold75pct.toLocaleString()} votes</span>
                <span>{kyc.ownerCount.toLocaleString()}</span>
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold tabular-nums text-[var(--critical)]">{kyc.threshold75pct.toLocaleString()}</div>
              <div className="text-xs text-[var(--text-tertiary)] mt-0.5">Votes needed</div>
            </div>
          </div>
          {kyc.governanceBroken && (
            <div className="text-xs text-center text-[var(--critical)] bg-[var(--critical)]/10 rounded-lg py-2">
              Deficit: <span className="font-bold">{kyc.deficitVotes.toLocaleString()}</span> votes short — governance cannot be reached with the current active validator set
            </div>
          )}
        </div>

        {/* Step-by-step flow */}
        <div>
          <div className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Code2 className="w-4 h-4 text-[var(--accent-blue)]" />
            KYC Governance Contract Flow
          </div>
          <div className="space-y-2">
            {kyc.flowSteps.map((step, idx) => (
              <div key={step.step} className="flex gap-3">
                {/* Connector */}
                <div className="flex flex-col items-center">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    step.status === 'broken' ? 'bg-[var(--critical)]/20 text-[var(--critical)] border border-[var(--critical)]/30' : 'bg-[var(--success)]/20 text-[var(--success)] border border-[var(--success)]/30'
                  }`}>{step.step}</div>
                  {idx < kyc.flowSteps.length - 1 && (
                    <div className="w-0.5 flex-1 my-1 bg-[var(--border-subtle)]" />
                  )}
                </div>
                {/* Content */}
                <div className={`flex-1 rounded-xl border p-3 mb-2 ${step.status === 'broken' ? 'border-[var(--critical)]/20 bg-[var(--critical)]/5' : 'border-[var(--border-subtle)] bg-[var(--bg-card)]'}`}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <code className="font-mono text-xs text-[var(--accent-blue)] font-semibold">{step.fn}</code>
                    <div className="flex items-center gap-2">
                      {step.selector !== 'internal' && (
                        <span className="font-mono text-xs text-[var(--text-tertiary)] bg-black/20 px-1.5 py-0.5 rounded">{step.selector}</span>
                      )}
                      <span className={`text-xs font-bold px-2 py-0.5 rounded border ${
                        step.status === 'broken'
                          ? 'text-[var(--critical)] bg-[var(--critical)]/15 border-[var(--critical)]/30'
                          : 'text-[var(--success)] bg-[var(--success)]/15 border-[var(--success)]/30'
                      }`}>{step.status === 'broken' ? '⚠ BROKEN' : '✓ OK'}</span>
                    </div>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1.5">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* The Root Cause: resign() never decrements */}
        <div className="rounded-xl border border-[var(--critical)]/25 bg-[var(--critical)]/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-[var(--critical)]" />
            <span className="font-semibold text-sm text-[var(--critical)]">Root Cause — resign() Never Decrements ownerCount</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-[var(--text-tertiary)] mb-1.5 font-semibold">BROKEN (current on-chain)</div>
              <pre className="text-xs font-mono bg-black/40 rounded-lg p-3 text-[var(--critical)] overflow-x-auto">{`function resign(address _candidate) public {
  validatorsState[_candidate].isCandidate = false;
  candidateCount = candidateCount.sub(1);
  // ...withdrawal scheduling...
  emit Resign(msg.sender, _candidate);
  // ❌ ownerCount-- MISSING
  // ❌ ownerToCandidate never cleaned
}`}</pre>
            </div>
            <div>
              <div className="text-xs text-[var(--text-tertiary)] mb-1.5 font-semibold">FIXED (PR #450)</div>
              <pre className="text-xs font-mono bg-black/40 rounded-lg p-3 text-[var(--success)] overflow-x-auto">{`function resign(address _candidate) public {
  validatorsState[_candidate].isCandidate = false;
  candidateCount = candidateCount.sub(1);
  deleteCandidate(_candidate);  // swap-and-pop
  deleteOwner(msg.sender,       // ✅ cleans up
    _candidate);                //    ownerCount--
  emit Resign(msg.sender, _candidate);
}`}</pre>
            </div>
          </div>
        </div>

        {/* Validation section - how to verify yourself */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
          <button
            onClick={() => setShowValidation(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[var(--accent-blue)]" />
              <span className="font-semibold text-sm">Validate Yourself — Ankr Public RPC Queries</span>
            </div>
            {showValidation ? <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" /> : <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)]" />}
          </button>

          {showValidation && (
            <div className="border-t border-[var(--border-subtle)] p-4 space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">
                Run these queries yourself using{' '}
                <a href="https://www.ankr.com/rpc/xdc/" target="_blank" className="text-[var(--accent-blue)] hover:underline">Ankr public RPC</a>{' '}
                — no API key required for basic calls.
              </p>

              {[
                {
                  label: '1. Get ownerCount — should be ~candidateCount but is 432,000',
                  rpc: kyc.validationQuery.rpc,
                  body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to: VALIDATOR_ADDR, data: '0xa9ff959e' }, 'latest'], id: 1 }, null, 2),
                  expected: `Result: 0x${kyc.validationQuery.getOwnerCount.result.toString(16).padStart(64,'0')}\nDecoded: ${kyc.validationQuery.getOwnerCount.result.toLocaleString()}`,
                  verdict: `ownerCount = ${kyc.validationQuery.getOwnerCount.result.toLocaleString()} (expected ~${kyc.validationQuery.candidateCount.result})`,
                },
                {
                  label: '2. Get candidateCount — the actual active candidates',
                  rpc: kyc.validationQuery.rpc,
                  body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', params: [{ to: VALIDATOR_ADDR, data: '0xa9a981a3' }, 'latest'], id: 1 }, null, 2),
                  expected: `Result: 0x${kyc.validationQuery.candidateCount.result.toString(16).padStart(64,'0')}\nDecoded: ${kyc.validationQuery.candidateCount.result}`,
                  verdict: `candidateCount = ${kyc.validationQuery.candidateCount.result} ✅ correct`,
                },
                {
                  label: `3. Governance threshold — need ${kyc.threshold75pct.toLocaleString()} votes but only ${kyc.maxPossibleVotes} exist`,
                  rpc: null,
                  body: `// Math:\nownerCount = ${kyc.ownerCount.toLocaleString()}\nthreshold  = floor(${kyc.ownerCount.toLocaleString()} × 0.75) + 1\n           = ${kyc.threshold75pct.toLocaleString()}\n\nmaxVotes = candidateCount = ${kyc.maxPossibleVotes}\ndeficit  = ${kyc.threshold75pct.toLocaleString()} - ${kyc.maxPossibleVotes} = ${kyc.deficitVotes.toLocaleString()}\n\nResult: UNREACHABLE ⛔`,
                  expected: null,
                  verdict: `Deficit: ${kyc.deficitVotes.toLocaleString()} votes`,
                },
              ].map((q, i) => (
                <div key={i} className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                  <div className="px-3 py-2 bg-[var(--bg-header)] border-b border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] flex items-center justify-between">
                    <span>{q.label}</span>
                    {q.rpc && <span className="font-mono text-[var(--text-tertiary)] text-xs">{q.rpc.includes('ankr') ? '⚡ Ankr Public RPC' : q.rpc}</span>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[var(--border-subtle)]">
                    <div className="p-3">
                      <div className="text-xs text-[var(--text-tertiary)] mb-1.5 flex items-center justify-between">
                        <span>REQUEST</span>
                        <CopyButton text={q.body} />
                      </div>
                      <pre className="text-xs font-mono text-[var(--text-secondary)] overflow-x-auto whitespace-pre-wrap break-all">{q.body}</pre>
                    </div>
                    {q.expected && (
                      <div className="p-3">
                        <div className="text-xs text-[var(--text-tertiary)] mb-1.5">LIVE RESULT</div>
                        <pre className="text-xs font-mono text-[var(--success)] overflow-x-auto">{q.expected}</pre>
                        <div className="mt-2 text-xs text-[var(--warning)] font-semibold">{q.verdict}</div>
                      </div>
                    )}
                    {!q.expected && (
                      <div className="p-3">
                        <div className="text-xs text-[var(--text-tertiary)] mb-1.5">ANALYSIS</div>
                        <div className="text-xs text-[var(--critical)] font-bold">{q.verdict}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* curl command */}
              <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                <div className="px-3 py-2 bg-[var(--bg-header)] border-b border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)] flex items-center justify-between">
                  <span>Run in terminal — curl one-liner</span>
                  <CopyButton text={`curl -s -X POST https://rpc.ankr.com/xdc -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0x0000000000000000000000000000000000000088","data":"0xa9ff959e"},"latest"],"id":1}' | python3 -c "import json,sys; r=json.load(sys.stdin); print('ownerCount:', int(r['result'],16))"`} />
                </div>
                <pre className="text-xs font-mono text-[var(--accent-blue)] p-3 overflow-x-auto bg-black/20">{`curl -s -X POST https://rpc.ankr.com/xdc \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","method":"eth_call","params":[{"to":"0x0000000000000000000000000000000000000088","data":"0xa9ff959e"},"latest"],"id":1}' \\
  | python3 -c "import json,sys; r=json.load(sys.stdin); print('ownerCount:', int(r['result'],16))"

# Expected output: ownerCount: ${kyc.ownerCount.toLocaleString()}`}</pre>
              </div>

              {/* Sample active candidates */}
              {kyc.activeCandidatesSample.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-[var(--text-tertiary)] mb-2 flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> Sample Active Candidates (from candidates[] array)
                  </div>
                  <div className="space-y-1">
                    {kyc.activeCandidatesSample.map(addr => (
                      <div key={addr} className="flex items-center justify-between bg-black/20 rounded-lg px-3 py-1.5">
                        <code className="font-mono text-xs text-[var(--text-secondary)]">{addr}</code>
                        <div className="flex items-center gap-1">
                          <CopyButton text={addr} />
                          <a
                            href={`https://xdcscan.com/address/${addr}`}
                            target="_blank"
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ghost entries summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'ownerCount', value: kyc.ownerCount.toLocaleString(), color: kyc.governanceBroken ? 'text-[var(--critical)]' : 'text-[var(--success)]', sub: kyc.governanceBroken ? 'Inflated by resign() bug' : 'Healthy' },
            { label: 'Ghost Entries', value: kyc.ghostEntries.toString(), color: kyc.ghostEntries > 0 ? 'text-[var(--warning)]' : 'text-[var(--success)]', sub: 'address(0) in candidates[]' },
            { label: 'Active Candidates', value: kyc.candidateCount.toString(), color: 'text-[var(--accent-blue)]', sub: 'can vote in governance' },
          ].map(m => (
            <div key={m.label} className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-3 text-center">
              <div className="text-xs text-[var(--text-tertiary)] mb-1">{m.label}</div>
              <div className={`text-2xl font-bold tabular-nums ${m.color}`}>{m.value}</div>
              <div className="text-xs text-[var(--text-tertiary)] mt-0.5">{m.sub}</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

const VALIDATOR_ADDR = '0x0000000000000000000000000000000000000088';

// ─── Network Panel ────────────────────────────────────────────────────────────
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
  const nHigh = findings.filter(f => f.severity === 'high').length;
  const nPass = findings.filter(f => f.severity === 'pass').length;
  const health = nCritical > 0 ? { icon: <ShieldAlert className="w-5 h-5 text-[var(--critical)]" />, label: 'AT RISK', color: 'text-[var(--critical)]' }
    : nHigh > 0 ? { icon: <AlertTriangle className="w-5 h-5 text-[var(--warning)]" />, label: 'CAUTION', color: 'text-[var(--warning)]' }
    : { icon: <ShieldCheck className="w-5 h-5 text-[var(--success)]" />, label: 'HEALTHY', color: 'text-[var(--success)]' };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-header)]">
        <div className="flex items-center gap-3">
          {data && !data.error ? health.icon : <Shield className="w-5 h-5 text-[var(--text-tertiary)]" />}
          <div>
            <div className="font-semibold text-sm">{label}</div>
            {data && !data.error && (
              <div className="text-xs text-[var(--text-tertiary)]">
                Block #{data.blockNumber.toLocaleString()} · {data.rpc.includes('ankr') ? '⚡ Ankr' : data.rpc.split('/')[2]}
              </div>
            )}
          </div>
          {data && !data.error && (
            <span className={`text-xs font-bold ${health.color}`}>{health.label}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastRun && <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1"><Clock className="w-3 h-3" />{lastRun}</span>}
          <button onClick={run} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border border-[var(--accent-blue)]/20 rounded-lg hover:bg-[var(--accent-blue)]/20 transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Running…' : 'Refresh'}
          </button>
        </div>
      </div>

      {data?.error && <div className="p-4 bg-[var(--critical)]/10 text-[var(--critical)] text-sm flex items-center gap-2"><XCircle className="w-4 h-4 flex-shrink-0" />{data.error}</div>}
      {loading && !data && <div className="flex flex-col items-center justify-center gap-3 py-12 text-[var(--text-tertiary)]"><RefreshCw className="w-6 h-6 animate-spin" /><span className="text-sm">Querying on-chain data…</span></div>}

      {data && !data.error && (
        <>
          {/* Score row */}
          <div className="grid grid-cols-3 divide-x divide-[var(--border-subtle)] border-b border-[var(--border-subtle)]">
            {[{ l: 'Critical', v: nCritical, c: nCritical > 0 ? 'text-[var(--critical)]' : 'text-[var(--text-tertiary)]' }, { l: 'High', v: nHigh, c: nHigh > 0 ? 'text-[var(--warning)]' : 'text-[var(--text-tertiary)]' }, { l: 'Passed', v: nPass, c: nPass > 0 ? 'text-[var(--success)]' : 'text-[var(--text-tertiary)]' }].map(({ l, v, c }) => (
              <div key={l} className="flex flex-col items-center py-3"><span className={`text-2xl font-bold ${c}`}>{v}</span><span className="text-xs text-[var(--text-tertiary)]">{l}</span></div>
            ))}
          </div>

          {/* RPC modules */}
          {data.exposedModules.length > 0 && (
            <div className="px-4 py-2 flex items-center gap-2 flex-wrap border-b border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-tertiary)]">RPC:</span>
              {data.exposedModules.map(m => (
                <span key={m} className={`text-xs px-2 py-0.5 rounded font-mono border ${data.dangerousModules.includes(m) ? 'bg-[var(--critical)]/15 text-[var(--critical)] border-[var(--critical)]/30' : 'bg-white/5 text-[var(--text-secondary)] border-[var(--border-subtle)]'}`}>{m}</span>
              ))}
            </div>
          )}

          {/* Findings */}
          <div className="p-4 space-y-2">
            <div className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-2">Security Findings</div>
            {findings.map(f => <FindingRow key={f.id} f={f} />)}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SecurityPage() {
  const [mainnetData, setMainnetData] = useState<AuditData | null>(null);
  const [apothemData, setApothemData] = useState<AuditData | null>(null);
  const [selectedNetwork, setSelectedNetwork] = useState<'mainnet' | 'apothem'>('mainnet');

  // Fetch both networks for the governance flow section
  useEffect(() => {
    fetch('/api/security/audit?network=mainnet').then(r => r.json()).then(setMainnetData).catch(() => {});
    fetch('/api/security/audit?network=apothem').then(r => r.json()).then(setApothemData).catch(() => {});
  }, []);

  const kycData = selectedNetwork === 'mainnet' ? mainnetData : apothemData;

  return (
    <DashboardLayout>
      <div className="p-4 sm:p-6 space-y-5 max-w-[1600px] mx-auto">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Shield className="w-5 h-5 text-[var(--critical)]" />
              <h1 className="text-xl font-bold">Security Audit</h1>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              Live on-chain validation of XDC Network security findings — XDCValidator contract 0x88 · Powered by{' '}
              <a href="https://www.ankr.com/rpc/xdc/" target="_blank" className="text-[var(--accent-blue)] hover:underline">⚡ Ankr Public RPC</a>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a href="https://github.com/AnilChinchawale/AllForOne/blob/main/XINFIN-SECURITY-AUDIT.md" target="_blank" className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--bg-card)] border border-[var(--border-card)] rounded-lg hover:bg-white/5 transition-colors">
              <ExternalLink className="w-3.5 h-3.5" /> Audit Report
            </a>
            <a href="https://github.com/XinFinOrg/XDPoSChain/pull/450" target="_blank" className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/25 rounded-lg hover:bg-[var(--success)]/20 transition-colors">
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
              accumulated to 432,000+ since genesis — making{' '}
              <code className="font-mono text-xs bg-black/30 px-1 rounded">voteInvalidKYC</code> permanently impossible.
              Fix exists in <a href="https://github.com/XinFinOrg/XDPoSChain/pull/450" target="_blank" className="text-[var(--accent-blue)] hover:underline">PR #450</a> — change <code className="font-mono text-xs bg-black/30 px-1 rounded">ValidtorV2SMCBlock</code> to a real block.
            </span>
          </div>
        </div>

        {/* Network panels */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <NetworkPanel networkKey="mainnet" label="XDC Mainnet" />
          <NetworkPanel networkKey="apothem" label="Apothem Testnet" />
        </div>

        {/* KYC Governance Flow — network selector */}
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex bg-[var(--bg-card)] border border-[var(--border-card)] rounded-xl p-1 gap-1">
              {(['mainnet', 'apothem'] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setSelectedNetwork(n)}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors ${selectedNetwork === n ? 'bg-[var(--accent-blue)] text-white' : 'text-[var(--text-secondary)] hover:bg-white/5'}`}
                >
                  {n === 'mainnet' ? 'XDC Mainnet' : 'Apothem'}
                </button>
              ))}
            </div>
            <span className="text-xs text-[var(--text-tertiary)]">Select network for KYC flow analysis</span>
          </div>

          {kycData && !kycData.error ? (
            <KycGovernanceSection data={kycData} />
          ) : (
            <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl flex items-center justify-center py-16 text-[var(--text-tertiary)]">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading KYC governance data…
            </div>
          )}
        </div>

        {/* Remediation quick ref */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-card)] rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch className="w-4 h-4 text-[var(--accent-blue)]" />
            <span className="font-semibold text-sm">Remediation Reference</span>
            <span className="text-xs text-[var(--text-tertiary)] ml-auto">Sorted by impact / effort</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              { rank: '1', effort: '1 line', title: 'Activate V2 Contract', code: 'ValidtorV2SMCBlock = big.NewInt(102030000)', file: 'common/constants.go', link: 'https://github.com/XinFinOrg/XDPoSChain/pull/450', color: 'border-[var(--critical)]/30 bg-[var(--critical)]/5' },
              { rank: '2', effort: '1 line', title: 'Fix RPC Bind Address', code: 'HTTPListenAddrFlag.Value = "localhost"', file: 'cmd/utils/flags.go', color: 'border-[var(--critical)]/30 bg-[var(--critical)]/5' },
              { rank: '3', effort: '5 min', title: 'Fix BFT Broadcast Order', code: 'Move broadcastCh after voteHandler()', file: 'eth/bft/bft_handler.go', color: 'border-[var(--warning)]/30 bg-[var(--warning)]/5' },
              { rank: '4', effort: '2 hours', title: 'Replace math/rand', code: 'cryptoRand.Int(cryptoRand.Reader, max)', file: 'contracts/utils.go', color: 'border-[var(--warning)]/30 bg-[var(--warning)]/5' },
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
                  {'link' in item && (
                    <a href={(item as { link: string }).link} target="_blank" className="flex items-center gap-0.5 text-xs text-[var(--accent-blue)] hover:underline ml-2 flex-shrink-0">
                      PR <ExternalLink className="w-3 h-3" />
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
