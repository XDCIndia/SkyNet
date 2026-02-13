'use client';

import { useEffect, useState, useCallback } from 'react';
import { 
  Bell, 
  Plus, 
  Trash2, 
  Edit2, 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle,
  MessageSquare,
  Mail,
  Globe,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Clock,
  Server,
  Cpu,
  HardDrive,
  Wifi
} from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';

interface AlertRule {
  id: string;
  name: string;
  description?: string;
  nodeId?: string;
  nodeName?: string;
  conditionType: string;
  thresholdValue: number;
  durationMinutes: number;
  severity: 'critical' | 'warning' | 'info';
  isActive: boolean;
  channels: Array<{ id: string; name: string; channelType: string }>;
  createdAt: string;
}

interface AlertChannel {
  id: string;
  name: string;
  channelType: 'telegram' | 'email' | 'webhook';
  config: any;
  isActive: boolean;
}

interface AlertHistory {
  id: number;
  ruleId?: string;
  nodeId?: string;
  nodeName?: string;
  channelId?: string;
  channelName?: string;
  channelType?: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message?: string;
  status: 'firing' | 'acknowledged' | 'resolved';
  firedAt: string;
}

const CONDITION_TYPES = [
  { value: 'node_offline', label: 'Node Offline', icon: <Server className="w-4 h-4" />, unit: 'min' },
  { value: 'sync_behind', label: 'Sync Behind', icon: <Clock className="w-4 h-4" />, unit: 'blocks' },
  { value: 'disk_usage', label: 'Disk Usage', icon: <HardDrive className="w-4 h-4" />, unit: '%' },
  { value: 'peer_count', label: 'Low Peer Count', icon: <Wifi className="w-4 h-4" />, unit: 'peers' },
  { value: 'cpu_usage', label: 'CPU Usage', icon: <Cpu className="w-4 h-4" />, unit: '%' },
  { value: 'memory_usage', label: 'Memory Usage', icon: <Server className="w-4 h-4" />, unit: '%' },
];

const SEVERITY_COLORS = {
  critical: 'bg-[var(--critical)]/10 text-[var(--critical)] border-[var(--critical)]/20',
  warning: 'bg-[var(--warning)]/10 text-[var(--warning)] border-[var(--warning)]/20',
  info: 'bg-[var(--accent-blue)]/10 text-[var(--accent-blue)] border-[var(--accent-blue)]/20',
};

function StatusBadge({ status }: { status: string }) {
  const styles = {
    firing: 'bg-[var(--critical)]/10 text-[var(--critical)]',
    acknowledged: 'bg-[var(--warning)]/10 text-[var(--warning)]',
    resolved: 'bg-[var(--success)]/10 text-[var(--success)]',
  };
  
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${styles[status as keyof typeof styles]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState<'rules' | 'channels' | 'history'>('rules');
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [channels, setChannels] = useState<AlertChannel[]>([]);
  const [history, setHistory] = useState<AlertHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [editingChannel, setEditingChannel] = useState<AlertChannel | null>(null);
  const [expandedHistory, setExpandedHistory] = useState<Set<number>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const [rulesRes, channelsRes, historyRes] = await Promise.all([
        fetch('/api/v1/alerts/rules'),
        fetch('/api/v1/alerts/channels'),
        fetch('/api/v1/alerts/history?limit=20'),
      ]);

      if (rulesRes.ok) {
        const data = await rulesRes.json();
        if (data.success) setRules(data.data);
      }

      if (channelsRes.ok) {
        const data = await channelsRes.json();
        if (data.success) setChannels(data.data);
      }

      if (historyRes.ok) {
        const data = await historyRes.json();
        if (data.success) setHistory(data.data);
      }
    } catch (err) {
      console.error('Error fetching alert data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this alert rule?')) return;
    
    try {
      const res = await fetch(`/api/v1/alerts/rules?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setRules(prev => prev.filter(r => r.id !== id));
      }
    } catch (err) {
      console.error('Error deleting rule:', err);
    }
  };

  const handleDeleteChannel = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notification channel?')) return;
    
    try {
      const res = await fetch(`/api/v1/alerts/channels?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setChannels(prev => prev.filter(c => c.id !== id));
      }
    } catch (err) {
      console.error('Error deleting channel:', err);
    }
  };

  const toggleHistoryExpand = (id: number) => {
    const newSet = new Set(expandedHistory);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedHistory(newSet);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[var(--warning)]/20 to-[var(--critical)]/20 flex items-center justify-center border border-[var(--warning)]/30">
              <Bell className="w-5 h-5 text-[var(--warning)]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">Alert Management</h1>
              <p className="text-sm text-[var(--text-tertiary)]">Configure monitoring rules and notifications</p>
            </div>
          </div>

          <button
            onClick={fetchData}
            className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-[var(--text-tertiary)] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-[var(--bg-hover)] p-1 rounded-lg w-fit">
          {[
            { id: 'rules', label: 'Alert Rules', count: rules.length },
            { id: 'channels', label: 'Channels', count: channels.length },
            { id: 'history', label: 'History', count: history.filter(h => h.status === 'firing').length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded text-xs ${
                activeTab === tab.id ? 'bg-[var(--bg-hover)]' : 'bg-[var(--bg-card)]'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Rules Tab */}
        {activeTab === 'rules' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Alert Rules</h2>
              <button
                onClick={() => { setEditingRule(null); setShowRuleModal(true); }}
                className="px-4 py-2 bg-[var(--accent-blue)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-blue)]/90 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Rule
              </button>
            </div>

            <div className="space-y-3">
              {rules.map(rule => (
                <div 
                  key={rule.id}
                  className={`bg-[var(--bg-card)] rounded-xl border ${
                    rule.isActive ? 'border-[var(--border-subtle)]' : 'border-[var(--border-subtle)]/50 opacity-70'
                  } p-4`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${SEVERITY_COLORS[rule.severity]}`}>
                        {rule.severity === 'critical' && <AlertTriangle className="w-4 h-4" />}
                        {rule.severity === 'warning' && <AlertCircle className="w-4 h-4" />}
                        {rule.severity === 'info' && <Bell className="w-4 h-4" />}
                      </div>
                      
                      <div>
                        <h3 className="font-medium text-[var(--text-primary)]">{rule.name}</h3>
                        {rule.description && (
                          <p className="text-sm text-[var(--text-secondary)]">{rule.description}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className="text-xs px-2 py-0.5 bg-[var(--bg-hover)] rounded">
                            {CONDITION_TYPES.find(c => c.value === rule.conditionType)?.label || rule.conditionType}
                          </span>
                          <span className="text-xs text-[var(--text-tertiary)]">
                            &gt; {rule.thresholdValue} {CONDITION_TYPES.find(c => c.value === rule.conditionType)?.unit}
                          </span>
                          <span className="text-xs text-[var(--text-tertiary)]">•</span>
                          <span className="text-xs text-[var(--text-tertiary)]">
                            for {rule.durationMinutes} min
                          </span>
                          {rule.nodeName && (
                            <>
                              <span className="text-xs text-[var(--text-tertiary)]">•</span>
                              <span className="text-xs text-[var(--accent-blue)]">{rule.nodeName}</span>
                            </>
                          )}
                        </div>

                        {rule.channels.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span className="text-xs text-[var(--text-tertiary)]">Channels:</span>
                            {rule.channels.map(channel => (
                              <span 
                                key={channel.id}
                                className="text-xs px-2 py-0.5 bg-[var(--bg-hover)] rounded flex items-center gap-1"
                              >
                                {channel.channelType === 'telegram' && <MessageSquare className="w-3 h-3" />}
                                {channel.channelType === 'email' && <Mail className="w-3 h-3" />}
                                {channel.channelType === 'webhook' && <Globe className="w-3 h-3" />}
                                {channel.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingRule(rule); setShowRuleModal(true); }}
                        className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4 text-[var(--text-secondary)]" />
                      </button>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="p-2 hover:bg-[var(--critical)]/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4 text-[var(--critical)]" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {rules.length === 0 && (
                <div className="text-center py-12 text-[var(--text-tertiary)]">
                  <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No alert rules configured</p>
                  <button
                    onClick={() => { setEditingRule(null); setShowRuleModal(true); }}
                    className="mt-4 text-[var(--accent-blue)] hover:underline"
                  >
                    Create your first rule
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Channels Tab */}
        {activeTab === 'channels' && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Notification Channels</h2>
              <button
                onClick={() => { setEditingChannel(null); setShowChannelModal(true); }}
                className="px-4 py-2 bg-[var(--accent-blue)] text-white rounded-lg text-sm font-medium hover:bg-[var(--accent-blue)]/90 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Channel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {channels.map(channel => (
                <div 
                  key={channel.id}
                  className={`bg-[var(--bg-card)] rounded-xl border ${
                    channel.isActive ? 'border-[var(--border-subtle)]' : 'border-[var(--border-subtle)]/50 opacity-70'
                  } p-4`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-[var(--bg-hover)] rounded-lg">
                        {channel.channelType === 'telegram' && <MessageSquare className="w-5 h-5 text-[var(--accent-blue)]" />}
                        {channel.channelType === 'email' && <Mail className="w-5 h-5 text-[var(--success)]" />}
                        {channel.channelType === 'webhook' && <Globe className="w-5 h-5 text-[var(--purple)]" />}
                      </div>
                      
                      <div>
                        <h3 className="font-medium text-[var(--text-primary)]">{channel.name}</h3>
                        <p className="text-xs text-[var(--text-tertiary)] capitalize">{channel.channelType}</p>
                        
                        {channel.channelType === 'telegram' && (
                          <p className="text-xs text-[var(--text-secondary)] mt-1">Chat ID: {channel.config.chatId}</p>
                        )}
                        {channel.channelType === 'email' && (
                          <p className="text-xs text-[var(--text-secondary)] mt-1">To: {channel.config.toAddresses?.[0]}...</p>
                        )}
                        {channel.channelType === 'webhook' && (
                          <p className="text-xs text-[var(--text-secondary)] mt-1 truncate max-w-[200px]">{channel.config.url}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingChannel(channel); setShowChannelModal(true); }}
                        className="p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4 text-[var(--text-secondary)]" />
                      </button>
                      <button
                        onClick={() => handleDeleteChannel(channel.id)}
                        className="p-2 hover:bg-[var(--critical)]/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-[var(--critical)]" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {channels.length === 0 && (
                <div className="col-span-2 text-center py-12 text-[var(--text-tertiary)]">
                  <Mail className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No notification channels configured</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <>
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Alert History</h2>

            <div className="space-y-2">
              {history.map(item => (
                <div 
                  key={item.id}
                  className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] overflow-hidden"
                >
                  <div 
                    className="p-4 cursor-pointer"
                    onClick={() => toggleHistoryExpand(item.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded ${SEVERITY_COLORS[item.severity]}`}>
                          {item.severity === 'critical' && <AlertTriangle className="w-4 h-4" />}
                          {item.severity === 'warning' && <AlertCircle className="w-4 h-4" />}
                          {item.severity === 'info' && <Bell className="w-4 h-4" />}
                        </div>
                        
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">{item.title}</p>
                          <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                            <StatusBadge status={item.status} />
                            <span>•</span>
                            <span>{new Date(item.firedAt).toLocaleString()}</span>
                            {item.nodeName && (
                              <>
                                <span>•</span>
                                <span className="text-[var(--accent-blue)]">{item.nodeName}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button className="p-1">
                        {expandedHistory.has(item.id) ? (
                          <ChevronUp className="w-4 h-4 text-[var(--text-tertiary)]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[var(--text-tertiary)]" />
                        )}
                      </button>
                    </div>
                  </div>

                  {expandedHistory.has(item.id) && item.message && (
                    <div className="px-4 pb-4 border-t border-[var(--border-subtle)]">
                      <p className="text-sm text-[var(--text-secondary)] mt-3">{item.message}</p>
                    </div>
                  )}
                </div>
              ))}

              {history.length === 0 && (
                <div className="text-center py-12 text-[var(--text-tertiary)]">
                  <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50 text-[var(--success)]" />
                  <p>No alerts in history</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Rule Modal */}
      {showRuleModal && (
        <RuleModal
          rule={editingRule}
          channels={channels}
          onClose={() => setShowRuleModal(false)}
          onSave={() => { setShowRuleModal(false); fetchData(); }}
        />
      )}

      {/* Channel Modal */}
      {showChannelModal && (
        <ChannelModal
          channel={editingChannel}
          onClose={() => setShowChannelModal(false)}
          onSave={() => { setShowChannelModal(false); fetchData(); }}
        />
      )}
    </DashboardLayout>
  );
}

// Rule Modal Component
function RuleModal({ rule, channels, onClose, onSave }: { 
  rule: AlertRule | null;
  channels: AlertChannel[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    name: rule?.name || '',
    description: rule?.description || '',
    nodeId: rule?.nodeId || '',
    conditionType: rule?.conditionType || 'node_offline',
    thresholdValue: rule?.thresholdValue || 5,
    durationMinutes: rule?.durationMinutes || 5,
    severity: rule?.severity || 'warning',
    isActive: rule?.isActive ?? true,
    channelIds: rule?.channels.map(c => c.id) || [],
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = '/api/v1/alerts/rules';
      const method = rule ? 'PUT' : 'POST';
      const body = rule ? { ...form, id: rule.id } : form;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onSave();
      }
    } catch (err) {
      console.error('Error saving rule:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            {rule ? 'Edit Alert Rule' : 'New Alert Rule'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-hover)] rounded">
            <X className="w-5 h-5 text-[var(--text-tertiary)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Rule Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
              className="w-full px-3 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Condition *</label>
            <select
              value={form.conditionType}
              onChange={e => setForm({ ...form, conditionType: e.target.value })}
              className="w-full px-3 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
            >
              {CONDITION_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Threshold *</label>
              <input
                type="number"
                value={form.thresholdValue}
                onChange={e => setForm({ ...form, thresholdValue: parseFloat(e.target.value) })}
                required
                min={1}
                className="w-full px-3 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Duration (min) *</label>
              <input
                type="number"
                value={form.durationMinutes}
                onChange={e => setForm({ ...form, durationMinutes: parseInt(e.target.value) })}
                required
                min={1}
                className="w-full px-3 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Severity *</label>
            <div className="flex gap-2">
              {(['critical', 'warning', 'info'] as const).map(sev => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setForm({ ...form, severity: sev })}
                  className={`flex-1 px-3 py-2 rounded-lg border text-sm font-medium capitalize transition-all ${
                    form.severity === sev
                      ? `border-[var(--accent-blue)] bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]`
                      : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-blue)]/50'
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Notification Channels</label>
            <div className="space-y-2">
              {channels.map(channel => (
                <label key={channel.id} className="flex items-center gap-2 p-2 rounded-lg border border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--bg-hover)]">
                  <input
                    type="checkbox"
                    checked={form.channelIds.includes(channel.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setForm({ ...form, channelIds: [...form.channelIds, channel.id] });
                      } else {
                        setForm({ ...form, channelIds: form.channelIds.filter(id => id !== channel.id) });
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm text-[var(--text-primary)]">{channel.name}</span>
                  <span className="text-xs text-[var(--text-tertiary)] capitalize">({channel.channelType})</span>
                </label>
              ))}
              {channels.length === 0 && (
                <p className="text-sm text-[var(--text-tertiary)]">No channels available. Add a channel first.</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={e => setForm({ ...form, isActive: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="isActive" className="text-sm text-[var(--text-secondary)]">Active</label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.name}
              className="flex-1 px-4 py-2 bg-[var(--accent-blue)] text-white rounded-lg font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : rule ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Channel Modal Component
function ChannelModal({ channel, onClose, onSave }: {
  channel: AlertChannel | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [channelType, setChannelType] = useState<'telegram' | 'email' | 'webhook'>(channel?.channelType || 'telegram');
  const [form, setForm] = useState({
    name: channel?.name || '',
    isActive: channel?.isActive ?? true,
    // Telegram
    botToken: channel?.config?.botToken || '',
    chatId: channel?.config?.chatId || '',
    // Email
    smtpHost: channel?.config?.smtpHost || '',
    smtpPort: channel?.config?.smtpPort || 587,
    username: channel?.config?.username || '',
    password: channel?.config?.password || '',
    fromAddress: channel?.config?.fromAddress || '',
    toAddresses: channel?.config?.toAddresses?.join(', ') || '',
    useTls: channel?.config?.useTls ?? true,
    // Webhook
    url: channel?.config?.url || '',
    method: channel?.config?.method || 'POST',
    secret: channel?.config?.secret || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    let config: any = {};
    if (channelType === 'telegram') {
      config = { botToken: form.botToken, chatId: form.chatId };
    } else if (channelType === 'email') {
      config = {
        smtpHost: form.smtpHost,
        smtpPort: form.smtpPort,
        username: form.username,
        password: form.password,
        fromAddress: form.fromAddress,
        toAddresses: form.toAddresses.split(',').map(s => s.trim()).filter(Boolean),
        useTls: form.useTls,
      };
    } else if (channelType === 'webhook') {
      config = { url: form.url, method: form.method, secret: form.secret || undefined };
    }

    try {
      const url = '/api/v1/alerts/channels';
      const method = channel ? 'PUT' : 'POST';
      const body = channel 
        ? { id: channel.id, name: form.name, channelType, config, isActive: form.isActive }
        : { name: form.name, channelType, config, isActive: form.isActive };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onSave();
      }
    } catch (err) {
      console.error('Error saving channel:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">
            {channel ? 'Edit Channel' : 'New Notification Channel'}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-hover)] rounded">
            <X className="w-5 h-5 text-[var(--text-tertiary)]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Channel Type */}
          {!channel && (
            <div>
              <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Channel Type *</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'telegram', icon: <MessageSquare className="w-4 h-4" />, label: 'Telegram' },
                  { id: 'email', icon: <Mail className="w-4 h-4" />, label: 'Email' },
                  { id: 'webhook', icon: <Globe className="w-4 h-4" />, label: 'Webhook' },
                ].map(type => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setChannelType(type.id as any)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-sm transition-all ${
                      channelType === type.id
                        ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/10 text-[var(--accent-blue)]'
                        : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent-blue)]/50'
                    }`}
                  >
                    {type.icon}
                    {type.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Channel Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
              className="w-full px-3 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
            />
          </div>

          {/* Telegram Fields */}
          {channelType === 'telegram' && (
            <>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Bot Token *</label>
                <input
                  type="text"
                  value={form.botToken}
                  onChange={e => setForm({ ...form, botToken: e.target.value })}
                  required
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                  className="w-full px-3 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Chat ID *</label>
                <input
                  type="text"
                  value={form.chatId}
                  onChange={e => setForm({ ...form, chatId: e.target.value })}
                  required
                  placeholder="-1001234567890"
                  className="w-full px-3 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
                />
              </div>
            </>
          )}

          {/* Email Fields */}
          {channelType === 'email' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">SMTP Host *</label>
                  <input
                    type="text"
                    value={form.smtpHost}
                    onChange={e => setForm({ ...form, smtpHost: e.target.value })}
                    required
                    placeholder="smtp.gmail.com"
                    className="w-full px-3 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Port *</label>
                  <input
                    type="number"
                    value={form.smtpPort}
                    onChange={e => setForm({ ...form, smtpPort: parseInt(e.target.value) })}
                    required
                    className="w-full px-3 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Username *</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Password *</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">From Address *</label>
                <input
                  type="email"
                  value={form.fromAddress}
                  onChange={e => setForm({ ...form, fromAddress: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">To Addresses (comma-separated) *</label>
                <input
                  type="text"
                  value={form.toAddresses}
                  onChange={e => setForm({ ...form, toAddresses: e.target.value })}
                  required
                  placeholder="admin@example.com, ops@example.com"
                  className="w-full px-3 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
                />
              </div>
            </>
          )}

          {/* Webhook Fields */}
          {channelType === 'webhook' && (
            <>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Webhook URL *</label>
                <input
                  type="url"
                  value={form.url}
                  onChange={e => setForm({ ...form, url: e.target.value })}
                  required
                  placeholder="https://hooks.example.com/alerts"
                  className="w-full px-3 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Method</label>
                <select
                  value={form.method}
                  onChange={e => setForm({ ...form, method: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
                >
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">Secret (optional, for HMAC signature)</label>
                <input
                  type="text"
                  value={form.secret}
                  onChange={e => setForm({ ...form, secret: e.target.value })}
                  placeholder="webhook-secret-key"
                  className="w-full px-3 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-blue)]"
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="channelIsActive"
              checked={form.isActive}
              onChange={e => setForm({ ...form, isActive: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="channelIsActive" className="text-sm text-[var(--text-secondary)]">Active</label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.name}
              className="flex-1 px-4 py-2 bg-[var(--accent-blue)] text-white rounded-lg font-medium disabled:opacity-50"
            >
              {saving ? 'Saving...' : channel ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
