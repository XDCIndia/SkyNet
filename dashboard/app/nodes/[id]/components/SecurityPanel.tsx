'use client';

/**
 * SecurityPanel — Issue #74
 * Displays security score from SkyOne heartbeat data.
 */

import { Shield, ShieldAlert, ShieldCheck, ShieldX, AlertTriangle } from 'lucide-react';
import type { NodeDetail, NodeStatus } from './types';

interface SecurityPanelProps {
  node: NodeDetail;
  status: NodeStatus | null;
}

function ScoreArc({ score }: { score: number }) {
  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * Math.PI; // half-circle
  const offset = circumference - (score / 100) * circumference;

  const color =
    score >= 80 ? '#10B981' :
    score >= 60 ? '#F59E0B' :
    score >= 40 ? '#F97316' :
    '#EF4444';

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size / 2 + strokeWidth} viewBox={`0 0 ${size} ${size / 2 + strokeWidth}`}>
        {/* Background arc */}
        <path
          d={`M ${strokeWidth / 2},${size / 2} A ${radius},${radius} 0 0 1 ${size - strokeWidth / 2},${size / 2}`}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Score arc */}
        <path
          d={`M ${strokeWidth / 2},${size / 2} A ${radius},${radius} 0 0 1 ${size - strokeWidth / 2},${size / 2}`}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute bottom-0 flex flex-col items-center">
        <div className="text-3xl font-bold" style={{ color }}>
          {score}
        </div>
        <div className="text-xs text-[#64748B]">/ 100</div>
      </div>
    </div>
  );
}

function scoreLabel(score: number): { label: string; color: string; Icon: React.ElementType } {
  if (score >= 80) return { label: 'Secure', color: '#10B981', Icon: ShieldCheck };
  if (score >= 60) return { label: 'Fair', color: '#F59E0B', Icon: Shield };
  if (score >= 40) return { label: 'At Risk', color: '#F97316', Icon: ShieldAlert };
  return { label: 'Vulnerable', color: '#EF4444', Icon: ShieldX };
}

function IssueItem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-[#F59E0B] flex-shrink-0" />
      <span className="text-sm text-[#CBD5E1]">{text}</span>
    </div>
  );
}

export default function SecurityPanel({ node, status }: SecurityPanelProps) {
  const score =
    status?.security?.score ??
    node.security_score ??
    null;

  const issuesRaw =
    status?.security?.issues ??
    node.security_issues ??
    null;

  // Parse issues — could be a JSON array string or comma-separated
  let issues: string[] = [];
  if (issuesRaw) {
    try {
      const parsed = JSON.parse(issuesRaw);
      issues = Array.isArray(parsed) ? parsed : [String(parsed)];
    } catch {
      issues = issuesRaw
        .split(/[,;|\n]/)
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
  }

  if (score == null) {
    return (
      <div className="card-xdc">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-[#10B981]/10 flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#10B981]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">Security Score <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full uppercase tracking-wide">New</span></h2>
            <p className="text-xs text-[#64748B]">From SkyOne agent security scan</p>
          </div>
        </div>
        <div className="text-center py-6 text-[#64748B] text-sm">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>Security score not yet reported.</p>
          <p className="text-xs mt-1">SkyOne agent will include it on next heartbeat.</p>
        </div>
      </div>
    );
  }

  const { label, color, Icon } = scoreLabel(score);

  return (
    <div className="card-xdc">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold flex items-center gap-2">Security Score <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full uppercase tracking-wide">New</span></h2>
          <p className="text-xs text-[#64748B]">From SkyOne agent security scan</p>
        </div>
        <span
          className="px-3 py-1.5 rounded-lg text-sm font-semibold border"
          style={{ color, borderColor: `${color}40`, background: `${color}10` }}
        >
          {label}
        </span>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Arc gauge */}
        <div className="flex-shrink-0">
          <ScoreArc score={score} />
        </div>

        {/* Issues / breakdown */}
        <div className="flex-1 w-full">
          {issues.length > 0 ? (
            <>
              <div className="text-xs uppercase text-[#64748B] tracking-wider mb-2">
                Detected Issues ({issues.length})
              </div>
              <div className="space-y-0.5 max-h-40 overflow-y-auto">
                {issues.map((issue, i) => (
                  <IssueItem key={i} text={issue} />
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 text-[#10B981]">
              <ShieldCheck className="w-5 h-5" />
              <span className="text-sm font-medium">No security issues detected</span>
            </div>
          )}

          {/* Score meaning */}
          <div className="mt-4 pt-3 border-t border-white/5 grid grid-cols-4 gap-1 text-center">
            {[
              { range: '80-100', label: 'Secure', color: '#10B981' },
              { range: '60-79', label: 'Fair', color: '#F59E0B' },
              { range: '40-59', label: 'At Risk', color: '#F97316' },
              { range: '0-39', label: 'Vuln.', color: '#EF4444' },
            ].map(r => (
              <div
                key={r.range}
                className="text-[10px] px-1 py-1 rounded"
                style={{
                  background: score >= parseInt(r.range) ? `${r.color}20` : 'transparent',
                  color: r.color,
                  opacity: score >= parseInt(r.range.split('-')[0]) ? 1 : 0.4,
                }}
              >
                <div className="font-bold">{r.label}</div>
                <div className="text-[9px] opacity-70">{r.range}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
