import { NextRequest, NextResponse } from 'next/server';

const VALIDATOR  = '0x0000000000000000000000000000000000000088';
const BLOCKSIGNER = '0x0000000000000000000000000000000000000089';
const RANDOMIZE   = '0x0000000000000000000000000000000000000090';
const ZERO_ADDR   = '0x0000000000000000000000000000000000000000';

const NETWORKS: Record<string, { name: string; rpc: string; fallbacks: string[] }> = {
  mainnet: {
    name: 'XDC Mainnet',
    rpc: 'https://rpc.xdcrpc.com',
    fallbacks: ['https://rpc.xinfin.network', 'https://rpc1.xinfin.network', 'https://erpc.xinfin.network'],
  },
  apothem: {
    name: 'Apothem Testnet',
    rpc: 'https://apothem.xdcrpc.com',
    fallbacks: ['https://rpc.apothem.network'],
  },
};

async function rpcPost(url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

async function ethCall(url: string, to: string, data: string): Promise<string> {
  return rpcPost(url, 'eth_call', [{ to, data }, 'latest']) as Promise<string>;
}

function hexToInt(hex: string | null | undefined): number {
  if (!hex || hex === '0x') return 0;
  return parseInt(hex, 16);
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

async function findWorkingRpc(config: { rpc: string; fallbacks: string[] }): Promise<string> {
  const urls = [config.rpc, ...config.fallbacks];
  for (const url of urls) {
    try {
      await rpcPost(url, 'eth_blockNumber', []);
      return url;
    } catch { continue; }
  }
  throw new Error(`No working RPC for ${urls[0]}`);
}

async function runAudit(networkKey: string) {
  const config = NETWORKS[networkKey];
  if (!config) throw new Error(`Unknown network: ${networkKey}`);

  const rpcUrl = await findWorkingRpc(config);
  const blockHex = await rpcPost(rpcUrl, 'eth_blockNumber', []) as string;
  const blockNumber = hexToInt(blockHex);

  // Core counters + candidates array in parallel
  const [candidateCountHex, ownerCountHex, candidatesHex, minCapHex, maxValHex, candDelayHex, voterDelayHex, bsCode, rzCode] =
    await Promise.all([
      ethCall(rpcUrl, VALIDATOR, '0xa9a981a3'),  // candidateCount()
      ethCall(rpcUrl, VALIDATOR, '0xa9ff959e'),  // getOwnerCount()
      ethCall(rpcUrl, VALIDATOR, '0x06a49fce'),  // getCandidates()
      ethCall(rpcUrl, VALIDATOR, '0x33aca42f'),  // minCandidateCap()
      ethCall(rpcUrl, VALIDATOR, '0x09dfdc2f'),  // maxValidatorNumber()
      ethCall(rpcUrl, VALIDATOR, '0x4d11d8fe'),  // candidateWithdrawDelay()
      ethCall(rpcUrl, VALIDATOR, '0x6fd55014'),  // voterWithdrawDelay()
      rpcPost(rpcUrl, 'eth_getCode', [BLOCKSIGNER, 'latest']) as Promise<string>,
      rpcPost(rpcUrl, 'eth_getCode', [RANDOMIZE, 'latest']) as Promise<string>,
    ]);

  const candidateCount = hexToInt(candidateCountHex);
  const ownerCount = hexToInt(ownerCountHex);
  const candidates = decodeAddressArray(candidatesHex);
  const ghostEntries = candidates.filter(a => a.toLowerCase() === ZERO_ADDR || parseInt(a, 16) === 0).length;
  const votesNeeded75pct = Math.floor(ownerCount * 0.75) + 1;
  const governanceBroken = votesNeeded75pct > candidateCount;

  const minCapWei = BigInt(minCapHex || '0x0');
  const minCandidateCap = (Number(minCapWei) / 1e18).toFixed(0);
  const maxValidatorNumber = hexToInt(maxValHex);
  const candidateWithdrawDelayBlocks = hexToInt(candDelayHex);
  const voterWithdrawDelayBlocks = hexToInt(voterDelayHex);

  const blockSignerHasCode = !!(bsCode as string) && (bsCode as string) !== '0x' && (bsCode as string).length > 4;
  const randomizeHasCode   = !!(rzCode as string) && (rzCode as string) !== '0x' && (rzCode as string).length > 4;

  // RPC modules
  let exposedModules: string[] = [];
  let dangerousModules: string[] = [];
  try {
    const modules = await rpcPost(rpcUrl, 'rpc_modules', []) as Record<string, string>;
    exposedModules = Object.keys(modules);
    dangerousModules = exposedModules.filter(m => ['debug', 'admin', 'personal', 'miner'].includes(m));
  } catch { /* not all nodes expose this */ }

  return {
    network: config.name,
    networkKey,
    rpc: rpcUrl,
    blockNumber,
    candidateCount,
    ownerCount,
    candidatesArrayLength: candidates.length,
    ghostEntries,
    votesNeeded75pct,
    governanceBroken,
    minCandidateCap,
    maxValidatorNumber,
    candidateWithdrawDelayBlocks,
    voterWithdrawDelayBlocks,
    blockSignerHasCode,
    randomizeHasCode,
    exposedModules,
    dangerousModules,
    timestamp: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const network = req.nextUrl.searchParams.get('network') || 'mainnet';
  try {
    const result = await runAudit(network);
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
