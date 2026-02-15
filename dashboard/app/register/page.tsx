'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Server, 
  Copy, 
  CheckCircle, 
  AlertCircle,
  Terminal,
  Mail,
  Globe,
  Cpu,
  Database,
  Radio,
  ArrowRight,
  ChevronLeft
} from 'lucide-react';

interface RegistrationForm {
  name: string;
  host: string;
  rpcUrl: string;
  role: 'masternode' | 'fullnode' | 'archive' | 'rpc' | '';
  email: string;
  locationCity: string;
  locationCountry: string;
}

interface RegistrationResult {
  success: boolean;
  data?: {
    nodeId: string;
    name: string;
    host: string;
    role: string;
    createdAt: string;
    apiKey: string;
  };
  setupCommand?: string;
  error?: string;
}

const ROLES = [
  { value: 'masternode', label: 'Masternode', description: 'Block producer with validator responsibilities', icon: <Radio className="w-5 h-5" />, color: 'text-[var(--warning)]' },
  { value: 'fullnode', label: 'Full Node', description: 'Full blockchain synchronization, no mining', icon: <Server className="w-5 h-5" />, color: 'text-[var(--success)]' },
  { value: 'archive', label: 'Archive Node', description: 'Complete historical state preservation', icon: <Database className="w-5 h-5" />, color: 'text-[var(--purple)]' },
  { value: 'rpc', label: 'RPC Node', description: 'Public API endpoint for dApp access', icon: <Globe className="w-5 h-5" />, color: 'text-[var(--accent-blue)]' },
];

function truncate(str: string, len = 20): string {
  if (str.length <= len) return str;
  return str.slice(0, len) + '...';
}

export default function RegisterPage() {
  const [form, setForm] = useState<RegistrationForm>({
    name: '',
    host: '',
    rpcUrl: '',
    role: '',
    email: '',
    locationCity: '',
    locationCountry: '',
  });
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const validateStep1 = () => {
    if (!form.name || !form.host || !form.role) {
      return false;
    }
    // Name must be alphanumeric with dashes/underscores
    if (!/^[a-zA-Z0-9_-]+$/.test(form.name)) {
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!form.email) return false;
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/v1/nodes/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          host: form.host,
          rpcUrl: form.rpcUrl || undefined,
          role: form.role,
          email: form.email,
          locationCity: form.locationCity || undefined,
          locationCountry: form.locationCountry || undefined,
        }),
      });

      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        setStep(3);
      }
    } catch (error) {
      setResult({
        success: false,
        error: 'Network error. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, type: 'key' | 'command') => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2000);
    }
  };

  if (step === 3 && result?.success) {
    return (
      <div className="min-h-screen bg-[var(--bg-body)] p-4 md:p-6">
        <div className="max-w-2xl mx-auto">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-[var(--success)]/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-[var(--success)]" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Registration Complete!</h1>
            <p className="text-[var(--text-secondary)]">Your node has been registered successfully.</p>
          </div>

          {/* API Key */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-[var(--warning)]" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Save Your API Key</h2>
            </div>
            
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              This API key will only be shown once. Store it securely - you'll need it to configure your node agent.
            </p>

            <div className="flex items-center gap-3 p-4 bg-[var(--bg-hover)] rounded-lg border border-[var(--warning)]/20">
              <code className="flex-1 font-mono text-sm text-[var(--accent-blue)] break-all">
                {result.data?.apiKey}
              </code>
              <button
                onClick={() => handleCopy(result.data?.apiKey || '', 'key')}
                className="p-2 hover:bg-[var(--bg-body)] rounded-lg transition-colors flex-shrink-0"
                title="Copy API key"
              >
                {copiedKey ? (
                  <CheckCircle className="w-5 h-5 text-[var(--success)]" />
                ) : (
                  <Copy className="w-5 h-5 text-[var(--text-secondary)]" />
                )}
              </button>
            </div>
          </div>

          {/* Setup Command */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Terminal className="w-5 h-5 text-[var(--accent-blue)]" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Agent Installation</h2>
            </div>
            
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Run this command on your server to install and configure the XDC SkyNet agent:
            </p>

            <div className="relative">
              <pre className="p-4 bg-[var(--bg-body)] rounded-lg border border-[var(--border-subtle)] overflow-x-auto">
                <code className="text-sm font-mono text-[var(--text-secondary)]">
                  {result.setupCommand}
                </code>
              </pre>
              <button
                onClick={() => handleCopy(result.setupCommand || '', 'command')}
                className="absolute top-2 right-2 p-2 hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
                title="Copy command"
              >
                {copiedCommand ? (
                  <CheckCircle className="w-4 h-4 text-[var(--success)]" />
                ) : (
                  <Copy className="w-4 h-4 text-[var(--text-secondary)]" />
                )}
              </button>
            </div>
          </div>

          {/* Node Details */}
          <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] p-6 mb-6">
            <h3 className="text-sm font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-4">Node Details</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Name</p>
                <p className="text-sm font-medium text-[var(--text-primary)]">{result.data?.name}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Role</p>
                <p className="text-sm font-medium text-[var(--text-primary)] capitalize">{result.data?.role}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Host</p>
                <p className="text-sm font-medium text-[var(--accent-blue)]">{result.data?.host}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Created</p>
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  {new Date(result.data?.createdAt || '').toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href="/"
              className="flex-1 px-4 py-3 bg-[var(--accent-blue)] text-white rounded-lg text-center font-medium hover:bg-[var(--accent-blue)]/90 transition-colors"
            >
              Go to Dashboard →
            </a>
            <a
              href="/explorer"
              className="flex-1 px-4 py-3 bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg text-center font-medium hover:bg-[var(--bg-hover)]/80 transition-colors"
            >
              View Network Explorer
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
    <div className="min-h-screen bg-[var(--bg-body)] p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <a 
            href="/explorer"
            className="flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-blue)] transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Explorer
          </a>
        </div>

        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[var(--accent-blue)]/20 to-[var(--success)]/20 flex items-center justify-center mx-auto mb-4 border border-[var(--accent-blue)]/30">
            <Server className="w-7 h-7 text-[var(--accent-blue)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Register Your Node</h1>
          <p className="text-[var(--text-secondary)]">Join the XDC SkyNet monitoring network</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          <div className={`flex-1 h-1 rounded-full ${step >= 1 ? 'bg-[var(--accent-blue)]' : 'bg-[var(--bg-hover)]'}`} />
          <div className={`flex-1 h-1 rounded-full ${step >= 2 ? 'bg-[var(--accent-blue)]' : 'bg-[var(--bg-hover)]'}`} />
          <div className={`flex-1 h-1 rounded-full ${step >= 3 ? 'bg-[var(--accent-blue)]' : 'bg-[var(--bg-hover)]'}`} />
        </div>

        {/* Form */}
        <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] p-6">
          {step === 1 && (
            <>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Node Configuration</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Node Name *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g., my-xdc-node-01"
                    className="w-full px-4 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                  />
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">Alphanumeric characters, dashes and underscores only</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Host / IP Address *
                  </label>
                  <input
                    type="text"
                    value={form.host}
                    onChange={(e) => setForm({ ...form, host: e.target.value })}
                    placeholder="e.g., 192.168.1.100 or node.example.com"
                    className="w-full px-4 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    RPC URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={form.rpcUrl}
                    onChange={(e) => setForm({ ...form, rpcUrl: e.target.value })}
                    placeholder="e.g., http://localhost:8989"
                    className="w-full px-4 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-3">
                    Node Role *
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {ROLES.map((role) => (
                      <button
                        key={role.value}
                        type="button"
                        onClick={() => setForm({ ...form, role: role.value as any })}
                        className={`flex items-start gap-3 p-4 rounded-lg border text-left transition-all ${
                          form.role === role.value
                            ? 'border-[var(--accent-blue)] bg-[var(--accent-blue)]/5'
                            : 'border-[var(--border-subtle)] hover:border-[var(--accent-blue)]/50'
                        }`}
                      >
                        <div className={`${role.color}`}>{role.icon}</div>
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">{role.label}</p>
                          <p className="text-xs text-[var(--text-tertiary)]">{role.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStep(2)}
                disabled={!validateStep1()}
                className="w-full mt-6 px-4 py-3 bg-[var(--accent-blue)] text-white rounded-lg font-medium hover:bg-[var(--accent-blue)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Contact Information</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Email Address *
                    </div>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="admin@example.com"
                    className="w-full px-4 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                  />
                  <p className="mt-1 text-xs text-[var(--text-tertiary)]">We'll send alerts and notifications to this address</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                      City (Optional)
                    </label>
                    <input
                      type="text"
                      value={form.locationCity}
                      onChange={(e) => setForm({ ...form, locationCity: e.target.value })}
                      placeholder="e.g., Singapore"
                      className="w-full px-4 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                      Country Code (Optional)
                    </label>
                    <input
                      type="text"
                      value={form.locationCountry}
                      onChange={(e) => setForm({ ...form, locationCountry: e.target.value.toUpperCase() })}
                      placeholder="e.g., SG"
                      maxLength={2}
                      className="w-full px-4 py-2 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] uppercase"
                    />
                  </div>
                </div>
              </div>

              {result?.error && (
                <div className="mt-4 p-3 bg-[var(--critical)]/10 border border-[var(--critical)]/20 rounded-lg text-[var(--critical)] text-sm">
                  {result.error}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-3 bg-[var(--bg-hover)] text-[var(--text-primary)] rounded-lg font-medium hover:bg-[var(--bg-hover)]/80 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!validateStep2() || loading}
                  className="flex-1 px-4 py-3 bg-[var(--accent-blue)] text-white rounded-lg font-medium hover:bg-[var(--accent-blue)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Registering...
                    </>
                  ) : (
                    <>Complete Registration</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-[var(--text-tertiary)]">
          <p>By registering, you agree to participate in the XDC SkyNet monitoring network.</p>
          <p className="mt-2">Your node data will be used for network health analysis and alerting.</p>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}
