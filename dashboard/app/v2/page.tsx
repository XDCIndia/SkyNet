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

// ── Shared UI primitives ────────────────────────────────────
function GlassCard({ children, style = {}, delay = 0, glowColor = null }: any) {
  const [hov, setHov] = useState(false);
  return (
    <div className="glass-card" onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ animationDelay: `${delay}s`, boxShadow: hov && glowColor ? `0 20px 60px rgba(0,0,0,0.35), 0 0 40px ${glowColor}15` : undefined, ...style }}>
      {children}
    </div>
  );
}

function DonutChart({ data, size = 130 }: { data: { name: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const sw = 14, r = (size - sw) / 2, circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        {data.map((d, i) => <linearGradient key={i} id={`dg${i}`} x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor={d.color} /><stop offset="100%" stopColor={d.color} stopOpacity="0.6" /></linearGradient>)}
        <filter id="dglow"><feGaussianBlur stdDeviation="2" result="cb" /><feMerge><feMergeNode in="cb" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={sw} />
      {data.map((d, i) => {
        const pct = total > 0 ? d.value / total : 0, adj = Math.max(pct - 0.01, 0.001), da = `${circ * adj} ${circ * (1 - adj)}`, off = -offset * circ; offset += pct;
        return <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#dg${i})`} strokeWidth={sw} strokeDasharray={da} strokeDashoffset={off} strokeLinecap="round" filter="url(#dglow)" transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ opacity: 0, animation: `fadeSliceIn 1s ease ${0.5 + i * 0.15}s forwards` }} />;
      })}
      <text x={size / 2} y={size / 2 - 5} textAnchor="middle" fill="white" fontSize="24" fontWeight="700" fontFamily="'Outfit',sans-serif" letterSpacing="-0.04em">{total}</text>
      <text x={size / 2} y={size / 2 + 11} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="8" fontWeight="600" letterSpacing="0.12em" fontFamily="'Outfit',sans-serif">NODES</text>
    </svg>
  );
}

function Sparkline({ data, color, w = 90, h = 26 }: { data: number[]; color: string; w?: number; h?: number }) {
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
  const id = `sp${color.replace(/[^a-z0-9]/gi, "")}${Math.random().toString(36).slice(2,5)}`;
  const ly = parseFloat(pts.split(" ").pop()!.split(",")[1]);
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.18" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <polygon points={`${pts} ${w},${h} 0,${h}`} fill={`url(#${id})`} style={{ opacity: 0, animation: "fadeIn 1s ease 0.8s forwards" }} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 400, strokeDashoffset: 400, animation: "drawLine 2s ease 0.5s forwards" }} />
      <circle cx={w} cy={ly} r="2.5" fill={color} style={{ opacity: 0, animation: "fadeIn 0.5s ease 2s forwards", filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}

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

function HexIndicator({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="hex-item">
      <svg width="32" height="32" viewBox="0 0 36 36">
        <polygon points="18,2 32,10 32,26 18,34 4,26 4,10" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
        <polygon points="18,2 32,10 32,26 18,34 4,26 4,10" fill={`${color}08`} stroke={color} strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray={`${pct * 1.2} 200`} style={{ filter: `drop-shadow(0 0 4px ${color}40)` }} />
        <text x="18" y="20" textAnchor="middle" fill={value > 0 ? color : "rgba(255,255,255,0.2)"} fontSize="11" fontWeight="700" fontFamily="'Outfit',sans-serif">{value}</text>
      </svg>
      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 500, textAlign: "center" }}>{label}</span>
    </div>
  );
}

function ChainBlocks() {
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", opacity: 0, animation: `chainSlide 0.4s ease ${i * 0.08}s forwards` }}>
          <div style={{ width: 24, height: 24, borderRadius: 5, background: i === 4 ? "linear-gradient(135deg,rgba(0,212,255,0.25),rgba(0,212,255,0.08))" : "rgba(255,255,255,0.04)", border: `1px solid ${i === 4 ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.06)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, color: i === 4 ? "rgba(0,212,255,0.9)" : "rgba(255,255,255,0.2)", fontFamily: "'JetBrains Mono',monospace" }}>
            {i === 4 ? "◆" : "▪"}
          </div>
          {i < 4 && <div style={{ width: 10, height: 1, background: "rgba(0,212,255,0.12)" }} />}
        </div>
      ))}
    </div>
  );
}

function NodeCard({ node, index }: { node: NodeData; index: number }) {
  const sc = node.status === "healthy" ? "#30D158" : node.status === "syncing" ? "#0AD4FF" : node.status === "degraded" ? "#FF9F0A" : "#FF453A";
  const clientLabel = (node.clientType || "?").charAt(0)?.toUpperCase() + (node.clientType || "").slice(1);
  const osLabel = node.os_info?.release ? node.os_info.release.replace(/\s+LTS/, "").split(" ").slice(0, 2).join(" ") : "Linux";
  const ago = (() => { const d = Date.now() - new Date(node.lastSeen).getTime(); return d < 60000 ? `${Math.floor(d / 1000)}s ago` : d < 3600000 ? `${Math.floor(d / 60000)}m ago` : `${Math.floor(d / 3600000)}h ago`; })();
  const spark = [0, 0, node.syncPercent * 0.4, node.syncPercent * 0.7, node.syncPercent, node.syncPercent, node.syncPercent].map(v => v + Math.random() * 0.2);
  const cpu = Math.round(node.cpuPercent || 0), mem = Math.round(node.memoryPercent || 0), disk = Math.round(node.diskPercent || 0);
  const peak = node.peakBlock || node.fleetMaxBlock || 0;
  return (
    <GlassCard delay={0.08 + index * 0.05} glowColor={sc} style={{ padding: 0 }}>
      <div style={{ height: 2, background: `linear-gradient(90deg,transparent,${sc}55,transparent)`, borderRadius: "20px 20px 0 0" }} />
      <div style={{ padding: "16px 18px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: sc, boxShadow: `0 0 8px ${sc}55`, flexShrink: 0, animation: "pulse 3s ease infinite" }} />
              <span style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</span>
            </div>
            <span style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: "rgba(0,212,255,0.5)", background: "rgba(0,212,255,0.06)", padding: "1px 7px", borderRadius: 3, border: "1px solid rgba(0,212,255,0.08)" }}>{node.host}</span>
          </div>
          <span className="badge" style={{ background: `${sc}12`, color: sc, border: `1px solid ${sc}20`, marginLeft: 8, flexShrink: 0 }}>{node.status}</span>
        </div>
        <div style={{ display: "flex", gap: 4, marginBottom: 12, flexWrap: "wrap" }}>
          {[clientLabel, node.nodeType || "fullnode"].map((t, i) => <span key={i} style={{ fontSize: 9, padding: "2px 8px", borderRadius: 5, background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.05)" }}>{t}</span>)}
        </div>
        <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 13, padding: "12px 14px", marginBottom: 11, border: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
            <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.28)", letterSpacing: ".1em" }}>BLOCK HEIGHT</span>
            <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.03em", fontFamily: "'Outfit',sans-serif" }}>{node.blockHeight.toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 8, fontWeight: 600, color: "rgba(255,255,255,0.28)", letterSpacing: ".1em" }}>SYNC</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 48, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.max(node.syncPercent, 2)}%`, borderRadius: 2, background: `linear-gradient(90deg,${sc},${sc}aa)`, animation: "barGrow 1.5s ease forwards", transformOrigin: "left" }} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: sc, fontFamily: "'JetBrains Mono',monospace" }}>{node.syncPercent.toFixed(1)}%</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 11 }}>
          <div style={{ display: "flex", gap: 14 }}>
            {[["PEERS", node.peerCount], ["PEAK", peak.toLocaleString()]].map(([l, v]) => (
              <div key={l as string}><div style={{ fontSize: 8, color: "rgba(255,255,255,0.24)", marginBottom: 2, letterSpacing: ".08em", fontWeight: 600 }}>{l}</div><div style={{ fontSize: 14, fontWeight: 700 }}>{v}</div></div>
            ))}
          </div>
          <Sparkline data={spark} color={sc} />
        </div>
        <div style={{ height: 1, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)", marginBottom: 11 }} />
        <ResourceBar value={cpu} color={cpu > 90 ? "#FF453A" : cpu > 70 ? "#FF9F0A" : "#30D158"} icon="⬜" />
        <ResourceBar value={mem} color={mem > 90 ? "#FF453A" : mem > 70 ? "#FF9F0A" : "#0A84FF"} icon="◻" />
        <ResourceBar value={disk} color={disk > 90 ? "#FF453A" : disk > 70 ? "#FF9F0A" : "#30D158"} icon="▪" />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 11 }}>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "'JetBrains Mono',monospace" }}>{osLabel}</span>
          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)" }}>{ago}</span>
        </div>
      </div>
    </GlassCard>
  );
}

// ── Main Dashboard Page ──────────────────────────────────────
export default function SkyNetV2Dashboard() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [fleet, setFleet] = useState<FleetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const fetchFleet = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/fleet/status', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) { setFleet(json.data); setLastRefresh(Date.now()); }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFleet(); const t = setInterval(fetchFleet, 15000); return () => clearInterval(t); }, [fetchFleet]);

  const nodes: NodeData[] = fleet?.nodes || [];
  const total = nodes.length, healthy = nodes.filter(n => n.status === 'healthy').length;
  const syncing = nodes.filter(n => n.status === 'syncing').length, offline = nodes.filter(n => n.status === 'offline').length;
  const totalPeers = nodes.reduce((s, n) => s + (n.peerCount || 0), 0);
  const avgSync = total > 0 ? nodes.reduce((s, n) => s + (n.syncPercent || 0), 0) / total : 0;

  const CLIENT_COLORS: Record<string, string> = { geth: "#0A84FF", erigon: "#FF9F0A", nethermind: "#BF5AF2", reth: "#30D158", xdc: "#0AD4FF" };
  const clientCounts: Record<string, number> = {};
  nodes.forEach(n => { const ct = n.clientType || 'unknown'; clientCounts[ct] = (clientCounts[ct] || 0) + 1; });
  const clientData = Object.entries(clientCounts).filter(([, v]) => v > 0).map(([name, value]) => ({ name: name.charAt(0)?.toUpperCase() + name.slice(1), value, color: CLIENT_COLORS[name] || "#64D2FF" }));

  const osCounts: Record<string, number> = {};
  nodes.forEach(n => { const os = n.os_info?.release?.includes('Ubuntu') ? 'Ubuntu' : n.os_info?.release?.includes('Alpine') ? 'Alpine' : 'Linux'; osCounts[os] = (osCounts[os] || 0) + 1; });
  const osData = Object.entries(osCounts).map(([name, value]) => ({ name, value, color: name === 'Ubuntu' ? "#0AD4FF" : "#30D158" }));

  const mainnetNodes = nodes.filter(n => n.network === 'mainnet' || !n.network);
  const mainnetTip = mainnetNodes.reduce((m, n) => Math.max(m, n.fleetMaxBlock || n.blockHeight || 0), 0);
  const apothemTip = nodes.filter(n => n.network === 'apothem').reduce((m, n) => Math.max(m, n.blockHeight || 0), 0);
  const mainnetSyncAvg = mainnetNodes.length > 0 ? mainnetNodes.reduce((s, n) => s + (n.syncPercent || 0), 0) / mainnetNodes.length : 0;
  const filteredNodes = nodes.filter(n => activeFilter === 'all' || n.status === activeFilter);
  const secondsAgo = Math.floor((Date.now() - lastRefresh) / 1000);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 16 }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: "2px solid rgba(0,212,255,0.2)", borderTop: "2px solid rgba(0,212,255,0.8)", animation: "spin 1s linear infinite" }} />
      <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading fleet…</span>
    </div>
  );

  return (
    <>
      <style>{`
        .hex-item{display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 10px;background:rgba(255,255,255,0.02);border-radius:13px;border:1px solid rgba(255,255,255,0.04);min-width:60px;flex:1}
        .hex-row{display:flex;gap:8px;margin-bottom:22px;opacity:0;animation:fadeUp .7s ease .2s forwards;flex-wrap:wrap}
        @media(max-width:640px){.hex-item{min-width:calc(33.33% - 6px);flex:none}.hex-row{gap:5px}}
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 26, opacity: 0, animation: "fadeUp 0.8s ease 0.1s forwards", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 5 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.04em", background: "linear-gradient(135deg,white 60%,rgba(0,212,255,0.6))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Network Health</h1>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 14, background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.12)" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#0AD4FF", animation: "pulse 2s ease infinite" }} />
              <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(0,212,255,0.7)", letterSpacing: ".06em" }}>LIVE</span>
            </div>
          </div>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>All Networks · {secondsAgo < 5 ? "just now" : `${secondsAgo}s ago`}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <ChainBlocks />
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,rgba(48,209,88,0.12),rgba(48,209,88,0.04))", border: "1px solid rgba(48,209,88,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: "#30D158", lineHeight: 1 }}>{fleet?.healthScore ?? 0}</span>
            <span style={{ fontSize: 6, fontWeight: 700, color: "rgba(48,209,88,0.6)", letterSpacing: ".1em" }}>SCORE</span>
          </div>
        </div>
      </div>

      {/* Hex Metrics */}
      <div className="hex-row">
        <HexIndicator value={total} max={total} color="#0AD4FF" label="Total" />
        <HexIndicator value={healthy} max={total} color="#30D158" label="Healthy" />
        <HexIndicator value={syncing} max={total} color="#0A84FF" label="Syncing" />
        <HexIndicator value={offline} max={total} color="#FF453A" label="Offline" />
        <HexIndicator value={totalPeers} max={Math.max(totalPeers, 100)} color="rgba(255,255,255,0.3)" label="Peers" />
        <div className="hex-item" style={{ background: "rgba(255,159,10,0.04)", borderColor: "rgba(255,159,10,0.1)" }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: "#FF9F0A", letterSpacing: "-0.04em" }}>{avgSync.toFixed(1)}<span style={{ fontSize: 11, opacity: .6 }}>%</span></span>
          <span style={{ fontSize: 9, color: "rgba(255,159,10,0.5)" }}>Avg Sync</span>
        </div>
      </div>

      {/* Charts */}
      <div className="v2-grid-3" style={{ marginBottom: 22 }}>
        <GlassCard delay={0.3} style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: "rgba(255,255,255,0.9)" }}>Client Distribution</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <DonutChart data={clientData.length > 0 ? clientData : [{ name: "–", value: 1, color: "rgba(255,255,255,0.1)" }]} />
            <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1, minWidth: 80 }}>
              {clientData.map((d, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}><div style={{ width: 7, height: 7, borderRadius: 2, background: d.color }} /><span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", flex: 1 }}>{d.name}</span><span style={{ fontSize: 14, fontWeight: 700 }}>{d.value}</span></div>)}
            </div>
          </div>
        </GlassCard>

        <GlassCard delay={0.35} style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: "rgba(255,255,255,0.9)" }}>OS Distribution</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <DonutChart data={osData.length > 0 ? osData : [{ name: "Linux", value: total, color: "#64D2FF" }]} size={120} />
            <div style={{ flex: 1, minWidth: 70 }}>
              {osData.map((os, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}><span style={{ fontSize: 14 }}>{os.name === 'Ubuntu' ? '🐧' : '🐳'}</span><div><div style={{ fontSize: 12, fontWeight: 700 }}>{os.name}</div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{os.value} nodes</div></div></div>)}
            </div>
          </div>
        </GlassCard>

        <GlassCard delay={0.4} style={{ padding: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16, color: "rgba(255,255,255,0.9)" }}>Fleet by Network</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {[{ name: "Mainnet", count: mainnetNodes.length, color: "#0AD4FF" }, { name: "Apothem", count: nodes.filter(n => n.network === 'apothem').length, color: "#BF5AF2" }, { name: "Devnet", count: nodes.filter(n => n.network === 'devnet').length, color: "#30D158" }].map((net, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 13px", borderRadius: 11, background: net.count > 0 ? `${net.color}08` : "rgba(255,255,255,0.012)", border: `1px solid ${net.count > 0 ? `${net.color}14` : "rgba(255,255,255,0.03)"}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ width: 6, height: 6, borderRadius: 2, background: net.color, opacity: net.count > 0 ? 1 : 0.2 }} />
                  <span style={{ fontSize: 12, color: net.count > 0 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.22)" }}>{net.name}</span>
                </div>
                <span style={{ fontSize: 17, fontWeight: 800, color: net.count > 0 ? "white" : "rgba(255,255,255,0.12)" }}>{net.count}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 11 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}><span style={{ fontSize: 9, color: "rgba(255,255,255,0.25)" }}>Mainnet Sync</span><span style={{ fontSize: 10, fontWeight: 700, color: "#FF9F0A", fontFamily: "'JetBrains Mono',monospace" }}>{mainnetSyncAvg.toFixed(1)}%</span></div>
            <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}><div style={{ width: `${Math.max(mainnetSyncAvg, 0.5)}%`, minWidth: 6, height: "100%", borderRadius: 2, background: "linear-gradient(90deg,#FF9F0A,#FFD60A)", animation: "barGrow 1.5s ease forwards", transformOrigin: "left" }} /></div>
          </div>
        </GlassCard>
      </div>

      {/* Block Tips */}
      <div className="v2-grid-2" style={{ marginBottom: 22, opacity: 0, animation: "fadeUp .7s ease .45s forwards" }}>
        {[{ label: "Mainnet Tip", value: mainnetTip.toLocaleString(), hash: "chain:50" }, { label: "Apothem Tip", value: apothemTip > 0 ? apothemTip.toLocaleString() : "—", hash: "chain:51" }].map((tip, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 14, padding: "13px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <svg width="13" height="13" viewBox="0 0 16 16"><polygon points="8,1 14,5 14,11 8,15 2,11 2,5" fill="none" stroke="rgba(0,212,255,0.3)" strokeWidth="1" /></svg>
              <div><div style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 1 }}>{tip.label}</div><span style={{ fontSize: 9, fontFamily: "'JetBrains Mono',monospace", color: "rgba(0,212,255,0.35)" }}>{tip.hash}</span></div>
            </div>
            <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.03em" }}>{tip.value}</span>
          </div>
        ))}
      </div>

      {/* Incidents */}
      <GlassCard delay={0.5} style={{ padding: "14px 20px", marginBottom: 22 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#30D158", animation: "pulse 2.5s ease infinite" }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Active Incidents</span>
          </div>
          <span style={{ fontSize: 10, fontWeight: 600, padding: "4px 13px", borderRadius: 14, background: "rgba(48,209,88,0.08)", color: "rgba(48,209,88,0.7)", border: "1px solid rgba(48,209,88,0.15)" }}>All clear</span>
        </div>
      </GlassCard>

      {/* Nodes */}
      <div style={{ opacity: 0, animation: "fadeUp .7s ease .55s forwards" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.03em", background: "linear-gradient(135deg,white 70%,rgba(0,212,255,0.5))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Nodes</h2>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{filteredNodes.length} of {total}</span>
          </div>
          <div style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.03)", borderRadius: 11, padding: 3, border: "1px solid rgba(255,255,255,0.05)" }}>
            {["all", "healthy", "syncing", "offline"].map(f => (
              <button key={f} onClick={() => setActiveFilter(f)} style={{ padding: "5px 11px", borderRadius: 8, border: "none", background: activeFilter === f ? "rgba(0,212,255,0.12)" : "transparent", color: activeFilter === f ? "rgba(0,212,255,0.9)" : "rgba(255,255,255,0.3)", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "'Outfit',sans-serif", textTransform: "capitalize" as const }}>{f === "all" ? `All ${total}` : f}</button>
            ))}
          </div>
        </div>
        <div className="v2-nodes-grid">
          {filteredNodes.map((node, i) => <NodeCard key={node.id} node={node} index={i} />)}
        </div>
      </div>
    </>
  );
}
