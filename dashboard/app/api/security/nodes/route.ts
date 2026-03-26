import { NextRequest, NextResponse } from 'next/server';
import * as net from 'net';
import { scrapeEthstats, EthstatsNode } from '@/lib/ethstats-scraper';
// 238 known node IPs from security audit (March 2026)
const AUDIT_IPS: string[] = ["103.4.235.212","103.7.54.103","103.7.54.72","104.152.209.110","104.152.209.119","104.152.209.131","104.152.209.134","104.152.209.135","104.152.209.76","104.152.210.110","104.152.210.117","104.152.210.92","104.152.210.97","104.152.211.94","107.152.35.42","109.123.232.199","109.123.242.198","109.123.255.175","109.199.104.167","109.199.104.176","112.213.33.28","116.202.175.242","116.202.175.246","134.209.151.56","139.64.164.35","139.64.164.59","139.64.165.183","139.84.210.193","141.105.70.104","142.132.150.202","144.126.136.27","144.126.139.207","144.126.142.140","144.126.150.58","144.126.154.51","146.0.76.67","147.135.10.26","147.93.152.231","147.93.157.137","149.102.132.114","149.102.139.253","149.102.140.198","149.102.140.32","149.102.148.150","149.5.246.158","149.5.247.30","152.114.192.194","152.114.192.47","152.114.192.49","152.114.194.218","152.114.194.219","152.114.194.220","152.114.195.62","152.53.242.25","154.12.117.180","154.12.117.49","154.12.117.54","154.38.161.222","154.38.167.154","156.67.29.219","157.180.106.249","157.180.107.160","157.180.107.161","157.180.107.209","157.180.107.94","157.180.108.19","157.180.111.172","157.180.63.99","158.255.0.100","158.255.0.91","158.255.5.175","158.255.5.206","158.255.5.45","158.255.5.87","158.255.6.164","161.97.129.254","161.97.130.13","161.97.131.145","161.97.131.6","161.97.155.86","161.97.183.38","161.97.77.36","162.250.188.70","162.250.189.149","162.250.189.221","162.250.190.246","162.250.191.14","162.250.191.160","162.250.191.5","162.250.191.70","164.68.101.30","164.68.115.24","167.224.64.239","167.235.13.113","167.86.126.97","167.86.80.198","167.86.89.240","168.119.4.162","168.119.67.58","173.212.216.152","173.249.10.67","175.45.183.249","176.9.17.66","176.9.17.98","185.130.224.211","185.130.224.247","185.175.45.97","185.218.204.110","185.252.234.115","185.70.184.28","185.70.186.99","193.247.82.157","194.147.214.186","194.163.138.98","194.163.186.247","194.180.206.170","194.180.207.188","194.233.95.220","194.34.236.239","205.172.57.65","205.172.58.173","207.180.240.193","207.244.252.29","207.90.192.188","209.126.1.10","209.126.1.25","209.126.11.108","209.126.2.33","209.126.9.230","209.209.8.252","209.250.245.222","212.237.219.94","213.133.101.14","213.133.101.8","213.136.72.182","216.106.184.93","3.209.179.245","37.60.243.5","37.60.244.133","38.102.124.161","38.102.124.162","38.102.124.164","38.102.124.216","38.102.124.68","38.102.84.145","38.102.84.166","38.102.85.251","38.102.85.50","38.102.86.242","38.102.87.174","38.102.87.214","38.102.87.241","38.102.87.32","38.102.87.4","38.102.87.54","38.114.123.74","38.143.58.165","38.143.58.166","38.186.48.83","38.242.155.60","38.242.202.39","38.242.209.74","38.49.208.227","38.49.208.229","38.49.208.244","38.49.208.252","38.49.208.253","38.49.209.153","38.49.209.177","38.49.209.215","38.49.210.110","38.49.210.133","38.49.210.142","38.49.210.149","38.49.210.154","38.49.210.232","38.49.210.249","38.49.210.253","38.49.210.78","38.49.212.117","38.49.212.52","38.49.212.92","38.49.212.98","38.49.213.162","38.49.216.166","45.10.162.64","45.32.117.169","45.32.44.106","45.32.95.89","45.58.149.95","45.76.87.117","45.77.17.1","46.17.97.100","46.250.240.52","46.250.244.219","5.180.172.41","5.180.174.145","5.189.144.192","5.189.158.155","5.39.216.187","54.219.223.79","54.37.200.146","62.171.147.107","62.171.181.23","62.212.86.103","64.20.34.122","65.108.0.32","65.109.25.162","65.21.216.184","65.21.27.213","66.151.40.197","66.151.42.217","67.220.70.103","69.50.95.191","69.50.95.203","74.207.225.194","75.119.143.96","75.119.155.142","77.42.7.160","78.46.75.143","78.46.75.144","78.46.98.23","78.46.98.24","81.0.220.137","84.247.172.33","84.247.183.213","85.190.246.191","85.239.236.10","85.239.242.163","86.48.31.130","89.117.146.4","89.117.49.48","91.230.111.137","94.130.249.58","94.130.249.61","95.111.245.191","95.217.77.10","95.217.77.20"];

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

  // Create lookup sets for role matching
  const mnSet = new Set(masternodes.map((a: string) => a.toLowerCase()));
  const sbSet = new Set(standbynodes.map((a: string) => a.toLowerCase()));
  const penSet = new Set(penalized.map((a: string) => a.toLowerCase()));

  // 2. Collect IPs from multiple sources
  const ipSources = new Map<string, Set<string>>(); // ip -> set of sources

  const addIP = (ip: string, source: string) => {
    if (!ip || ip === 'null' || ip === 'None') return;
    if (!ipSources.has(ip)) ipSources.set(ip, new Set());
    ipSources.get(ip)!.add(source);
  };

  // Source A0: Known audit IPs (238 nodes from security assessment)
  if (networkKey === 'mainnet') {
    // Source A0: known node IPs from security audit
    for (const ip of AUDIT_IPS) {
      addIP(ip, 'audit');
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
  // Build result entries — query eth_accounts on open RPC nodes for live coinbase
  const nodes: NodeScanEntry[] = await Promise.all(
    probeResults.map(async ({ ip, rpcOpen, rpcPort, wsOpen, p2pOpen, modules, dangerous }) => {
      const geo = geoMap.get(ip) || { isp: 'Unknown', org: '', country: 'Unknown', countryCode: '', city: '' };
      const score = calcScore(rpcOpen, wsOpen, dangerous);
      const findings: string[] = [];
      if (rpcOpen) findings.push('RPC port ' + (rpcPort || 8545) + ' open');
      if (wsOpen) findings.push('WS port 8546 open');
      if (dangerous.includes('debug')) findings.push('debug namespace exposed');
      if (dangerous.includes('admin')) findings.push('admin namespace exposed');
      if (dangerous.includes('personal')) findings.push('personal namespace exposed');

      // Query live coinbase/etherbase from the node's RPC
      let validatorAddress = '';
      let validatorName = '';
      let isCandidate = false;
      let validatorRole: NodeScanEntry['validatorRole'] = 'unknown';

      if (rpcOpen) {
        try {
          const rpcUrl = rpcPort === 8989 ? `http://${ip}:8989` : `http://${ip}:8545`;
          const acctRes = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_accounts', params: [], id: 1 }),
            signal: AbortSignal.timeout(3000),
          });
          const acctData = await acctRes.json();
          const accounts: string[] = acctData.result || [];
          if (accounts.length > 0) {
            validatorAddress = accounts[0].toLowerCase();
            findings.push('Unlocked account: ' + validatorAddress.slice(0, 10) + '...');

            // Check role against masternode/standby sets
            if (mnSet.has(validatorAddress)) {
              validatorRole = 'active';
              isCandidate = true;
            } else if (sbSet.has(validatorAddress)) {
              validatorRole = 'standby';
              isCandidate = true;
            } else if (penSet.has(validatorAddress)) {
              validatorRole = 'penalized';
              isCandidate = true;
            } else {
              validatorRole = 'fullnode';
            }
          }
        } catch { /* eth_accounts not available or timed out */ }

        // Also try to get node name via web3_clientVersion
        try {
          const rpcUrl = rpcPort === 8989 ? `http://${ip}:8989` : `http://${ip}:8545`;
          const verRes = await fetch(rpcUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'web3_clientVersion', params: [], id: 1 }),
            signal: AbortSignal.timeout(2000),
          });
          const verData = await verRes.json();
          if (verData.result) validatorName = verData.result;
        } catch { /* */ }
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
    })
  );

  // Sort: lowest score first (most risky at top)
  nodes.sort((a, b) => a.securityScore - b.securityScore);

  const uniqueProviders = new Set(nodes.map(n => n.isp || n.org).filter(Boolean)).size;

  // 6. Run ethstats + masternode enrichment IN PARALLEL (both are slow)
  // mnSet/sbSet/penSet already created above

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
