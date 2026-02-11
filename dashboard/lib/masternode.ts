// Masternode data fetcher for XDC Validator contract
// Contract: 0x0000000000000000000000000000000000000088

const VALIDATOR_CONTRACT = '0x0000000000000000000000000000000000000088';
const RPC_URL = process.env.XDC_RPC_URL || 'http://127.0.0.1:8989';

// ABI selectors
const SELECTORS = {
  getCandidates: '0x06a49fce',
  getCandidateOwner: '0xb642facd',
  getCandidateCap: '0x58e7525f',
  getVoters: '0x2d15cc04',
  getVoterCap: '0x507ce98e',
  candidateCount: '0xa9a981a3',
  isCandidate: '0xd51b9e93',
};

// Cache for masternode data
interface CacheEntry {
  data: MasternodeData;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface MasternodeData {
  epoch: number;
  round: number;
  blockNumber: number;
  masternodes: MasternodeInfo[];
  standbynodes: MasternodeInfo[];
  penalized: MasternodeInfo[];
  totalStaked: bigint;
  nakamotoCoefficient: number;
}

export interface MasternodeInfo {
  address: string;          // 0x-prefixed
  xdcAddress: string;       // xdc-prefixed
  status: 'active' | 'standby' | 'penalized';
  owner?: string;
  stake?: string;
  voterCount?: number;
  ethstatsName?: string;
}

export interface CandidateDetail extends MasternodeInfo {
  voters: { address: string; xdcAddress: string; stake: string }[];
  blocksProduced?: number;
  blocksMissed?: number;
}

// Helper: convert 0x address to xdc address
export function toXdcAddress(address: string): string {
  if (!address) return '';
  if (address.startsWith('0x')) {
    return 'xdc' + address.slice(2);
  }
  return address;
}

// Helper: format wei to XDC
export function weiToXDC(wei: bigint | string): string {
  const weiValue = typeof wei === 'string' ? BigInt(wei) : wei;
  const xdcValue = Number(weiValue) / 1e18;
  return xdcValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Helper: format XDC with commas
export function formatXDC(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Calculate Nakamoto coefficient
export function calculateNakamotoCoefficient(masternodes: MasternodeInfo[], totalStaked: bigint): number {
  if (!masternodes.length || totalStaked === 0n) return 0;
  
  const sorted = [...masternodes]
    .filter(m => m.stake)
    .sort((a, b) => {
      const aStake = parseFloat(a.stake?.replace(/,/g, '') || '0');
      const bStake = parseFloat(b.stake?.replace(/,/g, '') || '0');
      return bStake - aStake;
    });
  
  const threshold = Number(totalStaked) / 1e18 * 0.33;
  let accumulated = 0;
  let count = 0;
  
  for (const mn of sorted) {
    const stake = parseFloat(mn.stake?.replace(/,/g, '') || '0');
    accumulated += stake;
    count++;
    if (accumulated >= threshold) break;
  }
  
  return count;
}

// Make RPC call
async function rpcCall(method: string, params: any[]): Promise<any> {
  const response = await fetch(RPC_URL, {
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

// Make eth_call to contract
async function ethCall(data: string): Promise<string> {
  return rpcCall('eth_call', [{
    to: VALIDATOR_CONTRACT,
    data,
  }, 'latest']);
}

// Encode address parameter (pad to 32 bytes)
function encodeAddress(address: string): string {
  const cleanAddr = address.toLowerCase().replace(/^0x/, '');
  return '0' .repeat(24) + cleanAddr;
}

// Decode uint256 from hex
function decodeUint256(hex: string): bigint {
  return BigInt(hex);
}

// Decode address array from hex
function decodeAddressArray(hex: string): string[] {
  if (!hex || hex === '0x') return [];
  // Remove 0x prefix
  const clean = hex.replace(/^0x/, '');
  // First 32 bytes = offset (usually 0x20 = 32)
  // Second 32 bytes = array length
  const length = parseInt(clean.slice(64, 128), 16);
  const addresses: string[] = [];
  
  for (let i = 0; i < length; i++) {
    const start = 128 + i * 64;
    const addr = '0x' + clean.slice(start + 24, start + 64);
    addresses.push(addr);
  }
  
  return addresses;
}

// Fetch candidate cap (stake) with retry
async function fetchCandidateCap(address: string): Promise<bigint> {
  const data = SELECTORS.getCandidateCap + encodeAddress(address);
  const result = await ethCall(data);
  return decodeUint256(result);
}

// Fetch candidate owner
async function fetchCandidateOwner(address: string): Promise<string> {
  const data = SELECTORS.getCandidateOwner + encodeAddress(address);
  const result = await ethCall(data);
  // Last 40 hex chars = address
  return '0x' + result.slice(-40);
}

// Fetch voters for a candidate
async function fetchVoters(address: string): Promise<string[]> {
  const data = SELECTORS.getVoters + encodeAddress(address);
  const result = await ethCall(data);
  return decodeAddressArray(result);
}

// Fetch voter cap
async function fetchVoterCap(candidate: string, voter: string): Promise<bigint> {
  const data = SELECTORS.getVoterCap + encodeAddress(candidate) + encodeAddress(voter);
  const result = await ethCall(data);
  return decodeUint256(result);
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

// Get masternode data with caching
export async function fetchMasternodeData(rpcUrl?: string): Promise<MasternodeData> {
  const url = rpcUrl || RPC_URL;
  const cacheKey = 'masternode-data';
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  // Fetch masternodes by number
  const masternodesResult = await rpcCall('XDPoS_getMasternodesByNumber', ['latest']);
  
  const epoch = Math.floor(parseInt(masternodesResult.Number) / 900);
  const round = parseInt(masternodesResult.Round);
  const blockNumber = parseInt(masternodesResult.Number);
  
  const activeAddresses: string[] = masternodesResult.Masternodes || [];
  const standbyAddresses: string[] = masternodesResult.Standbynodes || [];
  const penalizedAddresses: string[] = masternodesResult.Penalty || [];
  
  // Create base info objects
  const createInfo = (addr: string, status: 'active' | 'standby' | 'penalized'): MasternodeInfo => ({
    address: addr.toLowerCase(),
    xdcAddress: toXdcAddress(addr.toLowerCase()),
    status,
  });
  
  const masternodes = activeAddresses.map(a => createInfo(a, 'active'));
  const standbynodes = standbyAddresses.map(a => createInfo(a, 'standby'));
  const penalized = penalizedAddresses.map(a => createInfo(a, 'penalized'));
  
  // Fetch stake and owner for all candidates (batch processing)
  const allCandidates = [...masternodes, ...standbynodes, ...penalized];
  
  const stakeData = await batchProcess(
    allCandidates,
    async (candidate) => {
      try {
        const [stakeWei, owner] = await Promise.all([
          fetchCandidateCap(candidate.address),
          fetchCandidateOwner(candidate.address).catch(() => undefined),
        ]);
        return {
          address: candidate.address,
          stake: weiToXDC(stakeWei),
          owner: owner?.toLowerCase() !== '0x0000000000000000000000000000000000000000' 
            ? owner 
            : undefined,
        };
      } catch (err) {
        console.error(`Failed to fetch data for ${candidate.address}:`, err);
        return { address: candidate.address, stake: '0', owner: undefined };
      }
    },
    10
  );
  
  // Merge stake data
  const stakeMap = new Map(stakeData.map(s => [s.address, s]));
  
  let totalStaked = 0n;
  
  for (const node of allCandidates) {
    const data = stakeMap.get(node.address);
    if (data) {
      node.stake = data.stake;
      node.owner = data.owner;
      const stakeValue = BigInt(Math.round(parseFloat(data.stake.replace(/,/g, '')) * 1e18));
      totalStaked += stakeValue;
    }
  }
  
  // Calculate Nakamoto coefficient
  const nakamotoCoefficient = calculateNakamotoCoefficient(
    [...masternodes, ...standbynodes],
    totalStaked
  );
  
  const result: MasternodeData = {
    epoch,
    round,
    blockNumber,
    masternodes,
    standbynodes,
    penalized,
    totalStaked,
    nakamotoCoefficient,
  };
  
  // Update cache
  cache.set(cacheKey, { data: result, timestamp: Date.now() });
  
  return result;
}

// Fetch detailed info for a single candidate
export async function fetchCandidateDetail(rpcUrl: string | undefined, address: string): Promise<CandidateDetail | null> {
  const url = rpcUrl || RPC_URL;
  const cleanAddress = address.toLowerCase().replace(/^xdc/, '0x');
  
  try {
    // Get current masternode data to find status
    const masternodeData = await fetchMasternodeData(url);
    
    const allNodes = [
      ...masternodeData.masternodes,
      ...masternodeData.standbynodes,
      ...masternodeData.penalized,
    ];
    
    const baseInfo = allNodes.find(n => n.address.toLowerCase() === cleanAddress);
    
    if (!baseInfo) {
      // Address not found in current masternodes
      return null;
    }
    
    // Fetch voters
    const voterAddresses = await fetchVoters(cleanAddress);
    
    // Fetch voter stakes
    const voters = await batchProcess(
      voterAddresses,
      async (voterAddr) => {
        try {
          const stakeWei = await fetchVoterCap(cleanAddress, voterAddr);
          return {
            address: voterAddr.toLowerCase(),
            xdcAddress: toXdcAddress(voterAddr.toLowerCase()),
            stake: weiToXDC(stakeWei),
          };
        } catch (err) {
          return {
            address: voterAddr.toLowerCase(),
            xdcAddress: toXdcAddress(voterAddr.toLowerCase()),
            stake: '0',
          };
        }
      },
      10
    );
    
    // Sort by stake desc
    voters.sort((a, b) => {
      const aStake = parseFloat(a.stake.replace(/,/g, ''));
      const bStake = parseFloat(b.stake.replace(/,/g, ''));
      return bStake - aStake;
    });
    
    return {
      ...baseInfo,
      voters,
    };
  } catch (err) {
    console.error(`Failed to fetch candidate detail for ${address}:`, err);
    return null;
  }
}

// Clear cache
export function clearMasternodeCache(): void {
  cache.clear();
}
