import { NextRequest, NextResponse } from 'next/server';

const VALIDATOR   = '0x0000000000000000000000000000000000000088';
const BLOCKSIGNER = '0x0000000000000000000000000000000000000089';
const RANDOMIZE   = '0x0000000000000000000000000000000000000090';
const ZERO_ADDR   = '0x0000000000000000000000000000000000000000';

const NETWORKS: Record<string, { name: string; rpc: string; fallbacks: string[] }> = {
  mainnet: {
    name: 'XDC Mainnet',
    // Own RPCs first (reliable), Ankr last as public fallback
    rpc: 'https://rpc.xdcrpc.com',
    fallbacks: ['https://rpc.xdc.network', 'https://rpc.xinfin.network', 'https://rpc1.xinfin.network', 'https://rpc.ankr.com/xdc'],
  },
  apothem: {
    name: 'Apothem Testnet',
    rpc: 'https://apothem.xdcrpc.com',
    fallbacks: ['https://rpc.apothem.network', 'https://rpc.ankr.com/xdc_testnet'],
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
  if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error));
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

// Try RPCs in order, return first working one
// Skips rate-limited endpoints and continues to next fallback
async function findWorkingRpc(config: { rpc: string; fallbacks: string[] }): Promise<{ url: string; blockNumber: number }> {
  const urls = [config.rpc, ...config.fallbacks];
  const errors: string[] = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
        signal: AbortSignal.timeout(6000),
      });
      const data = await res.json();
      // Rate limited — skip to next, don't throw
      if (data.error?.code === -32090 || data.error?.message?.includes('rate limit')) {
        errors.push(`${url} (rate limited)`);
        continue;
      }
      if (data.error) {
        errors.push(`${url} (${data.error.message})`);
        continue;
      }
      const blockNumber = hexToInt(data.result);
      if (blockNumber > 0) return { url, blockNumber };
      errors.push(`${url} (block=0)`);
    } catch (e) {
      errors.push(`${url} (${(e as Error).message})`);
    }
  }
  throw new Error(`No working RPC available. Tried: ${errors.join(' | ')}`);
}

async function runAudit(networkKey: string) {
  const config = NETWORKS[networkKey];
  if (!config) throw new Error(`Unknown network: ${networkKey}`);

  const { url: rpcUrl, blockNumber } = await findWorkingRpc(config);

  // Parallel fetch all contract data
  const [
    candidateCountHex, ownerCountHex, candidatesHex,
    minCapHex, minVoterCapHex, maxValHex, candDelayHex, voterDelayHex,
    bsCode, rzCode,
  ] = await Promise.all([
    ethCall(rpcUrl, VALIDATOR, '0xa9a981a3'),  // candidateCount()
    ethCall(rpcUrl, VALIDATOR, '0xef18374a'),  // getOwnerCount()  ← corrected
    ethCall(rpcUrl, VALIDATOR, '0x06a49fce'),  // getCandidates()
    ethCall(rpcUrl, VALIDATOR, '0xd55b7dff'),  // minCandidateCap() ← corrected
    ethCall(rpcUrl, VALIDATOR, '0xf8ac9dd5'),  // minVoterCap()     ← corrected
    ethCall(rpcUrl, VALIDATOR, '0xd09f1ab4'),  // maxValidatorNumber() ← corrected
    ethCall(rpcUrl, VALIDATOR, '0xd161c767'),  // candidateWithdrawDelay() ← corrected
    ethCall(rpcUrl, VALIDATOR, '0xa9ff959e'),  // voterWithdrawDelay() ← corrected
    rpcPost(rpcUrl, 'eth_getCode', [BLOCKSIGNER, 'latest']),
    rpcPost(rpcUrl, 'eth_getCode', [RANDOMIZE, 'latest']),
  ]);

  const candidateCount = hexToInt(candidateCountHex);
  const ownerCount = hexToInt(ownerCountHex);
  const candidates = decodeAddressArray(candidatesHex);

  const ZERO = ZERO_ADDR.toLowerCase();
  const ghostEntries = candidates.filter(a => a.toLowerCase() === ZERO || parseInt(a, 16) === 0).length;
  const activeCandidates = candidates.filter(a => a.toLowerCase() !== ZERO && parseInt(a, 16) !== 0);

  const votesNeeded75pct = Math.floor(ownerCount * 0.75) + 1;
  const governanceBroken = votesNeeded75pct > candidateCount;

  const minCapWei = BigInt(minCapHex || '0x0');
  const minCandidateCap = (Number(minCapWei) / 1e18).toFixed(0);
  // minVoterCapHex available but not used in audit output currently
  const maxValidatorNumber = hexToInt(maxValHex);
  const candidateWithdrawDelayBlocks = hexToInt(candDelayHex);
  const voterWithdrawDelayBlocks = hexToInt(voterDelayHex);

  const blockSignerHasCode = !!(bsCode as string) && (bsCode as string) !== '0x' && (bsCode as string).length > 4;
  const randomizeHasCode   = !!(rzCode as string) && (rzCode as string) !== '0x' && (rzCode as string).length > 4;

  // RPC modules (best-effort)
  let exposedModules: string[] = [];
  let dangerousModules: string[] = [];
  try {
    const modules = await rpcPost(rpcUrl, 'rpc_modules', []) as Record<string, string>;
    exposedModules = Object.keys(modules);
    dangerousModules = exposedModules.filter(m => ['debug', 'admin', 'personal', 'miner'].includes(m));
  } catch { /* not all nodes expose this */ }

  // KYC governance simulation:
  // Show what voteInvalidKYC needs vs what's possible
  const kycGovernance = {
    ownerCount,
    candidateCount,
    threshold75pct: votesNeeded75pct,
    maxPossibleVotes: candidateCount,
    deficitVotes: Math.max(0, votesNeeded75pct - candidateCount),
    governanceBroken,
    ghostEntries,
    activeCandidatesSample: activeCandidates.slice(0, 5),
    // Steps in flow
    flowSteps: [
      {
        step: 1,
        fn: 'uploadKYC(string kychash)',
        status: 'broken',
        description: 'Anyone can upload any string as KYC. No admin approval, no identity check. Just pushing a string makes you "KYC whitelisted".',
        selector: '0x9d888e86',
      },
      {
        step: 2,
        fn: 'propose(address _candidate)',
        status: governanceBroken ? 'broken' : 'ok',
        description: `propose() increments ownerCount on first call per address (currently ${ownerCount.toLocaleString()}), but resign() NEVER decrements it. This is the root cause of governance failure.`,
        selector: '0x01267951',
      },
      {
        step: 3,
        fn: 'voteInvalidKYC(address _invalidCandidate)',
        status: 'broken',
        description: `Requires invalidKYCCount * 100 / getOwnerCount() >= 75. With ownerCount=${ownerCount.toLocaleString()}, need ${votesNeeded75pct.toLocaleString()} votes. Only ${candidateCount} candidates exist. Permanently unreachable.`,
        selector: '0x8f35a75e',
      },
      {
        step: 4,
        fn: 'delete candidates[i] then delete validatorsState[candidates[i]]',
        status: 'broken',
        description: `Even if threshold were reached: delete candidates[i] first zeros the slot to address(0), then delete validatorsState[address(0)] deletes the WRONG state. The invalidated validator keeps isCandidate=true and can resign()+withdraw().`,
        selector: 'internal',
      },
    ],
    validationQuery: {
      rpc: rpcUrl,
      contract: VALIDATOR,
      getOwnerCount: { selector: '0xa9ff959e', result: ownerCount },
      candidateCount: { selector: '0xa9a981a3', result: candidateCount },
      candidatesArrayLength: candidates.length,
      ghostEntries,
    },
  };

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
    kycGovernance,
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
