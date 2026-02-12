'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Wrench,
  Globe,
  Pickaxe,
  ChevronLeft,
  ChevronRight,
  BarChart3,
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
        } bg-[#0D1117] border-r border-white/5`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-white/5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#1E90FF]/20 to-[#10B981]/20 flex items-center justify-center border border-[#1E90FF]/30 flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#1E90FF" strokeWidth="2"/>
              <path d="M8 8L16 16M16 8L8 16" stroke="#1E90FF" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold text-[#F1F5F9] whitespace-nowrap">XDCNetOwn</h1>
              <p className="text-[10px] text-[#64748B] whitespace-nowrap">Network Dashboard</p>
            </div>
          )}
        </div>

        {/* Network Status */}
        {!collapsed && networkStatus && (
          <div className="px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2 text-xs">
              <span className={`w-2 h-2 rounded-full ${networkStatus.online ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`} />
              <span className="text-[#94A3B8]">XDC Mainnet</span>
            </div>
            <div className="text-xs text-[#64748B] mt-1">
              Block #{formatBlock(networkStatus.bestBlock)}
              <span className="mx-1">•</span>
              <span className={networkStatus.online ? 'text-[#10B981]' : 'text-[#EF4444]'}>
                {networkStatus.online ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        )}
        {collapsed && networkStatus && (
          <div className="flex justify-center py-2 border-b border-white/5">
            <span className={`w-2.5 h-2.5 rounded-full ${networkStatus.online ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`} title={`Block #${networkStatus.bestBlock.toLocaleString()}`} />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {sections.map(section => (
            <div key={section} className="mb-3">
              {!collapsed && (
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#4B5563]">
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
                          ? 'bg-[#1E90FF]/10 text-[#1E90FF] border border-[#1E90FF]/20'
                          : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 border border-transparent'
                      }`}
                      title={collapsed ? item.label : undefined}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      {!collapsed && (
                        <span className="text-sm font-medium truncate">{item.label}</span>
                      )}
                      {!collapsed && item.badge && (
                        <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#EF4444]/20 text-[#EF4444]">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          ))}
        </nav>

        {/* Last Updated */}
        {!collapsed && lastFetched > 0 && (
          <div className="px-4 py-2 border-t border-white/5">
            <p className="text-[10px] text-[#64748B]">Last updated: {formatTimeAgoShort(lastFetched)}</p>
          </div>
        )}

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center py-3 border-t border-white/5 text-[#64748B] hover:text-[#F1F5F9] transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0D1117]/95 backdrop-blur-xl border-t border-white/10">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.filter(i => !['nodes', 'alerts'].includes(i.id)).map(item => {
            const isActive = pathname === item.path ||
              (item.path !== '/' && pathname.startsWith(item.path));
            return (
              <button
                key={item.id}
                onClick={() => router.push(item.path)}
                className={`flex flex-col items-center gap-0.5 px-3 py-2.5 min-w-[44px] min-h-[44px] rounded-lg transition-colors ${
                  isActive ? 'text-[#1E90FF]' : 'text-[#64748B]'
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
