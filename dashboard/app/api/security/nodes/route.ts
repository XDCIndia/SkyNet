import { NextRequest, NextResponse } from 'next/server';
import * as net from 'net';
import { scrapeEthstats, EthstatsNode } from '@/lib/ethstats-scraper';
// import { AUDIT_NODE_IPS, AUDIT_NODE_ACCOUNTS } from '@/lib/audit-data';
const AUDIT_NODE_IPS: Array<{ip:string;port:number}> = [];
const AUDIT_NODE_ACCOUNTS: Record<string, {account:string;name:string;port:number;isCandidate:boolean}> = {};

export const maxDuration = 120; // Allow up to 120 seconds for full scan
export const dynamic = 'force-dynamic';

// ─── Config ───────────────────────────────────────────────────────────────────
const VALIDATOR = '0x0000000000000000000000000000000000000088';

const NETWORKS: Record<string, { name: string; rpc: string; fallbacks: string[]; ethstatsIp?: string; ethstatsPort?: number; localNodes: Array<{url: string; name: string}> }> = {
  mainnet: {
    name: 'XDC Mainnet',
    rpc: 'https://rpc.xdcrpc.com',
    fallbacks: ['https://rpc.xdc.network', 'https://rpc.xinfin.network'],
    ethstatsIp: '45.82.64.150',
    ethstatsPort: 3000,
    localNodes: [
      { url: 'http://localhost:8545', name: 'GP5 Mainnet' },
      { url: 'http://localhost:8547', name: 'NM Mainnet' },
      { url: 'http://localhost:8546', name: 'Erigon Mainnet' },
      { url: 'http://localhost:8548', name: 'Reth Mainnet' },
    ],
  },
  apothem: {
    name: 'Apothem Testnet',
    rpc: 'https://apothem.xdcrpc.com',
    fallbacks: ['https://rpc.apothem.network'],
    localNodes: [
      { url: 'http://localhost:8562', name: 'GP5 Apothem' },
    ],
  },
};
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const PROBE_TIMEOUT_MS = 2500;
const PROBE_CONCURRENCY = 25;

// ─── Cache (per network) ──────────────────────────────────────────────────────
const cache = new Map<string, { data: ScanResult; ts: number }>();

// ─── Types ────────────────────────────────────────────────────────────────────
export interface NodeScanEntry {
  ip: string;
  sources: string[];
  rpcOpen: boolean;
  rpcPort: number;
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
  // Validator mapping
  validatorAddress: string;
  validatorName: string;
  validatorRole: 'active' | 'standby' | 'penalized' | 'fullnode' | 'unknown';
  isCandidate: boolean;
}

export interface MasternodeEntry {
  address: string;
  owner: string;
  stakeXDC: number;
  role: 'active' | 'standby' | 'penalized' | 'candidate';
}

export interface ScanResult {
  scannedAt: string;
  totalIPs: number;
  openRpc: number;
  openWs: number;
  debugExposed: number;
  uniqueProviders: number;
  nodes: NodeScanEntry[];
  masternodeList: MasternodeEntry[];
  masternodes: string[];
  standbynodes: string[];
  penalized: string[];
  activeCount: number;
  standbyCount: number;
  ethstats: {
    totalNodes: number;
    activeNodes: number;
    syncingNodes: number;
    maxBlock: number;
    nodes: EthstatsNode[];
    error?: string;
  };
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

async function ethCall(url: string, to: string, data: string): Promise<string> {
  return rpcPost(url, 'eth_call', [{ to, data }, 'latest']) as Promise<string>;
}

function decodeAddressArray(hex: string): string[] {
  if (!hex || hex.length < 10) return [];
  const data = hex.slice(2);
  if (data.length < 128) return [];
  const arrLen = parseInt(data.slice(64, 128), 16);
  const addrs: string[] = [];
  for (let i = 0; i < arrLen; i++) {
    const start = 128 + i * 64;
    if (start + 64 > data.length) break;
    addrs.push('0x' + data.slice(start + 24, start + 64));
  }
  return addrs;
}

function hexToInt(hex: string | null | undefined): number {
  if (!hex || hex === '0x') return 0;
  return parseInt(hex, 16);
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
async function runScan(networkKey: string = 'mainnet'): Promise<ScanResult> {
  const network = NETWORKS[networkKey] || NETWORKS.mainnet;
  const RPC = network.rpc;

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

  // Source A0: Known audit IPs (238 nodes from security assessment)
  if (networkKey === 'mainnet') {
    for (const node of AUDIT_NODE_IPS) {
      addIP(node.ip, 'audit:port' + node.port);
    }
  }

  // Source A: admin_peers from local nodes
  const localNodes = network.localNodes;

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

  // Parallel probe: RPC (8545 + 8989), WS (8546), P2P (30303)
  const probeResults = await scanWithConcurrency(
    allIPs,
    async (ip) => {
      const [rpc8545, rpc8989, wsOpen, p2pOpen] = await Promise.all([
        probeTCP(ip, 8545),
        probeTCP(ip, 8989),
        probeTCP(ip, 8546),
        probeTCP(ip, 30303),
      ]);
      const rpcOpen = rpc8545 || rpc8989;
      const rpcPort = rpc8545 ? 8545 : rpc8989 ? 8989 : 0;
      let modules: string[] = [];
      if (rpcOpen) {
        modules = await getRpcModules(ip + (rpcPort === 8989 ? ':8989' : ''));
        if (modules.length === 0 && rpc8989) {
          // Try port 8989 explicitly
          try {
            const res = await fetch(`http://${ip}:8989`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', method: 'rpc_modules', params: [], id: 1 }),
              signal: AbortSignal.timeout(3000),
            });
            const d = await res.json();
            if (d.result) modules = Object.keys(d.result);
          } catch { /* */ }
        }
      }
      const dangerous = modules.filter(m => ['debug', 'admin', 'personal', 'miner'].includes(m));
      return { ip, rpcOpen, rpcPort, wsOpen, p2pOpen, modules, dangerous };
    },
    PROBE_CONCURRENCY
  );

  // 4. Geolocate
  const geoMap = await geolocateBatch(allIPs);

  // 5. Load audit IP→account mapping
  const auditAccounts = networkKey === 'mainnet' ? AUDIT_NODE_ACCOUNTS : {};

  // Build result entries
  const nodes: NodeScanEntry[] = probeResults.map(({ ip, rpcOpen, rpcPort, wsOpen, p2pOpen, modules, dangerous }) => {
    const geo = geoMap.get(ip) || { isp: 'Unknown', org: '', country: 'Unknown', countryCode: '', city: '' };
    const score = calcScore(rpcOpen, wsOpen, dangerous);
    const findings: string[] = [];
    if (rpcOpen) findings.push('RPC port ' + (rpcPort || 8545) + ' open');
    if (wsOpen) findings.push('WS port 8546 open');
    if (dangerous.includes('debug')) findings.push('debug namespace exposed');
    if (dangerous.includes('admin')) findings.push('admin namespace exposed');
    if (dangerous.includes('personal')) findings.push('personal namespace exposed');

    const auditEntry = auditAccounts[ip];
    const validatorAddress = auditEntry?.account || '';
    const validatorName = auditEntry?.name || '';
    const isCandidate = auditEntry?.isCandidate || false;
    let validatorRole: NodeScanEntry['validatorRole'] = 'unknown';
    if (validatorAddress) {
      const addrLower = validatorAddress.toLowerCase();
      if (mnSet.has(addrLower)) validatorRole = 'active';
      else if (sbSet.has(addrLower)) validatorRole = 'standby';
      else if (penSet.has(addrLower)) validatorRole = 'penalized';
      else validatorRole = 'fullnode';
    }

    return {
      ip,
      sources: Array.from(ipSources.get(ip) || []),
      rpcOpen,
      rpcPort: rpcPort || 0,
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
      validatorAddress,
      validatorName,
      validatorRole,
      isCandidate,
    };
  });

  // Sort: lowest score first (most risky at top)
  nodes.sort((a, b) => a.securityScore - b.securityScore);

  const uniqueProviders = new Set(nodes.map(n => n.isp || n.org).filter(Boolean)).size;

  // 6. Run ethstats + masternode enrichment IN PARALLEL (both are slow)
  const mnSet = new Set(masternodes.map(a => a.toLowerCase()));
  const sbSet = new Set(standbynodes.map(a => a.toLowerCase()));
  const penSet = new Set(penalized.map(a => a.toLowerCase()));

  // Start ethstats scrape immediately (5s WS collection)
  const ethstatsPromise = (async () => {
    try {
      return network.ethstatsIp
        ? await scrapeEthstats(network.ethstatsIp, network.ethstatsPort)
        : { nodes: [], totalCollected: 0, messagesProcessed: 0, scrapedAt: new Date().toISOString(), error: 'No ethstats for this network' };
    } catch (e) {
      return { nodes: [], totalCollected: 0, messagesProcessed: 0, scrapedAt: new Date().toISOString(), error: (e as Error).message };
    }
  })();

  // Start masternode enrichment in parallel
  const masternodePromise = (async () => {
    const candidatesHex = await ethCall(RPC, VALIDATOR, '0x06a49fce');
    const allCandidates = decodeAddressArray(candidatesHex).filter(a => parseInt(a, 16) !== 0);
    const list: MasternodeEntry[] = [];
    for (let i = 0; i < allCandidates.length; i += 50) {
      const batch = allCandidates.slice(i, i + 50);
      const results = await Promise.allSettled(
        batch.map(async (addr) => {
          const capSel = '0x58e7525f' + '0'.repeat(24) + addr.slice(2);
          const ownerSel = '0xb642facd' + '0'.repeat(24) + addr.slice(2);
          const [capHex, ownerHex] = await Promise.all([
            ethCall(RPC, VALIDATOR, capSel),
            ethCall(RPC, VALIDATOR, ownerSel),
          ]);
          const capWei = BigInt(capHex || '0x0');
          const stakeXDC = Math.round(Number(capWei) / 1e18);
          const owner = ownerHex && ownerHex.length >= 42 ? '0x' + ownerHex.slice(-40) : '';
          const addrLower = addr.toLowerCase();
          const role: MasternodeEntry['role'] = mnSet.has(addrLower) ? 'active'
            : sbSet.has(addrLower) ? 'standby'
            : penSet.has(addrLower) ? 'penalized'
            : 'candidate';
          return { address: addr, owner, stakeXDC, role };
        })
      );
      for (const r of results) {
        if (r.status === 'fulfilled') list.push(r.value);
      }
    }
    list.sort((a, b) => {
      const roleOrder = { active: 0, standby: 1, penalized: 2, candidate: 3 };
      const rd = roleOrder[a.role] - roleOrder[b.role];
      return rd !== 0 ? rd : b.stakeXDC - a.stakeXDC;
    });
    return list;
  })();

  // Wait for both to complete
  const [ethResult, masternodeList] = await Promise.all([ethstatsPromise, masternodePromise]);

  const activeEthNodes = ethResult.nodes.filter((n: { active: boolean; syncing: boolean }) => n.active && !n.syncing);
  const syncingEthNodes = ethResult.nodes.filter((n: { syncing: boolean }) => n.syncing);
  const maxEthBlock = Math.max(0, ...ethResult.nodes.map((n: { blockNumber: number }) => n.blockNumber));
  const ethstatsData: ScanResult['ethstats'] = {
    totalNodes: ethResult.totalCollected,
    activeNodes: activeEthNodes.length,
    syncingNodes: syncingEthNodes.length,
    maxBlock: maxEthBlock,
    nodes: ethResult.nodes,
    error: ethResult.error,
  };

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
    masternodeList,
    activeCount: masternodes.length,
    standbyCount: standbynodes.length,
    penalizedCount: penalized.length,
    activeMNOpen: nodes.filter(n => n.validatorRole === 'active' && n.rpcOpen).length,
    standbyOpen: nodes.filter(n => n.validatorRole === 'standby' && n.rpcOpen).length,
    fullnodeOpen: nodes.filter(n => (n.validatorRole === 'fullnode' || n.validatorRole === 'unknown') && n.rpcOpen).length,
    ethstats: ethstatsData,
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const force = req.nextUrl.searchParams.get('refresh') === '1';
  const networkKey = req.nextUrl.searchParams.get('network') || 'mainnet';

  if (!NETWORKS[networkKey]) {
    return NextResponse.json({ error: `Unknown network: ${networkKey}. Use: mainnet | apothem` }, { status: 400 });
  }

  // Return cache if valid
  const cached = cache.get(networkKey);
  if (!force && cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ ...cached.data, cached: true });
  }

  try {
    const data = await runScan(networkKey);
    cache.set(networkKey, { data, ts: Date.now() });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
