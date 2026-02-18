'use client';

import { useMemo, useState } from 'react';

interface ClientDistributionItem {
  type: string;
  count: number;
  color: string;
  icon?: string;
  percentage?: number;
}

interface ClientDistributionChartProps {
  data: ClientDistributionItem[];
  total: number;
  variant?: 'donut' | 'pie' | '3d-donut';
  showCenterGlow?: boolean;
}

export default function ClientDistributionChart({ 
  data, 
  total,
  variant = '3d-donut',
  showCenterGlow = true
}: ClientDistributionChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const size = 220;
  const strokeWidth = 35;
  const radius = (size - strokeWidth) / 2;
  
  const segments = useMemo(() => {
    let currentAngle = -90;
    
    return data.map((item, index) => {
      const percentage = total > 0 ? (item.count / total) * 100 : 0;
      const angle = (percentage / 100) * 360;
      
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      
      const x1 = size / 2 + radius * Math.cos(startRad);
      const y1 = size / 2 + radius * Math.sin(startRad);
      const x2 = size / 2 + radius * Math.cos(endRad);
      const y2 = size / 2 + radius * Math.sin(endRad);
      
      const largeArc = angle > 180 ? 1 : 0;
      
      const cx = size / 2;
      const cy = size / 2;
      const outerPath = "M " + cx + " " + cy + " L " + x1 + " " + y1 + " A " + radius + " " + radius + " 0 " + largeArc + " 1 " + x2 + " " + y2 + " Z";
      
      const midAngle = (startAngle + endAngle) / 2;
      const midRad = (midAngle * Math.PI) / 180;
      const labelRadius = radius * 0.65;
      const labelX = size / 2 + labelRadius * Math.cos(midRad);
      const labelY = size / 2 + labelRadius * Math.sin(midRad);
      
      const depth = 12;
      const y1Bottom = size / 2 + radius * Math.sin(startRad) + depth;
      const y2Bottom = size / 2 + radius * Math.sin(endRad) + depth;
      
      const depthPath = "M " + x2 + " " + y2 + " L " + x2 + " " + y2Bottom + " A " + radius + " " + radius + " 0 " + largeArc + " 0 " + x1 + " " + y1Bottom + " L " + x1 + " " + y1;
      
      currentAngle = endAngle;
      
      return {
        ...item,
        percentage,
        outerPath,
        labelX,
        labelY,
        startAngle,
        endAngle,
        midAngle,
        depthPath,
      };
    });
  }, [data, total, radius, size, strokeWidth]);
  
  if (total === 0 || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <p className="text-sm text-[#6B7280]">No client data available</p>
      </div>
    );
  }
  
  const is3D = variant === '3d-donut';
  const viewBoxHeight = size + (is3D ? 20 : 0);
  
  return (
    <div className="flex flex-col items-center">
      <div 
        className={is3D ? "relative transition-all duration-500 ease-out hover:scale-[1.02] [perspective:1200px]" : "relative transition-all duration-500 ease-out hover:scale-[1.02]"}
        style={{ perspective: is3D ? '1200px' : undefined }}
      >
        <svg
          viewBox={"0 0 " + size + " " + viewBoxHeight}
          className={is3D 
            ? "w-full max-w-[220px] transition-all duration-500 [transform:rotateX(20deg)_rotateY(-15deg)] hover:[transform:rotateX(15deg)_rotateY(-10deg)_scale(1.02)] drop-shadow-[0_16px_32px_rgba(0,0,0,0.5)]"
            : "w-full max-w-[220px] transition-all duration-500 drop-shadow-[0_4px_6px_rgba(0,0,0,0.3)]"
          }
          style={{
            transform: is3D ? 'rotateX(20deg) rotateY(-15deg)' : undefined,
            transformOrigin: 'center center',
            filter: is3D ? 'drop-shadow(0 16px 32px rgba(0,0,0,0.5))' : undefined,
          }}
        >
          <defs>
            <linearGradient id="depth-top" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
              <stop offset="40%" stopColor="transparent" />
            </linearGradient>
            <radialGradient id="glow-center" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(30,144,255,0.3)" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>
          
          {is3D && segments.map((segment, index) => (
            <g key={"shadow-" + segment.type} opacity="0.3">
              <path d={segment.depthPath} fill={segment.color} transform="translate(0, 8)" />
            </g>
          ))}
          
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth={strokeWidth} />
          
          {segments.map((segment, index) => {
            const isHovered = hoveredIndex === index;
            const isAnyHovered = hoveredIndex !== null;
            
            return (
              <g 
                key={segment.type}
                className="transition-all duration-300 cursor-pointer"
                style={{
                  filter: isHovered 
                    ? 'drop-shadow(0 12px 24px rgba(0,0,0,0.6)) brightness(1.15)' 
                    : isAnyHovered && !isHovered
                    ? 'brightness(0.7)'
                    : undefined,
                  transform: isHovered ? 'translateZ(10px)' : undefined,
                }}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {is3D && (
                  <path d={segment.depthPath} fill={segment.color} opacity="0.6" style={{ filter: 'brightness(0.7)' }} />
                )}
                <path d={segment.outerPath} fill={segment.color} opacity={is3D ? 0.95 : 0.9} stroke="rgba(0,0,0,0.2)" strokeWidth="1" />
                {is3D && (
                  <path d={segment.outerPath} fill="url(#depth-top)" opacity="0.5" />
                )}
                {segment.percentage >= 8 && (
                  <text x={segment.labelX} y={segment.labelY} textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="13" fontWeight="bold" className="pointer-events-none" style={{ textShadow: '0 2px 4px rgba(0, 0, 0, 0.8)' }}>
                    {segment.percentage.toFixed(0)}%
                  </text>
                )}
              </g>
            );
          })}
          
          <circle cx={size / 2} cy={size / 2} r={radius - strokeWidth} fill="#111827" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          
          {showCenterGlow && is3D && (
            <circle cx={size / 2} cy={size / 2} r={radius - strokeWidth - 5} fill="url(#glow-center)" opacity="0.5" />
          )}
          
          <text x={size / 2} y={size / 2 - 10} textAnchor="middle" dominantBaseline="middle" fill="#F9FAFB" fontSize="28" fontWeight="bold" className="pointer-events-none" style={{ textShadow: is3D ? '0 2px 8px rgba(0,0,0,0.5)' : undefined }}>
            {total}
          </text>
          <text x={size / 2} y={size / 2 + 14} textAnchor="middle" dominantBaseline="middle" fill="#6B7280" fontSize="13" className="pointer-events-none">
            nodes
          </text>
          
          {is3D && (
            <ellipse cx={size / 2} cy={size / 2 + radius + 10} rx={radius * 0.8} ry={radius * 0.15} fill="url(#glow-center)" opacity="0.3" />
          )}
        </svg>
      </div>
      
      <div className="w-full space-y-2 mt-4">
        {segments.map((segment, index) => (
          <div
            key={segment.type}
            className={
              hoveredIndex === index 
                ? "flex items-center justify-between p-2.5 rounded-lg transition-all duration-200 bg-[rgba(255,255,255,0.08)] scale-[1.02]"
                : hoveredIndex !== null && hoveredIndex !== index
                ? "flex items-center justify-between p-2.5 rounded-lg transition-all duration-200 opacity-50"
                : "flex items-center justify-between p-2.5 rounded-lg transition-all duration-200 bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)]"
            }
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            style={{ transform: hoveredIndex === index ? 'translateX(4px)' : undefined }}
          >
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full flex-shrink-0 shadow-lg" style={{ backgroundColor: segment.color, boxShadow: "0 0 12px " + segment.color + "60" }} />
              <span className="text-sm text-[#F9FAFB] capitalize font-medium">
                {segment.icon && <span className="mr-1.5">{segment.icon}</span>}
                {segment.type}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold text-[#F9FAFB] min-w-[30px] text-right">{segment.count}</span>
              <span className="text-xs text-[#6B7280] min-w-[45px] text-right font-mono">{segment.percentage.toFixed(1)}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function parseOsFromVersion(clientVersion: string): string {
  if (!clientVersion) return 'unknown';
  const match = clientVersion.match(/\/(linux|darwin|windows)-/i);
  return match ? match[1].toLowerCase() : 'unknown';
}

export function parseArchFromVersion(clientVersion: string): string {
  if (!clientVersion) return '';
  const match = clientVersion.match(/\/(?:linux|darwin|windows)-(amd64|arm64|x64|x86|386|armv7)/i);
  return match ? match[1].toLowerCase() : '';
}

export function parseClientVersion(clientVersion: string): {
  client: string;
  version: string;
  os_type: string;
  os_arch: string;
  runtime: string;
} {
  if (!clientVersion) {
    return { client: 'Unknown', version: '', os_type: 'unknown', os_arch: '', runtime: '' };
  }
  const parts = clientVersion.split('/');
  return {
    client: parts[0] || 'Unknown',
    version: parts[1] || '',
    os_type: parseOsFromVersion(clientVersion),
    os_arch: parseArchFromVersion(clientVersion),
    runtime: parts[3] || '',
  };
}
