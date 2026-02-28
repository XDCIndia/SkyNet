'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

// ── Canvas ──────────────────────────────────────────────────
function NetworkCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const anim = useRef<number | null>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    let w = (c.width = window.innerWidth), h = (c.height = window.innerHeight);
    const nodes: any[] = Array.from({ length: 28 }, () => ({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25, r: Math.random() * 1.5 + 0.5, ph: Math.random() * Math.PI * 2, hex: Math.random() > 0.7 }));
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      nodes.forEach(n => { n.x += n.vx; n.y += n.vy; if (n.x < 0 || n.x > w) n.vx *= -1; if (n.y < 0 || n.y > h) n.vy *= -1; n.ph += 0.018; });
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, d = Math.sqrt(dx * dx + dy * dy);
        if (d < 160) { ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.strokeStyle = `rgba(0,212,255,${(1 - d / 160) * 0.065})`; ctx.lineWidth = 0.5; ctx.stroke(); }
      }
      nodes.forEach(n => { const p = Math.sin(n.ph) * 0.3 + 0.7; if (n.hex) { ctx.save(); ctx.translate(n.x, n.y); ctx.rotate(Math.PI / 6); const s = 3.5 * p; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = (Math.PI / 3) * k; k === 0 ? ctx.moveTo(Math.cos(a) * s, Math.sin(a) * s) : ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s); } ctx.closePath(); ctx.fillStyle = `rgba(0,212,255,${0.1 * p})`; ctx.fill(); ctx.strokeStyle = `rgba(0,212,255,${0.22 * p})`; ctx.lineWidth = 0.5; ctx.stroke(); ctx.restore(); } else { ctx.beginPath(); ctx.arc(n.x, n.y, n.r * p, 0, Math.PI * 2); ctx.fillStyle = `rgba(0,212,255,${0.09 * p})`; ctx.fill(); } });
      anim.current = requestAnimationFrame(draw);
    };
    draw();
    const resize = () => { w = c.width = window.innerWidth; h = c.height = window.innerHeight; };
    window.addEventListener('resize', resize);
    return () => { if (anim.current) cancelAnimationFrame(anim.current); window.removeEventListener('resize', resize); };
  }, []);
  return <canvas ref={ref} style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />;
}

// ── Nav Item ─────────────────────────────────────────────────
function NavItem({ icon, label, active, badge, href, onClick }: { icon: string; label: string; active?: boolean; badge?: number | string; href: string; onClick?: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <a href={href} onClick={onClick} style={{ textDecoration: 'none' }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 12, background: active ? 'rgba(0,212,255,0.08)' : hov ? 'rgba(255,255,255,0.04)' : 'transparent', cursor: 'pointer', transition: 'all 0.2s', position: 'relative' }}>
        {active && <div style={{ position: 'absolute', left: -1, top: '25%', bottom: '25%', width: 2, background: 'rgba(0,212,255,0.8)', borderRadius: 1, boxShadow: '0 0 6px rgba(0,212,255,0.4)' }} />}
        <span style={{ fontSize: 13, opacity: active ? 0.9 : 0.35, filter: active ? 'drop-shadow(0 0 3px rgba(0,212,255,0.3))' : 'none' }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'rgba(0,212,255,0.9)' : hov ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.4)', flex: 1 }}>{label}</span>
        {badge !== undefined && <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: 'rgba(255,69,58,0.15)', color: '#FF453A', border: '1px solid rgba(255,69,58,0.2)' }}>{badge}</span>}
      </div>
    </a>
  );
}

// ── Sidebar Shell ────────────────────────────────────────────
function SidebarNav({ pathname, time, onClose }: { pathname: string; time: Date; onClose?: () => void }) {
  const items = [
    { section: 'OVERVIEW', items: [
      { icon: '◉', label: 'Dashboard', href: '/v2' },
      { icon: '◎', label: 'Classic View', href: '/' },
    ]},
    { section: 'OPERATIONS', items: [
      { icon: '⬡', label: 'Nodes', href: '/v2/nodes' },
      { icon: '⊞', label: 'Fleet', href: '/v2/fleet' },
      { icon: '⚡', label: 'Alerts', href: '/v2/alerts' },
      { icon: '⚠', label: 'Issues', href: '/v2/issues', badge: 21 },
      { icon: '◧', label: 'Analytics', href: '/v2/analytics' },
    ]},
    { section: 'NETWORK', items: [
      { icon: '◈', label: 'Network Stats', href: '/v2/network' },
      { icon: '⊛', label: 'Peers', href: '/v2/peers' },
      { icon: '◆', label: 'Masternodes', href: '/v2/masternodes' },
    ]},
  ];

  return (
    <>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 14px 22px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: 18 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, overflow: 'hidden', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <img src="/xdc-logo.png" alt="XDC" width={28} height={28} style={{ objectFit: 'contain' }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.03em', color: 'white' }}>SkyNet</div>
          <div style={{ fontSize: 8, color: 'rgba(0,212,255,0.5)', letterSpacing: '0.1em', fontWeight: 600 }}>XDC NETWORK MONITOR</div>
        </div>
      </div>

      {/* Nav */}
      {items.map(group => (
        <div key={group.section}>
          <div style={{ fontSize: 8, fontWeight: 600, color: 'rgba(255,255,255,0.2)', padding: '6px 14px 4px', letterSpacing: '0.12em' }}>{group.section}</div>
          {group.items.map(item => (
            <NavItem key={item.href} {...item} active={pathname === item.href || (item.href !== '/v2' && pathname.startsWith(item.href))} onClick={onClose} />
          ))}
          <div style={{ height: 10 }} />
        </div>
      ))}

      <div style={{ flex: 1 }} />
      <div style={{ padding: '12px 14px 0', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 8 }}>
        <div style={{ fontSize: 9, color: 'rgba(0,212,255,0.4)', fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>{time.toLocaleTimeString()} IST</div>
        <NavItem icon="⊕" label="Explorer" href="/v2/explorer" onClick={onClose} />
        <NavItem icon="◱" label="Register Node" href="/v2/register" onClick={onClose} />
      </div>
    </>
  );
}

// ── V2 Shell Layout ──────────────────────────────────────────
export default function V2Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  const [pathname, setPathname] = useState('/v2');

  useEffect(() => {
    setPathname(window.location.pathname);
  }, []);
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!sidebarOpen) return;
    const h = (e: MouseEvent) => { const t = e.target as HTMLElement; if (!t.closest('.v2-sidebar-panel') && !t.closest('.v2-hamburger')) setSidebarOpen(false); };
    document.addEventListener('click', h); return () => document.removeEventListener('click', h);
  }, [sidebarOpen]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        @keyframes glassIn { from{opacity:0;transform:translateY(12px) scale(0.98)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.2)} }
        @keyframes barGrow { from{transform:scaleX(0)} to{transform:scaleX(1)} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes drawLine { to{stroke-dashoffset:0} }
        @keyframes fadeSliceIn { from{opacity:0} to{opacity:1} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes slideInLeft { from{transform:translateX(-100%)} to{transform:translateX(0)} }
        @keyframes sidebarIn { from{opacity:0;transform:translateX(-12px)} to{opacity:1;transform:translateX(0)} }
        @keyframes chainSlide { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
        @keyframes dataFlow { 0%{transform:translateX(0);opacity:0} 50%{opacity:1} 100%{transform:translateX(10px);opacity:0} }
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(0,212,255,0.12);border-radius:2px}

        .v2-shell { display:flex; height:100dvh; overflow:hidden; position:relative; font-family:'Outfit',-apple-system,sans-serif; color:white; background:radial-gradient(ellipse at 20% 0%,rgba(0,30,60,0.4) 0%,transparent 50%),radial-gradient(ellipse at 80% 100%,rgba(0,20,40,0.3) 0%,transparent 50%),#06080C; }
        .v2-sidebar { width:226px; flex-shrink:0; border-right:1px solid rgba(255,255,255,0.05); padding:20px 10px; display:flex; flex-direction:column; gap:1px; background:rgba(6,8,12,0.88); backdrop-filter:blur(60px); -webkit-backdrop-filter:blur(60px); z-index:20; animation:sidebarIn 0.5s ease; overflow-y:auto; }
        .v2-topbar { display:none; }
        .v2-content { flex:1; overflow-y:auto; overflow-x:hidden; z-index:10; position:relative; }
        .v2-inner { padding:28px 32px; max-width:1600px; }

        /* GlassCard */
        .glass-card { background:rgba(255,255,255,0.025); backdrop-filter:blur(40px) saturate(150%); -webkit-backdrop-filter:blur(40px) saturate(150%); border:1px solid rgba(255,255,255,0.06); border-radius:20px; transition:all 0.45s cubic-bezier(0.16,1,0.3,1); opacity:0; animation:glassIn 0.8s cubic-bezier(0.16,1,0.3,1) forwards; position:relative; overflow:hidden; }
        .glass-card::before { content:''; position:absolute; top:0; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent); }
        .glass-card:hover { background:rgba(255,255,255,0.055); border-color:rgba(255,255,255,0.11); transform:translateY(-2px) scale(1.003); box-shadow:0 20px 60px rgba(0,0,0,0.35); }

        /* Stat badge */
        .status-healthy { color:#30D158; } .status-syncing { color:#0AD4FF; } .status-degraded { color:#FF9F0A; } .status-offline { color:#FF453A; }
        .badge { font-size:8px; font-weight:700; padding:3px 9px; border-radius:7px; text-transform:uppercase; letter-spacing:.08em; }

        /* Grid layouts */
        .v2-grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
        .v2-grid-2 { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; }
        .v2-grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
        .v2-nodes-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:13px; }

        /* Drawer */
        .v2-drawer-backdrop { position:fixed; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); z-index:48; }
        .v2-sidebar-panel { position:fixed; top:0; left:0; bottom:0; width:250px; max-width:82vw; background:rgba(6,8,12,0.97); border-right:1px solid rgba(255,255,255,0.08); padding:20px 10px; display:flex; flex-direction:column; gap:1px; overflow-y:auto; z-index:49; animation:slideInLeft 0.22s ease; }

        /* Mobile */
        @media(max-width:640px){
          .v2-sidebar{display:none}
          .v2-topbar{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);background:rgba(6,8,12,0.92);backdrop-filter:blur(20px);z-index:15;position:sticky;top:0;flex-shrink:0}
          .v2-shell{flex-direction:column}
          .v2-inner{padding:14px 12px 40px}
          .v2-grid-3{grid-template-columns:1fr}
          .v2-grid-2{grid-template-columns:1fr}
          .v2-grid-4{grid-template-columns:repeat(2,1fr)}
          .v2-nodes-grid{grid-template-columns:1fr}
        }
        @media(max-width:900px) and (min-width:641px){
          .v2-grid-3{grid-template-columns:repeat(2,1fr)}
          .v2-grid-4{grid-template-columns:repeat(2,1fr)}
        }
        @media(max-width:380px){
          .v2-inner{padding:10px 8px 40px}
          .v2-grid-4{grid-template-columns:1fr}
        }
      `}</style>

      <div className="v2-shell">
        <NetworkCanvas />

        {/* Desktop Sidebar */}
        <nav className="v2-sidebar">
          <SidebarNav pathname={pathname} time={time} />
        </nav>

        {/* Mobile Drawer */}
        {sidebarOpen && (
          <>
            <div className="v2-drawer-backdrop" onClick={() => setSidebarOpen(false)} />
            <nav className="v2-sidebar-panel">
              <SidebarNav pathname={pathname} time={time} onClose={() => setSidebarOpen(false)} />
            </nav>
          </>
        )}

        {/* Mobile Topbar */}
        <header className="v2-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="v2-hamburger" onClick={() => setSidebarOpen(true)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 9px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3.5 }}>
              {[0, 1, 2].map(i => <div key={i} style={{ width: 17, height: 1.5, background: 'rgba(255,255,255,0.6)', borderRadius: 1 }} />)}
            </button>
            <img src="/xdc-logo.png" alt="XDC" width={24} height={24} style={{ borderRadius: 6 }} />
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.03em' }}>SkyNet</span>
            <span style={{ fontSize: 8, color: 'rgba(0,212,255,0.55)', letterSpacing: '0.08em', fontWeight: 600 }}>v2</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 14, background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.12)' }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#0AD4FF', animation: 'pulse 2s ease infinite' }} />
            <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(0,212,255,0.7)', letterSpacing: '.06em' }}>LIVE</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="v2-content">
          <div className="v2-inner">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
