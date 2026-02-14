import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

// XDC Mainnet RPC and Validator Contract
const MAINNET_RPC = 'https://erpc.xinfin.network';
const VALIDATOR_CONTRACT = '0x0000000000000000000000000000000000000088';

// Method signatures (keccak256 hashes)
const SELECTORS = {
  getCandidates: '0x06a49fce',
  getCandidateCap: '0x58e7525f',
  getCandidateOwner: '0xb642facd',
};

// Cache for masternode data
interface CacheEntry {
  data: MasternodeData;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 60 * 1000; // 60 seconds

interface MasternodeInfo {
  address: string;
  xdcAddress: string;
  status: 'active' | 'standby' | 'penalized';
  owner?: string;
  stake?: string;
  stakeRaw: string;
  voterCount?: number;
  rank?: number;
}

interface MasternodeData {
  epoch: number;
  round: number;
  blockNumber: number;
  masternodes: MasternodeInfo[];
  standbynodes: MasternodeInfo[];
  penalized: MasternodeInfo[];
  totalStaked: string;
  nakamotoCoefficient: number;
}

// Helper: convert 0x address to xdc address
function toXdcAddress(address: string): string {
  if (!address) return '';
  if (address.startsWith('0x')) {
    return 'xdc' + address.slice(2);
  }
  return address;
}

// Helper: format wei to XDC
function weiToXDC(wei: bigint | string): string {
  const weiValue = typeof wei === 'string' ? BigInt(wei) : wei;
  const xdcValue = Number(weiValue) / 1e18;
  return xdcValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Make RPC call to mainnet
async function rpcCall(url: string, method: string, params: any[]): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC error: ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }

  return data.result;
}

// Make eth_call to validator contract
async function ethCall(rpcUrl: string, data: string): Promise<string> {
  return rpcCall(rpcUrl, 'eth_call', [{
    to: VALIDATOR_CONTRACT,
    data,
  }, 'latest']);
}

// Encode address parameter (pad to 32 bytes)
function encodeAddress(address: string): string {
  const cleanAddr = address.toLowerCase().replace(/^0x/, '');
  return '0'.repeat(24) + cleanAddr;
}

// Decode uint256 from hex
function decodeUint256(hex: string): bigint {
  return BigInt(hex);
}

// Decode address array from hex
function decodeAddressArray(hex: string): string[] {
  if (!hex || hex === '0x') return [];
  const clean = hex.replace(/^0x/, '');
  const length = parseInt(clean.slice(64, 128), 16);
  const addresses: string[] = [];

  for (let i = 0; i < length; i++) {
    const start = 128 + i * 64;
    const addr = '0x' + clean.slice(start + 24, start + 64);
    addresses.push(addr);
  }

  return addresses;
}

// Fetch candidate cap (stake)
async function fetchCandidateCap(rpcUrl: string, address: string): Promise<bigint> {
  const data = SELECTORS.getCandidateCap + encodeAddress(address);
  const result = await ethCall(rpcUrl, data);
  return decodeUint256(result);
}

// Fetch candidate owner
async function fetchCandidateOwner(rpcUrl: string, address: string): Promise<string | undefined> {
  const data = SELECTORS.getCandidateOwner + encodeAddress(address);
  const result = await ethCall(rpcUrl, data);
  const owner = '0x' + result.slice(-40);
  // Return undefined if zero address
  if (owner.toLowerCase() === '0x0000000000000000000000000000000000000000') {
    return undefined;
  }
  return owner;
}

// Batch process with concurrency limit
async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency = 10
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(item => processor(item)));
    results.push(...batchResults);
  }

  return results;
}

// Calculate Nakamoto coefficient
function calculateNakamotoCoefficient(candidates: MasternodeInfo[], totalStaked: bigint): number {
  if (!candidates.length || totalStaked === 0n) return 0;

  const sorted = [...candidates]
    .filter(m => m.stakeRaw)
    .sort((a, b) => {
      const aStake = BigInt(a.stakeRaw);
      const bStake = BigInt(b.stakeRaw);
      return bStake > aStake ? 1 : bStake < aStake ? -1 : 0;
    });

  const threshold = Number(totalStaked) * 0.33;
  let accumulated = 0n;
  let count = 0;

  for (const mn of sorted) {
    accumulated += BigInt(mn.stakeRaw);
    count++;
    if (Number(accumulated) >= threshold) break;
  }

  return count;
}

// Fetch live masternode data from XDCValidator contract
async function fetchLiveMasternodeData(): Promise<MasternodeData> {
  // Get current block info
  const blockNumberHex = await rpcCall(MAINNET_RPC, 'eth_blockNumber', []);
  const blockNumber = parseInt(blockNumberHex, 16);
  const epoch = Math.floor(blockNumber / 900);

  // Get candidates from contract
  const candidatesData = await ethCall(MAINNET_RPC, SELECTORS.getCandidates);
  const candidateAddresses = decodeAddressArray(candidatesData);

  // Get current masternodes and standbynodes using XDPoS API
  let activeAddresses: string[] = [];
  let standbyAddresses: string[] = [];
  let penalizedAddresses: string[] = [];

  try {
    const masternodesResult = await rpcCall(MAINNET_RPC, 'XDPoS_getMasternodesByNumber', ['latest']);
    activeAddresses = (masternodesResult.Masternodes || []).map((a: string) => a.toLowerCase());
    standbyAddresses = (masternodesResult.Standbynodes || []).map((a: string) => a.toLowerCase());
    penalizedAddresses = (masternodesResult.Penalty || []).map((a: string) => a.toLowerCase());
  } catch (err) {
    console.warn('Failed to get masternodes by number, using candidate list only');
  }

  // Fetch stake and owner for all candidates
  const candidatesWithData = await batchProcess(
    candidateAddresses,
    async (address) => {
      try {
        const [stakeWei, owner] = await Promise.all([
          fetchCandidateCap(MAINNET_RPC, address),
          fetchCandidateOwner(MAINNET_RPC, address).catch(() => undefined),
        ]);
        return {
          address: address.toLowerCase(),
          xdcAddress: toXdcAddress(address.toLowerCase()),
          stakeRaw: stakeWei.toString(),
          stake: weiToXDC(stakeWei),
          owner: owner?.toLowerCase(),
        };
      } catch (err) {
        console.error(`Failed to fetch data for ${address}:`, err);
        return {
          address: address.toLowerCase(),
          xdcAddress: toXdcAddress(address.toLowerCase()),
          stakeRaw: '0',
          stake: '0.00',
          owner: undefined,
        };
      }
    },
    10
  );

  // Sort by stake descending
  candidatesWithData.sort((a, b) => {
    const aStake = BigInt(a.stakeRaw);
    const bStake = BigInt(b.stakeRaw);
    return bStake > aStake ? 1 : bStake < aStake ? -1 : 0;
  });

  // Categorize masternodes
  const masternodes: MasternodeInfo[] = [];
  const standbynodes: MasternodeInfo[] = [];
  const penalized: MasternodeInfo[] = [];

  let totalStaked = 0n;

  for (const candidate of candidatesWithData) {
    const addr = candidate.address;
    totalStaked += BigInt(candidate.stakeRaw);

    if (activeAddresses.includes(addr)) {
      masternodes.push({ ...candidate, status: 'active' as const });
    } else if (standbyAddresses.includes(addr)) {
      standbynodes.push({ ...candidate, status: 'standby' as const });
    } else if (penalizedAddresses.includes(addr)) {
      penalized.push({ ...candidate, status: 'penalized' as const });
    } else {
      // Not in any list - treat as standby
      standbynodes.push({ ...candidate, status: 'standby' as const });
    }
  }

  // Add rank
  let rank = 1;
  for (const mn of masternodes) mn.rank = rank++;
  for (const sn of standbynodes) sn.rank = rank++;
  for (const p of penalized) p.rank = rank++;

  // Calculate Nakamoto coefficient
  const nakamotoCoefficient = calculateNakamotoCoefficient(
    [...masternodes, ...standbynodes],
    totalStaked
  );

  return {
    epoch,
    round: 0,
    blockNumber,
    masternodes,
    standbynodes,
    penalized,
    totalStaked: weiToXDC(totalStaked),
    nakamotoCoefficient,
  };
}

/**
 * GET /api/v1/masternodes
 * Returns all masternodes with live stake data from XDCValidator contract
 * Query params: page, limit, search, filter (active/standby/all)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const search = searchParams.get('search')?.toLowerCase() || '';
    const filter = searchParams.get('filter') || 'all'; // active, standby, penalized, all

    // Check cache
    const cacheKey = 'masternode-data';
    const cached = cache.get(cacheKey);
    let data: MasternodeData;

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      data = cached.data;
    } else {
      // Fetch live data from mainnet
      data = await fetchLiveMasternodeData();
      cache.set(cacheKey, { data, timestamp: Date.now() });
    }

    // Apply filter
    let filteredNodes: MasternodeInfo[] = [];
    switch (filter) {
      case 'active':
        filteredNodes = data.masternodes;
        break;
      case 'standby':
        filteredNodes = data.standbynodes;
        break;
      case 'penalized':
        filteredNodes = data.penalized;
        break;
      default:
        filteredNodes = [...data.masternodes, ...data.standbynodes, ...data.penalized];
    }

    // Apply search
    if (search) {
      filteredNodes = filteredNodes.filter(n =>
        n.xdcAddress.toLowerCase().includes(search) ||
        n.address.toLowerCase().includes(search) ||
        n.owner?.toLowerCase().includes(search)
      );
    }

    // Pagination
    const total = filteredNodes.length;
    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedNodes = filteredNodes.slice(start, end);

    return NextResponse.json({
      success: true,
      data: {
        epoch: data.epoch,
        round: data.round,
        blockNumber: data.blockNumber,
        masternodes: filter === 'active' || filter === 'all' ? paginatedNodes.filter(n => n.status === 'active') : data.masternodes,
        standbynodes: filter === 'standby' || filter === 'all' ? paginatedNodes.filter(n => n.status === 'standby') : data.standbynodes,
        penalized: filter === 'penalized' || filter === 'all' ? paginatedNodes.filter(n => n.status === 'penalized') : data.penalized,
        totalStaked: data.totalStaked,
        nakamotoCoefficient: data.nakamotoCoefficient,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    });
  } catch (error: any) {
    console.error('Error fetching masternodes:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch masternode data',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
