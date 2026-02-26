'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, AlertCircle, AlertTriangle, Info, CheckCircle, Minimize2, Maximize2 } from 'lucide-react';

interface Incident {
  id: number;
  node_id: string;
  node_name?: string;
  client_type?: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  fingerprint: string;
  message: string;
  context: any;
  occurrence_count: number;
  first_seen: string;
  last_seen: string;
  status: string;
  github_issue_url?: string;
  github_issue_number?: number;
  heal_action?: string;
  heal_success?: boolean;
  heal_attempts: number;
  context_history?: any[];
}

interface IncidentsPanelProps {
  refreshInterval?: number;
  defaultCollapsed?: boolean;
}

export default function IncidentsPanel({ refreshInterval = 30000, defaultCollapsed = false }: IncidentsPanelProps) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIncident, setExpandedIncident] = useState<number | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const fetchIncidents = async () => {
    try {
      const params = new URLSearchParams({ status: 'open', limit: '50' });
      if (filter !== 'all') {
        params.set('severity', filter);
      }
      
      const response = await fetch(`/api/v1/incidents?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setIncidents(data.incidents);
      }
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, refreshInterval);
    return () => clearInterval(interval);
  }, [filter, refreshInterval]);

  const handleResolve = async (incidentId: number) => {
    setResolvingId(incidentId);
    try {
      const response = await fetch(`/api/v1/incidents/${incidentId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('skynet_token') || ''}`,
        },
        body: JSON.stringify({
          status: 'resolved',
          resolution_notes: 'Manually resolved by user',
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Remove resolved incident from list
        setIncidents(prev => prev.filter(i => i.id !== incidentId));
        if (expandedIncident === incidentId) {
          setExpandedIncident(null);
        }
      } else {
        alert(`Failed to resolve: ${data.error}`);
      }
    } catch (error) {
      console.error('Error resolving incident:', error);
      alert('Failed to resolve incident');
    } finally {
      setResolvingId(null);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500 bg-red-500/10';
      case 'warning':
        return 'border-yellow-500 bg-yellow-500/10';
      default:
        return 'border-blue-500 bg-blue-500/10';
    }
  };

  const getHealStatusIcon = (healAction?: string, healSuccess?: boolean) => {
    if (!healAction || healAction === 'none') {
      return <span className="text-gray-400 text-sm">—</span>;
    }
    
    if (healSuccess) {
      return <span className="text-green-400 text-lg">✅</span>;
    } else {
      return <span className="text-red-400 text-lg">❌</span>;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const toggleExpand = (incidentId: number) => {
    setExpandedIncident(expandedIncident === incidentId ? null : incidentId);
  };

  if (loading) {
    return (
      <div className="bg-[#111827] rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1E90FF]"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#111827] rounded-lg border border-gray-700 overflow-hidden">
      {/* Header with Collapse Toggle */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors border-b border-gray-700"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          <AlertCircle className="w-6 h-6 text-[#1E90FF]" />
          Active Incidents
          {incidents.length > 0 && (
            <span className="px-2 py-0.5 bg-red-500 text-white text-sm rounded-full">
              {incidents.length}
            </span>
          )}
        </h2>
        
        <div className="flex items-center gap-3">
          {/* Filter (only show when expanded) */}
          {!isCollapsed && (
            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              {['all', 'critical', 'warning', 'info'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f as any)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    filter === f
                      ? 'bg-[#1E90FF] text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          )}
          
          {/* Collapse Toggle Icon */}
          <button 
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsCollapsed(!isCollapsed);
            }}
          >
            {isCollapsed ? (
              <Maximize2 className="w-5 h-5 text-gray-400" />
            ) : (
              <Minimize2 className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Content (collapsible) */}
      {!isCollapsed && (
        <div className="p-4">
          {/* Incidents List */}
          {incidents.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Info className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No active incidents</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incidents.map((incident) => (
                <div
                  key={incident.id}
                  className={`border rounded-lg overflow-hidden ${getSeverityColor(incident.severity)}`}
                >
                  {/* Incident Header */}
                  <div
                    className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => toggleExpand(incident.id)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Severity Icon */}
                      {getSeverityIcon(incident.severity)}
                      
                      {/* Main Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-white truncate">
                            {incident.type.replace(/_/g, ' ')}
                          </h3>
                          
                          {/* Occurrence Badge */}
                          <span className="px-2 py-0.5 bg-gray-700 text-gray-200 text-xs rounded-full">
                            {incident.occurrence_count}x
                          </span>
                          
                          {/* Heal Status */}
                          {getHealStatusIcon(incident.heal_action, incident.heal_success)}
                          
                          {/* GitHub Link */}
                          {incident.github_issue_url && (
                            <a
                              href={incident.github_issue_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#1E90FF] hover:text-blue-400 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                        
                        <p className="text-sm text-gray-300 truncate mb-2">
                          {incident.message}
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs text-gray-400">
                          <span>{incident.node_name || 'Unknown Node'}</span>
                          <span>•</span>
                          <span>{incident.client_type || 'unknown'}</span>
                          <span>•</span>
                          <span>Last seen: {formatTimestamp(incident.last_seen)}</span>
                          {incident.heal_attempts > 0 && (
                            <>
                              <span>•</span>
                              <span>Heal attempts: {incident.heal_attempts}</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Expand Icon */}
                      <div className="flex-shrink-0">
                        {expandedIncident === incident.id ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedIncident === incident.id && (
                    <div className="px-4 pb-4 space-y-4 border-t border-gray-600/50">
                      {/* Context */}
                      <div className="mt-4">
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Context</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-gray-400">Block:</span>
                            <span className="ml-2 text-white">{incident.context?.block || '—'}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Peers:</span>
                            <span className="ml-2 text-white">{incident.context?.peers || '—'}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">CPU:</span>
                            <span className="ml-2 text-white">{incident.context?.cpu_percent || '—'}%</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Disk:</span>
                            <span className="ml-2 text-white">{incident.context?.disk_percent || '—'}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Recent Logs */}
                      {incident.context?.last_logs && incident.context.last_logs.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-300 mb-2">Recent Logs</h4>
                          <div className="bg-black/30 rounded p-3 max-h-48 overflow-y-auto">
                            <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
                              {incident.context.last_logs.slice(-10).join('\n')}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Timeline */}
                      <div>
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Timeline</h4>
                        <div className="space-y-2 text-xs text-gray-400">
                          <div>First seen: {new Date(incident.first_seen).toLocaleString()}</div>
                          <div>Last seen: {new Date(incident.last_seen).toLocaleString()}</div>
                          <div>Fingerprint: <code className="text-gray-300">{incident.fingerprint.substring(0, 16)}...</code></div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => handleResolve(incident.id)}
                          disabled={resolvingId === incident.id}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {resolvingId === incident.id ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Resolving...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-4 h-4" />
                              Mark as Solved
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
