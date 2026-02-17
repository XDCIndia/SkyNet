'use client';

import { useMemo } from 'react';

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
}

/**
 * Pure SVG Donut Chart for Client Distribution
 * No external chart libraries - just SVG and CSS
 */
export default function ClientDistributionChart({ data, total }: ClientDistributionChartProps) {
  const size = 200;
  const strokeWidth = 30;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Calculate segments
  const segments = useMemo(() => {
    let currentAngle = -90; // Start at top
    
    return data.map((item) => {
      const percentage = total > 0 ? (item.count / total) * 100 : 0;
      const angle = (percentage / 100) * 360;
      
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      
      // Calculate arc path
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      
      const x1 = size / 2 + radius * Math.cos(startRad);
      const y1 = size / 2 + radius * Math.sin(startRad);
      const x2 = size / 2 + radius * Math.cos(endRad);
      const y2 = size / 2 + radius * Math.sin(endRad);
      
      const largeArc = angle > 180 ? 1 : 0;
      
      const pathData = `
        M ${size / 2} ${size / 2}
        L ${x1} ${y1}
        A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
        Z
      `;
      
      // Calculate label position (middle of segment)
      const midAngle = (startAngle + endAngle) / 2;
      const midRad = (midAngle * Math.PI) / 180;
      const labelRadius = radius * 0.7;
      const labelX = size / 2 + labelRadius * Math.cos(midRad);
      const labelY = size / 2 + labelRadius * Math.sin(midRad);
      
      currentAngle = endAngle;
      
      return {
        ...item,
        percentage,
        pathData,
        labelX,
        labelY,
        startAngle,
        endAngle,
      };
    });
  }, [data, total, radius, size]);
  
  if (total === 0 || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <p className="text-sm text-[#6B7280]">No client data available</p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center">
      {/* SVG Donut Chart */}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full max-w-[200px] mb-4"
        style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3))' }}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth={strokeWidth}
        />
        
        {/* Donut segments */}
        {segments.map((segment, index) => (
          <g key={segment.type}>
            <path
              d={segment.pathData}
              fill={segment.color}
              opacity={0.9}
              className="transition-opacity hover:opacity-100 cursor-pointer"
            />
            
            {/* Percentage label in center of segment */}
            {segment.percentage >= 10 && (
              <text
                x={segment.labelX}
                y={segment.labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fff"
                fontSize="14"
                fontWeight="bold"
                className="pointer-events-none"
                style={{ textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)' }}
              >
                {segment.percentage.toFixed(0)}%
              </text>
            )}
          </g>
        ))}
        
        {/* Center circle to create donut hole */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius - strokeWidth}
          fill="#111827"
        />
        
        {/* Total count in center */}
        <text
          x={size / 2}
          y={size / 2 - 8}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#F9FAFB"
          fontSize="24"
          fontWeight="bold"
          className="pointer-events-none"
        >
          {total}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 12}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#6B7280"
          fontSize="12"
          className="pointer-events-none"
        >
          nodes
        </text>
      </svg>
      
      {/* Legend */}
      <div className="w-full space-y-2">
        {segments.map((segment) => (
          <div
            key={segment.type}
            className="flex items-center justify-between p-2 rounded-lg bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.05)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-sm text-[#F9FAFB] capitalize">
                {segment.icon && <span className="mr-1">{segment.icon}</span>}
                {segment.type}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-[#F9FAFB]">
                {segment.count}
              </span>
              <span className="text-xs text-[#6B7280] min-w-[45px] text-right">
                {segment.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
