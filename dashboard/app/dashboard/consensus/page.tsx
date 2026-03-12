'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Blocks,
  Users,
  ShieldCheck,
  AlertTriangle,
  Activity,
  Clock,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  CheckCircle,
  XCircle,
  Gauge,
  Target,
  Timer,
  Award
} from 'lucide-react';

interface EpochStatus {
  currentEpoch: number;
  currentBlock: number;
  blocksInEpoch: number;
  blocksRemaining: number;
  epochProgressPercent: number;
  epochStartBlock: number;
  epochEndBlock: number;
  estimatedTimeToNextEpoch: number;
  averageBlockTime: number;
  nextEpochStartTime: string;
}

interface Validator {
  address: string;
  xdcAddress: string;
  status: 'active' | 'standby' | 'penalized';
  rank?: number;
  stake?: string;
  uptimePercent?: number;
  blocksProduced: number;
  blocksExpected: number;
  blockProductionRate: number;
  votesParticipated: number;
  votesExpected: number;
  voteParticipationPercent: number;
  qcContributions: number;
  qcContributionPercent: number;
  missedBlocks: number;
  gapBlocks: number;
  overallScore: number;
  lastSeen: string;
}

interface QCStats {
  latestBlock: number;
  latestQCValid: boolean;
  signatureCount: number;
  thresholdRequired: number;
  thresholdPercent: number;
  timeToQC: number;
  averageTimeToQC: number;
  qcRate: number;
  recentQCs: {
    blockNumber: number;
    valid: boolean;
    signatures: number;
    timeToQC: number;
  }[];
}

interface GapBlock {
  blockNumber: number;
  epochNumber: number;
  roundNumber: number | null;
  expectedProducer: string;
  expectedProducerXdc: string;
  actualProducer: string | null;
  actualProducerXdc: string | null;
  gapType: 'missed_turn' | 'late_block' | 'forked';
  timeToNextBlock: number | null;
  detectedAt: string;
}

interface HealthScore {
  overallScore: number;
  status: 'green' | 'yellow' | 'red';
  components: {
    participation: {
      score: number;
      weight: number;
      weightedScore: number;
      details: {
        activeValidators: number;
        totalValidators: number;
        participationPercent: number;
      };
    };
    qcValidity: {
      score: number;
      weight: number;
      weightedScore: number;
      details: {
        validQCs: number;
        totalQCs: number;
        validityPercent: number;
        avgTimeToQC: number;
      };
    };
    gapRate: {
      score: number;
      weight: number;
      weightedScore: number;
      details: {
        gapBlocks: number;
        totalBlocks: number;
        gapRatePercent: number;
      };
    };
  };
  epoch: number;
  trend: {
    direction: 'improving' | 'stable' | 'declining';
    change: number;
  };
}

interface GapBlockStats {
  totalGapBlocks: number;
  recentGapBlocks: GapBlock[];
  gapRate: number;
  topOffenders: {
    address: string;
    xdcAddress: string;
    missedCount: number;
  }[];
}

export default function ConsensusDashboard() {
  const [epochStatus, setEpochStatus] = useState<EpochStatus | null>(null);
  const [validators, setValidators] = useState<Validator[]>([]);
  const [validatorSummary, setValidatorSummary] = useState<any>(null);
  const [qcStats, setQcStats] = useState<QCStats | null>(null);
  const [gapStats, setGapStats] = useState<GapBlockStats | null>(null);
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'overview' | 'validators' | 'gaps'>('overview');

  const fetchData = async () => {
    try {
      setLoading(true);
      const [epochRes, validatorsRes, qcRes, gapsRes, healthRes] = await Promise.all([
        fetch('/api/v1/consensus/epoch-status'),
        fetch('/api/v1/consensus/validators'),
        fetch('/api/v1/consensus/qc-stats'),
        fetch('/api/v1/consensus/gap-blocks'),
        fetch('/api/v1/consensus/health-score')
      ]);

      if (!epochRes.ok || !validatorsRes.ok || !qcRes.ok || !gapsRes.ok || !healthRes.ok) {
        throw new Error('Failed to fetch consensus data');
      }

      const [epochData, validatorsData, qcData, gapsData, healthData] = await Promise.all([
        epochRes.json(),
        validatorsRes.json(),
        qcRes.json(),
        gapsRes.json(),
        healthRes.json()
      ]);

      if (epochData.success) setEpochStatus(epochData.data);
      if (validatorsData.success) {
        setValidators(validatorsData.data.validators);
        setValidatorSummary(validatorsData.data.summary);
      }
      if (qcData.success) setQcStats(qcData.data);
      if (gapsData.success) setGapStats(gapsData.data);
      if (healthData.success) setHealthScore(healthData.data);

      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const formatNumber = (num: number | null | undefined) => {
    if (num === null || num === undefined) return '-';
    return num.toLocaleString();
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-500/10 border-green-500/30';
    if (score >= 50) return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-red-500/10 border-red-500/30';
  };

  const activeValidators = validators.filter(v => v.status === 'active');
  const highPerformers = validators.filter(v => v.overallScore >= 80);
  const lowPerformers = validators.filter(v => v.overallScore < 50 && v.overallScore > 0);

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[var(--accent-blue)]" />
            XDPoS 2.0 Consensus
          </h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Real-time consensus monitoring and validator performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[var(--text-muted)]">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent-blue)] text-white rounded-lg hover:bg-[var(--accent-blue)]/90 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500">
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex items-center gap-2 mb-6 border-b border-[var(--border-subtle)]">
        {(['overview', 'validators', 'gaps'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-[var(--accent-blue)] border-[var(--accent-blue)]'
                : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)]'
            }`}
          >
            {tab === 'overview' && 'Overview'}
            {tab === 'validators' && `Validators (${validatorSummary?.total || 0})`}
            {tab === 'gaps' && `Gap Blocks (${gapStats?.totalGapBlocks || 0})`}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Health Score Card */}
          {healthScore && (
            <div className={`card-xdc ${getScoreBg(healthScore.overallScore)}`}>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${getScoreBg(healthScore.overallScore)}`}>
                    <Gauge className={`w-8 h-8 ${getScoreColor(healthScore.overallScore)}`} />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--text-secondary)]">Consensus Health Score</p>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-4xl font-bold ${getScoreColor(healthScore.overallScore)}`}>
                        {healthScore.overallScore}
                      </span>
                      <span className="text-sm text-[var(--text-muted)]">/ 100</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-[var(--text-secondary)]">Trend</p>
                    <div className={`flex items-center gap-1 ${
                      healthScore.trend.direction === 'improving' ? 'text-green-500' :
                      healthScore.trend.direction === 'declining' ? 'text-red-500' :
                      'text-[var(--text-muted)]'
                    }`}>
                      {healthScore.trend.direction === 'improving' && <TrendingUp className="w-4 h-4" />}
                      {healthScore.trend.direction === 'declining' && <TrendingDown className="w-4 h-4" />}
                      {healthScore.trend.direction === 'stable' && <Activity className="w-4 h-4" />}
                      <span className="font-medium">
                        {healthScore.trend.change > 0 ? '+' : ''}{healthScore.trend.change}
                      </span>
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${getScoreBg(healthScore.overallScore)} ${getScoreColor(healthScore.overallScore)}`}>
                    {healthScore.status.toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Score Components */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-[var(--border-subtle)]">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[var(--text-secondary)]">Participation</span>
                    <span className="text-sm font-medium">{healthScore.components.participation.weight * 100}% weight</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[var(--accent-blue)] rounded-full"
                      style={{ width: `${healthScore.components.participation.score}%` }}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {healthScore.components.participation.details.activeValidators} / {healthScore.components.participation.details.totalValidators} validators active
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[var(--text-secondary)]">QC Validity</span>
                    <span className="text-sm font-medium">{healthScore.components.qcValidity.weight * 100}% weight</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[var(--success)] rounded-full"
                      style={{ width: `${healthScore.components.qcValidity.score}%` }}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {healthScore.components.qcValidity.details.validQCs} / {healthScore.components.qcValidity.details.totalQCs} valid QCs
                  </p>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-[var(--text-secondary)]">Gap Rate</span>
                    <span className="text-sm font-medium">{healthScore.components.gapRate.weight * 100}% weight</span>
                  </div>
                  <div className="w-full h-2 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[var(--warning)] rounded-full"
                      style={{ width: `${healthScore.components.gapRate.score}%` }}
                    />
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-1">
                    {healthScore.components.gapRate.details.gapRatePercent.toFixed(2)}% gap rate
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Epoch Status */}
            <div className="card-xdc">
              <div className="flex items-center gap-2 mb-3">
                <Blocks className="w-5 h-5 text-[var(--accent-blue)]" />
                <span className="text-sm font-medium text-[var(--text-secondary)]">Epoch Status</span>
              </div>
              {epochStatus ? (
                <>
                  <p className="text-3xl font-bold text-[var(--text-primary)]">
                    #{formatNumber(epochStatus.currentEpoch)}
                  </p>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[var(--text-muted)]">Progress</span>
                      <span className="text-[var(--text-secondary)]">{epochStatus.epochProgressPercent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full h-2 bg-[var(--bg-hover)] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[var(--accent-blue)] rounded-full transition-all"
                        style={{ width: `${epochStatus.epochProgressPercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-2">
                      {epochStatus.blocksInEpoch} / 900 blocks • {epochStatus.blocksRemaining} remaining
                    </p>
                  </div>
                </>
              ) : (
                <div className="skeleton h-16 rounded" />
              )}
            </div>

            {/* Block Height */}
            <div className="card-xdc">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-[var(--purple)]" />
                <span className="text-sm font-medium text-[var(--text-secondary)]">Current Block</span>
              </div>
              {epochStatus ? (
                <>
                  <p className="text-3xl font-bold text-[var(--text-primary)]">
                    {formatNumber(epochStatus.currentBlock)}
                  </p>
                  <p className="text-sm text-[var(--text-muted)] mt-2">
                    Next epoch: #{formatNumber(epochStatus.epochEndBlock + 1)}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    ~{formatTime(epochStatus.estimatedTimeToNextEpoch)} remaining
                  </p>
                </>
              ) : (
                <div className="skeleton h-16 rounded" />
              )}
            </div>

            {/* QC Status */}
            <div className="card-xdc">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-5 h-5 text-[var(--success)]" />
                <span className="text-sm font-medium text-[var(--text-secondary)]">Latest QC</span>
              </div>
              {qcStats ? (
                <>
                  <div className="flex items-center gap-2">
                    {qcStats.latestQCValid ? (
                      <CheckCircle className="w-6 h-6 text-green-500" />
                    ) : (
                      <XCircle className="w-6 h-6 text-red-500" />
                    )}
                    <span className="text-2xl font-bold text-[var(--text-primary)]">
                      {qcStats.signatureCount} / {qcStats.thresholdRequired}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--text-muted)] mt-2">
                    Signatures ({qcStats.thresholdPercent}% threshold)
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    Time to QC: {qcStats.timeToQC}ms (avg: {qcStats.averageTimeToQC}ms)
                  </p>
                </>
              ) : (
                <div className="skeleton h-16 rounded" />
              )}
            </div>

            {/* Active Validators */}
            <div className="card-xdc">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-[var(--warning)]" />
                <span className="text-sm font-medium text-[var(--text-secondary)]">Validators</span>
              </div>
              {validatorSummary ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-[var(--text-primary)]">
                      {validatorSummary.active}
                    </span>
                    <span className="text-sm text-[var(--text-muted)]">/ {validatorSummary.total}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-green-500">{validatorSummary.highPerformers} high</span>
                    {validatorSummary.lowPerformers > 0 && (
                      <span className="text-xs text-red-500">{validatorSummary.lowPerformers} low</span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">
                    Avg score: {validatorSummary.averageScore}
                  </p>
                </>
              ) : (
                <div className="skeleton h-16 rounded" />
              )}
            </div>
          </div>

          {/* Recent QC History */}
          {qcStats && qcStats.recentQCs.length > 0 && (
            <div className="card-xdc">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Timer className="w-5 h-5 text-[var(--accent-blue)]" />
                  Recent QC Formation
                </h3>
                <span className="text-sm text-[var(--text-muted)]">
                  {qcStats.qcRate}% success rate
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-2">
                {qcStats.recentQCs.slice(0, 10).map((qc, i) => (
                  <div 
                    key={i}
                    className={`p-2 rounded-lg text-center ${
                      qc.valid 
                        ? 'bg-green-500/10 border border-green-500/30' 
                        : 'bg-red-500/10 border border-red-500/30'
                    }`}
                    title={`Block ${qc.blockNumber}: ${qc.signatures} signatures, ${qc.timeToQC}ms`}
                  >
                    <div className={`w-3 h-3 rounded-full mx-auto mb-1 ${qc.valid ? 'bg-green-500' : 'bg-red-500'}`} />
                    <p className="text-[10px] text-[var(--text-muted)]">{qc.signatures}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-3">
                Showing last {Math.min(qcStats.recentQCs.length, 10)} blocks • Green = valid QC, Red = invalid
              </p>
            </div>
          )}
        </div>
      )}

      {/* Validators Tab */}
      {activeTab === 'validators' && (
        <div className="space-y-6">
          {/* Validator Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card-xdc text-center">
              <p className="text-3xl font-bold text-[var(--text-primary)]">{validatorSummary?.total || 0}</p>
              <p className="text-sm text-[var(--text-secondary)]">Total Validators</p>
            </div>
            <div className="card-xdc text-center">
              <p className="text-3xl font-bold text-green-500">{validatorSummary?.active || 0}</p>
              <p className="text-sm text-[var(--text-secondary)]">Active</p>
            </div>
            <div className="card-xdc text-center">
              <p className="text-3xl font-bold text-[var(--warning)]">{highPerformers.length}</p>
              <p className="text-sm text-[var(--text-secondary)]">High Performers (≥80)</p>
            </div>
            <div className="card-xdc text-center">
              <p className="text-3xl font-bold text-[var(--accent-blue)]">{validatorSummary?.averageScore || 0}</p>
              <p className="text-sm text-[var(--text-secondary)]">Average Score</p>
            </div>
          </div>

          {/* Validators Table */}
          <div className="card-xdc overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Award className="w-5 h-5 text-[var(--accent-blue)]" />
                Validator Performance
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--bg-hover)]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Rank</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Address</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase">Score</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase">Blocks</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase">Votes %</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase">QC %</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase">Missed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {validators.slice(0, 20).map((validator) => (
                    <tr key={validator.address} className="hover:bg-[var(--bg-hover)]">
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                        #{validator.rank}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-mono text-[var(--text-primary)]">
                            {validator.xdcAddress.slice(0, 12)}...{validator.xdcAddress.slice(-8)}
                          </span>
                          {validator.stake && (
                            <span className="text-xs text-[var(--text-muted)]">{validator.stake} XDC</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                          validator.status === 'active' 
                            ? 'bg-green-500/20 text-green-500' 
                            : validator.status === 'standby'
                            ? 'bg-yellow-500/20 text-yellow-500'
                            : 'bg-red-500/20 text-red-500'
                        }`}>
                          {validator.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-sm font-bold ${getScoreColor(validator.overallScore)}`}>
                          {validator.overallScore}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-[var(--text-secondary)]">
                        {validator.blocksProduced} / {validator.blocksExpected}
                        <span className="text-xs text-[var(--text-muted)] ml-1">
                          ({validator.blockProductionRate.toFixed(0)}%)
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-[var(--text-secondary)]">
                        {validator.voteParticipationPercent.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-[var(--text-secondary)]">
                        {validator.qcContributionPercent.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-center">
                        {validator.missedBlocks > 0 ? (
                          <span className="text-sm text-red-500">{validator.missedBlocks}</span>
                        ) : (
                          <span className="text-sm text-green-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Gap Blocks Tab */}
      {activeTab === 'gaps' && (
        <div className="space-y-6">
          {/* Gap Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card-xdc text-center">
              <p className="text-3xl font-bold text-red-500">{gapStats?.totalGapBlocks || 0}</p>
              <p className="text-sm text-[var(--text-secondary)]">Total Gap Blocks (24h)</p>
            </div>
            <div className="card-xdc text-center">
              <p className="text-3xl font-bold text-[var(--warning)]">
                {gapStats?.gapRate?.toFixed(2) || 0}%
              </p>
              <p className="text-sm text-[var(--text-secondary)]">Gap Rate</p>
            </div>
            <div className="card-xdc text-center">
              <p className="text-3xl font-bold text-[var(--text-primary)]">
                {gapStats?.topOffenders?.length || 0}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">Validators with Gaps</p>
            </div>
            <div className="card-xdc text-center">
              <p className="text-3xl font-bold text-[var(--accent-blue)]">
                {gapStats?.recentGapBlocks?.[0]?.blockNumber ? 
                  `#${gapStats.recentGapBlocks[0].blockNumber.toLocaleString()}` : 
                  '-'
                }
              </p>
              <p className="text-sm text-[var(--text-secondary)]">Latest Gap</p>
            </div>
          </div>

          {/* Top Offenders */}
          {gapStats?.topOffenders && gapStats.topOffenders.length > 0 && (
            <div className="card-xdc">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                Top Offenders
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {gapStats.topOffenders.slice(0, 6).map((offender, i) => (
                  <div key={offender.address} className="flex items-center justify-between p-3 bg-[var(--bg-hover)] rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-[var(--text-muted)]">#{i + 1}</span>
                      <div>
                        <p className="text-sm font-mono text-[var(--text-primary)]">
                          {offender.xdcAddress.slice(0, 10)}...{offender.xdcAddress.slice(-6)}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-red-500">{offender.missedCount} missed</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Gap Blocks */}
          <div className="card-xdc overflow-hidden">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-[var(--accent-blue)]" />
              Recent Gap Blocks
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--bg-hover)]">
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Block</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Epoch</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Expected Producer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-[var(--text-muted)] uppercase">Actual Producer</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase">Type</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-[var(--text-muted)] uppercase">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {gapStats?.recentGapBlocks?.slice(0, 20).map((gap) => (
                    <tr key={gap.blockNumber} className="hover:bg-[var(--bg-hover)]">
                      <td className="px-4 py-3 text-sm font-mono text-[var(--text-primary)]">
                        #{gap.blockNumber.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                        {gap.epochNumber}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-red-400">
                        {gap.expectedProducerXdc.slice(0, 12)}...{gap.expectedProducerXdc.slice(-8)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-green-400">
                        {gap.actualProducerXdc 
                          ? `${gap.actualProducerXdc.slice(0, 12)}...${gap.actualProducerXdc.slice(-8)}`
                          : '-'
                        }
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                          gap.gapType === 'missed_turn' 
                            ? 'bg-red-500/20 text-red-500' 
                            : gap.gapType === 'late_block'
                            ? 'bg-yellow-500/20 text-yellow-500'
                            : 'bg-orange-500/20 text-orange-500'
                        }`}>
                          {gap.gapType.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-[var(--text-muted)]">
                        {new Date(gap.detectedAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                  {(!gapStats?.recentGapBlocks || gapStats.recentGapBlocks.length === 0) && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[var(--text-muted)]">
                        No gap blocks detected in the last 24 hours. Great job validators! 🎉
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
