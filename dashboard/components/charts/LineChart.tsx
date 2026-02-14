'use client';

import React from 'react';

export interface LineChartProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  showDots?: boolean;
  showArea?: boolean;
  labels?: string[];
  title?: string;
  unit?: string;
  strokeWidth?: number;
  className?: string;
}

/**
 * LineChart - Full-featured SVG line chart
 * Pure SVG implementation with optional area fill, dots, and labels
 */
export function LineChart({
  data,
  color = '#1E90FF',
  height = 200,
  width = 600,
  showDots = false,
  showArea = true,
  labels = [],
  title = '',
  unit = '',
  strokeWidth = 2,
  className = '',
}: LineChartProps) {
  // Don't render if no data
  if (!data || data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-900/50 rounded-lg ${className}`}
        style={{ height, width }}
      >
        <span className="text-gray-500 text-sm">No data available</span>
      </div>
    );
  }

  // Chart dimensions (accounting for padding and labels)
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Calculate points
  const points = data.map((value, index) => {
    const x = padding.left + (index / (data.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - ((value - min) / range) * chartHeight;
    return { x, y, value };
  });

  // Polyline path
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');

  // Area path (close the polygon at bottom)
  const areaPath = showArea
    ? `${linePath} L ${points[points.length - 1].x},${padding.top + chartHeight} L ${padding.left},${padding.top + chartHeight} Z`
    : '';

  // Gradient ID (unique per component instance)
  const gradientId = `gradient-${Math.random().toString(36).substr(2, 9)}`;

  // Format labels
  const showLabels = labels.length > 0 && labels.length === data.length;
  const labelStep = Math.max(1, Math.floor(data.length / 5)); // Show ~5 labels

  return (
    <div className={`${className}`}>
      {title && <div className="text-sm font-medium text-gray-300 mb-2">{title}</div>}
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          {showArea && (
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          )}
        </defs>

        {/* Grid lines */}
        <g>
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = padding.top + chartHeight * (1 - fraction);
            return (
              <line
                key={fraction}
                x1={padding.left}
                y1={y}
                x2={padding.left + chartWidth}
                y2={y}
                stroke="#1F2937"
                strokeWidth={1}
                strokeDasharray="2,2"
              />
            );
          })}
        </g>

        {/* Y-axis labels */}
        <g>
          {[0, 0.5, 1].map((fraction) => {
            const y = padding.top + chartHeight * (1 - fraction);
            const value = min + range * fraction;
            return (
              <text
                key={fraction}
                x={padding.left - 10}
                y={y}
                textAnchor="end"
                alignmentBaseline="middle"
                fill="#6B7280"
                fontSize="11"
              >
                {value.toFixed(0)}
                {unit}
              </text>
            );
          })}
        </g>

        {/* Area fill */}
        {showArea && areaPath && (
          <path d={areaPath} fill={`url(#${gradientId})`} />
        )}

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {showDots &&
          points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={3}
              fill={color}
              stroke="#0A0E1A"
              strokeWidth={1.5}
            />
          ))}

        {/* X-axis labels */}
        {showLabels && (
          <g>
            {points.map((point, index) => {
              if (index % labelStep !== 0 && index !== data.length - 1) return null;
              return (
                <text
                  key={index}
                  x={point.x}
                  y={padding.top + chartHeight + 15}
                  textAnchor="middle"
                  fill="#6B7280"
                  fontSize="10"
                >
                  {labels[index]}
                </text>
              );
            })}
          </g>
        )}
      </svg>
    </div>
  );
}

export default LineChart;
