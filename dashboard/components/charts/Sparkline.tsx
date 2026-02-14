'use client';

import React from 'react';

export interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  className?: string;
}

/**
 * Sparkline - Minimal inline SVG chart
 * Pure SVG implementation with no external dependencies
 */
export function Sparkline({
  data,
  color = '#1E90FF',
  width = 120,
  height = 40,
  strokeWidth = 2,
  className = '',
}: SparklineProps) {
  // Don't render if no data or insufficient data
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} className={className}>
        <text x="50%" y="50%" textAnchor="middle" fill="#6B7280" fontSize="10">
          No data
        </text>
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1; // Avoid division by zero

  // Calculate points for polyline
  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ display: 'block' }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default Sparkline;
