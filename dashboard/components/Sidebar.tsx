'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard,
  Building2,
  Wrench,
  Globe,
  Pickaxe,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: string;
  section?: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, path: '/', section: 'Overview' },
  { id: 'executive', label: 'Executive', icon: <Building2 className="w-5 h-5" />, path: '/executive', section: 'Overview' },
  { id: 'fleet', label: 'Fleet', icon: <Wrench className="w-5 h-5" />, path: '/fleet', section: 'Operations' },
  { id: 'network', label: 'Network Stats', icon: <BarChart3 className="w-5 h-5" />, path: '/network', section: 'Network' },
  { id: 'peers', label: 'Peers', icon: <Globe className="w-5 h-5" />, path: '/peers', section: 'Network' },
  { id: 'masternodes', label: 'Masternodes', icon: <Pickaxe className="w-5 h-5" />, path: '/masternodes', section: 'Network' },
];

interface NetworkStatus {
  bestBlock: number;
  online: boolean;
}

function formatBlock(num: number): string {
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'K';
  return num.toString();
}

function formatTimeAgoShort(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="w-full flex items-center justify-center px-3 py-2.5 rounded-lg text-[var(--text-tertiary)]">
        <Monitor className="w-5 h-5" />
      </button>
    );
  }

  const currentTheme = resolvedTheme || theme;

  const toggleTheme = () => {
    if (currentTheme === 'dark') {
      setTheme('light');
    } else if (currentTheme === 'light') {
      setTheme('system');
    } else {
      setTheme('dark');
    }
  };

  const getIcon = () => {
    if (theme === 'system') return <Monitor className="w-5 h-5" />;
    if (currentTheme === 'dark') return <Moon className="w-5 h-5" />;
    return <Sun className="w-5 h-5" />;
  };

  const getLabel = () => {
    if (theme === 'system') return 'System';
    return currentTheme === 'dark' ? 'Dark' : 'Light';
  };

  return (
    <button
      onClick={toggleTheme}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-transparent`}
      title={collapsed ? `Theme: ${getLabel()}` : undefined}
    >
      <span className="flex-shrink-0">{getIcon()}</span>
      {!collapsed && (
        <span className="text-sm font-medium truncate">{getLabel()}</span>
      )}
    </button>
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
  const [lastFetched, setLastFetched] = useState<number>(0);
  const [, setTick] = useState(0);

  const fetchNetworkStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/network/stats', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setNetworkStatus({ bestBlock: data.bestBlock, online: true });
        setLastFetched(Date.now());
      }
    } catch {
      setNetworkStatus(prev => prev ? { ...prev, online: false } : null);
    }
  }, []);

  useEffect(() => {
    fetchNetworkStatus();
    const interval = setInterval(fetchNetworkStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchNetworkStatus]);

  // Tick every 10s to update "last updated" display
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  const sections = Array.from(new Set(navItems.map(i => i.section)));

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 h-screen z-50 transition-all duration-300 ${
          collapsed ? 'w-[68px]' : 'w-[220px]'
        } bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)]`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-[var(--border-subtle)]">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--accent-blue)]/20 to-[var(--success)]/20 flex items-center justify-center border border-[var(--accent-blue)]/30 flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="var(--accent-blue)" strokeWidth="2"/>
              <path d="M8 8L16 16M16 8L8 16" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold text-[var(--text-primary)] whitespace-nowrap">XDCNetOwn</h1>
              <p className="text-[10px] text-[var(--text-tertiary)] whitespace-nowrap">Network Dashboard</p>
            </div>
          )}
        </div>

        {/* Network Status */}
        {!collapsed && networkStatus && (
          <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${networkStatus.online ? 'bg-[var(--success)]' : 'bg-[var(--critical)]'}`} />
              <span className="text-[var(--text-secondary)]">XDC Mainnet</span>
            </div>
            <div className="text-xs text-[var(--text-tertiary)] mt-1">
              Block #{formatBlock(networkStatus.bestBlock)}
              <span className="mx-1">•</span>
              <span className={networkStatus.online ? 'text-[var(--success)]' : 'text-[var(--critical)]'}>
                {networkStatus.online ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        )}
        {collapsed && networkStatus && (
          <div className="flex justify-center py-2 border-b border-[var(--border-subtle)]">
            <span className={`w-2.5 h-2.5 rounded-full ${networkStatus.online ? 'bg-[var(--success)]' : 'bg-[var(--critical)]'}`} title={`Block #${networkStatus.bestBlock.toLocaleString()}`} />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {sections.map(section => (
            <div key={section} className="mb-3">
              {!collapsed && (
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {section}
                </p>
              )}
              {navItems
                .filter(i => i.section === section)
                .map(item => {
                  const isActive = pathname === item.path || 
                    (item.path !== '/' && pathname.startsWith(item.path));
                  return (
                    <button
                      key={item.id}
                      onClick={() => router.push(item.path)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-all text-left ${
                        isActive
                          ? 'bg-[var(--bg-active)] text-[var(--accent-blue)] border border-[var(--accent-blue)]/20'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-transparent'
                      }`}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      {!collapsed && (
                        <span className="text-sm font-medium truncate">{item.label}</span>
                      )}
                      {!collapsed && item.badge && (
                        <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--critical)]/20 text-[var(--critical)]">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>

        {/* Theme Toggle */}
        <div className="px-2 py-2 border-t border-[var(--border-subtle)]">
          <ThemeToggle collapsed={collapsed} />
        </div>

        {/* Last Updated */}
        {!collapsed && lastFetched > 0 && (
          <div className="px-4 py-2 border-t border-[var(--border-subtle)]">
            <p className="text-[10px] text-[var(--text-tertiary)]">Last updated: {formatTimeAgoShort(lastFetched)}</p>
          </div>
        )}

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center py-3 border-t border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-sidebar)]/95 backdrop-blur-xl border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.filter(i => !['nodes', 'alerts'].includes(i.id)).map(item => {
            const isActive = pathname === item.path ||
              (item.path !== '/' && pathname.startsWith(item.path));
            return (
              <button
                key={item.id}
                onClick={() => router.push(item.path)}
                className={`flex flex-col items-center gap-0.5 px-3 py-2.5 min-w-[44px] min-h-[44px] rounded-lg transition-colors ${
                  isActive ? 'text-[var(--accent-blue)]' : 'text-[var(--text-tertiary)]'
                }`}
              >
                {item.icon}
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
