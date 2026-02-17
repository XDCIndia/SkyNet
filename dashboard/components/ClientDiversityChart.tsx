'use client';

import { useMemo } from 'react';

interface ClientDistributionItem {
  type: string;
  count: number;
  color: string;
  icon?: string;
  percentage?: number;
}

interface ClientDiversityChartProps {
  data: ClientDistributionItem[];
  total: number;
  className?: string;
}

/**
 * SVG Donut Chart for Client Diversity
 * No external chart libraries - pure SVG/CSS
 */
export default function ClientDiversityChart({ data, total, className = '' }: ClientDiversityChartProps) {
  const chartData = useMemo(() => {
    if (!data.length || total === 0) return { segments: [], centerText: '0' };
    
    const radius = 40;
    const center = 50;
    const circumference = 2 * Math.PI * radius;
    let currentOffset = 0;
    
    const segments = data.map((item) => {
      const percentage = item.percentage || (item.count / total) * 100;
      const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
      const segment = {
        ...item,
        percentage,
        strokeDasharray,
        strokeDashoffset: -currentOffset,
        circumference,
      };
      currentOffset += (percentage / 100) * circumference;
      return segment;
    });
    
    return {
      segments,
      centerText: total.toString(),
    };
  }, [data, total]);

  if (!data.length || total === 0) {
    return (
      <div className={`flex flex-col items-center justify-center p-6 ${className}`}>
        <div className="text-[#6B7280] text-sm">No client data available</div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Donut Chart */}
      <div className="relative flex items-center justify-center mb-4">
        <svg 
          viewBox="0 0 100 100" 
          className="w-40 h-40 transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="12"
          />
          
          {/* Data segments */}
          {chartData.segments.map((segment, index) => (
            <circle
              key={segment.type}
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={segment.color}
              strokeWidth="12"
              strokeDasharray={segment.strokeDasharray}
              strokeDashoffset={segment.strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
              style={{
                filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.3))',
              }}
            />
          ))}
        </svg>
        
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-[#F9FAFB]">{chartData.centerText}</span>
          <span className="text-xs text-[#6B7280]">nodes</span>
        </div>
      </div>
      
      {/* Legend */}
      <div className="space-y-2">
        {chartData.segments.map((segment) => (
          <div 
            key={segment.type}
            className="flex items-center justify-between p-2 rounded-lg bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{segment.icon}</span>
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="text-sm text-[#F9FAFB] capitalize">
                  {segment.type === 'geth-pr5' ? 'Geth PR5' : segment.type}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-[#F9FAFB]">{segment.count}</span>
              <span className="text-xs text-[#6B7280] w-12 text-right">
                {segment.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
