'use client';

import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════
interface NodeData {
  id: string;
  name: string;
  host: string;
  clientType: string;
  nodeType: string;
  status: string;
  blockHeight: number;
  peakBlock?: number;
  fleetMaxBlock?: number;
  syncPercent: number;
  peerCount: number;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  clientVersion?: string;
  os_info?: { type?: string; release?: string };
  lastSeen: string;
  network?: string;
}

interface FleetData {
  healthScore: number;
  totalNodes: number;
  nodes: NodeData[];
}

// ═══════════════════════════════════════════════════════════
// ANIMATED BLOCKCHAIN NETWORK BACKGROUND (Canvas)
// ═══════════════════════════════════════════════════════════
function NetworkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = (canvas.width = canvas.parentElement!.offsetWidth);
    let h = (canvas.height = canvas.parentElement!.offsetHeight);

    const NODES = 40;
    const CONNECTION_DIST = 180;
    const nodes: any[] = [];

    for (let i = 0; i < NODES; i++) {
      nodes.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 1.5 + 0.5,
        pulsePhase: Math.random() * Math.PI * 2,
        isBlock: Math.random() > 0.7,
      });
    }

    let blockPulse = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      blockPulse += 0.008;

      nodes.forEach((n) => {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        n.pulsePhase += 0.02;
      });

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_DIST) {
            const alpha = (1 - dist / CONNECTION_DIST) * 0.08;
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = `rgba(0, 212, 255, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();

            if (Math.random() > 0.997) {
              const t = (Math.sin(blockPulse * 2) + 1) / 2;
              const px = nodes[i].x + (nodes[j].x - nodes[i].x) * t;
              const py = nodes[i].y + (nodes[j].y - nodes[i].y) * t;
              ctx.beginPath();
              ctx.arc(px, py, 2, 0, Math.PI * 2);
              ctx.fillStyle = "rgba(0, 212, 255, 0.6)";
              ctx.fill();
            }
          }
        }
      }

      nodes.forEach((n) => {
        const pulse = Math.sin(n.pulsePhase) * 0.3 + 0.7;
        if (n.isBlock) {
          ctx.save();
          ctx.translate(n.x, n.y);
          ctx.rotate(Math.PI / 6);
          const s = 4 * pulse;
          ctx.beginPath();
          for (let k = 0; k < 6; k++) {
            const angle = (Math.PI / 3) * k;
            const px = Math.cos(angle) * s;
            const py = Math.sin(angle) * s;
            k === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fillStyle = `rgba(0, 212, 255, ${0.15 * pulse})`;
          ctx.fill();
          ctx.strokeStyle = `rgba(0, 212, 255, ${0.3 * pulse})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius * pulse, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0, 212, 255, ${0.12 * pulse})`;
          ctx.fill();
        }
      });

      animRef.current = requestAnimationFrame(draw);
    };

    draw();
    const resize = () => {
      w = canvas.width = canvas.parentElement!.offsetWidth;
      h = canvas.height = canvas.parentElement!.offsetHeight;
    };
    window.addEventListener("resize", resize);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
        pointerEvents: "none", zIndex: 0,
      }}
    />
  );
}

// ═══════════════════════════════════════════════════════════
// BLOCK CHAIN ANIMATION
// ═══════════════════════════════════════════════════════════
function ChainBlocks() {
  const blocks = Array.from({ length: 7 }, (_, i) => i);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, overflow: "hidden" }}>
      {blocks.map((b, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", opacity: 0, animation: `chainSlide 0.4s ease ${i * 0.08}s forwards` }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6,
            background: i === blocks.length - 1
              ? "linear-gradient(135deg, rgba(0,212,255,0.25), rgba(0,212,255,0.08))"
              : "rgba(255,255,255,0.04)",
            border: `1px solid ${i === blocks.length - 1 ? "rgba(0,212,255,0.3)" : "rgba(255,255,255,0.06)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 8, fontWeight: 700,
            color: i === blocks.length - 1 ? "rgba(0,212,255,0.9)" : "rgba(255,255,255,0.2)",
            fontFamily: "'JetBrains Mono', monospace",
          }}>
            {i === blocks.length - 1 ? "◆" : "▪"}
          </div>
          {i < blocks.length - 1 && (
            <div style={{ width: 16, height: 1, background: "rgba(0,212,255,0.12)", position: "relative", overflow: "hidden" }}>
              <div style={{
                width: 6, height: 1, background: "rgba(0,212,255,0.5)",
                animation: `dataFlow 2s ease ${i * 0.3}s infinite`,
              }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// GLASS CARD
// ═══════════════════════════════════════════════════════════
function GlassCard({ children, style = {}, delay = 0, hoverable = true, glowColor = null }: any) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => hoverable && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.025)",
        backdropFilter: "blur(40px) saturate(150%)",
        WebkitBackdropFilter: "blur(40px) saturate(150%)",
        border: `1px solid ${hovered ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 24,
        transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
        transform: hovered ? "translateY(-3px) scale(1.005)" : "translateY(0) scale(1)",
        boxShadow: hovered
          ? `0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08) inset${glowColor ? `, 0 0 40px ${glowColor}15` : ""}`
          : "0 4px 24px rgba(0,0,0,0.1)",
        opacity: 0,
        animation: `glassIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s forwards`,
        position: "relative", overflow: "hidden",
        ...style,
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: "10%", right: "10%", height: 1,
        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
      }} />
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// DONUT CHART
// ═══════════════════════════════════════════════════════════
function DonutChart({ data, size = 150 }: { data: { name: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <defs>
        {data.map((d, i) => (
          <linearGradient key={i} id={`grad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={d.color} stopOpacity="1" />
            <stop offset="100%" stopColor={d.color} stopOpacity="0.6" />
          </linearGradient>
        ))}
        <filter id="glow"><feGaussianBlur stdDeviation="2" result="coloredBlur" /><feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth={strokeWidth} />
      {data.map((d, i) => {
        const pct = total > 0 ? d.value / total : 0;
        const gap = 0.01;
        const adjustedPct = Math.max(pct - gap, 0.001);
        const dashArray = `${circumference * adjustedPct} ${circumference * (1 - adjustedPct)}`;
        const dashOffset = -offset * circumference;
        offset += pct;
        return (
          <circle key={i} cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={`url(#grad-${i})`} strokeWidth={strokeWidth}
            strokeDasharray={dashArray} strokeDashoffset={dashOffset}
            strokeLinecap="round" filter="url(#glow)"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ opacity: 0, animation: `fadeSliceIn 1s ease ${0.5 + i * 0.15}s forwards` }}
          />
        );
      })}
      <text x={size / 2} y={size / 2 - 6} textAnchor="middle" fill="white" fontSize="28" fontWeight="700"
        fontFamily="'Outfit', sans-serif" letterSpacing="-0.04em">{total}</text>
      <text x={size / 2} y={size / 2 + 12} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="9"
        fontWeight="600" letterSpacing="0.12em" fontFamily="'Outfit', sans-serif">NODES</text>
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════
// SPARKLINE
// ═══════════════════════════════════════════════════════════
function Sparkline({ data, color, w = 100, h = 28 }: { data: number[]; color: string; w?: number; h?: number }) {
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4) - 2}`).join(" ");
  const areapts = pts + ` ${w},${h} 0,${h}`;
  const id = `sp-${color.replace(/[^a-z0-9]/gi, "")}`;
  const lastPt = pts.split(" ").pop()!.split(",");
  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areapts} fill={`url(#${id})`} style={{ opacity: 0, animation: "fadeIn 1s ease 0.8s forwards" }} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ strokeDasharray: 400, strokeDashoffset: 400, animation: "drawLine 2s ease 0.5s forwards" }} />
      <circle cx={w} cy={parseFloat(lastPt[1])} r="2.5" fill={color}
        style={{ opacity: 0, animation: "fadeIn 0.5s ease 2s forwards", filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════
// RESOURCE BAR
// ═══════════════════════════════════════════════════════════
function ResourceBar({ value, color, icon }: { value: number; color: string; icon: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", width: 20, textAlign: "center" }}>{icon}</span>
      <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${value}%`, borderRadius: 2,
          background: `linear-gradient(90deg, ${color}, ${color}88)`,
          animation: "barGrow 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards",
          transformOrigin: "left", boxShadow: value > 80 ? `0 0 8px ${color}40` : "none",
        }} />
      </div>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", width: 28, textAlign: "right", fontVariantNumeric: "tabular-nums", fontFamily: "'JetBrains Mono', monospace" }}>{value}%</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// HASH BADGE
// ═══════════════════════════════════════════════════════════
function HashBadge({ text }: { text: string }) {
  return (
    <span style={{
      fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
      color: "rgba(0,212,255,0.5)", background: "rgba(0,212,255,0.06)",
      padding: "2px 8px", borderRadius: 4, letterSpacing: "0.02em",
      border: "1px solid rgba(0,212,255,0.08)",
    }}>{text}</span>
  );
}

// ═══════════════════════════════════════════════════════════
// NODE CARD
// ═══════════════════════════════════════════════════════════
function NodeCard({ node, index }: { node: NodeData; index: number }) {
  const statusColor =
    node.status === "healthy" ? "#30D158" :
      node.status === "syncing" ? "#0AD4FF" :
        node.status === "degraded" ? "#FF9F0A" : "#FF453A";

  const clientLabel = (node.clientType || "unknown").charAt(0).toUpperCase() + (node.clientType || "unknown").slice(1);
  const osLabel = node.os_info?.release
    ? node.os_info.release.replace(/\s+LTS/, "").replace(/Ubuntu/, "Ubuntu").split(" ").slice(0, 2).join(" ")
    : node.os_info?.type || "Linux";

  const lastUpdate = (() => {
    if (!node.lastSeen) return "unknown";
    const diff = Date.now() - new Date(node.lastSeen).getTime();
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  })();

  const sparkData = [0, 0, 0, 0, 0, node.syncPercent, node.syncPercent, node.syncPercent, node.syncPercent, node.syncPercent, node.syncPercent, node.syncPercent]
    .map((v, i) => v + Math.random() * 0.3);

  const cpu = Math.round(node.cpuPercent || 0);
  const mem = Math.round(node.memoryPercent || 0);
  const disk = Math.round(node.diskPercent || 0);

  const cpuColor = cpu > 90 ? "#FF453A" : cpu > 70 ? "#FF9F0A" : "#30D158";
  const memColor = mem > 90 ? "#FF453A" : mem > 70 ? "#FF9F0A" : "#0A84FF";
  const diskColor = disk > 90 ? "#FF453A" : disk > 70 ? "#FF9F0A" : "#30D158";

  const peak = node.peakBlock || node.fleetMaxBlock || 0;
  const tags = [clientLabel, node.nodeType || "fullnode"];

  return (
    <GlassCard delay={0.15 + index * 0.08} glowColor={statusColor} style={{ padding: 0 }}>
      <div style={{ height: 2, background: `linear-gradient(90deg, transparent, ${statusColor}60, transparent)`, borderRadius: "24px 24px 0 0" }} />
      <div style={{ padding: "22px 24px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor, boxShadow: `0 0 10px ${statusColor}60`, animation: "pulse 3s ease infinite" }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "white", letterSpacing: "-0.02em", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.name}</span>
            </div>
            <HashBadge text={node.host} />
          </div>
          <div style={{
            fontSize: 9, fontWeight: 700, padding: "4px 10px", borderRadius: 8,
            background: `${statusColor}12`, color: statusColor, letterSpacing: "0.08em",
            textTransform: "uppercase", border: `1px solid ${statusColor}20`,
          }}>{node.status}</div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
          {tags.map((tag, i) => (
            <span key={i} style={{
              fontSize: 10, fontWeight: 500, padding: "3px 10px", borderRadius: 6,
              background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)",
              border: "1px solid rgba(255,255,255,0.05)",
            }}>{tag}</span>
          ))}
        </div>

        <div style={{
          background: "rgba(255,255,255,0.02)", borderRadius: 16, padding: "16px 18px", marginBottom: 14,
          border: "1px solid rgba(255,255,255,0.04)",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>BLOCK HEIGHT</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: "white", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em", fontFamily: "'Outfit', sans-serif" }}>{node.blockHeight.toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>SYNC PROGRESS</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 60, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${Math.max(node.syncPercent, 2)}%`, borderRadius: 2,
                  background: `linear-gradient(90deg, ${statusColor}, ${statusColor}aa)`,
                  boxShadow: `0 0 8px ${statusColor}40`,
                  animation: "barGrow 1.5s ease forwards", transformOrigin: "left",
                }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: statusColor, fontVariantNumeric: "tabular-nums", fontFamily: "'JetBrains Mono', monospace" }}>{node.syncPercent.toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 20 }}>
            <div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginBottom: 3, letterSpacing: "0.08em", fontWeight: 600 }}>PEERS</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "white", fontVariantNumeric: "tabular-nums" }}>{node.peerCount}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", marginBottom: 3, letterSpacing: "0.08em", fontWeight: 600 }}>PEAK</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "white", fontVariantNumeric: "tabular-nums" }}>{peak.toLocaleString()}</div>
            </div>
          </div>
          <Sparkline data={sparkData} color={statusColor} />
        </div>

        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)", margin: "0 0 14px" }} />

        <ResourceBar value={cpu} color={cpuColor} icon="⬜" />
        <ResourceBar value={mem} color={memColor} icon="◻" />
        <ResourceBar value={disk} color={diskColor} icon="▪" />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", fontFamily: "'JetBrains Mono', monospace" }}>{osLabel}</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>{lastUpdate}</span>
        </div>
      </div>
    </GlassCard>
  );
}

// ═══════════════════════════════════════════════════════════
// SIDEBAR NAV ITEM
// ═══════════════════════════════════════════════════════════
function NavItem({ icon, label, active, badge, href }: any) {
  const [hov, setHov] = useState(false);
  return (
    <a href={href || "#"} style={{ textDecoration: "none" }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderRadius: 12,
        background: active ? "rgba(0,212,255,0.08)" : hov ? "rgba(255,255,255,0.04)" : "transparent",
        cursor: "pointer", transition: "all 0.25s ease", position: "relative",
      }}>
        {active && <div style={{ position: "absolute", left: -1, top: "25%", bottom: "25%", width: 2, background: "rgba(0,212,255,0.8)", borderRadius: 1, boxShadow: "0 0 8px rgba(0,212,255,0.4)" }} />}
        <span style={{ fontSize: 14, opacity: active ? 0.9 : 0.3, filter: active ? "drop-shadow(0 0 4px rgba(0,212,255,0.3))" : "none" }}>{icon}</span>
        <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, letterSpacing: "-0.01em", color: active ? "rgba(0,212,255,0.9)" : hov ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.4)" }}>{label}</span>
        {badge && <span style={{ marginLeft: "auto", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: "rgba(255,69,58,0.15)", color: "#FF453A", fontVariantNumeric: "tabular-nums", border: "1px solid rgba(255,69,58,0.2)" }}>{badge}</span>}
      </div>
    </a>
  );
}

// ═══════════════════════════════════════════════════════════
// HEX NETWORK INDICATOR
// ═══════════════════════════════════════════════════════════
function HexIndicator({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
      padding: "20px 16px", background: "rgba(255,255,255,0.02)", borderRadius: 16,
      border: "1px solid rgba(255,255,255,0.04)", minWidth: 90, flex: 1,
    }}>
      <svg width="36" height="36" viewBox="0 0 36 36">
        <polygon points="18,2 32,10 32,26 18,34 4,26 4,10" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
        <polygon points="18,2 32,10 32,26 18,34 4,26 4,10" fill={`${color}08`} stroke={color} strokeWidth="1.5" strokeOpacity="0.4"
          strokeDasharray={`${pct * 1.2} 200`} style={{ filter: `drop-shadow(0 0 4px ${color}40)` }} />
        <text x="18" y="20" textAnchor="middle" fill={value > 0 ? color : "rgba(255,255,255,0.2)"} fontSize="11" fontWeight="700" fontFamily="'Outfit', sans-serif">{value}</text>
      </svg>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", fontWeight: 500, letterSpacing: "0.02em" }}>{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN DASHBOARD v2
// ═══════════════════════════════════════════════════════════
export default function SkyNetV2Dashboard() {
  const [activeFilter, setActiveFilter] = useState("all");
  const [time, setTime] = useState(new Date());
  const [fleet, setFleet] = useState<FleetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const fetchFleet = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/fleet/status', { cache: 'no-store' });
      const json = await res.json();
      if (json.success) {
        setFleet(json.data);
        setLastRefresh(Date.now());
      }
    } catch (e) {
      console.error('Fleet fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFleet();
    const tick = setInterval(fetchFleet, 15000); // refresh every 15s
    return () => clearInterval(tick);
  }, [fetchFleet]);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const nodes: NodeData[] = fleet?.nodes || [];
  const activeNodes = nodes.filter(n => n.status !== 'offline');
  const total = nodes.length;
  const healthy = nodes.filter(n => n.status === 'healthy').length;
  const syncing = nodes.filter(n => n.status === 'syncing').length;
  const offline = nodes.filter(n => n.status === 'offline').length;
  const totalPeers = nodes.reduce((s, n) => s + (n.peerCount || 0), 0);
  const avgSync = total > 0 ? nodes.reduce((s, n) => s + (n.syncPercent || 0), 0) / total : 0;

  // Client distribution
  const clientCounts: Record<string, number> = {};
  nodes.forEach(n => {
    const ct = n.clientType || 'unknown';
    clientCounts[ct] = (clientCounts[ct] || 0) + 1;
  });
  const CLIENT_COLORS: Record<string, string> = {
    geth: "#0A84FF", erigon: "#FF9F0A", nethermind: "#BF5AF2",
    reth: "#30D158", xdc: "#0AD4FF", unknown: "rgba(255,255,255,0.25)",
  };
  const clientData = Object.entries(clientCounts)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: CLIENT_COLORS[name] || "#64D2FF",
    }));

  // OS distribution
  const osCounts: Record<string, number> = {};
  nodes.forEach(n => {
    const os = n.os_info?.release?.includes('Ubuntu') ? 'Ubuntu' :
      n.os_info?.release?.includes('Alpine') ? 'Alpine' :
        n.os_info?.type || 'Linux';
    osCounts[os] = (osCounts[os] || 0) + 1;
  });
  const osData = Object.entries(osCounts).map(([name, value]) => ({
    name, value,
    color: name === 'Ubuntu' ? "#0AD4FF" : name === 'Alpine' ? "#30D158" : "#64D2FF",
  }));

  // Network heights
  const mainnetNodes = nodes.filter(n => n.network === 'mainnet' || !n.network);
  const mainnetTip = mainnetNodes.reduce((m, n) => Math.max(m, n.fleetMaxBlock || n.blockHeight || 0), 0);
  const apothemTip = nodes.filter(n => n.network === 'apothem').reduce((m, n) => Math.max(m, n.blockHeight || 0), 0);

  // Mainnet sync overall
  const mainnetSyncAvg = mainnetNodes.length > 0
    ? mainnetNodes.reduce((s, n) => s + (n.syncPercent || 0), 0) / mainnetNodes.length
    : 0;

  // Filter nodes
  const filteredNodes = nodes.filter(n => {
    if (activeFilter === 'all') return true;
    return n.status === activeFilter;
  });

  const secondsAgo = Math.floor((Date.now() - lastRefresh) / 1000);
  const refreshLabel = secondsAgo < 5 ? "just now" : `${secondsAgo}s ago`;

  // Issues count from window/sidebar (static for now)
  const openIssues = 21;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @keyframes fadeSliceIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes drawLine { to { stroke-dashoffset: 0; } }
        @keyframes barGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes glassIn { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.2); } }
        @keyframes chainSlide { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes dataFlow { 0% { transform: translateX(0); opacity: 0; } 50% { opacity: 1; } 100% { transform: translateX(10px); opacity: 0; } }
        @keyframes sidebarIn { from { opacity: 0; transform: translateX(-16px); } to { opacity: 1; transform: translateX(0); } }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.1); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(0,212,255,0.2); }
      `}</style>

      <div style={{
        display: "flex", height: "100vh",
        background: "radial-gradient(ellipse at 20% 0%, rgba(0,30,60,0.4) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(0,20,40,0.3) 0%, transparent 50%), #06080C",
        fontFamily: "'Outfit', -apple-system, sans-serif", color: "white", overflow: "hidden", position: "relative",
      }}>
        <NetworkCanvas />

        {/* SIDEBAR */}
        <div style={{
          width: 240, borderRight: "1px solid rgba(255,255,255,0.05)", padding: "24px 14px", display: "flex",
          flexDirection: "column", gap: 2, background: "rgba(6,8,12,0.85)", backdropFilter: "blur(60px)",
          WebkitBackdropFilter: "blur(60px)", zIndex: 10, animation: "sidebarIn 0.6s ease", flexShrink: 0,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12, padding: "6px 14px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.05)", marginBottom: 20,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,212,255,0.05))",
              border: "1px solid rgba(0,212,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 20px rgba(0,212,255,0.1)",
            }}>
              <svg width="18" height="18" viewBox="0 0 18 18">
                <polygon points="9,1 16,5 16,13 9,17 2,13 2,5" fill="none" stroke="rgba(0,212,255,0.8)" strokeWidth="1.5" />
                <circle cx="9" cy="9" r="2" fill="rgba(0,212,255,0.6)" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.03em", color: "white" }}>SkyNet</div>
              <div style={{ fontSize: 9, color: "rgba(0,212,255,0.5)", letterSpacing: "0.1em", fontWeight: 600 }}>NETWORK MONITOR</div>
            </div>
          </div>

          <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.2)", padding: "8px 14px 4px", letterSpacing: "0.12em" }}>OVERVIEW</div>
          <NavItem icon="◉" label="Dashboard v2" active href="/v2" />
          <NavItem icon="◎" label="Classic View" href="/" />
          <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.2)", padding: "20px 14px 4px", letterSpacing: "0.12em" }}>OPERATIONS</div>
          <NavItem icon="⬡" label="Nodes" href="/nodes" />
          <NavItem icon="⊞" label="Fleet" href="/fleet" />
          <NavItem icon="⚡" label="Alerts" href="/alerts" />
          <NavItem icon="⚠" label="Issues" badge={openIssues} href="/issues" />
          <NavItem icon="◧" label="Analytics" href="/analytics" />
          <div style={{ fontSize: 9, fontWeight: 600, color: "rgba(255,255,255,0.2)", padding: "20px 14px 4px", letterSpacing: "0.12em" }}>NETWORK</div>
          <NavItem icon="◈" label="Network Stats" href="/network" />
          <NavItem icon="⊛" label="Peers" href="/peers" />
          <NavItem icon="◆" label="Masternodes" href="/masternodes" />
          <div style={{ flex: 1 }} />
          <div style={{ padding: "16px 14px", borderTop: "1px solid rgba(255,255,255,0.05)", marginTop: 8 }}>
            <div style={{ fontSize: 10, color: "rgba(0,212,255,0.4)", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em", marginBottom: 8 }}>
              {time.toLocaleTimeString()} IST
            </div>
            <NavItem icon="⊕" label="Explorer" href="/explorer" />
            <NavItem icon="◱" label="Register Node" href="/register" />
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div style={{ flex: 1, overflow: "auto", padding: "32px 40px", zIndex: 10, position: "relative" }}>

          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh", flexDirection: "column", gap: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid rgba(0,212,255,0.2)", borderTop: "2px solid rgba(0,212,255,0.8)", animation: "spin 1s linear infinite" }} />
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Loading fleet data...</span>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <>
              {/* HEADER */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 36, opacity: 0, animation: "fadeUp 0.8s ease 0.1s forwards" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                    <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.04em", background: "linear-gradient(135deg, white 60%, rgba(0,212,255,0.6))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                      Network Health
                    </h1>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 20,
                      background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.12)",
                    }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#0AD4FF", boxShadow: "0 0 8px rgba(0,212,255,0.6)", animation: "pulse 2s ease infinite" }} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(0,212,255,0.7)", letterSpacing: "0.06em" }}>LIVE</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", fontWeight: 400 }}>All Networks · Updated {refreshLabel}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <ChainBlocks />
                  <div style={{
                    width: 60, height: 60, borderRadius: 18,
                    background: `linear-gradient(135deg, rgba(48,209,88,0.12), rgba(48,209,88,0.04))`,
                    border: "1px solid rgba(48,209,88,0.2)", display: "flex", alignItems: "center",
                    justifyContent: "center", flexDirection: "column", boxShadow: "0 0 30px rgba(48,209,88,0.08)",
                  }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: "#30D158", lineHeight: 1 }}>{fleet?.healthScore ?? 0}</span>
                    <span style={{ fontSize: 7, fontWeight: 700, color: "rgba(48,209,88,0.6)", letterSpacing: "0.1em" }}>SCORE</span>
                  </div>
                </div>
              </div>

              {/* HEX METRICS */}
              <div style={{ display: "flex", gap: 10, marginBottom: 28, opacity: 0, animation: "fadeUp 0.7s ease 0.2s forwards" }}>
                <HexIndicator value={total} max={total} color="#0AD4FF" label="Total Nodes" />
                <HexIndicator value={healthy} max={total} color="#30D158" label="Healthy" />
                <HexIndicator value={syncing} max={total} color="#0A84FF" label="Syncing" />
                <HexIndicator value={offline} max={total} color="#FF453A" label="Offline" />
                <HexIndicator value={totalPeers} max={Math.max(totalPeers, 100)} color="rgba(255,255,255,0.3)" label="Total Peers" />
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                  padding: "16px 20px", background: "rgba(255,159,10,0.04)", borderRadius: 16,
                  border: "1px solid rgba(255,159,10,0.1)", minWidth: 100, flex: 1,
                }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: "#FF9F0A", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.04em" }}>
                    {avgSync.toFixed(1)}<span style={{ fontSize: 14, fontWeight: 500, opacity: 0.6 }}>%</span>
                  </span>
                  <span style={{ fontSize: 10, color: "rgba(255,159,10,0.5)", fontWeight: 500 }}>Avg Sync</span>
                </div>
              </div>

              {/* CHARTS */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 28 }}>
                <GlassCard delay={0.3} style={{ padding: 28 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 22, color: "rgba(255,255,255,0.9)" }}>Client Distribution</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                    <DonutChart data={clientData.length > 0 ? clientData : [{ name: "Loading", value: 1, color: "rgba(255,255,255,0.1)" }]} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {clientData.map((d, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 3, background: d.color, boxShadow: `0 0 8px ${d.color}30` }} />
                          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", flex: 1, minWidth: 60 }}>{d.name}</span>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "white", fontVariantNumeric: "tabular-nums" }}>{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>

                <GlassCard delay={0.35} style={{ padding: 28 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 22, color: "rgba(255,255,255,0.9)" }}>OS Distribution</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                    <DonutChart data={osData.length > 0 ? osData : [{ name: "Linux", value: total, color: "#64D2FF" }]} size={130} />
                    <div>
                      {osData.map((os, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: 18 }}>{os.name === 'Ubuntu' ? '🐧' : os.name === 'Alpine' ? '🐳' : '💻'}</span>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700 }}>{os.name}</div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{os.value} nodes</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>

                <GlassCard delay={0.4} style={{ padding: 28 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 22, color: "rgba(255,255,255,0.9)" }}>Fleet by Network</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {[
                      { name: "Mainnet", count: mainnetNodes.length, color: "#0AD4FF" },
                      { name: "Apothem", count: nodes.filter(n => n.network === 'apothem').length, color: "#BF5AF2" },
                      { name: "Devnet", count: nodes.filter(n => n.network === 'devnet').length, color: "#30D158" },
                    ].map((net, i) => (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "14px 16px", borderRadius: 14,
                        background: net.count > 0 ? `${net.color}08` : "rgba(255,255,255,0.015)",
                        border: `1px solid ${net.count > 0 ? `${net.color}15` : "rgba(255,255,255,0.03)"}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 3, background: net.color, opacity: net.count > 0 ? 1 : 0.2, boxShadow: net.count > 0 ? `0 0 8px ${net.color}40` : "none" }} />
                          <span style={{ fontSize: 13, fontWeight: 500, color: net.count > 0 ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.25)" }}>{net.name}</span>
                        </div>
                        <span style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: net.count > 0 ? "white" : "rgba(255,255,255,0.15)" }}>{net.count}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontWeight: 500 }}>Mainnet Sync</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#FF9F0A", fontFamily: "'JetBrains Mono', monospace" }}>{mainnetSyncAvg.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                      <div style={{
                        width: `${Math.max(mainnetSyncAvg, 0.5)}%`, minWidth: 8, height: "100%", borderRadius: 2,
                        background: "linear-gradient(90deg, #FF9F0A, #FFD60A)",
                        boxShadow: "0 0 12px rgba(255,159,10,0.3)",
                        animation: "barGrow 1.5s ease forwards", transformOrigin: "left",
                      }} />
                    </div>
                  </div>
                </GlassCard>
              </div>

              {/* BLOCK TIPS */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28, opacity: 0, animation: "fadeUp 0.7s ease 0.45s forwards" }}>
                {[
                  { label: "Mainnet Tip", value: mainnetTip.toLocaleString(), hash: "chain:50" },
                  { label: "Apothem Tip", value: apothemTip > 0 ? apothemTip.toLocaleString() : "—", hash: "chain:51" },
                ].map((tip, i) => (
                  <div key={i} style={{
                    background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 16, padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center",
                    backdropFilter: "blur(20px)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <svg width="16" height="16" viewBox="0 0 16 16">
                        <polygon points="8,1 14,5 14,11 8,15 2,11 2,5" fill="none" stroke="rgba(0,212,255,0.3)" strokeWidth="1" />
                      </svg>
                      <div>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", marginBottom: 2 }}>{tip.label}</div>
                        <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "rgba(0,212,255,0.35)" }}>{tip.hash}</span>
                      </div>
                    </div>
                    <span style={{ fontSize: 20, fontWeight: 800, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.03em" }}>{tip.value}</span>
                  </div>
                ))}
              </div>

              {/* INCIDENTS */}
              <GlassCard delay={0.5} style={{ padding: "18px 26px", marginBottom: 28 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#30D158", boxShadow: "0 0 14px rgba(48,209,88,0.5)", animation: "pulse 2.5s ease infinite" }} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Active Incidents</span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "5px 16px", borderRadius: 20,
                    background: "rgba(48,209,88,0.08)", color: "rgba(48,209,88,0.7)", border: "1px solid rgba(48,209,88,0.15)",
                  }}>All clear — no active incidents</span>
                </div>
              </GlassCard>

              {/* NODES */}
              <div style={{ opacity: 0, animation: "fadeUp 0.7s ease 0.55s forwards" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", background: "linear-gradient(135deg, white 70%, rgba(0,212,255,0.5))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Nodes</h2>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>{filteredNodes.length} of {total}</span>
                  </div>
                  <div style={{ display: "flex", gap: 3, background: "rgba(255,255,255,0.03)", borderRadius: 14, padding: 3, border: "1px solid rgba(255,255,255,0.05)" }}>
                    {["all", "healthy", "syncing", "offline"].map((f) => (
                      <button key={f} onClick={() => setActiveFilter(f)} style={{
                        padding: "6px 16px", borderRadius: 11, border: "none",
                        background: activeFilter === f ? "rgba(0,212,255,0.12)" : "transparent",
                        color: activeFilter === f ? "rgba(0,212,255,0.9)" : "rgba(255,255,255,0.3)",
                        fontSize: 12, fontWeight: 500, cursor: "pointer", transition: "all 0.25s ease",
                        fontFamily: "'Outfit', sans-serif", textTransform: "capitalize",
                      }}>{f === "all" ? `All ${total}` : f}</button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 16 }}>
                  {filteredNodes.map((node, i) => <NodeCard key={node.id} node={node} index={i} />)}
                </div>
              </div>
              <div style={{ height: 60 }} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
