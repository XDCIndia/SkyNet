'use client';

import { useState, useEffect, useRef, useCallback } from "react";

interface NodeData {
  id: string; name: string; host: string; clientType: string; nodeType: string;
  status: string; blockHeight: number; peakBlock?: number; fleetMaxBlock?: number;
  syncPercent: number; peerCount: number; cpuPercent: number; memoryPercent: number;
  diskPercent: number; clientVersion?: string; os_info?: { type?: string; release?: string };
  lastSeen: string; network?: string;
}
interface FleetData { healthScore: number; totalNodes: number; nodes: NodeData[]; }

// ── Canvas Background ────────────────────────────────────────
function NetworkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const NODES = 30, CONNECTION_DIST = 160;
    const nodes: any[] = Array.from({ length: NODES }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 1.5 + 0.5, pulsePhase: Math.random() * Math.PI * 2,
      isBlock: Math.random() > 0.7,
    }));
    let blockPulse = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h); blockPulse += 0.008;
      nodes.forEach(n => { n.x += n.vx; n.y += n.vy; if (n.x < 0 || n.x > w) n.vx *= -1; if (n.y < 0 || n.y > h) n.vy *= -1; n.pulsePhase += 0.02; });
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECTION_DIST) { ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); ctx.strokeStyle = `rgba(0,212,255,${(1 - dist / CONNECTION_DIST) * 0.07})`; ctx.lineWidth = 0.5; ctx.stroke(); }
      }
      nodes.forEach(n => { const pulse = Math.sin(n.pulsePhase) * 0.3 + 0.7; if (n.isBlock) { ctx.save(); ctx.translate(n.x, n.y); ctx.rotate(Math.PI / 6); const s = 4 * pulse; ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = (Math.PI / 3) * k; k === 0 ? ctx.moveTo(Math.cos(a) * s, Math.sin(a) * s) : ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s); } ctx.closePath(); ctx.fillStyle = `rgba(0,212,255,${0.12 * pulse})`; ctx.fill(); ctx.strokeStyle = `rgba(0,212,255,${0.25 * pulse})`; ctx.lineWidth = 0.5; ctx.stroke(); ctx.restore(); } else { ctx.beginPath(); ctx.arc(n.x, n.y, n.radius * pulse, 0, Math.PI * 2); ctx.fillStyle = `rgba(0,212,255,${0.1 * pulse})`; ctx.fill(); } });
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    const resize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    window.addEventListener("resize", resize);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); window.removeEventListener("resize", resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 0 }} />;
}

// ── ChainBlocks ──────────────────────────────────────────────
function ChainBlocks() {
  return (
    <div style={{ display: "flex", alignItems: "center", overflow: "hidden" }}>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", opacity: 0, animation: `chainSlide 0.4s ease ${i * 0.08}s forwards` }}>
          <div style={{ width: 24, height: 24, borderRadius: 5, background: i === 4 ? "linear-gradient(135deg,rgba(0,212,255,0.25),rgba(0,212,255,0.08))" : "rgba(255,255,255,0.04)", border: `1px solid ${i === 4 ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.06)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, color: i === 4 ? "rgba(0,212,255,0.9)" : "rgba(255,255,255,0.2)", fontFamily: "'JetBrains Mono',monospace" }}>
            {i === 4 ? "◆" : "▪"}
          </div>
          {i < 4 && <div style={{ width: 12, height: 1, background: "rgba(0,212,255,0.12)" }} />}
        </div>
      ))}
    </div>
  );
}

// ── GlassCard ────────────────────────────────────────────────
function GlassCard({ children, style = {}, delay = 0, glowColor = null }: any) {
  const [hovered, setHovered] = useState(false);
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} style={{ background: hovered ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.025)", backdropFilter: "blur(40px) saturate(150%)", WebkitBackdropFilter: "blur(40px) saturate(150%)", border: `1px solid ${hovered ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`, borderRadius: 20, transition: "all 0.5s cubic-bezier(0.16,1,0.3,1)", transform: hovered ? "translateY(-2px) scale(1.004)" : "none", boxShadow: hovered ? `0 20px 60px rgba(0,0,0,0.4)${glowColor ? `,0 0 40px ${glowColor}15` : ""}` : "0 4px 24px rgba(0,0,0,0.1)", opacity: 0, animation: `glassIn 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}s forwards`, position: "relative", overflow: "hidden", ...style }}>
      <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)" }} />
      {children}
    </div>
  );
}

// ── DonutChart ───────────────────────────────────────────────
function DonutChart({ data, size = 130 }: { data: { name: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const sw = 14, r = (size - sw) / 2, circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>{data.map((d, i) => <linearGradient key={i} id={`dg${i}`} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={d.color} /><stop offset="100%" stopColor={d.color} stopOpacity="0.6" /></linearGradient>)}<filter id="dglow"><feGaussianBlur stdDeviation="2" result="cb" /><feMerge><feMergeNode in="cb" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={sw} />
      {data.map((d, i) => { const pct = total > 0 ? d.value / total : 0; const adj = Math.max(pct - 0.01, 0.001); const da = `${circ * adj} ${circ * (1 - adj)}`; const off = -offset * circ; offset += pct; return <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#dg${i})`} strokeWidth={sw} strokeDasharray={da} strokeDashoffset={off} strokeLinecap="round" filter="url(#dglow)" transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ opacity: 0, animation: `fadeSliceIn 1s ease ${0.5 + i * 0.15}s forwards` }} />; })}
      <text x={size / 2} y={size / 2 - 5} textAnchor="middle" fill="white" fontSize="24" fontWeight="700" fontFamily="'Outfit',sans-serif" letterSpacing="-0.04em">{total}</text>
      <text x={size / 2} y={size / 2 + 11} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="8" fontWeight="600" letterSpacing="0.12em" fontFamily="'Outfit',sans-serif">NODES</text>
    </svg>
  );
}

// ── Sparkline ────────────────────────────────────────────────
function Sparkline({ data, color, w = 90, h = 26 }: { data: number[]; color: string; w?: number; h?: number }) {
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
  const id = `sp${color.replace(/[^a-z0-9]/gi, "")}`;
  const lastY = parseFloat(pts.split(" ").pop()!.split(",")[1]);
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.18" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <polygon points={`${pts} ${w},${h} 0,${h}`} fill={`url(#${id})`} style={{ opacity: 0, animation: "fadeIn 1s ease 0.8s forwards" }} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 400, strokeDashoffset: 400, animation: "drawLine 2s ease 0.5s forwards" }} />
      <circle cx={w} cy={lastY} r="2.5" fill={color} style={{ opacity: 0, animation: "fadeIn 0.5s ease 2s forwards", filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}

// ── ResourceBar ──────────────────────────────────────────────
function ResourceBar({ value, color, icon }: { value: number; color: string; icon: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", width: 16, textAlign: "center" }}>{icon}</span>
      <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${value}%`, borderRadius: 2, background: `linear-gradient(90deg,${color},${color}88)`, animation: "barGrow 1.2s cubic-bezier(0.16,1,0.3,1) forwards", transformOrigin: "left", boxShadow: value > 80 ? `0 0 8px ${color}40` : "none" }} />
      </div>
      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", width: 26, textAlign: "right", fontVariantNumeric: "tabular-nums", fontFamily: "'JetBrains Mono',monospace" }}>{value}%</span>
    </div>
  );
}

// ── NodeCard ─────────────────────────────────────────────────
function NodeCard({ node, index }: { node: NodeData; index: number }) {
  const sc = node.status === "healthy" ? "#30D158" : node.status === "syncing" ? "#0AD4FF" : node.status === "degraded" ? "#FF9F0A" : "#FF453A";
  const clientLabel = (node.clientType || "unknown").charAt(0).toUpperCase() + (node.clientType || "unknown").slice(1);
  const osLabel = node.os_info?.release ? node.os_info.release.replace(/\s+LTS/, "").split(" ").slice(0, 2).join(" ") : node.os_info?.type || "Linux";
  const lastUpdate = (() => { if (!node.lastSeen) return "—"; const d = Date.now() - new Date(node.lastSeen).getTime(); return d < 60000 ? `${Math.floor(d / 1000)}s ago` : d < 3600000 ? `${Math.floor(d / 60000)}m ago` : `${Math.floor(d / 3600000)}h ago`; })();
  const spark = [0, 0, 0, node.syncPercent * 0.5, node.syncPercent * 0.7, node.syncPercent, node.syncPercent, node.syncPercent, node.syncPercent, node.syncPercent].map(v => v + Math.random() * 0.3);
  const cpu = Math.round(node.cpuPercent || 0), mem = Math.round(node.memoryPercent || 0), disk = Math.round(node.diskPercent || 0);
  const peak = node.peakBlock || node.fleetMaxBlock || 0;
  return (
    <GlassCard delay={0.1 + index * 0.06} glowColor={sc} style={{ padding: 0 }}>
      <div style={{ height: 2, background: `linear-gradient(90deg,transparent,${sc}60,transparent)`, borderRadius: "20px 20px 0 0" }} />
      <div style={{ padding: "18px 20px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: sc, boxShadow: `0 0 8px ${sc}60`, flexShrink: 0, animation: "pulse 3s ease infinite" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "white", letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</span>
            </div>
            <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: "rgba(0,212,255,0.5)", background: "rgba(0,212,255,0.06)", padding: "2px 7px", borderRadius: 3, border: "1px solid rgba(0,212,255,0.08)" }}>{node.host}</span>
          </div>
          <div style={{ fontSize: 8, fontWeight: 700, padding: "3px 9px", borderRadius: 7, background: `${sc}12`, color: sc, letterSpacing: "0.08em", textTransform: "uppercase", border: `1px solid ${sc}20`, flexShrink: 0, marginLeft: 8 }}>{node.status}</div>
        </div>

        <div style={{ display: "flex", gap: 5, marginBottom: 14, flexWrap: "wrap" }}>
          {[clientLabel, node.nodeType || "fullnode"].map((tag, i) => (
            <span key={i} style={{ fontSize: 9, fontWeight: 500, padding: "2px 9px", borderRadius: 5, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.05)" }}>{tag}</span>
          ))}
        </div>

        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 14, padding: "13px 15px", marginBottom: 12, border: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>BLOCK HEIGHT</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "white", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em", fontFamily: "'Outfit',sans-serif" }}>{node.blockHeight.toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>SYNC</span>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 50, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.max(node.syncPercent, 2)}%`, borderRadius: 2, background: `linear-gradient(90deg,${sc},${sc}aa)`, boxShadow: `0 0 8px ${sc}40`, animation: "barGrow 1.5s ease forwards", transformOrigin: "left" }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: sc, fontVariantNumeric: "tabular-nums", fontFamily: "'JetBrains Mono',monospace" }}>{node.syncPercent.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 13 }}>
          <div style={{ display: "flex", gap: 16 }}>
            <div><div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", marginBottom: 2, letterSpacing: "0.08em", fontWeight: 600 }}>PEERS</div><div style={{ fontSize: 15, fontWeight: 700, color: "white" }}>{node.peerCount}</div></div>
            <div><div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", marginBottom: 2, letterSpacing: "0.08em", fontWeight: 600 }}>PEAK</div><div style={{ fontSize: 15, fontWeight: 700, color: "white" }}>{peak.toLocaleString()}</div></div>
          </div>
          <Sparkline data={spark} color={sc} />
        </div>

        <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)", margin: "0 0 12px" }} />
        <ResourceBar value={cpu} color={cpu > 90 ? "#FF453A" : cpu > 70 ? "#FF9F0A" : "#30D158"} icon="⬜" />
        <ResourceBar value={mem} color={mem > 90 ? "#FF453A" : mem > 70 ? "#FF9F0A" : "#0A84FF"} icon="◻" />
        <ResourceBar value={disk} color={disk > 90 ? "#FF453A" : disk > 70 ? "#FF9F0A" : "#30D158"} icon="▪" />

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "'JetBrains Mono',monospace" }}>{osLabel}</span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>{lastUpdate}</span>
        </div>
      </div>
    </GlassCard>
  );
}

// ── NavItem ──────────────────────────────────────────────────
function NavItem({ icon, label, active, badge, href, onClick }: any) {
  const [hov, setHov] = useState(false);
  return (
    <a href={href || "#"} onClick={onClick} style={{ textDecoration: "none" }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderRadius: 12, background: active ? "rgba(0,212,255,0.08)" : hov ? "rgba(255,255,255,0.04)" : "transparent", cursor: "pointer", transition: "all 0.2s", position: "relative" }}>
        {active && <div style={{ position: "absolute", left: -1, top: "25%", bottom: "25%", width: 2, background: "rgba(0,212,255,0.8)", borderRadius: 1 }} />}
        <span style={{ fontSize: 14, opacity: active ? 0.9 : 0.35 }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? "rgba(0,212,255,0.9)" : hov ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.4)" }}>{label}</span>
        {badge && <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "rgba(255,69,58,0.15)", color: "#FF453A", border: "1px solid rgba(255,69,58,0.2)" }}>{badge}</span>}
      </div>
    </a>
  );
}

// ── HexIndicator ─────────────────────────────────────────────
function HexIndicator({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="hex-item">
      <svg width="32" height="32" viewBox="0 0 36 36">
        <polygon points="18,2 32,10 32,26 18,34 4,26 4,10" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
        <polygon points="18,2 32,10 32,26 18,34 4,26 4,10" fill={`${color}08`} stroke={color} strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray={`${pct * 1.2} 200`} style={{ filter: `drop-shadow(0 0 4px ${color}40)` }} />
        <text x="18" y="20" textAnchor="middle" fill={value > 0 ? color : "rgba(255,255,255,0.2)"} fontSize="11" fontWeight="700" fontFamily="'Outfit',sans-serif">{value}</text>
      </svg>
      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 500, letterSpacing: "0.02em", textAlign: "center" as const }}>{label}</span>
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────
export default function SkyNetV2Dashboard() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [time, setTime] = useState(new Date());
  const [fleet, setFleet] = useState<FleetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const fetchFleet = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/fleet/status', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) { setFleet(json.data); setLastRefresh(Date.now()); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFleet(); const t = setInterval(fetchFleet, 15000); return () => clearInterval(t); }, [fetchFleet]);
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);
  // Close sidebar on outside click
  useEffect(() => {
    if (!sidebarOpen) return;
    const handler = (e: MouseEvent) => { const target = e.target as HTMLElement; if (!target.closest('.v2-sidebar') && !target.closest('.v2-hamburger')) setSidebarOpen(false); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [sidebarOpen]);

  const nodes: NodeData[] = fleet?.nodes || [];
  const total = nodes.length;
  const healthy = nodes.filter(n => n.status === 'healthy').length;
  const syncing = nodes.filter(n => n.status === 'syncing').length;
  const offline = nodes.filter(n => n.status === 'offline').length;
  const totalPeers = nodes.reduce((s, n) => s + (n.peerCount || 0), 0);
  const avgSync = total > 0 ? nodes.reduce((s, n) => s + (n.syncPercent || 0), 0) / total : 0;

  const CLIENT_COLORS: Record<string, string> = { geth: "#0A84FF", erigon: "#FF9F0A", nethermind: "#BF5AF2", reth: "#30D158", xdc: "#0AD4FF", unknown: "rgba(255,255,255,0.25)" };
  const clientCounts: Record<string, number> = {};
  nodes.forEach(n => { const ct = n.clientType || 'unknown'; clientCounts[ct] = (clientCounts[ct] || 0) + 1; });
  const clientData = Object.entries(clientCounts).filter(([, v]) => v > 0).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value, color: CLIENT_COLORS[name] || "#64D2FF" }));

  const osCounts: Record<string, number> = {};
  nodes.forEach(n => { const os = n.os_info?.release?.includes('Ubuntu') ? 'Ubuntu' : n.os_info?.release?.includes('Alpine') ? 'Alpine' : n.os_info?.type || 'Linux'; osCounts[os] = (osCounts[os] || 0) + 1; });
  const osData = Object.entries(osCounts).map(([name, value]) => ({ name, value, color: name === 'Ubuntu' ? "#0AD4FF" : "#30D158" }));

  const mainnetNodes = nodes.filter(n => n.network === 'mainnet' || !n.network);
  const mainnetTip = mainnetNodes.reduce((m, n) => Math.max(m, n.fleetMaxBlock || n.blockHeight || 0), 0);
  const apothemTip = nodes.filter(n => n.network === 'apothem').reduce((m, n) => Math.max(m, n.blockHeight || 0), 0);
  const mainnetSyncAvg = mainnetNodes.length > 0 ? mainnetNodes.reduce((s, n) => s + (n.syncPercent || 0), 0) / mainnetNodes.length : 0;

  const filteredNodes = nodes.filter(n => activeFilter === 'all' || n.status === activeFilter);
  const secondsAgo = Math.floor((Date.now() - lastRefresh) / 1000);

  const SidebarContent = () => (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 14px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: 20 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,rgba(0,212,255,0.2),rgba(0,212,255,0.05))", border: "1px solid rgba(0,212,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="16" viewBox="0 0 18 18"><polygon points="9,1 16,5 16,13 9,17 2,13 2,5" fill="none" stroke="rgba(0,212,255,0.8)" strokeWidth="1.5" /><circle cx="9" cy="9" r="2" fill="rgba(0,212,255,0.6)" /></svg>
        </div>
        <div><div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.03em" }}>SkyNet</div><div style={{ fontSize: 8, color: "rgba(0,212,255,0.5)", letterSpacing: "0.1em", fontWeight: 600 }}>NETWORK MONITOR</div></div>
      </div>
      <div style={{ fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.2)", padding: "6px 14px 4px", letterSpacing: "0.12em" }}>OVERVIEW</div>
      <NavItem icon="◉" label="Dashboard v2" active href="/v2" onClick={() => setSidebarOpen(false)} />
      <NavItem icon="◎" label="Classic View" href="/" onClick={() => setSidebarOpen(false)} />
      <div style={{ fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.2)", padding: "16px 14px 4px", letterSpacing: "0.12em" }}>OPERATIONS</div>
      <NavItem icon="⬡" label="Nodes" href="/nodes" onClick={() => setSidebarOpen(false)} />
      <NavItem icon="⊞" label="Fleet" href="/fleet" onClick={() => setSidebarOpen(false)} />
      <NavItem icon="⚡" label="Alerts" href="/alerts" onClick={() => setSidebarOpen(false)} />
      <NavItem icon="⚠" label="Issues" badge={21} href="/issues" onClick={() => setSidebarOpen(false)} />
      <NavItem icon="◧" label="Analytics" href="/analytics" onClick={() => setSidebarOpen(false)} />
      <div style={{ fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.2)", padding: "16px 14px 4px", letterSpacing: "0.12em" }}>NETWORK</div>
      <NavItem icon="◈" label="Network Stats" href="/network" onClick={() => setSidebarOpen(false)} />
      <NavItem icon="⊛" label="Peers" href="/peers" onClick={() => setSidebarOpen(false)} />
      <NavItem icon="◆" label="Masternodes" href="/masternodes" onClick={() => setSidebarOpen(false)} />
      <div style={{ flex: 1 }} />
      <div style={{ padding: "14px 14px 0", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 12 }}>
        <div style={{ fontSize: 9, color: "rgba(0,212,255,0.4)", fontFamily: "'JetBrains Mono',monospace", marginBottom: 6 }}>{time.toLocaleTimeString()} IST</div>
        <NavItem icon="⊕" label="Explorer" href="/explorer" onClick={() => setSidebarOpen(false)} />
        <NavItem icon="◱" label="Register Node" href="/register" onClick={() => setSidebarOpen(false)} />
      </div>
    </>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes fadeSliceIn { from { opacity:0 } to { opacity:1 } }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes drawLine { to { stroke-dashoffset:0 } }
        @keyframes barGrow { from { transform:scaleX(0) } to { transform:scaleX(1) } }
        @keyframes glassIn { from { opacity:0; transform:translateY(14px) scale(0.98) } to { opacity:1; transform:translateY(0) scale(1) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse { 0%,100% { opacity:0.6; transform:scale(1) } 50% { opacity:1; transform:scale(1.2) } }
        @keyframes chainSlide { from { opacity:0; transform:translateX(-8px) } to { opacity:1; transform:translateX(0) } }
        @keyframes sidebarIn { from { opacity:0; transform:translateX(-16px) } to { opacity:1; transform:translateX(0) } }
        @keyframes slideInLeft { from { transform:translateX(-100%) } to { transform:translateX(0) } }
        @keyframes spin { to { transform:rotate(360deg) } }
        ::-webkit-scrollbar { width:4px } ::-webkit-scrollbar-track { background:transparent } ::-webkit-scrollbar-thumb { background:rgba(0,212,255,0.15); border-radius:2px }

        .v2-layout { display:flex; height:100dvh; overflow:hidden; position:relative; }
        
        /* Sidebar desktop */
        .v2-sidebar { width:230px; flex-shrink:0; border-right:1px solid rgba(255,255,255,0.05); padding:22px 12px; display:flex; flex-direction:column; gap:2px; background:rgba(6,8,12,0.88); backdrop-filter:blur(60px); -webkit-backdrop-filter:blur(60px); z-index:20; animation:sidebarIn 0.6s ease; overflow-y:auto; }
        
        /* Mobile sidebar drawer */
        .v2-sidebar-drawer { position:fixed; inset:0; z-index:50; display:flex; }
        .v2-sidebar-backdrop { position:absolute; inset:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(4px); }
        .v2-sidebar-panel { position:relative; width:260px; max-width:80vw; height:100%; background:rgba(6,8,12,0.97); border-right:1px solid rgba(255,255,255,0.08); display:flex; flex-direction:column; gap:2px; padding:22px 12px; overflow-y:auto; animation:slideInLeft 0.25s ease; }

        .v2-topbar { display:none; }
        .v2-main { flex:1; overflow-y:auto; overflow-x:hidden; padding:28px 32px; z-index:10; position:relative; }
        
        .v2-page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; opacity:0; animation:fadeUp 0.8s ease 0.1s forwards; }
        .v2-header-right { display:flex; align-items:center; gap:14px; }

        .v2-hex-row { display:flex; gap:8px; margin-bottom:24px; opacity:0; animation:fadeUp 0.7s ease 0.2s forwards; }
        .hex-item { display:flex; flex-direction:column; align-items:center; gap:7px; padding:16px 12px; background:rgba(255,255,255,0.02); border-radius:14px; border:1px solid rgba(255,255,255,0.04); min-width:72px; flex:1; }
        .v2-avg-sync { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; padding:13px 16px; background:rgba(255,159,10,0.04); border-radius:14px; border:1px solid rgba(255,159,10,0.1); min-width:80px; flex:1; }

        .v2-charts { display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; margin-bottom:24px; }
        .v2-tips { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:24px; opacity:0; animation:fadeUp 0.7s ease 0.45s forwards; }
        .v2-nodes-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(300px,1fr)); gap:14px; }

        /* Tablet: 768px */
        @media (max-width: 900px) {
          .v2-charts { grid-template-columns:1fr 1fr; }
        }

        /* Mobile: 640px */
        @media (max-width: 640px) {
          .v2-sidebar { display:none; }
          .v2-topbar { display:flex; align-items:center; justify-content:space-between; padding:14px 16px 12px; border-bottom:1px solid rgba(255,255,255,0.06); background:rgba(6,8,12,0.9); backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); z-index:15; position:sticky; top:0; flex-shrink:0; }
          .v2-layout { flex-direction:column; }
          .v2-main { padding:16px 14px 40px; }
          .v2-page-header { flex-direction:column; gap:14px; margin-bottom:20px; }
          .v2-header-right { width:100%; justify-content:space-between; }
          .v2-hex-row { flex-wrap:wrap; gap:6px; }
          .hex-item { min-width: calc(33.33% - 4px); flex: none; padding:12px 8px; }
          .v2-avg-sync { min-width: calc(50% - 3px); flex: none; }
          .v2-charts { grid-template-columns:1fr; gap:10px; }
          .v2-tips { grid-template-columns:1fr; gap:8px; }
          .v2-nodes-grid { grid-template-columns:1fr; gap:10px; }
          h1.v2-title { font-size:24px !important; }
        }

        /* Very small: 380px */
        @media (max-width: 380px) {
          .hex-item { min-width: calc(50% - 3px); }
          .v2-main { padding:12px 10px 40px; }
        }
      `}</style>

      <div className="v2-layout" style={{ background: "radial-gradient(ellipse at 20% 0%,rgba(0,30,60,0.4) 0%,transparent 50%),radial-gradient(ellipse at 80% 100%,rgba(0,20,40,0.3) 0%,transparent 50%),#06080C", fontFamily: "'Outfit',-apple-system,sans-serif", color: "white" }}>
        <NetworkCanvas />

        {/* Desktop Sidebar */}
        <div className="v2-sidebar">
          <SidebarContent />
        </div>

        {/* Mobile Drawer */}
        {sidebarOpen && (
          <div className="v2-sidebar-drawer">
            <div className="v2-sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
            <div className="v2-sidebar-panel v2-sidebar">
              <SidebarContent />
            </div>
          </div>
        )}

        {/* Mobile Topbar */}
        <div className="v2-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="v2-hamburger" onClick={() => setSidebarOpen(true)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 9, padding: "7px 10px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 4 }}>
              {[0, 1, 2].map(i => <div key={i} style={{ width: 18, height: 1.5, background: "rgba(255,255,255,0.6)", borderRadius: 1 }} />)}
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="14" height="14" viewBox="0 0 18 18"><polygon points="9,1 16,5 16,13 9,17 2,13 2,5" fill="none" stroke="rgba(0,212,255,0.8)" strokeWidth="1.5" /><circle cx="9" cy="9" r="2" fill="rgba(0,212,255,0.6)" /></svg>
              <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.03em" }}>SkyNet</span>
              <span style={{ fontSize: 8, color: "rgba(0,212,255,0.5)", letterSpacing: "0.08em", fontWeight: 600 }}>v2</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 16, background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.12)" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#0AD4FF", animation: "pulse 2s ease infinite" }} />
              <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,212,255,0.7)", letterSpacing: "0.06em" }}>LIVE</span>
            </div>
            <div style={{ width: 44, height: 44, borderRadius: 13, background: "linear-gradient(135deg,rgba(48,209,88,0.12),rgba(48,209,88,0.04))", border: "1px solid rgba(48,209,88,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#30D158", lineHeight: 1 }}>{fleet?.healthScore ?? 0}</span>
              <span style={{ fontSize: 6, fontWeight: 700, color: "rgba(48,209,88,0.6)", letterSpacing: "0.1em" }}>SCORE</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="v2-main">
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", flexDirection: "column", gap: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid rgba(0,212,255,0.2)", borderTop: "2px solid rgba(0,212,255,0.8)", animation: "spin 1s linear infinite" }} />
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading fleet data…</span>
            </div>
          ) : (
            <>
              {/* Page Header */}
              <div className="v2-page-header">
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                    <h1 className="v2-title" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.04em", background: "linear-gradient(135deg,white 60%,rgba(0,212,255,0.6))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Network Health</h1>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 16, background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.12)" }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#0AD4FF", animation: "pulse 2s ease infinite" }} />
                      <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,212,255,0.7)", letterSpacing: "0.06em" }}>LIVE</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>All Networks · {secondsAgo < 5 ? "just now" : `${secondsAgo}s ago`}</span>
                </div>
                <div className="v2-header-right">
                  <ChainBlocks />
                  <div style={{ width: 54, height: 54, borderRadius: 15, background: "linear-gradient(135deg,rgba(48,209,88,0.12),rgba(48,209,88,0.04))", border: "1px solid rgba(48,209,88,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: "#30D158", lineHeight: 1 }}>{fleet?.healthScore ?? 0}</span>
                    <span style={{ fontSize: 6, fontWeight: 700, color: "rgba(48,209,88,0.6)", letterSpacing: "0.1em" }}>SCORE</span>
                  </div>
                </div>
              </div>

              {/* Hex Metrics */}
              <div className="v2-hex-row">
                <HexIndicator value={total} max={total} color="#0AD4FF" label="Total" />
                <HexIndicator value={healthy} max={total} color="#30D158" label="Healthy" />
                <HexIndicator value={syncing} max={total} color="#0A84FF" label="Syncing" />
                <HexIndicator value={offline} max={total} color="#FF453A" label="Offline" />
                <HexIndicator value={totalPeers} max={Math.max(totalPeers, 100)} color="rgba(255,255,255,0.3)" label="Peers" />
                <div className="v2-avg-sync">
                  <span style={{ fontSize: 24, fontWeight: 800, color: "#FF9F0A", letterSpacing: "-0.04em" }}>{avgSync.toFixed(1)}<span style={{ fontSize: 12, opacity: 0.6 }}>%</span></span>
                  <span style={{ fontSize: 9, color: "rgba(255,159,10,0.5)", fontWeight: 500 }}>Avg Sync</span>
                </div>
              </div>

              {/* Charts */}
              <div className="v2-charts">
                <GlassCard delay={0.3} style={{ padding: 22 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 18, color: "rgba(255,255,255,0.9)" }}>Client Distribution</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                    <DonutChart data={clientData.length > 0 ? clientData : [{ name: "Loading", value: 1, color: "rgba(255,255,255,0.1)" }]} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, minWidth: 80 }}>
                      {clientData.map((d, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 7, height: 7, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", flex: 1 }}>{d.name}</span>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "white" }}>{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>

                <GlassCard delay={0.35} style={{ padding: 22 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 18, color: "rgba(255,255,255,0.9)" }}>OS Distribution</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
                    <DonutChart data={osData.length > 0 ? osData : [{ name: "Linux", value: total, color: "#64D2FF" }]} size={120} />
                    <div style={{ flex: 1, minWidth: 80 }}>
                      {osData.map((os, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: 16 }}>{os.name === 'Ubuntu' ? '🐧' : '🐳'}</span>
                          <div><div style={{ fontSize: 13, fontWeight: 700 }}>{os.name}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{os.value} nodes</div></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>

                <GlassCard delay={0.4} style={{ padding: 22 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 18, color: "rgba(255,255,255,0.9)" }}>Fleet by Network</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[{ name: "Mainnet", count: mainnetNodes.length, color: "#0AD4FF" }, { name: "Apothem", count: nodes.filter(n => n.network === 'apothem').length, color: "#BF5AF2" }, { name: "Devnet", count: nodes.filter(n => n.network === 'devnet').length, color: "#30D158" }].map((net, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 14px", borderRadius: 12, background: net.count > 0 ? `${net.color}08` : "rgba(255,255,255,0.015)", border: `1px solid ${net.count > 0 ? `${net.color}15` : "rgba(255,255,255,0.03)"}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 7, height: 7, borderRadius: 2, background: net.color, opacity: net.count > 0 ? 1 : 0.2 }} />
                          <span style={{ fontSize: 12, fontWeight: 500, color: net.count > 0 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.25)" }}>{net.name}</span>
                        </div>
                        <span style={{ fontSize: 18, fontWeight: 800, color: net.count > 0 ? "white" : "rgba(255,255,255,0.15)" }}>{net.count}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>Mainnet Sync</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: "#FF9F0A", fontFamily: "'JetBrains Mono',monospace" }}>{mainnetSyncAvg.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                      <div style={{ width: `${Math.max(mainnetSyncAvg, 0.5)}%`, minWidth: 8, height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#FF9F0A,#FFD60A)", animation: "barGrow 1.5s ease forwards", transformOrigin: "left" }} />
                    </div>
                  </div>
                </GlassCard>
              </div>

              {/* Block Tips */}
              <div className="v2-tips">
                {[{ label: "Mainnet Tip", value: mainnetTip.toLocaleString(), hash: "chain:50" }, { label: "Apothem Tip", value: apothemTip > 0 ? apothemTip.toLocaleString() : "—", hash: "chain:51" }].map((tip, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 14, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", backdropFilter: "blur(20px)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <svg width="14" height="14" viewBox="0 0 16 16"><polygon points="8,1 14,5 14,11 8,15 2,11 2,5" fill="none" stroke="rgba(0,212,255,0.3)" strokeWidth="1" /></svg>
                      <div>
                        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>{tip.label}</div>
                        <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: "rgba(0,212,255,0.35)" }}>{tip.hash}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em" }}>{tip.value}</span>
                  </div>
                ))}
              </div>

              {/* Incidents */}
              <GlassCard delay={0.5} style={{ padding: "16px 22px", marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#30D158", animation: "pulse 2.5s ease infinite" }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Active Incidents</span>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "4px 14px", borderRadius: 16, background: "rgba(48,209,88,0.08)", color: "rgba(48,209,88,0.7)", border: "1px solid rgba(48,209,88,0.15)" }}>All clear — no active incidents</span>
                </div>
              </GlassCard>

              {/* Nodes Section */}
              <div style={{ opacity: 0, animation: "fadeUp 0.7s ease 0.55s forwards" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", background: "linear-gradient(135deg,white 70%,rgba(0,212,255,0.5))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Nodes</h2>
                    <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{filteredNodes.length} of {total}</span>
                  </div>
                  <div style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: 3, border: "1px solid rgba(255,255,255,0.05)", flexWrap: "wrap" }}>
                    {["all", "healthy", "syncing", "offline"].map(f => (
                      <button key={f} onClick={() => setActiveFilter(f)} style={{ padding: "5px 12px", borderRadius: 9, border: "none", background: activeFilter === f ? "rgba(0,212,255,0.12)" : "transparent", color: activeFilter === f ? "rgba(0,212,255,0.9)" : "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 500, cursor: "pointer", transition: "all 0.2s", fontFamily: "'Outfit',sans-serif", textTransform: "capitalize" as const }}>{f === "all" ? `All ${total}` : f}</button>
                    ))}
                  </div>
                </div>
                <div className="v2-nodes-grid">
                  {filteredNodes.map((node, i) => <NodeCard key={node.id} node={node} index={i} />)}
                </div>
              </div>
              <div style={{ height: 48 }} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
