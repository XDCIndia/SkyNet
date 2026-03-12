'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';

interface Node {
  id: string;
  name: string;
  clientType: string;
  clientVersion: string;
  status: string;
  blockHeight: number;
  blockHash?: string;
  syncPercent: number;
  peerCount: number;
  cpuPercent: number;
  memoryPercent: number;
  isSyncing: boolean;
  lastSeen: string;
  network: string;
}

interface ClientGroup {
  clientType: string;
  nodes: Node[];
  bestHeight: number;
  consensusHash: string | null;
}

// Client type display names and colors
const CLIENT_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  geth: { label: 'GP5', color: '#0A84FF', bgColor: 'rgba(10,132,255,0.1)' },
  erigon: { label: 'Erigon', color: '#FF9F0A', bgColor: 'rgba(255,159,10,0.1)' },
  nethermind: { label: 'NM', color: '#BF5AF2', bgColor: 'rgba(191,90,242,0.1)' },
  reth: { label: 'Reth', color: '#30D158', bgColor: 'rgba(48,209,88,0.1)' },
};

function getClientConfig(clientType: string) {
  const key = clientType?.toLowerCase() || 'unknown';
  return CLIENT_CONFIG[key] || { 
    label: clientType || 'Unknown', 
    color: '#8E8E93', 
    bgColor: 'rgba(142,142,147,0.1)' 
  };
}

function formatNumber(num: number): string {
  return num?.toLocaleString() || '0';
}

function statusColor(value: number, thresholds: { warning: number; critical: number }) {
  if (value >= thresholds.critical) return '#FF453A';
  if (value >= thresholds.warning) return '#FF9F0A';
  return '#30D158';
}

function blockHeightColor(height: number, maxHeight: number): string {
  const diff = maxHeight - height;
  if (diff > 100) return '#FF453A'; // Critical - more than 100 blocks behind
  if (diff > 50) return '#FF9F0A';  // Warning - more than 50 blocks behind
  if (diff > 10) return '#FFD60A';  // Caution - more than 10 blocks behind
  return '#30D158';
}

export default function MultiClientPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [forkStatus, setForkStatus] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      // Fetch nodes
      const nodesRes = await fetch('/api/v1/nodes', { cache: 'no-store' });
      if (nodesRes.ok) {
        const nodesData = await nodesRes.json();
        setNodes(nodesData.nodes || []);
      }

      // Fetch fork status
      const forkRes = await fetch('/api/v1/network/fork-status', { cache: 'no-store' });
      if (forkRes.ok) {
        const forkData = await forkRes.json();
        setForkStatus(forkData);
      }

      setLastUpdated(0);
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 15000);
    return () => clearInterval(t);
  }, [fetchData]);

  useEffect(() => {
    const countdown = setInterval(() => {
      setLastUpdated(p => p + 1);
    }, 1000);
    return () => clearInterval(countdown);
  }, []);

  // Group nodes by client type
  const clientGroups = useMemo((): ClientGroup[] => {
    const groups = new Map<string, Node[]>();
    
    for (const node of nodes) {
      const clientType = node.clientType?.toLowerCase() || 'unknown';
      if (!groups.has(clientType)) {
        groups.set(clientType, []);
      }
      groups.get(clientType)!.push(node);
    }

    return Array.from(groups.entries()).map(([clientType, nodes]) => {
      const heights = nodes.map(n => n.blockHeight || 0);
      const bestHeight = Math.max(...heights, 0);
      
      // Find consensus hash (most common hash among nodes at best height)
      const hashCounts = new Map<string, number>();
      for (const node of nodes) {
        if (node.blockHash && node.blockHeight === bestHeight) {
          hashCounts.set(node.blockHash, (hashCounts.get(node.blockHash) || 0) + 1);
        }
      }
      let consensusHash: string | null = null;
      let maxCount = 0;
      for (const [hash, count] of hashCounts) {
        if (count > maxCount) {
          maxCount = count;
          consensusHash = hash;
        }
      }

      return { clientType, nodes, bestHeight, consensusHash };
    }).sort((a, b) => a.clientType.localeCompare(b.clientType));
  }, [nodes]);

  // Calculate global max height for comparison
  const globalMaxHeight = useMemo(() => {
    return Math.max(...clientGroups.map(g => g.bestHeight), 0);
  }, [clientGroups]);

  // Calculate aggregated metrics for each client
  const clientMetrics = useMemo(() => {
    return clientGroups.map(group => {
      const nodes = group.nodes;
      const heights = nodes.map(n => n.blockHeight || 0);
      const peers = nodes.map(n => n.peerCount || 0);
      const syncs = nodes.map(n => n.syncPercent || 0);
      const cpus = nodes.map(n => n.cpuPercent || 0).filter(v => v > 0);
      const mems = nodes.map(n => n.memoryPercent || 0).filter(v => v > 0);

      return {
        clientType: group.clientType,
        config: getClientConfig(group.clientType),
        nodeCount: nodes.length,
        maxHeight: Math.max(...heights, 0),
        minHeight: Math.min(...heights, 0),
        avgHeight: heights.reduce((a, b) => a + b, 0) / heights.length || 0,
        consensusHash: group.consensusHash,
        avgPeers: peers.reduce((a, b) => a + b, 0) / peers.length || 0,
        avgSync: syncs.reduce((a, b) => a + b, 0) / syncs.length || 0,
        avgCpu: cpus.length > 0 ? cpus.reduce((a, b) => a + b, 0) / cpus.length : 0,
        avgMemory: mems.length > 0 ? mems.reduce((a, b) => a + b, 0) / mems.length : 0,
        healthyNodes: nodes.filter(n => n.status === 'healthy').length,
        syncingNodes: nodes.filter(n => n.status === 'syncing' || n.isSyncing).length,
      };
    });
  }, [clientGroups]);

  // Check if all clients agree on the latest block hash
  const allClientsAgree = useMemo(() => {
    if (clientMetrics.length < 2) return true;
    const hashes = clientMetrics.map(m => m.consensusHash).filter(Boolean);
    if (hashes.length < 2) return true;
    return new Set(hashes).size === 1;
  }, [clientMetrics]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ 
          width: 36, 
          height: 36, 
          borderRadius: '50%', 
          border: '2px solid rgba(255,255,255,0.05)', 
          borderTop: '2px solid rgba(0,212,255,0.8)', 
          animation: 'spin 0.8s linear infinite' 
        }} />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        marginBottom: 24, 
        flexWrap: 'wrap', 
        gap: 12 
      }}>
        <div>
          <h1 style={{ 
            fontSize: 24, 
            fontWeight: 800, 
            letterSpacing: '-0.04em', 
            background: 'linear-gradient(135deg,white 60%,rgba(0,212,255,0.6))', 
            WebkitBackgroundClip: 'text', 
            WebkitTextFillColor: 'transparent', 
            margin: 0 
          }}>
            Multi-Client Comparison
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
            Cross-client consensus monitoring · auto-refresh 15s
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Consensus Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 16px',
            borderRadius: 10,
            background: allClientsAgree ? 'rgba(48,209,88,0.1)' : 'rgba(255,159,10,0.1)',
            border: `1px solid ${allClientsAgree ? 'rgba(48,209,88,0.3)' : 'rgba(255,159,10,0.3)'}`,
          }}>
            <span style={{ fontSize: 16 }}>{allClientsAgree ? '✅' : '⚠️'}</span>
            <span style={{ 
              fontSize: 12, 
              fontWeight: 600, 
              color: allClientsAgree ? '#30D158' : '#FF9F0A' 
            }}>
              {allClientsAgree ? 'Consensus' : 'Divergence Detected'}
            </span>
          </div>
          <button 
            onClick={fetchData}
            style={{ 
              padding: '8px 16px', 
              borderRadius: 10, 
              background: 'rgba(0,212,255,0.08)', 
              border: '1px solid rgba(0,212,255,0.2)', 
              color: 'rgba(0,212,255,0.9)', 
              fontSize: 12, 
              fontWeight: 600, 
              cursor: 'pointer' 
            }}
          >
            ↺ Refresh
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="v2-grid-4" style={{ marginBottom: 24 }}>
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '.1em', marginBottom: 8 }}>
            ACTIVE CLIENTS
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: '#0AD4FF' }}>
            {clientMetrics.length}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
            {nodes.length} total nodes
          </div>
        </div>
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '.1em', marginBottom: 8 }}>
            GLOBAL MAX HEIGHT
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: '#30D158' }}>
            {formatNumber(globalMaxHeight)}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
            best across all clients
          </div>
        </div>
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '.1em', marginBottom: 8 }}>
            CONSENSUS STATUS
          </div>
          <div style={{ 
            fontSize: 28, 
            fontWeight: 800, 
            letterSpacing: '-0.04em', 
            color: allClientsAgree ? '#30D158' : '#FF453A' 
          }}>
            {allClientsAgree ? 'SYNCED' : 'FORK'}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
            {allClientsAgree ? 'All clients agree' : 'Hash mismatch detected'}
          </div>
        </div>
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.3)', letterSpacing: '.1em', marginBottom: 8 }}>
            LAST UPDATE
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em', color: '#BF5AF2' }}>
            {lastUpdated}s
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
            ago
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'white' }}>
            Client Comparison Matrix
          </h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            Real-time metrics across all client implementations
          </p>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ 
                  padding: '14px 16px', 
                  textAlign: 'left', 
                  fontSize: 10, 
                  fontWeight: 600, 
                  color: 'rgba(255,255,255,0.4)', 
                  letterSpacing: '.1em',
                  borderBottom: '1px solid rgba(255,255,255,0.05)'
                }}>
                  METRIC
                </th>
                {clientMetrics.map(client => (
                  <th key={client.clientType} style={{ 
                    padding: '14px 16px', 
                    textAlign: 'center', 
                    fontSize: 10, 
                    fontWeight: 600, 
                    color: client.config.color, 
                    letterSpacing: '.1em',
                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                    background: client.config.bgColor
                  }}>
                    {client.config.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Nodes Count */}
              <tr>
                <td style={{ 
                  padding: '14px 16px', 
                  fontSize: 12, 
                  color: 'rgba(255,255,255,0.6)',
                  borderBottom: '1px solid rgba(255,255,255,0.03)'
                }}>
                  Active Nodes
                </td>
                {clientMetrics.map(client => (
                  <td key={client.clientType} style={{ 
                    padding: '14px 16px', 
                    textAlign: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.03)'
                  }}>
                    <span style={{ 
                      fontSize: 14, 
                      fontWeight: 700, 
                      color: 'white',
                      fontFamily: "'JetBrains Mono',monospace"
                    }}>
                      {client.nodeCount}
                    </span>
                    <span style={{ 
                      fontSize: 10, 
                      color: 'rgba(255,255,255,0.3)',
                      marginLeft: 4
                    }}>
                      ({client.healthyNodes} healthy)
                    </span>
                  </td>
                ))}
              </tr>

              {/* Block Height */}
              <tr>
                <td style={{ 
                  padding: '14px 16px', 
                  fontSize: 12, 
                  color: 'rgba(255,255,255,0.6)',
                  borderBottom: '1px solid rgba(255,255,255,0.03)'
                }}>
                  Block Height
                </td>
                {clientMetrics.map(client => {
                  const color = blockHeightColor(client.maxHeight, globalMaxHeight);
                  const diff = globalMaxHeight - client.maxHeight;
                  return (
                    <td key={client.clientType} style={{ 
                      padding: '14px 16px', 
                      textAlign: 'center',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      background: diff > 100 ? 'rgba(255,69,58,0.05)' : 'transparent'
                    }}>
                      <span style={{ 
                        fontSize: 16, 
                        fontWeight: 800, 
                        color,
                        fontFamily: "'JetBrains Mono',monospace"
                      }}>
                        {formatNumber(client.maxHeight)}
                      </span>
                      {diff > 0 && (
                        <span style={{ 
                          fontSize: 10, 
                          color: '#FF453A',
                          display: 'block',
                          marginTop: 2
                        }}>
                          -{diff} behind
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Peers */}
              <tr>
                <td style={{ 
                  padding: '14px 16px', 
                  fontSize: 12, 
                  color: 'rgba(255,255,255,0.6)',
                  borderBottom: '1px solid rgba(255,255,255,0.03)'
                }}>
                  Avg Peers
                </td>
                {clientMetrics.map(client => (
                  <td key={client.clientType} style={{ 
                    padding: '14px 16px', 
                    textAlign: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.03)'
                  }}>
                    <span style={{ 
                      fontSize: 14, 
                      fontWeight: 700, 
                      color: client.avgPeers > 10 ? '#30D158' : client.avgPeers > 5 ? '#FF9F0A' : '#FF453A',
                      fontFamily: "'JetBrains Mono',monospace"
                    }}>
                      {client.avgPeers.toFixed(1)}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Sync % */}
              <tr>
                <td style={{ 
                  padding: '14px 16px', 
                  fontSize: 12, 
                  color: 'rgba(255,255,255,0.6)',
                  borderBottom: '1px solid rgba(255,255,255,0.03)'
                }}>
                  Avg Sync %
                </td>
                {clientMetrics.map(client => (
                  <td key={client.clientType} style={{ 
                    padding: '14px 16px', 
                    textAlign: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.03)'
                  }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: client.avgSync >= 99.9 ? 'rgba(48,209,88,0.1)' : 
                                 client.avgSync >= 95 ? 'rgba(255,214,10,0.1)' : 'rgba(255,69,58,0.1)',
                    }}>
                      <span style={{ 
                        fontSize: 14, 
                        fontWeight: 700, 
                        color: client.avgSync >= 99.9 ? '#30D158' : 
                               client.avgSync >= 95 ? '#FFD60A' : '#FF453A',
                        fontFamily: "'JetBrains Mono',monospace"
                      }}>
                        {client.avgSync.toFixed(2)}%
                      </span>
                    </div>
                  </td>
                ))}
              </tr>

              {/* CPU */}
              <tr>
                <td style={{ 
                  padding: '14px 16px', 
                  fontSize: 12, 
                  color: 'rgba(255,255,255,0.6)',
                  borderBottom: '1px solid rgba(255,255,255,0.03)'
                }}>
                  Avg CPU
                </td>
                {clientMetrics.map(client => (
                  <td key={client.clientType} style={{ 
                    padding: '14px 16px', 
                    textAlign: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.03)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <div style={{
                        width: 40,
                        height: 4,
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: 2,
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${Math.min(client.avgCpu, 100)}%`,
                          height: '100%',
                          background: statusColor(client.avgCpu, { warning: 70, critical: 85 }),
                          borderRadius: 2
                        }} />
                      </div>
                      <span style={{ 
                        fontSize: 12, 
                        fontWeight: 600, 
                        color: statusColor(client.avgCpu, { warning: 70, critical: 85 }),
                        fontFamily: "'JetBrains Mono',monospace",
                        minWidth: 36
                      }}>
                        {client.avgCpu.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                ))}
              </tr>

              {/* Memory */}
              <tr>
                <td style={{ 
                  padding: '14px 16px', 
                  fontSize: 12, 
                  color: 'rgba(255,255,255,0.6)',
                  borderBottom: '1px solid rgba(255,255,255,0.03)'
                }}>
                  Avg Memory
                </td>
                {clientMetrics.map(client => (
                  <td key={client.clientType} style={{ 
                    padding: '14px 16px', 
                    textAlign: 'center',
                    borderBottom: '1px solid rgba(255,255,255,0.03)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <div style={{
                        width: 40,
                        height: 4,
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: 2,
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${Math.min(client.avgMemory, 100)}%`,
                          height: '100%',
                          background: statusColor(client.avgMemory, { warning: 75, critical: 90 }),
                          borderRadius: 2
                        }} />
                      </div>
                      <span style={{ 
                        fontSize: 12, 
                        fontWeight: 600, 
                        color: statusColor(client.avgMemory, { warning: 75, critical: 90 }),
                        fontFamily: "'JetBrains Mono',monospace",
                        minWidth: 36
                      }}>
                        {client.avgMemory.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                ))}
              </tr>

              {/* Block Hash */}
              <tr>
                <td style={{ 
                  padding: '14px 16px', 
                  fontSize: 12, 
                  color: 'rgba(255,255,255,0.6)',
                  borderBottom: '1px solid rgba(255,255,255,0.03)'
                }}>
                  Latest Block Hash
                </td>
                {clientMetrics.map((client, idx) => {
                  const hash = client.consensusHash;
                  const isFirst = idx === 0;
                  const matchesFirst = isFirst || hash === clientMetrics[0].consensusHash;
                  
                  return (
                    <td key={client.clientType} style={{ 
                      padding: '14px 16px', 
                      textAlign: 'center',
                      borderBottom: '1px solid rgba(255,255,255,0.03)'
                    }}>
                      {hash ? (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 10px',
                          borderRadius: 6,
                          background: matchesFirst ? 'rgba(48,209,88,0.1)' : 'rgba(255,69,58,0.1)',
                        }}>
                          <span style={{ fontSize: 10 }}>
                            {matchesFirst ? '✅' : '⚠️'}
                          </span>
                          <span style={{ 
                            fontSize: 10, 
                            fontWeight: 600, 
                            color: matchesFirst ? '#30D158' : '#FF453A',
                            fontFamily: "'JetBrains Mono',monospace"
                          }}>
                            {hash.substring(0, 12)}...{hash.substring(hash.length - 8)}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                          No data
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* Actions */}
              <tr>
                <td style={{ 
                  padding: '14px 16px', 
                  fontSize: 12, 
                  color: 'rgba(255,255,255,0.6)'
                }}>
                  Actions
                </td>
                {clientMetrics.map(client => (
                  <td key={client.clientType} style={{ 
                    padding: '14px 16px', 
                    textAlign: 'center'
                  }}>
                    <Link 
                      href={`/v2/nodes?client=${client.clientType}`}
                      style={{
                        display: 'inline-block',
                        padding: '6px 12px',
                        borderRadius: 6,
                        background: client.config.bgColor,
                        color: client.config.color,
                        fontSize: 11,
                        fontWeight: 600,
                        textDecoration: 'none',
                        border: `1px solid ${client.config.color}40`
                      }}
                    >
                      View Nodes
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Fork Alert Banner */}
      {forkStatus?.forked && (
        <div style={{
          marginTop: 24,
          padding: '20px 24px',
          borderRadius: 12,
          background: 'rgba(255,69,58,0.1)',
          border: '1px solid rgba(255,69,58,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 24 }}>🚨</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#FF453A' }}>
                NETWORK FORK DETECTED
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                Divergence at block #{formatNumber(forkStatus.divergenceBlock)}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {forkStatus.clients?.map((c: any) => (
              <div key={c.name} style={{
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'white' }}>{c.name}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: "'JetBrains Mono',monospace" }}>
                  {c.blockHash?.substring(0, 20)}...
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ 
        marginTop: 24,
        padding: '16px 20px',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.4)', marginBottom: 12, letterSpacing: '.05em' }}>
          COLOR LEGEND
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#30D158', fontSize: 12 }}>●</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Healthy / Synced</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#FFD60A', fontSize: 12 }}>●</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{'>'}10 blocks behind</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#FF9F0A', fontSize: 12 }}>●</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{'>'}50 blocks behind</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: '#FF453A', fontSize: 12 }}>●</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{'>'}100 blocks behind</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12 }}>✅</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Hash matches</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12 }}>⚠️</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Hash diverged</span>
          </div>
        </div>
      </div>
    </div>
  );
}
