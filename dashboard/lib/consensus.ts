// XDPoS 2.0 Consensus Monitoring Library for SkyNet
// Provides QC validation, vote tracking, and epoch monitoring

const RPC_URL = process.env.XDC_RPC_URL || 'http://127.0.0.1:8989';

// XDPoS 2.0 Constants
const EPOCH_LENGTH = 900;
const MIN_QUORUM = 73; // 2/3 of 108 masternodes
const QC_TIMEOUT_MS = 5000;
const MAX_VOTE_LATENCY_MS = 2000;

// Interfaces
export interface QCData {
  blockNumber: number;
  signatures: string[];
  proposalTime: number;
  round: number;
}

export interface VoteData {
  masternode: string;
  blockNumber: number;
  timestamp: number;
  signature: string;
}

export interface ConsensusHealth {
  timestamp: number;
  blockNumber: number;
  epoch: number;
  masternodeCount: number;
  voteCount: number;
  qcData: QCData | null;
  isEpochBoundary: boolean;
  healthScore: number;
}

export interface MasternodeSet {
  epoch: number;
  masternodes: string[];
  standbynodes: string[];
  penalized: string[];
}

// RPC Helper
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

// Get current block number
export async function getBlockNumber(): Promise<number> {
  const result = await rpcCall('eth_blockNumber', []);
  return parseInt(result, 16);
}

// Get block by number
export async function getBlockByNumber(
  blockNum: number,
  fullTx = false
): Promise<any> {
  return rpcCall('eth_getBlockByNumber', [
    `0x${blockNum.toString(16)}`,
    fullTx,
  ]);
}

// Check if block is at epoch boundary
export function isEpochBoundary(blockNum: number): boolean {
  return blockNum % EPOCH_LENGTH === 0;
}

// Get current epoch
export async function getCurrentEpoch(): Promise<number> {
  const blockNum = await getBlockNumber();
  return Math.floor(blockNum / EPOCH_LENGTH);
}

// Get epoch start block
export function getEpochStartBlock(epoch: number): number {
  return epoch * EPOCH_LENGTH;
}

// Get QC data for a block
export async function getQCData(blockNum: number): Promise<QCData | null> {
  try {
    const result = await rpcCall('XDPoS_getQC', [`0x${blockNum.toString(16)}`]);
    if (!result) return null;

    return {
      blockNumber: blockNum,
      signatures: result.signatures || [],
      proposalTime: result.proposalTime || 0,
      round: result.round || 0,
    };
  } catch (error) {
    console.error(`Failed to get QC for block ${blockNum}:`, error);
    return null;
  }
}

// Validate QC at checkpoint block
export async function validateQC(blockNum: number): Promise<{
  valid: boolean;
  signatureCount: number;
  error?: string;
}> {
  // Only validate at epoch boundaries
  if (!isEpochBoundary(blockNum)) {
    return { valid: true, signatureCount: 0 };
  }

  const qcData = await getQCData(blockNum);

  if (!qcData) {
    return {
      valid: false,
      signatureCount: 0,
      error: `No QC data found for checkpoint block ${blockNum}`,
    };
  }

  const sigCount = qcData.signatures.length;

  if (sigCount < MIN_QUORUM) {
    return {
      valid: false,
      signatureCount: sigCount,
      error: `QC validation failed: ${sigCount} signatures (min: ${MIN_QUORUM})`,
    };
  }

  return { valid: true, signatureCount: sigCount };
}

// Get QC formation time
export async function getQCFormationTime(blockNum: number): Promise<number> {
  const qcData = await getQCData(blockNum);
  return qcData?.proposalTime || 0;
}

// Get votes for a block
export async function getVotes(blockNum: number): Promise<VoteData[]> {
  try {
    const result = await rpcCall('XDPoS_getVotesByNumber', [
      `0x${blockNum.toString(16)}`,
    ]);
    if (!result) return [];

    return result.map((v: any) => ({
      masternode: v.masternode,
      blockNumber: blockNum,
      timestamp: v.timestamp,
      signature: v.signature,
    }));
  } catch (error) {
    console.error(`Failed to get votes for block ${blockNum}:`, error);
    return [];
  }
}

// Count votes for a block
export async function countVotes(blockNum: number): Promise<number> {
  const votes = await getVotes(blockNum);
  return votes.length;
}

// Get vote latency for a specific masternode
export async function getVoteLatency(
  blockNum: number,
  masternode: string
): Promise<number> {
  const votes = await getVotes(blockNum);
  const vote = votes.find((v) => v.masternode.toLowerCase() === masternode.toLowerCase());

  if (!vote) return -1; // No vote found

  const block = await getBlockByNumber(blockNum);
  const blockTime = parseInt(block.timestamp, 16) * 1000;
  return vote.timestamp - blockTime;
}

// Get current masternode list
export async function getMasternodes(): Promise<MasternodeSet> {
  const result = await rpcCall('XDPoS_getMasternodesByNumber', ['latest']);
  const blockNum = parseInt(result.Number);
  const epoch = Math.floor(blockNum / EPOCH_LENGTH);

  return {
    epoch,
    masternodes: result.Masternodes || [],
    standbynodes: result.Standbynodes || [],
    penalized: result.Penalty || [],
  };
}

// Get masternode count
export async function getMasternodeCount(): Promise<number> {
  const mnSet = await getMasternodes();
  return mnSet.masternodes.length;
}

// Check if address is a masternode
export async function isMasternode(address: string): Promise<boolean> {
  const mnSet = await getMasternodes();
  return mnSet.masternodes.some(
    (mn) => mn.toLowerCase() === address.toLowerCase()
  );
}

// Check if block is a gap block
export async function isGapBlock(blockNum: number): Promise<boolean> {
  // Gap blocks only occur at epoch boundaries
  if (!isEpochBoundary(blockNum + 1)) {
    return false;
  }

  try {
    const block = await getBlockByNumber(blockNum);
    const txCount = block.transactions?.length || 0;
    return txCount === 0;
  } catch (error) {
    return false;
  }
}

// Detect gap blocks in range
export async function detectGapBlocks(
  startBlock: number,
  endBlock: number
): Promise<number[]> {
  const gapBlocks: number[] = [];

  for (let b = startBlock; b <= endBlock; b++) {
    if (isEpochBoundary(b + 1) && (await isGapBlock(b))) {
      gapBlocks.push(b);
    }
  }

  return gapBlocks;
}

// Calculate consensus health score
export function calculateHealthScore(health: Partial<ConsensusHealth>): number {
  let score = 100;

  // Deduct for insufficient masternodes
  if (health.masternodeCount && health.masternodeCount < MIN_QUORUM) {
    score -= 50;
  }

  // Deduct for missing QC at epoch boundary
  if (health.isEpochBoundary && !health.qcData) {
    score -= 30;
  }

  // Deduct for insufficient votes
  if (health.voteCount && health.voteCount < MIN_QUORUM) {
    score -= 20;
  }

  return Math.max(0, score);
}

// Get comprehensive consensus health
export async function getConsensusHealth(): Promise<ConsensusHealth> {
  const blockNum = await getBlockNumber();
  const epoch = Math.floor(blockNum / EPOCH_LENGTH);
  const mnCount = await getMasternodeCount();
  const qcData = await getQCData(blockNum);
  const voteCount = await countVotes(blockNum);
  const isEpochB = isEpochBoundary(blockNum);

  const health: ConsensusHealth = {
    timestamp: Date.now(),
    blockNumber: blockNum,
    epoch,
    masternodeCount: mnCount,
    voteCount,
    qcData,
    isEpochBoundary: isEpochB,
    healthScore: 100,
  };

  health.healthScore = calculateHealthScore(health);

  return health;
}

// Check consensus health and return status
export async function checkConsensusHealth(): Promise<{
  healthy: boolean;
  score: number;
  issues: string[];
}> {
  const health = await getConsensusHealth();
  const issues: string[] = [];

  // Check masternode count
  if (health.masternodeCount < MIN_QUORUM) {
    issues.push(
      `Insufficient masternodes: ${health.masternodeCount} (min: ${MIN_QUORUM})`
    );
  }

  // Validate QC at epoch boundaries
  if (health.isEpochBoundary) {
    const qcValidation = await validateQC(health.blockNumber);
    if (!qcValidation.valid) {
      issues.push(qcValidation.error || 'QC validation failed');
    }
  }

  return {
    healthy: issues.length === 0,
    score: health.healthScore,
    issues,
  };
}

// Get epoch transition data
export async function getEpochTransition(
  epoch: number
): Promise<{
  epoch: number;
  startBlock: number;
  endBlock: number;
  masternodeSet: MasternodeSet;
  qcValid: boolean;
}> {
  const startBlock = getEpochStartBlock(epoch);
  const endBlock = startBlock + EPOCH_LENGTH - 1;
  const mnSet = await getMasternodes();
  const qcValidation = await validateQC(startBlock);

  return {
    epoch,
    startBlock,
    endBlock,
    masternodeSet: mnSet,
    qcValid: qcValidation.valid,
  };
}

// Monitor QC formation time and alert if too slow
export async function monitorQCFormation(
  blockNum: number,
  thresholdMs = QC_TIMEOUT_MS
): Promise<{
  formed: boolean;
  formationTime: number;
  alert: boolean;
}> {
  const startTime = Date.now();
  let qcData: QCData | null = null;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    qcData = await getQCData(blockNum);
    if (qcData && qcData.signatures.length >= MIN_QUORUM) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    attempts++;
  }

  const formationTime = Date.now() - startTime;

  return {
    formed: !!qcData && qcData.signatures.length >= MIN_QUORUM,
    formationTime,
    alert: formationTime > thresholdMs,
  };
}
