'use client';

import { Layers, Zap, RotateCcw, TrendingUp } from 'lucide-react';

interface ConsensusPanelProps {
  epoch?: number;
  epochProgress?: number;
  v2Active?: boolean;
  round?: number;
  blockHeight?: number;
  chainId?: number;
}

const V2_MAINNET = 55296900;
const V2_APOTHEM = 455000;
const EPOCH_SIZE = 900;

export function ConsensusPanel({
  epoch,
  epochProgress,
  v2Active,
  round,
  blockHeight,
  chainId,
}: ConsensusPanelProps) {
  // Don't render if no consensus data
  if (epoch === undefined && epoch === null) return null;
  if (epoch == null && round == null && v2Active == null) return null;

  const progress = epochProgress ?? 0;
  const isMainnet = chainId === 50;
  const isApothem = chainId === 51;

  // For V1 nodes: compute blocks until V2 activation
  let blocksToV2: number | null = null;
  let v2Target: number | null = null;
  if (!v2Active && blockHeight != null) {
    if (isMainnet) {
      v2Target = V2_MAINNET;
      blocksToV2 = Math.max(0, V2_MAINNET - blockHeight);
    } else if (isApothem) {
      v2Target = V2_APOTHEM;
      blocksToV2 = Math.max(0, V2_APOTHEM - blockHeight);
    }
  }

  // Estimated epochs until V2 (for V1 nodes)
  const epochsToV2 = blocksToV2 != null ? Math.ceil(blocksToV2 / EPOCH_SIZE) : null;

  return (
    <div className="card-xdc">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-[#1E90FF]/10 flex items-center justify-center">
          <Layers className="w-5 h-5 text-[#1E90FF]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">XDPoS Consensus <span className="ml-2 px-2 py-0.5 text-[10px] font-bold bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full uppercase tracking-wide">New</span></h2>
          <p className="text-xs text-[#64748B]">Epoch progress &amp; protocol version</p>
        </div>

        {/* V1/V2 Badge */}
        <div className="ml-auto">
          {v2Active ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20 rounded-lg text-sm font-semibold">
              <Zap className="w-4 h-4" />
              XDPoS V2 Active
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20 rounded-lg text-sm font-semibold">
              <Layers className="w-4 h-4" />
              XDPoS V1
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {/* Epoch */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-[#1E90FF]/10 flex items-center justify-center">
              <Layers className="w-3 h-3 text-[#1E90FF]" />
            </div>
            <span className="text-[11px] uppercase text-[#64748B] font-medium tracking-wider">Epoch</span>
          </div>
          <div className="text-xl font-bold font-mono-nums text-[#1E90FF]">
            {epoch != null ? epoch.toLocaleString() : '—'}
          </div>
          {epochProgress != null && (
            <div className="text-xs text-[#64748B] mt-0.5">{epochProgress}% complete</div>
          )}
        </div>

        {/* Epoch Progress */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-[#8B5CF6]/10 flex items-center justify-center">
              <TrendingUp className="w-3 h-3 text-[#8B5CF6]" />
            </div>
            <span className="text-[11px] uppercase text-[#64748B] font-medium tracking-wider">In-Epoch Block</span>
          </div>
          {epochProgress != null && blockHeight != null && epoch != null ? (
            <>
              <div className="text-xl font-bold font-mono-nums text-[#8B5CF6]">
                {(blockHeight % EPOCH_SIZE).toLocaleString()}
                <span className="text-sm font-normal text-[#64748B]"> / {EPOCH_SIZE}</span>
              </div>
              <div className="text-xs text-[#64748B] mt-0.5">block in epoch</div>
            </>
          ) : (
            <div className="text-xl font-bold text-[#64748B]">—</div>
          )}
        </div>

        {/* Round (V2 only) */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-[#10B981]/10 flex items-center justify-center">
              <RotateCcw className="w-3 h-3 text-[#10B981]" />
            </div>
            <span className="text-[11px] uppercase text-[#64748B] font-medium tracking-wider">Round</span>
          </div>
          {v2Active ? (
            <>
              <div className="text-xl font-bold font-mono-nums text-[#10B981]">
                {round != null ? round.toLocaleString() : '—'}
              </div>
              <div className="text-xs text-[#64748B] mt-0.5">V2 consensus round</div>
            </>
          ) : (
            <>
              <div className="text-xl font-bold text-[#64748B]">N/A</div>
              <div className="text-xs text-[#64748B] mt-0.5">V1 (no rounds)</div>
            </>
          )}
        </div>

        {/* Chain / Network */}
        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
              <Zap className="w-3 h-3 text-[#F59E0B]" />
            </div>
            <span className="text-[11px] uppercase text-[#64748B] font-medium tracking-wider">Chain ID</span>
          </div>
          <div className="text-xl font-bold font-mono-nums text-[#F59E0B]">
            {chainId ?? '—'}
          </div>
          <div className="text-xs text-[#64748B] mt-0.5">
            {isMainnet ? 'XDC Mainnet' : isApothem ? 'Apothem Testnet' : 'Unknown Network'}
          </div>
        </div>
      </div>

      {/* Epoch Progress Bar */}
      {epochProgress != null && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#64748B]">
              Epoch {epoch != null ? epoch.toLocaleString() : '?'} Progress
            </span>
            <span className="text-xs font-mono text-[#1E90FF]">{epochProgress}%</span>
          </div>
          <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, progress)}%`,
                background: 'linear-gradient(90deg, #1E90FF 0%, #10B981 100%)',
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-[#475569] mt-1">
            <span>Epoch start</span>
            <span>{EPOCH_SIZE} blocks</span>
          </div>
        </div>
      )}

      {/* V2 Activation Info (V1 nodes only) */}
      {!v2Active && blocksToV2 != null && v2Target != null && (
        <div className="p-3 bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-[#F59E0B]" />
            <span className="text-sm font-medium text-[#F59E0B]">XDPoS V2 Activation</span>
          </div>
          <div className="text-xs text-[#94A3B8] space-y-0.5">
            <div>Target block: <span className="font-mono text-[#F1F5F9]">{v2Target.toLocaleString()}</span></div>
            {blockHeight != null && (
              <div>Current block: <span className="font-mono text-[#F1F5F9]">{blockHeight.toLocaleString()}</span></div>
            )}
            <div>
              Remaining: <span className="font-mono text-[#F59E0B]">{blocksToV2.toLocaleString()} blocks</span>
              {epochsToV2 != null && (
                <span className="ml-1 text-[#64748B]">≈ {epochsToV2.toLocaleString()} epochs</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConsensusPanel;
