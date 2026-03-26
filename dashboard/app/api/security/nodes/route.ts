import { NextRequest, NextResponse } from 'next/server';
import * as net from 'net';

// ─── Config ───────────────────────────────────────────────────────────────────
const RPC = 'https://rpc.xdcrpc.com';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const PROBE_TIMEOUT_MS = 2500;
const PROBE_CONCURRENCY = 25;

// ─── Cache ────────────────────────────────────────────────────────────────────
let cache: { data: ScanResult; ts: number } | null = null;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface NodeScanEntry {
  ip: string;
  sources: string[];        // where we discovered this IP
  rpcOpen: boolean;
  wsOpen: boolean;
  p2pOpen: boolean;
  exposedModules: string[];
  dangerousModules: string[];
  securityScore: number;
  securityLabel: 'secure' | 'caution' | 'risk';
  isp: string;
  org: string;
  country: string;
  countryCode: string;
  city: string;
  findings: string[];
}

export interface ScanResult {
  scannedAt: string;
  totalIPs: number;
  openRpc: number;
  openWs: number;
  debugExposed: number;
  uniqueProviders: number;
  nodes: NodeScanEntry[];
  masternodes: string[];
  standbynodes: string[];
  penalized: string[];
  activeCount: number;
  standbyCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function rpcPost(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
    signal: AbortSignal.timeout(8000),
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error.message);
  return d.result;
}

// TCP port probe using Node.js net module
function probeTCP(ip: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (result: boolean) => {
      sock.destroy();
      resolve(result);
    };
    sock.setTimeout(PROBE_TIMEOUT_MS);
    sock.on('connect', () => done(true));
    sock.on('timeout', () => done(false));
    sock.on('error', () => done(false));
    sock.connect(port, ip);
  });
}

// Check RPC modules if port is open
async function getRpcModules(ip: string): Promise<string[]> {
  try {
    const res = await fetch(`http://${ip}:8545`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'rpc_modules', params: [], id: 1 }),
      signal: AbortSignal.timeout(3000),
    });
    const d = await res.json();
    return d.result ? Object.keys(d.result) : [];
  } catch {
    return [];
  }
}

// Batch geolocate IPs via ip-api.com (100 per batch, free)
async function geolocateBatch(ips: string[]): Promise<Map<string, { isp: string; org: string; country: string; countryCode: string; city: string }>> {
  const result = new Map<string, { isp: string; org: string; country: string; countryCode: string; city: string }>();
  const chunks = [];
  for (let i = 0; i < ips.length; i += 100) chunks.push(ips.slice(i, i + 100));

  for (const chunk of chunks) {
    try {
      const res = await fetch('http://ip-api.com/batch?fields=status,query,country,countryCode,city,isp,org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk.map(ip => ({ query: ip }))),
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json() as Array<{ query: string; country: string; countryCode: string; city: string; isp: string; org: string; status: string }>;
      for (const item of data) {
        if (item.status === 'success') {
          result.set(item.query, {
            isp: item.isp || '',
            org: item.org || '',
            country: item.country || '',
            countryCode: item.countryCode || '',
            city: item.city || '',
          });
        }
      }
    } catch { /* geo failed for this batch */ }
  }
  return result;
}

// Security score calculation
function calcScore(rpcOpen: boolean, wsOpen: boolean, dangerousMods: string[]): number {
  let score = 100;
  if (rpcOpen) score -= 40;
  if (wsOpen) score -= 15;
  if (dangerousMods.includes('debug')) score -= 30;
  if (dangerousMods.includes('admin')) score -= 15;
  if (dangerousMods.includes('personal')) score -= 10;
  if (dangerousMods.includes('miner')) score -= 5;
  return Math.max(0, score);
}

function scoreLabel(score: number): 'secure' | 'caution' | 'risk' {
  if (score >= 80) return 'secure';
  if (score >= 50) return 'caution';
  return 'risk';
}

// Run scan with concurrency control
async function scanWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(fn));
    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(r.value);
    }
  }
  return results;
}

// ─── Main scan ────────────────────────────────────────────────────────────────
async function runScan(): Promise<ScanResult> {
  // 1. Get masternode list
  const mnData = await rpcPost(RPC, 'XDPoS_getMasternodesByNumber', ['latest']) as {
    Masternodes: string[];
    Standbynodes: string[];
    Penalty: string[];
  };
  const masternodes = mnData.Masternodes || [];
  const standbynodes = mnData.Standbynodes || [];
  const penalized = mnData.Penalty || [];

  // 2. Collect IPs from multiple sources
  const ipSources = new Map<string, Set<string>>(); // ip -> set of sources

  const addIP = (ip: string, source: string) => {
    if (!ip || ip === 'null' || ip === 'None') return;
    if (!ipSources.has(ip)) ipSources.set(ip, new Set());
    ipSources.get(ip)!.add(source);
  };

  // Source A: admin_peers from local nodes
  const localNodes = [
    { url: 'http://localhost:8545', name: 'GP5 Mainnet' },
    { url: 'http://localhost:8547', name: 'NM Mainnet' },
    { url: 'http://localhost:8546', name: 'Erigon Mainnet' },
    { url: 'http://localhost:8562', name: 'GP5 Apothem' },
    { url: 'http://localhost:8548', name: 'Reth Mainnet' },
  ];

  for (const node of localNodes) {
    try {
      const peers = await rpcPost(node.url, 'admin_peers', []) as Array<{ network?: { remoteAddress?: string } }>;
      for (const peer of peers) {
        const remote = peer?.network?.remoteAddress || '';
        const ip = remote.split(':')[0];
        if (ip && ip.match(/^\d+\.\d+\.\d+\.\d+$/)) {
          addIP(ip, `peers:${node.name}`);
        }
      }
    } catch { /* node not available */ }
  }

  // Source B: SkyNet registered nodes
  try {
    const res = await fetch('http://localhost:3005/api/v1/nodes?limit=500', { signal: AbortSignal.timeout(5000) });
    const data = await res.json() as { nodes?: Array<{ ipv4?: string; name?: string }> };
    const skyNodes = data.nodes || [];
    for (const n of skyNodes) {
      if (n.ipv4 && n.ipv4 !== 'null') addIP(n.ipv4, `skynet:${n.name || ''}`);
    }
  } catch { /* SkyNet not available */ }

  // 3. Probe all discovered IPs
  const allIPs = Array.from(ipSources.keys());

  // Parallel probe: RPC (8545), WS (8546), P2P (30303)
  const probeResults = await scanWithConcurrency(
    allIPs,
    async (ip) => {
      const [rpcOpen, wsOpen, p2pOpen] = await Promise.all([
        probeTCP(ip, 8545),
        probeTCP(ip, 8546),
        probeTCP(ip, 30303),
      ]);
      let modules: string[] = [];
      if (rpcOpen) modules = await getRpcModules(ip);
      const dangerous = modules.filter(m => ['debug', 'admin', 'personal', 'miner'].includes(m));
      return { ip, rpcOpen, wsOpen, p2pOpen, modules, dangerous };
    },
    PROBE_CONCURRENCY
  );

  // 4. Geolocate
  const geoMap = await geolocateBatch(allIPs);

  // 5. Build result entries
  const nodes: NodeScanEntry[] = probeResults.map(({ ip, rpcOpen, wsOpen, p2pOpen, modules, dangerous }) => {
    const geo = geoMap.get(ip) || { isp: 'Unknown', org: '', country: 'Unknown', countryCode: '', city: '' };
    const score = calcScore(rpcOpen, wsOpen, dangerous);
    const findings: string[] = [];
    if (rpcOpen) findings.push('RPC port 8545 open');
    if (wsOpen) findings.push('WS port 8546 open');
    if (dangerous.includes('debug')) findings.push('debug namespace exposed');
    if (dangerous.includes('admin')) findings.push('admin namespace exposed');
    if (dangerous.includes('personal')) findings.push('personal namespace exposed');
    return {
      ip,
      sources: Array.from(ipSources.get(ip) || []),
      rpcOpen,
      wsOpen,
      p2pOpen,
      exposedModules: modules,
      dangerousModules: dangerous,
      securityScore: score,
      securityLabel: scoreLabel(score),
      isp: geo.isp,
      org: geo.org,
      country: geo.country,
      countryCode: geo.countryCode,
      city: geo.city,
      findings,
    };
  });

  // Sort: lowest score first (most risky at top)
  nodes.sort((a, b) => a.securityScore - b.securityScore);

  const uniqueProviders = new Set(nodes.map(n => n.isp || n.org).filter(Boolean)).size;

  return {
    scannedAt: new Date().toISOString(),
    totalIPs: nodes.length,
    openRpc: nodes.filter(n => n.rpcOpen).length,
    openWs: nodes.filter(n => n.wsOpen).length,
    debugExposed: nodes.filter(n => n.dangerousModules.includes('debug')).length,
    uniqueProviders,
    nodes,
    masternodes,
    standbynodes,
    penalized,
    activeCount: masternodes.length,
    standbyCount: standbynodes.length,
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('refresh') === '1';

  // Return cache if valid
  if (!force && cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json({ ...cache.data, cached: true });
  }

  try {
    const data = await runScan();
    cache = { data, ts: Date.now() };
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
