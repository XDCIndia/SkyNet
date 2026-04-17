'use client';

import { useState } from 'react';

interface RegistrationResult {
  success: boolean;
  data?: {
    nodeId: string;
    name: string;
    apiKey: string;
    createdAt: string;
  };
  setupCommand?: string;
  error?: string;
}

const ROLES = [
  { value: 'masternode', label: 'Masternode', description: 'Block producer with validator responsibilities', icon: '◆', color: '#FF9F0A' },
  { value: 'fullnode', label: 'Full Node', description: 'Full blockchain sync, no mining', icon: '⬡', color: '#30D158' },
  { value: 'archive', label: 'Archive Node', description: 'Complete historical state preservation', icon: '⊟', color: '#BF5AF2' },
  { value: 'rpc', label: 'RPC Node', description: 'Public API endpoint for dApp access', icon: '⊕', color: '#0A84FF' },
];

const CLIENTS = ['geth', 'erigon', 'nethermind', 'reth', 'other'];
const NETWORKS = ['mainnet', 'apothem'];

export default function V2RegisterPage() {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    name: '',
    host: '',
    rpcUrl: '',
    role: '',
    clientType: 'geth',
    network: 'mainnet',
    email: '',
    locationCity: '',
    locationCountry: '',
  });

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Node name is required';
    if (!form.host.trim()) errs.host = 'Host / IP address is required';
    if (!form.rpcUrl.trim()) errs.rpcUrl = 'RPC URL is required';
    if (!form.role) errs.role = 'Please select a node role';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email address';
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    setSubmitting(true);

    try {
      const res = await fetch('/api/v1/nodes/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      setResult(data);
      if (data.success) setStep('success');
    } catch (e) {
      setResult({ success: false, error: 'Network error. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };

  const copyApiKey = async () => {
    if (result?.data?.apiKey) {
      await navigator.clipboard.writeText(result.data.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%',
    padding: '10px 14px',
    borderRadius: 10,
    background: 'rgba(255,255,255,0.04)',
    border: `1px solid ${errors[field] ? 'rgba(255,69,58,0.4)' : 'rgba(255,255,255,0.09)'}`,
    color: 'white',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: "'Outfit',-apple-system,sans-serif",
    transition: 'border-color 0.2s',
  });

  if (step === 'success' && result?.data) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', opacity: 0, animation: 'fadeUp .8s ease .1s forwards' }}>
        <div className="glass-card" style={{ padding: 32 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✓</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#30D158', margin: 0, marginBottom: 8 }}>Node Registered!</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
              <strong style={{ color: 'white' }}>{result.data.name}</strong> has been added to your fleet
            </p>
          </div>

          {/* Node ID */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>NODE ID</div>
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#0AD4FF', wordBreak: 'break-all' }}>
              {result.data.nodeId}
            </div>
          </div>

          {/* API Key */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>API KEY</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,159,10,0.06)', border: '1px solid rgba(255,159,10,0.15)', fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: '#FF9F0A', wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
                {result.data.apiKey}
              </div>
              <button onClick={copyApiKey}
                style={{ padding: '10px 16px', borderRadius: 10, background: copied ? 'rgba(48,209,88,0.1)' : 'rgba(0,212,255,0.08)', border: `1px solid ${copied ? 'rgba(48,209,88,0.25)' : 'rgba(0,212,255,0.2)'}`, color: copied ? '#30D158' : '#0AD4FF', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,69,58,0.7)', marginTop: 6 }}>
              ⚠ Save this API key now — it won't be shown again
            </div>
          </div>

          {/* Setup Command */}
          {result.setupCommand && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>SETUP COMMAND</div>
              <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(10,14,24,0.8)', border: '1px solid rgba(255,255,255,0.08)', fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: 'rgba(255,255,255,0.7)', wordBreak: 'break-all', overflowWrap: 'anywhere', lineHeight: 1.6 }}>
                {result.setupCommand}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setStep('form'); setForm({ name: '', host: '', rpcUrl: '', role: '', clientType: 'geth', network: 'mainnet', email: '', locationCity: '', locationCountry: '' }); setResult(null); }}
              style={{ flex: 1, padding: '11px 0', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', fontSize: 13, cursor: 'pointer' }}>
              Register Another Node
            </button>
            <a href="/v2/nodes" style={{ flex: 1, padding: '11px 0', borderRadius: 10, background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.2)', color: '#0AD4FF', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              View Fleet →
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 660, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28, opacity: 0, animation: 'fadeUp .8s ease .1s forwards' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.04em', background: 'linear-gradient(135deg,white 60%,rgba(48,209,88,0.6))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>Register Node</h1>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Add a new XDC node to your SkyNet fleet</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Role Selection */}
        <div className="glass-card" style={{ padding: 20, marginBottom: 14, animationDelay: '0.1s' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 14, letterSpacing: '.06em' }}>NODE ROLE *</div>
          <div className="v2-grid-2">
            {ROLES.map(r => (
              <div key={r.value} onClick={() => { setForm({ ...form, role: r.value }); setErrors({ ...errors, role: '' }); }}
                style={{ padding: '14px 16px', borderRadius: 12, background: form.role === r.value ? `${r.color}0e` : 'rgba(255,255,255,0.02)', border: `1px solid ${form.role === r.value ? r.color + '35' : 'rgba(255,255,255,0.07)'}`, cursor: 'pointer', transition: 'all 0.2s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 16, color: r.color }}>{r.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: form.role === r.value ? r.color : 'rgba(255,255,255,0.7)' }}>{r.label}</span>
                  {form.role === r.value && <span style={{ marginLeft: 'auto', fontSize: 12, color: r.color }}>✓</span>}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', lineHeight: 1.4 }}>{r.description}</div>
              </div>
            ))}
          </div>
          {errors.role && <div style={{ fontSize: 11, color: '#FF453A', marginTop: 8 }}>{errors.role}</div>}
        </div>

        {/* Basic Info */}
        <div className="glass-card" style={{ padding: 20, marginBottom: 14, animationDelay: '0.15s' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 14, letterSpacing: '.06em' }}>NODE DETAILS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block' }}>Node Name *</label>
              <input value={form.name} onChange={e => { setForm({ ...form, name: e.target.value }); setErrors({ ...errors, name: '' }); }}
                placeholder="e.g. Erigon-Main-1" style={inputStyle('name')} />
              {errors.name && <div style={{ fontSize: 11, color: '#FF453A', marginTop: 4 }}>{errors.name}</div>}
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block' }}>Host / IP Address *</label>
              <input value={form.host} onChange={e => { setForm({ ...form, host: e.target.value }); setErrors({ ...errors, host: '' }); }}
                placeholder="e.g. 192.168.1.100 or node.example.com" style={inputStyle('host')} />
              {errors.host && <div style={{ fontSize: 11, color: '#FF453A', marginTop: 4 }}>{errors.host}</div>}
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block' }}>RPC URL *</label>
              <input value={form.rpcUrl} onChange={e => { setForm({ ...form, rpcUrl: e.target.value }); setErrors({ ...errors, rpcUrl: '' }); }}
                placeholder="e.g. http://192.168.1.100:8545" style={inputStyle('rpcUrl')} />
              {errors.rpcUrl && <div style={{ fontSize: 11, color: '#FF453A', marginTop: 4 }}>{errors.rpcUrl}</div>}
            </div>
          </div>
        </div>

        {/* Config */}
        <div className="glass-card" style={{ padding: 20, marginBottom: 14, animationDelay: '0.2s' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 14, letterSpacing: '.06em' }}>CONFIGURATION</div>
          <div className="v2-grid-2">
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block' }}>Client Type</label>
              <select value={form.clientType} onChange={e => setForm({ ...form, clientType: e.target.value })}
                style={{ ...inputStyle('clientType'), background: 'rgba(255,255,255,0.04)' }}>
                {CLIENTS.map(c => <option key={c} value={c}>{c.charAt(0)?.toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block' }}>Network</label>
              <select value={form.network} onChange={e => setForm({ ...form, network: e.target.value })}
                style={{ ...inputStyle('network'), background: 'rgba(255,255,255,0.04)' }}>
                {NETWORKS.map(n => <option key={n} value={n}>{n.charAt(0)?.toUpperCase() + n.slice(1)}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Optional */}
        <div className="glass-card" style={{ padding: 20, marginBottom: 20, animationDelay: '0.25s' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 14, letterSpacing: '.06em' }}>OPTIONAL INFO</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block' }}>Email (for alerts)</label>
              <input type="email" value={form.email} onChange={e => { setForm({ ...form, email: e.target.value }); setErrors({ ...errors, email: '' }); }}
                placeholder="ops@example.com" style={inputStyle('email')} />
              {errors.email && <div style={{ fontSize: 11, color: '#FF453A', marginTop: 4 }}>{errors.email}</div>}
            </div>
            <div className="v2-grid-2">
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block' }}>City</label>
                <input value={form.locationCity} onChange={e => setForm({ ...form, locationCity: e.target.value })}
                  placeholder="e.g. London" style={inputStyle('')} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 6, display: 'block' }}>Country</label>
                <input value={form.locationCountry} onChange={e => setForm({ ...form, locationCountry: e.target.value })}
                  placeholder="e.g. UK" style={inputStyle('')} />
              </div>
            </div>
          </div>
        </div>

        {result && !result.success && (
          <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)', color: '#FF453A', fontSize: 13, marginBottom: 16 }}>
            ⚠ {result.error}
          </div>
        )}

        <button type="submit" disabled={submitting}
          style={{ width: '100%', padding: '13px 0', borderRadius: 12, background: submitting ? 'rgba(0,212,255,0.05)' : 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)', color: '#0AD4FF', fontSize: 14, fontWeight: 800, cursor: submitting ? 'default' : 'pointer', letterSpacing: '-0.02em', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {submitting ? (
            <>
              <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(0,212,255,0.2)', borderTop: '2px solid rgba(0,212,255,0.8)', animation: 'spin 0.8s linear infinite' }} />
              Registering...
            </>
          ) : '→ Register Node'}
        </button>
      </form>
    </div>
  );
}
