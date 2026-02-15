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
  Bell,
  ServerCog,
  TrendingUp,
  Menu,
  X,
  AlertCircle,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  badge?: string;
  section?: string;
  isPublic?: boolean;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" />, path: '/', section: 'Overview' },
  { id: 'executive', label: 'Executive', icon: <Building2 className="w-5 h-5" />, path: '/executive', section: 'Overview' },
  { id: 'fleet', label: 'Fleet', icon: <Wrench className="w-5 h-5" />, path: '/fleet', section: 'Operations' },
  { id: 'alerts', label: 'Alerts', icon: <Bell className="w-5 h-5" />, path: '/alerts', section: 'Operations' },
  { id: 'issues', label: 'Issues', icon: <AlertCircle className="w-5 h-5" />, path: '/issues', section: 'Operations' },
  { id: 'analytics', label: 'Analytics', icon: <TrendingUp className="w-5 h-5" />, path: '/analytics', section: 'Operations' },
  { id: 'network', label: 'Network Stats', icon: <BarChart3 className="w-5 h-5" />, path: '/network', section: 'Network' },
  { id: 'peers', label: 'Peers', icon: <Globe className="w-5 h-5" />, path: '/peers', section: 'Network' },
  { id: 'masternodes', label: 'Masternodes', icon: <Pickaxe className="w-5 h-5" />, path: '/masternodes', section: 'Network' },
  { id: 'explorer', label: 'Explorer', icon: <Globe className="w-5 h-5" />, path: '/explorer', section: 'Public', isPublic: true },
  { id: 'register', label: 'Register Node', icon: <ServerCog className="w-5 h-5" />, path: '/register', section: 'Public', isPublic: true },
];

interface NetworkStatus {
  bestBlock: number;
  online: boolean;
}

interface NetworkHealth {
  healthScore: number;
  status: 'green' | 'yellow' | 'red';
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
  const [lastFetched, setLastFetched] = useState<number>(0);
  const [openIssueCount, setOpenIssueCount] = useState<number>(0);
  const [networkHealth, setNetworkHealth] = useState<NetworkHealth | null>(null);
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

  const fetchNetworkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/network/health', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const score = data.data?.healthyNodes != null && data.data?.totalNodes
          ? Math.round((data.data.healthyNodes / data.data.totalNodes) * 100)
          : 0;
        const status: 'green' | 'yellow' | 'red' = score >= 75 ? 'green' : score >= 50 ? 'yellow' : 'red';
        setNetworkHealth({ healthScore: score, status });
      }
    } catch {
      // Ignore errors
    }
  }, []);

  const fetchIssueCount = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/issues?status=open&limit=1', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setOpenIssueCount(data.summary?.open || 0);
      }
    } catch {
      // Ignore errors
    }
  }, []);

  useEffect(() => {
    fetchNetworkStatus();
    fetchIssueCount();
    fetchNetworkHealth();
    const interval = setInterval(() => {
      fetchNetworkStatus();
      fetchIssueCount();
      fetchNetworkHealth();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchNetworkStatus, fetchIssueCount, fetchNetworkHealth]);

  // Tick every 10s to update "last updated" display
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const sections = Array.from(new Set(navItems.map(i => i.section)));

  const handleNavClick = (path: string) => {
    router.push(path);
    setMobileOpen(false);
  };

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-[var(--border-subtle)]">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
          <img src="/xdc-logo.png" alt="XDC" width={36} height={36} className="rounded-lg" />
        </div>
        {(!collapsed || isMobile) && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-[var(--text-primary)] whitespace-nowrap">XDC SkyNet</h1>
            <p className="text-[12px] text-[var(--text-tertiary)] whitespace-nowrap">Network Dashboard</p>
          </div>
        )}
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto p-2 hover:bg-[var(--bg-hover)] rounded-lg"
          >
            <X className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        )}
      </div>

      {/* Network Status */}
      {(!collapsed || isMobile) && networkStatus && (
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
          {networkHealth && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className={`w-2 h-2 rounded-full ${
                networkHealth.status === 'green' ? 'bg-[var(--success)]' :
                networkHealth.status === 'yellow' ? 'bg-[var(--warning)]' :
                'bg-[var(--critical)]'
              }`} />
              <span className="text-[12px] text-[var(--text-tertiary)]">
                Health {networkHealth.healthScore}%
              </span>
            </div>
          )}
        </div>
      )}
      {!isMobile && collapsed && networkStatus && (
        <div className="flex justify-center py-2 border-b border-[var(--border-subtle)]">
          <span className={`w-2.5 h-2.5 rounded-full ${networkStatus.online ? 'bg-[var(--success)]' : 'bg-[var(--critical)]'}`} title={`Block #${networkStatus.bestBlock.toLocaleString()}`} />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {sections.map(section => (
          <div key={section} className="mb-3">
            {(!collapsed || isMobile) && (
              <p className="px-3 mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
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
                    onClick={() => handleNavClick(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-all text-left ${
                      isActive
                        ? 'bg-[var(--bg-active)] text-[var(--accent-blue)] border border-[var(--accent-blue)]/20'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] border border-transparent'
                    }`}
                    title={collapsed && !isMobile ? item.label : undefined}
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    {(!collapsed || isMobile) && (
                      <span className="text-sm font-medium truncate">{item.label}</span>
                    )}
                    {(!collapsed || isMobile) && item.badge && (
                      <span className="ml-auto text-[12px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--critical)]/20 text-[var(--critical)]">
                        {item.badge}
                      </span>
                    )}
                    {(!collapsed || isMobile) && item.id === 'issues' && openIssueCount > 0 && (
                      <span className="ml-auto text-[12px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--critical)]/20 text-[var(--critical)]">
                        {openIssueCount > 99 ? '99+' : openIssueCount}
                      </span>
                    )}
                    {(!collapsed || isMobile) && item.isPublic && (
                      <span className="ml-auto text-[12px] px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)]">
                        Public
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
        <ThemeToggle collapsed={collapsed && !isMobile} />
      </div>

      {/* Last Updated */}
      {(!collapsed || isMobile) && lastFetched > 0 && (
        <div className="px-4 py-2 border-t border-[var(--border-subtle)]">
          <p className="text-[12px] text-[var(--text-tertiary)]">Last updated: {formatTimeAgoShort(lastFetched)}</p>
        </div>
      )}

      {/* Collapse Toggle (Desktop Only) */}
      {!isMobile && (
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center py-3 border-t border-[var(--border-subtle)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      )}
    </>
  );

  return (
    <>
      {/* Mobile Header Bar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[var(--bg-sidebar)]/95 backdrop-blur-xl border-b border-[var(--border-subtle)]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 -ml-2 hover:bg-[var(--bg-hover)] rounded-lg"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6 text-[var(--text-secondary)]" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[var(--accent-blue)]/20 to-[var(--success)]/20 flex items-center justify-center border border-[var(--accent-blue)]/30">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="var(--accent-blue)" strokeWidth="2"/>
                  <path d="M8 8L16 16M16 8L8 16" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="text-sm font-bold text-[var(--text-primary)]">SkyNet</span>
            </div>
          </div>
          
          {networkStatus && (
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${networkStatus.online ? 'bg-[var(--success)]' : 'bg-[var(--critical)]'}`} />
              <span className="text-xs text-[var(--text-tertiary)]">#{formatBlock(networkStatus.bestBlock)}</span>
            </div>
          )}
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div 
          className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`lg:hidden fixed left-0 top-0 h-screen z-50 w-[280px] bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)] transform transition-transform duration-300 ease-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <SidebarContent isMobile />
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 top-0 h-screen z-50 transition-all duration-300 ${
          collapsed ? 'w-[68px]' : 'w-[220px]'
        } bg-[var(--bg-sidebar)] border-r border-[var(--border-subtle)]`}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Bottom Spacer (for fixed header) */}
      <div className="lg:hidden h-14" />
    </>
  );
}
