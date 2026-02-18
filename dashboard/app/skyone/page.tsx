'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { ExternalLink, Server } from 'lucide-react';

interface SkyOneClient {
  name: string;
  port: number;
  color: string;
  icon: string;
  description: string;
}

const clients: SkyOneClient[] = [
  {
    name: 'Geth XDC',
    port: 7070,
    color: '#1E90FF',
    icon: '🔷',
    description: 'XDC Geth client metrics and monitoring',
  },
  {
    name: 'Erigon XDC',
    port: 7071,
    color: '#8B5CF6',
    icon: '🟣',
    description: 'XDC Erigon client metrics and monitoring',
  },
  {
    name: 'Nethermind XDC',
    port: 7072,
    color: '#10B981',
    icon: '🟢',
    description: 'XDC Nethermind client metrics and monitoring',
  },
  {
    name: 'Rust XDC',
    port: 7073,
    color: '#F59E0B',
    icon: '🟠',
    description: 'XDC Rust client metrics and monitoring',
  },
];

export default function SkyOnePage() {
  const getUrl = (port: number) => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      return `http://${hostname}:${port}`;
    }
    return `http://localhost:${port}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">
            SkyOne Dashboard
          </h1>
          <p className="text-[var(--text-secondary)]">
            Client-specific monitoring and metrics for XDC node implementations
          </p>
        </div>

        {/* Client Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {clients.map((client) => (
            <a
              key={client.port}
              href={getUrl(client.port)}
              target="_blank"
              rel="noopener noreferrer"
              className="card-xdc group hover:border-[var(--accent-blue)]/30 transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{
                      backgroundColor: `${client.color}20`,
                      border: `1px solid ${client.color}40`,
                    }}
                  >
                    {client.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
                      {client.name}
                    </h3>
                    <p className="text-sm text-[var(--text-tertiary)]">
                      Port: {client.port}
                    </p>
                  </div>
                </div>
                <ExternalLink className="w-5 h-5 text-[var(--text-tertiary)] group-hover:text-[var(--accent-blue)] transition-colors" />
              </div>

              <p className="text-[var(--text-secondary)] mb-4">
                {client.description}
              </p>

              <div className="flex items-center gap-2 pt-3 border-t border-[var(--border-subtle)]">
                <Server className="w-4 h-4 text-[var(--text-tertiary)]" />
                <span className="text-sm font-mono text-[var(--text-tertiary)]">
                  {getUrl(client.port)}
                </span>
              </div>
            </a>
          ))}
        </div>

        {/* Info Box */}
        <div className="card-xdc bg-[var(--accent-blue)]/5 border-[var(--accent-blue)]/20">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-[var(--accent-blue)]/10">
              <Server className="w-5 h-5 text-[var(--accent-blue)]" />
            </div>
            <div>
              <h4 className="font-semibold text-[var(--text-primary)] mb-1">
                About SkyOne
              </h4>
              <p className="text-sm text-[var(--text-secondary)]">
                SkyOne provides real-time monitoring and metrics for each XDC client implementation.
                Each client runs on its dedicated port with specialized dashboards showing
                client-specific performance metrics, block production, peer connections, and more.
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
