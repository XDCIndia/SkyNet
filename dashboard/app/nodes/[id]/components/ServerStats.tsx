'use client';

import { Monitor, Cpu, MemoryStick, HardDrive } from 'lucide-react';
import { useAnimatedNumber } from '@/lib/animations';
import { formatBytes, formatNumber, getUsageColor } from '@/lib/formatters';
import type { NodeStatus } from './types';

interface ServerStatsProps {
  status: NodeStatus;
}

function CircularGauge({ 
  value, 
  label, 
  color,
  size = 80,
  strokeWidth = 6
}: { 
  value: number; 
  label: string; 
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  
  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.06)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{
              transition: 'stroke-dashoffset 0.5s ease-out',
              filter: `drop-shadow(0 0 4px ${color}50)`,
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold font-mono-nums" style={{ color }}>
            {Math.round(value)}%
          </span>
        </div>
      </div>
      <span className="section-header mt-2">{label}</span>
    </div>
  );
}

function ResourceBar({ label, used, total, icon: Icon }: { label: string; used: number; total: number; icon: any }) {
  const percentage = total > 0 ? (used / total) * 100 : 0;
  const color = getUsageColor(percentage);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[var(--text-tertiary)]" />
          <span className="text-sm text-[var(--text-secondary)]">{label}</span>
        </div>
        <div className="text-right">
          <span className="text-sm font-medium text-[var(--text-primary)]">{formatBytes(used)}</span>
          <span className="text-xs text-[var(--text-tertiary)] ml-1">/ {formatBytes(total)}</span>
        </div>
      </div>
      <div className="w-full h-2 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(100, percentage)}%`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}50`,
          }}
        />
      </div>
    </div>
  );
}

export default function ServerStats({ status }: ServerStatsProps) {
  const cpuUsage = status.system?.cpuPercent || 0;
  const memUsed = (status.system?.memoryPercent || 0) * 0.1; // Approximate bytes
  const memTotal = 100 * 0.1;
  const diskUsed = status.system?.diskUsedGb || 0;
  const diskTotal = status.system?.diskTotalGb || 1;
  
  const diskPercent = diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0;
  const memoryPercent = status.system?.memoryPercent || 0;
  
  const cpuColor = getUsageColor(cpuUsage);
  const memColor = getUsageColor(memoryPercent);
  const diskColor = getUsageColor(diskPercent);
  
  // Convert GB to bytes for display
  const diskUsedBytes = diskUsed * 1024 * 1024 * 1024;
  const diskTotalBytes = diskTotal * 1024 * 1024 * 1024;
  
  return (
    <div className="card-xdc">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--critical)]/20 to-[var(--warning)]/10 flex items-center justify-center">
          <Monitor className="w-5 h-5 text-[var(--critical)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Server Resources</h2>
          <div className="text-sm text-[var(--text-tertiary)]">System performance metrics</div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gauges */}
        <div className="grid grid-cols-3 gap-4">
          <CircularGauge 
            value={cpuUsage} 
            label="CPU" 
            color={cpuColor}
          />
          <CircularGauge 
            value={memoryPercent} 
            label="Memory" 
            color={memColor}
          />
          <CircularGauge 
            value={diskPercent} 
            label="Disk" 
            color={diskColor}
          />
        </div>
        
        {/* Resource Bars */}
        <div className="space-y-4">
          <ResourceBar
            label="Memory Usage"
            used={memUsed * 1024 * 1024 * 1024}
            total={memTotal * 1024 * 1024 * 1024}
            icon={MemoryStick}
          />
          
          <ResourceBar
            label="Disk Usage"
            used={diskUsedBytes}
            total={diskTotalBytes}
            icon={HardDrive}
          />
        </div>
      </div>
    </div>
  );
}
