/**
 * XDPoS 2.0 Consensus Health Scoring System
 * 
 * Calculates comprehensive health scores for XDPoS 2.0 consensus
 * based on epoch participation, vote propagation, and masternode stability.
 * 
 * @module lib/consensus-scoring
 * @see https://github.com/AnilChinchawale/XDCNetOwn/issues/600
 */

import { query } from './db';

// Consensus health score components
export interface ConsensusHealthScore {
  overall: number;           // 0-100
  epochParticipation: number; // 0-100
  votePropagation: number;    // 0-100
  masternodeStability: number; // 0-100
  timestamp: Date;
  networkId: string;
  details: ConsensusHealthDetails;
}

export interface ConsensusHealthDetails {
  currentEpoch: number;
  currentRound: number;
  activeMasternodes: number;
  expectedMasternodes: number;
  lastGapBlock: number;
  missedRoundsInEpoch: number;
  avgVoteLatencyMs: number;
  timeoutRate: number;
  participationRate: number;
  blockProductionRate: number;
}

export interface MasternodeScore {
  address: string;
  epoch: number;
  totalScore: number;
  tier: 'gold' | 'silver' | 'bronze' | 'needs-improvement';
  uptime: number;
  blockProduction: number;
  voteLatency: number;
  qcParticipation: number;
  peerConnectivity: number;
  ranking?: {
    global: number;
    totalMasternodes: number;
    percentile: number;
  };
}

// Scoring weights
const WEIGHTS = {
  epochParticipation: 0.40,
  votePropagation: 0.35,
  masternodeStability: 0.25,
};

// Tier thresholds
const TIER_THRESHOLDS = {
  gold: 90,
  silver: 75,
  bronze: 60,
};

/**
 * Calculate overall consensus health score
 */
export async function calculateConsensusHealth(
  networkId: string = 'mainnet'
): Promise<ConsensusHealthScore> {
  const now = new Date();
  
  // Get current epoch and round info
  const epochInfo = await getCurrentEpochInfo(networkId);
  
  // Calculate component scores
  const epochScore = await calculateEpochParticipationScore(epochInfo);
  const voteScore = await calculateVotePropagationScore(epochInfo);
  const stabilityScore = await calculateMasternodeStabilityScore(epochInfo);
  
  // Weighted overall score
  const overall = Math.round(
    epochScore * WEIGHTS.epochParticipation +
    voteScore * WEIGHTS.votePropagation +
    stabilityScore * WEIGHTS.masternodeStability
  );
  
  return {
    overall,
    epochParticipation: epochScore,
    votePropagation: voteScore,
    masternodeStability: stabilityScore,
    timestamp: now,
    networkId,
    details: epochInfo,
  };
}

/**
 * Calculate epoch participation score
 */
async function calculateEpochParticipationScore(
  info: ConsensusHealthDetails
): Promise<number> {
  let score = 100;
  
  // Penalize for missed rounds
  score -= info.missedRoundsInEpoch * 5;
  
  // Penalize for low masternode participation
  const participationRate = info.activeMasternodes / info.expectedMasternodes;
  if (participationRate < 0.9) {
    score -= (0.9 - participationRate) * 100;
  }
  
  // Penalize for low participation rate
  if (info.participationRate < 0.95) {
    score -= (0.95 - info.participationRate) * 200;
  }
  
  // Penalize for timeout rate
  score -= info.timeoutRate * 50;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate vote propagation score
 */
async function calculateVotePropagationScore(
  info: ConsensusHealthDetails
): Promise<number> {
  let score = 100;
  
  // Penalize for high vote latency
  if (info.avgVoteLatencyMs > 500) {
    score -= (info.avgVoteLatencyMs - 500) / 10;
  }
  
  // Penalize for excessive timeouts
  if (info.timeoutRate > 0.1) {
    score -= (info.timeoutRate - 0.1) * 200;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate masternode stability score
 */
async function calculateMasternodeStabilityScore(
  info: ConsensusHealthDetails
): Promise<number> {
  // Query recent masternode set changes
  const result = await query(
    `SELECT COUNT(DISTINCT epoch) as epoch_changes
     FROM skynet.masternode_history
     WHERE network_id = $1
     AND recorded_at > NOW() - INTERVAL '24 hours'`,
    [info.networkId]
  );
  
  const epochChanges = result.rows[0]?.epoch_changes || 0;
  
  // Score based on stability
  let score = 100;
  if (epochChanges > 10) {
    score -= (epochChanges - 10) * 2;
  }
  
  // Penalize for low block production rate
  if (info.blockProductionRate < 0.9) {
    score -= (0.9 - info.blockProductionRate) * 100;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Get current epoch information
 */
async function getCurrentEpochInfo(networkId: string): Promise<ConsensusHealthDetails> {
  // Query from consensus metrics
  const result = await query(
    `SELECT 
      (metrics->>'epoch')::int as epoch,
      (metrics->>'round')::int as round,
      (metrics->>'activeMasternodes')::int as active_masternodes,
      (metrics->>'missedRounds')::int as missed_rounds,
      (metrics->>'avgVoteLatency')::float as avg_vote_latency,
      (metrics->>'timeoutRate')::float as timeout_rate,
      (metrics->>'participationRate')::float as participation_rate,
      (metrics->>'blockProductionRate')::float as block_production_rate
     FROM skynet.consensus_metrics
     WHERE network_id = $1
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [networkId]
  );
  
  const row = result.rows[0];
  
  return {
    currentEpoch: row?.epoch || 0,
    currentRound: row?.round || 0,
    activeMasternodes: row?.active_masternodes || 0,
    expectedMasternodes: 108, // XDC mainnet expected masternodes
    lastGapBlock: calculateLastGapBlock(row?.epoch || 0),
    missedRoundsInEpoch: row?.missed_rounds || 0,
    avgVoteLatencyMs: row?.avg_vote_latency || 0,
    timeoutRate: row?.timeout_rate || 0,
    participationRate: row?.participation_rate || 0,
    blockProductionRate: row?.block_production_rate || 0,
    networkId,
  };
}

/**
 * Calculate last gap block for current epoch
 */
function calculateLastGapBlock(epoch: number): number {
  const EPOCH_LENGTH = 900;
  const GAP_END = 454;
  return (epoch * EPOCH_LENGTH) + GAP_END;
}

/**
 * Store consensus health score
 */
export async function storeConsensusHealthScore(
  score: ConsensusHealthScore,
  networkId: string
): Promise<void> {
  await query(
    `INSERT INTO skynet.consensus_health_scores 
     (network_id, overall_score, epoch_participation_score, 
      vote_propagation_score, masternode_stability_score, 
      details, recorded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (network_id, recorded_at) DO UPDATE SET
       overall_score = EXCLUDED.overall_score,
       epoch_participation_score = EXCLUDED.epoch_participation_score,
       vote_propagation_score = EXCLUDED.vote_propagation_score,
       masternode_stability_score = EXCLUDED.masternode_stability_score,
       details = EXCLUDED.details`,
    [
      networkId,
      score.overall,
      score.epochParticipation,
      score.votePropagation,
      score.masternodeStability,
      JSON.stringify(score.details),
      score.timestamp,
    ]
  );
}

/**
 * Get consensus health trend
 */
export async function getConsensusHealthTrend(
  networkId: string,
  hours: number = 24
): Promise<Array<{ timestamp: Date; score: number }>> {
  const result = await query(
    `SELECT recorded_at as timestamp, overall_score as score
     FROM skynet.consensus_health_scores
     WHERE network_id = $1
     AND recorded_at > NOW() - INTERVAL '${hours} hours'
     ORDER BY recorded_at ASC`,
    [networkId]
  );
  
  return result.rows;
}

/**
 * Calculate individual masternode score
 */
export async function calculateMasternodeScore(
  address: string,
  epoch: number,
  networkId: string = 'mainnet'
): Promise<MasternodeScore> {
  // Fetch masternode metrics
  const metrics = await getMasternodeMetrics(address, epoch, networkId);
  
  // Calculate individual component scores
  const uptimeScore = metrics.uptimePercentage;
  const blockProductionScore = (metrics.blocksSigned / metrics.blockOpportunities) * 100;
  const voteLatencyScore = Math.max(0, 100 - (metrics.avgVoteLatencyMs / 200) * 100);
  const qcParticipationScore = metrics.qcParticipationRate * 100;
  const peerConnectivityScore = Math.min(100, (metrics.avgPeerCount / 10) * 100);
  
  // Weighted total score
  const totalScore = Math.round(
    uptimeScore * 0.30 +
    blockProductionScore * 0.25 +
    voteLatencyScore * 0.20 +
    qcParticipationScore * 0.15 +
    peerConnectivityScore * 0.10
  );
  
  // Determine tier
  const tier = determineTier(totalScore);
  
  return {
    address,
    epoch,
    totalScore,
    tier,
    uptime: Math.round(uptimeScore * 10) / 10,
    blockProduction: Math.round(blockProductionScore * 10) / 10,
    voteLatency: Math.round(voteLatencyScore * 10) / 10,
    qcParticipation: Math.round(qcParticipationScore * 10) / 10,
    peerConnectivity: Math.round(peerConnectivityScore * 10) / 10,
  };
}

/**
 * Determine tier based on score
 */
function determineTier(score: number): 'gold' | 'silver' | 'bronze' | 'needs-improvement' {
  if (score >= TIER_THRESHOLDS.gold) return 'gold';
  if (score >= TIER_THRESHOLDS.silver) return 'silver';
  if (score >= TIER_THRESHOLDS.bronze) return 'bronze';
  return 'needs-improvement';
}

/**
 * Get masternode metrics
 */
async function getMasternodeMetrics(
  address: string,
  epoch: number,
  networkId: string
): Promise<any> {
  const result = await query(
    `SELECT 
      uptime_percentage,
      blocks_signed,
      block_opportunities,
      avg_vote_latency_ms,
      qc_participation_rate,
      avg_peer_count
     FROM skynet.masternode_metrics
     WHERE address = $1
     AND epoch = $2
     AND network_id = $3
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [address, epoch, networkId]
  );
  
  return result.rows[0] || {
    uptimePercentage: 100,
    blocksSigned: 0,
    blockOpportunities: 1,
    avgVoteLatencyMs: 0,
    qcParticipationRate: 1,
    avgPeerCount: 10,
  };
}

/**
 * Get leaderboard of masternode scores
 */
export async function getMasternodeLeaderboard(
  epoch: number,
  limit: number = 100,
  networkId: string = 'mainnet'
): Promise<MasternodeScore[]> {
  const result = await query(
    `SELECT 
      address,
      total_score,
      tier,
      uptime,
      block_production,
      vote_latency,
      qc_participation,
      peer_connectivity,
      RANK() OVER (ORDER BY total_score DESC) as global_rank,
      COUNT(*) OVER () as total_masternodes
     FROM skynet.masternode_scores
     WHERE epoch = $1
     AND network_id = $2
     ORDER BY total_score DESC
     LIMIT $3`,
    [epoch, networkId, limit]
  );
  
  return result.rows.map((row: any) => ({
    address: row.address,
    epoch,
    totalScore: row.total_score,
    tier: row.tier,
    uptime: row.uptime,
    blockProduction: row.block_production,
    voteLatency: row.vote_latency,
    qcParticipation: row.qc_participation,
    peerConnectivity: row.peer_connectivity,
    ranking: {
      global: row.global_rank,
      totalMasternodes: row.total_masternodes,
      percentile: Math.round((1 - (row.global_rank - 1) / row.total_masternodes) * 1000) / 10,
    },
  }));
}

/**
 * Initialize consensus scoring service
 */
export function initializeConsensusScoring(): void {
  console.log('[ConsensusScoring] Initializing consensus health scoring service...');
  
  // Run scoring every 5 minutes
  setInterval(async () => {
    try {
      const score = await calculateConsensusHealth('mainnet');
      await storeConsensusHealthScore(score, 'mainnet');
      console.log(`[ConsensusScoring] Health score: ${score.overall}/100`);
    } catch (error) {
      console.error('[ConsensusScoring] Error calculating health score:', error);
    }
  }, 5 * 60 * 1000);
  
  // Run initial scoring
  calculateConsensusHealth('mainnet')
    .then(score => storeConsensusHealthScore(score, 'mainnet'))
    .catch(console.error);
}

export default {
  calculateConsensusHealth,
  storeConsensusHealthScore,
  getConsensusHealthTrend,
  calculateMasternodeScore,
  getMasternodeLeaderboard,
  initializeConsensusScoring,
};
