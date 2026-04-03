'use client';

/**
 * SystemInfoPanel — Issue #6
 * Displays OS, CPU, RAM, disk, and storage type from node data.
 */

import { NodeDetail, NodeStatus } from './types';

interface SystemInfoPanelProps {
  node: NodeDetail;
  status: NodeStatus | null;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-700 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-white text-sm font-mono">{value ?? '—'}</span>
    </div>
  );
}

function UsageBar({ percent, label }: { percent: number; label: string }) {
  const color =
    percent >= 90 ? 'bg-red-500' : percent >= 70 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span>{percent.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default function SystemInfoPanel({ node, status }: SystemInfoPanelProps) {
  const sys = status?.system;
  const storage = status?.storage;
  const os = status?.os ?? node.os_info;

  const diskUsed = sys ? `${sys.diskUsedGb.toFixed(1)} GB / ${sys.diskTotalGb.toFixed(1)} GB` : null;
  const osString = os
    ? [os.type, os.release, os.arch].filter(Boolean).join(' ')
    : null;

  return (
    <div className="bg-gray-800 rounded-xl p-5 space-y-5">
      <h2 className="text-lg font-semibold text-white">System Info</h2>

      {/* Usage bars */}
      {sys && (
        <div>
          <UsageBar percent={sys.cpuPercent} label="CPU" />
          <UsageBar percent={sys.memoryPercent} label="RAM" />
          <UsageBar percent={sys.diskPercent} label="Disk" />
        </div>
      )}

      {/* Details */}
      <div>
        <Row label="OS" value={osString ?? node.os_info?.type} />
        <Row label="Kernel" value={os?.kernel} />
        <Row label="Arch" value={os?.arch} />
        <Row label="CPU Usage" value={sys ? `${sys.cpuPercent.toFixed(1)}%` : null} />
        <Row label="RAM Usage" value={sys ? `${sys.memoryPercent.toFixed(1)}%` : null} />
        <Row label="Disk Used" value={diskUsed} />
        <Row label="Storage Type" value={storage?.storageType ?? storage?.storageModel} />
        <Row label="Storage IOPS" value={storage?.iopsEstimate ? `~${storage.iopsEstimate}` : null} />
        <Row label="Mount Point" value={storage?.mountPoint} />
        <Row label="Mount Usage" value={storage?.mountPercent != null ? `${storage.mountPercent.toFixed(1)}%` : null} />
        <Row label="DB Engine" value={status?.dbEngine} />
        <Row label="Chain Data" value={storage?.chainDataSize != null ? `${(storage.chainDataSize / 1e9).toFixed(2)} GB` : null} />
        <Row label="State Scheme" value={node.state_scheme} />
        <Row label="IPv4" value={status?.ipv4 ?? node.ipv4} />
        <Row label="IPv6" value={status?.ipv6 ?? node.ipv6} />
      </div>
    </div>
  );
}
