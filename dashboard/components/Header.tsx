'use client';

import { useState } from 'react';
import { RefreshCw, Users } from 'lucide-react';

interface HeaderProps {
  lastUpdated: string | null;
  connected: boolean;
  nextRefresh: number;
  refreshInterval?: number;
  blockHeight?: number;
  peers?: number;
  isSyncing?: boolean;
  coinbase?: string;
  ethstatsName?: string;
}

export default function Header({ 
  lastUpdated, 
  connected, 
  nextRefresh,
  refreshInterval = 10,
  blockHeight = 0,
  peers = 0,
  isSyncing = false,
  coinbase = '',
  ethstatsName = '',
}: HeaderProps) {
  const [isSpinning, setIsSpinning] = useState(false);

  const handleRefreshClick = () => {
    setIsSpinning(true);
    setTimeout(() => setIsSpinning(false), 1000);
    window.location.reload();
  };

  return (
    <header className="header-obsidian sticky top-0 z-50">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between px-4 lg:px-6 py-3">
        {/* Left: Logo + Title */}
        <div className="flex items-center gap-3">
          {/* XDC Logo SVG */}
          <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden">
            <img src="https://s2.coinmarketcap.com/static/img/coins/200x200/2634.png" alt="XDC" width={40} height={40} className="rounded-full" />
          </div>
          <div>
            <h1 className="text-lg lg:text-xl font-semibold text-[#F9FAFB]" style={{ fontFamily: 'var(--font-fira-sans)' }}>
              Node Dashboard
            </h1>
            <div className="hidden sm:flex items-center gap-2 text-xs flex-wrap">
              {ethstatsName && (
                <>
                  <span className="text-[var(--success)] font-medium">{ethstatsName}</span>
                  <span className="text-[#6B7280]">·</span>
                </>
              )}
              <span className="text-[#6B7280]">XDC Mainnet</span>
              {coinbase && (
                <>
                  <span className="text-[#6B7280]">·</span>
                  <span className="text-[#9CA3AF] font-mono text-[10px]" title={coinbase}>
                    {coinbase.slice(0, 8)}...{coinbase.slice(-6)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center: Live Status Pill */}
        <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-full bg-[var(--bg-card)] border border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-2">
            <span className={`status-dot ${isSyncing ? 'syncing' : connected ? 'active' : 'inactive'}`} />
            <span className={`text-sm font-medium ${isSyncing ? 'text-[var(--warning)]' : connected ? 'text-[var(--success)]' : 'text-[var(--critical)]'}`}>
              {isSyncing ? 'Syncing' : connected ? 'Synced' : 'Disconnected'}
            </span>
          </div>
          {blockHeight > 0 && (
            <>
              <span className="text-[#6B7280]">|</span>
              <span className="text-sm font-mono-nums text-[#F9FAFB]">
                #{blockHeight.toLocaleString()}
              </span>
            </>
          )}
        </div>

        {/* Right: Auto-refresh + Peers */}
        <div className="flex items-center gap-4">
          {/* Auto-refresh indicator */}
          <div className="flex items-center gap-2">
            <button 
              onClick={handleRefreshClick}
              className="p-2 rounded-lg hover:bg-[rgba(30,144,255,0.1)] transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw 
                className={`w-4 h-4 text-[var(--accent-blue)] ${isSpinning ? 'animate-spin' : ''}`}
                style={{ animationDuration: isSpinning ? '1s' : '10s' }}
              />
            </button>
            <span className="hidden sm:block text-xs text-[#6B7280]">
              {nextRefresh}s
            </span>
          </div>

          {/* Peers badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[rgba(255,255,255,0.06)]">
            <Users className="w-4 h-4 text-[var(--accent-blue)]" />
            <span className="text-sm font-medium text-[#F9FAFB]">{peers || '—'}</span>
          </div>

          {/* Mobile status dot */}
          <div className="md:hidden">
            <span className={`status-dot ${isSyncing ? 'syncing' : connected ? 'active' : 'inactive'}`} />
          </div>
        </div>
      </div>
    </header>
  );
}
