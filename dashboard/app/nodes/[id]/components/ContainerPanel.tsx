'use client';

import { useMemo } from 'react';
import { Container, Globe, Clock, Layers, Terminal, Monitor } from 'lucide-react';
import type { NodeDetail, NodeStatus } from './types';

interface ContainerPanelProps {
  node: NodeDetail;
  status: NodeStatus;
}

type ClientFamily = 'geth' | 'erigon' | 'nethermind' | 'reth' | 'unknown';

const CLIENT_STYLES: Record<ClientFamily, { color: string; bg: string; label: string; prefix: string }> = {
  geth:       { color: '#1E90FF', bg: 'bg-[#1E90FF]/10',  label: 'Geth/GP5',   prefix: 'xdcgeth' },
  erigon:     { color: '#F97316', bg: 'bg-[#F97316]/10',  label: 'Erigon',     prefix: 'xdcerigon' },
  nethermind: { color: '#8B5CF6', bg: 'bg-[#8B5CF6]/10',  label: 'Nethermind', prefix: 'xdcnethermind' },
  reth:       { color: '#10B981', bg: 'bg-[#10B981]/10',  label: 'Reth',       prefix: 'xdcreth' },
  unknown:    { color: '#64748B', bg: 'bg-[#64748B]/10',  label: 'Unknown',    prefix: 'xdcnode' },
};

function detectClientFamily(node: NodeDetail, status: NodeStatus): ClientFamily {
  const ct = (status.clientType || node.client_type || '').toLowerCase();
  if (ct.includes('erigon'))     return 'erigon';
  if (ct.includes('nethermind')) return 'nethermind';
  if (ct.includes('reth'))       return 'reth';
  if (ct.includes('geth') || ct.includes('gp5') || ct.includes('xdc')) return 'geth';
  return 'unknown';
}

/**
 * Derive container name from node name.
 * e.g. "xdc02-gp5-mainnet-109" → "xdcgeth-mainnet"
 *       "xdc03-erigon-apothem-07" → "xdcerigon-apothem"
 */
function deriveContainerName(nodeName: string, family: ClientFamily): string {
  const nameLower = nodeName.toLowerCase();
  const network = nameLower.includes('apothem') ? 'apothem' : 'mainnet';
  return `${CLIENT_STYLES[family].prefix}-${network}`;
}

function detectNetwork(nodeName: string): { label: string; color: string } {
  if (nodeName.toLowerCase().includes('apothem')) {
    return { label: 'Apothem Testnet', color: '#F59E0B' };
  }
  return { label: 'XDC Mainnet', color: '#10B981' };
}

function formatUptime(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider text-[#475569] font-medium">{label}</span>
      <div className="text-sm text-[#F1F5F9]">{value}</div>
    </div>
  );
}

export default function ContainerPanel({ node, status }: ContainerPanelProps) {
  const family = useMemo(() => detectClientFamily(node, status), [node, status]);
  const style = CLIENT_STYLES[family];
  const containerName = useMemo(() => deriveContainerName(node.name, family), [node.name, family]);
  const network = useMemo(() => detectNetwork(node.name), [node.name]);
  const dockerImage = status.dockerImage || node.docker_image;
  const startupParams = node.startup_params;
  const stateScheme = node.state_scheme;
  const isPBSS = stateScheme === 'path';
  const osInfo = status.os || node.os_info;

  return (
    <div className="card-xdc">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-10 h-10 rounded-xl ${style.bg} flex items-center justify-center`} style={{ color: style.color }}>
          <Container className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Container Info</h2>
          <p className="text-xs text-[#64748B]">{style.label} deployment details</p>
        </div>
        {/* Uptime badge */}
        {node.createdAt && (
          <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] text-xs font-medium">
            <Clock className="w-3.5 h-3.5" />
            {formatUptime(node.createdAt)}
          </div>
        )}
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          {/* Container Name */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <span className="text-[10px] uppercase tracking-wider text-[#475569] font-medium">Container Name</span>
            <div className="mt-1.5 flex items-center gap-2">
              <code
                className="text-base font-mono font-bold px-2 py-1 rounded-lg"
                style={{ color: style.color, background: `${style.color}15` }}
              >
                {containerName}
              </code>
            </div>
          </div>

          {/* Docker Image */}
          {dockerImage && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-[#06B6D4]/20 transition-colors">
              <span className="text-[10px] uppercase tracking-wider text-[#475569] font-medium">🐳 Docker Image</span>
              <div className="mt-1.5 text-sm font-mono text-[#06B6D4] bg-[#06B6D4]/5 px-3 py-2 rounded-lg break-all">
                {dockerImage}
              </div>
            </div>
          )}

          {/* Network */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-3.5 h-3.5 text-[#64748B]" />
              <span className="text-[10px] uppercase tracking-wider text-[#475569] font-medium">Network</span>
            </div>
            <span
              className="text-sm font-semibold px-2 py-1 rounded-lg"
              style={{ color: network.color, background: `${network.color}15` }}
            >
              {network.label}
            </span>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* State Scheme */}
          {stateScheme && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="w-3.5 h-3.5 text-[#64748B]" />
                <span className="text-[10px] uppercase tracking-wider text-[#475569] font-medium">State Scheme</span>
              </div>
              <span
                className={`text-sm font-bold px-2 py-1 rounded-lg ${
                  isPBSS
                    ? 'bg-[#8B5CF6]/15 text-[#8B5CF6]'
                    : 'bg-[#10B981]/15 text-[#10B981]'
                }`}
              >
                {isPBSS ? 'PBSS' : 'HBSS'}
              </span>
              <span className="ml-2 text-xs text-[#475569]">
                {isPBSS ? 'Path-Based State Scheme' : 'Hash-Based State Scheme'}
              </span>
            </div>
          )}

          {/* OS Info */}
          {osInfo && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <Monitor className="w-3.5 h-3.5 text-[#64748B]" />
                <span className="text-[10px] uppercase tracking-wider text-[#475569] font-medium">Operating System</span>
              </div>
              <div className="space-y-1.5">
                {osInfo.release && (
                  <div className="text-sm text-[#F1F5F9]">{osInfo.release}</div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {osInfo.type && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-[#F59E0B]/10 text-[#F59E0B] rounded font-medium capitalize">
                      {osInfo.type}
                    </span>
                  )}
                  {osInfo.arch && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-white/5 text-[#94A3B8] rounded font-mono">
                      {osInfo.arch}
                    </span>
                  )}
                </div>
                {osInfo.kernel && (
                  <div className="text-[10px] text-[#475569] font-mono">
                    kernel: {osInfo.kernel}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Startup Params (code block) */}
          {startupParams && (
            <div className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-[#F59E0B]/20 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <Terminal className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span className="text-[10px] uppercase tracking-wider text-[#475569] font-medium">Startup Parameters</span>
              </div>
              <pre className="text-[10px] font-mono text-[#94A3B8] bg-black/20 px-3 py-2 rounded-lg overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-[120px] overflow-y-auto">
                {startupParams}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
