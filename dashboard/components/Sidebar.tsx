'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Wrench,
  Globe,
  Pickaxe,
  Server,
  AlertTriangle,
  Settings,
  ChevronLeft,
  ChevronRight,
  Activity,
  Shield,
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
  { id: 'nodes', label: 'War Room', icon: <Server className="w-5 h-5" />, path: '/fleet', section: 'Operations' },
  { id: 'peers', label: 'Peers', icon: <Globe className="w-5 h-5" />, path: '/peers', section: 'Network' },
  { id: 'masternodes', label: 'Masternodes', icon: <Pickaxe className="w-5 h-5" />, path: '/masternodes', section: 'Network' },
  { id: 'alerts', label: 'Alerts', icon: <AlertTriangle className="w-5 h-5" />, path: '/fleet', section: 'System' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

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
              <h1 className="text-sm font-bold text-[#F9FAFB] whitespace-nowrap">XDCNetOwn</h1>
              <p className="text-[10px] text-[#6B7280] whitespace-nowrap">Network Dashboard</p>
            </div>
          )}
        </div>

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
                          : 'text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-white/5 border border-transparent'
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

        {/* Collapse Toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center py-3 border-t border-white/5 text-[#6B7280] hover:text-[#F9FAFB] transition-colors"
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
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                  isActive ? 'text-[#1E90FF]' : 'text-[#6B7280]'
                }`}
              >
                {item.icon}
                <span className="text-[9px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
