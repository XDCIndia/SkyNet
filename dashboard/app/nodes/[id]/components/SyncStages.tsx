'use client';

interface SyncStagesProps {
  clientType?: string;
  syncPercent?: number;
  isSyncing?: boolean;
}

type Stage = string;

const STAGES: Record<string, Stage[]> = {
  geth:        ['Header Download', 'Body Download', 'State Processing', 'XDPoS Validation'],
  gp5:         ['Header Download', 'Body Download', 'State Processing', 'XDPoS Validation'],
  xdc:         ['Header Download', 'Body Download', 'State Processing', 'XDPoS Validation'],
  erigon:      ['Headers', 'Bodies', 'Senders', 'Execution', 'HashState', 'IntermediateHashes', 'AccountHistory', 'StorageHistory', 'LogIndex', 'TxLookup', 'Finish'],
  nethermind:  ['FastHeaders', 'FastBodies', 'FastReceipts', 'StateSync', 'FullSync'],
  reth:        ['Headers', 'Bodies', 'SenderRecovery', 'Execution', 'AccountHashing', 'StorageHashing', 'MerkleUnwind'],
};

function resolveClientKey(clientType?: string): string {
  const t = (clientType || '').toLowerCase();
  if (t.includes('nethermind')) return 'nethermind';
  if (t.includes('erigon'))     return 'erigon';
  if (t.includes('reth'))       return 'reth';
  if (t === 'gp5' || t.includes('gp5') || t.includes('geth-pr5')) return 'gp5';
  return 'geth'; // default covers geth + xdc
}

function getActiveIndex(stages: Stage[], syncPercent: number, isSyncing?: boolean): number {
  const total = stages.length;
  if (!isSyncing && syncPercent >= 99.9) return total; // all complete
  if (syncPercent <= 0)                  return 0;     // not started
  if (syncPercent < 50)                  return Math.floor(total * 0.2);
  if (syncPercent < 90)                  return Math.floor(total * 0.5);
  return Math.floor(total * 0.85);
}

export default function SyncStages({ clientType, syncPercent = 0, isSyncing }: SyncStagesProps) {
  const key    = resolveClientKey(clientType);
  const stages = STAGES[key] || STAGES['geth'];
  const total  = stages.length;

  // activeIdx: index of the currently active stage (0-based). total = all done.
  const activeIdx = getActiveIndex(stages, syncPercent, isSyncing);
  const allDone   = activeIdx >= total;

  const displayStage = allDone ? total : activeIdx + 1;

  return (
    <div className="card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Sync Pipeline</h3>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
            {allDone
              ? `All ${total} stages complete`
              : `Stage ${displayStage} of ${total} — ${stages[activeIdx]}`}
          </p>
        </div>
        <span className="text-xs px-2 py-1 rounded-full bg-[var(--bg-hover)] text-[var(--text-secondary)]">
          {key.toUpperCase()}
        </span>
      </div>

      {/* Desktop: horizontal pipeline */}
      <div className="hidden sm:flex items-center w-full overflow-x-auto pb-2">
        {stages.map((stage, i) => {
          const isDone   = i < activeIdx || allDone;
          const isActive = !allDone && i === activeIdx;
          const isPending = !isDone && !isActive;

          return (
            <div key={stage} className="flex items-center flex-1 min-w-0">
              {/* Node */}
              <div className="flex flex-col items-center shrink-0">
                {/* Circle */}
                <div
                  className={[
                    'w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all',
                    isDone
                      ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                      : isActive
                      ? 'bg-[#3B82F6]/20 border-[#3B82F6] text-[#3B82F6] shadow-[0_0_10px_#3B82F680] animate-pulse'
                      : 'bg-[var(--bg-hover)] border-[var(--border-subtle)] text-[var(--text-tertiary)]',
                  ].join(' ')}
                >
                  {isDone ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-[10px] font-bold">{i + 1}</span>
                  )}
                </div>
                {/* Label */}
                <span
                  className={[
                    'mt-1.5 text-[10px] font-medium text-center leading-tight max-w-[60px] break-words',
                    isDone ? 'text-[#10B981]' : isActive ? 'text-[#3B82F6]' : 'text-[var(--text-tertiary)]',
                  ].join(' ')}
                >
                  {stage}
                </span>
              </div>

              {/* Connector line (not after last) */}
              {i < total - 1 && (
                <div
                  className={[
                    'flex-1 h-0.5 mx-0.5 mt-[-14px]',
                    isDone ? 'bg-[#10B981]/60' : 'bg-[var(--border-subtle)]',
                  ].join(' ')}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: vertical pipeline */}
      <div className="flex sm:hidden flex-col gap-0">
        {stages.map((stage, i) => {
          const isDone   = i < activeIdx || allDone;
          const isActive = !allDone && i === activeIdx;

          return (
            <div key={stage} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={[
                    'w-6 h-6 rounded-full flex items-center justify-center border-2 shrink-0',
                    isDone
                      ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                      : isActive
                      ? 'bg-[#3B82F6]/20 border-[#3B82F6] text-[#3B82F6] shadow-[0_0_8px_#3B82F680] animate-pulse'
                      : 'bg-[var(--bg-hover)] border-[var(--border-subtle)] text-[var(--text-tertiary)]',
                  ].join(' ')}
                >
                  {isDone ? (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-[9px] font-bold">{i + 1}</span>
                  )}
                </div>
                {i < total - 1 && (
                  <div className={['w-0.5 h-4', isDone ? 'bg-[#10B981]/60' : 'bg-[var(--border-subtle)]'].join(' ')} />
                )}
              </div>
              <span
                className={[
                  'text-xs font-medium pt-0.5',
                  isDone ? 'text-[#10B981]' : isActive ? 'text-[#3B82F6]' : 'text-[var(--text-tertiary)]',
                ].join(' ')}
              >
                {stage}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
