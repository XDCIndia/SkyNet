'use client';

import { useState } from 'react';
import { 
  Share2, 
  Download, 
  Copy, 
  Check,
  TrendingUp,
  TrendingDown,
  Globe,
  Activity,
  Users,
  Clock,
  Zap,
  Award,
  Server,
  BarChart3,
  Sparkles,
  Twitter,
  Linkedin,
  MessageCircle
} from 'lucide-react';

// Types
type CardType = 'stats' | 'growth' | 'milestone' | 'validator';

interface NetworkStats {
  nodeCount: number;
  masternodeCount: number;
  blockHeight: number;
  uptime: number;
  tps: number;
  dailyTx: number;
  peerCount: number;
  countryCount: number;
  ispCount: number;
}

interface GrowthStats {
  nodeGrowth: number;
  txGrowth: number;
  addressGrowth: number;
  peerGrowth: number;
  lastMonthNodes: number;
  thisMonthNodes: number;
  lastMonthTx: number;
  thisMonthTx: number;
}

interface MilestoneData {
  type: 'nodes' | 'blocks' | 'uptime' | 'tx';
  value: number;
  unit: string;
  achievedDate: string;
  description: string;
}

interface ValidatorData {
  name: string;
  rank: number;
  uptime: number;
  blocksProduced: number;
  rewards: number;
  streak: number;
}

// Mock data
const mockStats: NetworkStats = {
  nodeCount: 1247,
  masternodeCount: 108,
  blockHeight: 99234567,
  uptime: 99.97,
  tps: 143.5,
  dailyTx: 12.4,
  peerCount: 2847,
  countryCount: 42,
  ispCount: 67
};

const mockGrowth: GrowthStats = {
  nodeGrowth: 39.8,
  txGrowth: 39.3,
  addressGrowth: 33.3,
  peerGrowth: 48.0,
  lastMonthNodes: 892,
  thisMonthNodes: 1247,
  lastMonthTx: 8.9,
  thisMonthTx: 12.4
};

const mockMilestone: MilestoneData = {
  type: 'nodes',
  value: 1000,
  unit: 'Nodes',
  achievedDate: '2026-02-10',
  description: 'XDC Network crossed 1,000 active nodes!'
};

const mockValidator: ValidatorData = {
  name: 'NodeAlpha',
  rank: 1,
  uptime: 99.99,
  blocksProduced: 89234,
  rewards: 45234,
  streak: 180
};

export default function SocialCard() {
  const [activeCard, setActiveCard] = useState<CardType>('stats');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleCopyToClipboard = async () => {
    const text = generateShareText(activeCard);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    setDownloading(true);
    // TODO: Connect to actual image generation API
    setTimeout(() => {
      console.log('Download triggered for card:', activeCard);
      setDownloading(false);
    }, 1000);
  };

  const handleShareTwitter = () => {
    const text = generateShareText(activeCard);
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleShareLinkedIn = () => {
    const text = generateShareText(activeCard);
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('https://xdc.network')}&summary=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const generateShareText = (type: CardType): string => {
    switch (type) {
      case 'stats':
        return `🚀 XDC Network Update\n\n🌐 ${mockStats.nodeCount.toLocaleString()} Nodes\n📊 ${mockStats.dailyTx}M Daily TX\n⏱️ ${mockStats.uptime}% Uptime\n👥 ${mockStats.peerCount.toLocaleString()} Peers\n\n#XDC #XDCNetwork #WeAreXDC`;
      case 'growth':
        return `📈 XDC Growth This Month\n\nNodes: +${mockGrowth.nodeGrowth}% 🚀\nDaily TX: +${mockGrowth.txGrowth}% 📈\nPeers: +${mockGrowth.peerGrowth}% 🌐\n\nBuilding the future of enterprise blockchain.\n\n#XDC #Growth #Blockchain`;
      case 'milestone':
        return `🎉 MILESTONE: ${mockMilestone.value.toLocaleString()} ${mockMilestone.unit}!\n\n${mockMilestone.description}\n\n🌍 ${mockStats.countryCount} countries\n🔗 ${mockStats.ispCount} ISPs\n⏱️ ${mockStats.uptime}% uptime\n\nThank you to our validator community! 🙏\n\n#XDC #Milestone #Blockchain`;
      case 'validator':
        return `🏆 Validator Spotlight: ${mockValidator.name}\n\n• Uptime: ${mockValidator.uptime}%\n• Blocks: ${mockValidator.blocksProduced.toLocaleString()}\n• Rewards: ${mockValidator.rewards.toLocaleString()} XDC\n• Streak: ${mockValidator.streak} days 🔥\n\nTop ${mockValidator.rank}% performer!\n\n#XDC #Validator #Staking`;
      default:
        return '#XDC #XDCNetwork';
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="card-xdc">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1E90FF]/20 to-[#10B981]/10 flex items-center justify-center">
            <Share2 className="w-5 h-5 text-[var(--accent-blue)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#F9FAFB]">Social Media Cards</h2>
            <p className="text-sm text-[#6B7280]">Auto-generated shareable content</p>
          </div>
        </div>
      </div>

      {/* Card Type Selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(['stats', 'growth', 'milestone', 'validator'] as CardType[]).map((type) => (
          <button
            key={type}
            onClick={() => setActiveCard(type)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeCard === type
                ? 'bg-[var(--accent-blue)] text-white'
                : 'bg-[var(--bg-card)] text-[#9CA3AF] hover:text-[#F9FAFB] border border-[rgba(255,255,255,0.06)]'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)} Card
          </button>
        ))}
      </div>

      {/* Card Preview */}
      <div className="mb-6">
        {activeCard === 'stats' && <StatsCard stats={mockStats} />}
        {activeCard === 'growth' && <GrowthCard stats={mockGrowth} />}
        {activeCard === 'milestone' && <MilestoneCard data={mockMilestone} stats={mockStats} />}
        {activeCard === 'validator' && <ValidatorCard data={mockValidator} />}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleShareTwitter}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1DA1F2]/15 text-[#1DA1F2] hover:bg-[#1DA1F2]/25 transition-colors"
        >
          <Twitter className="w-4 h-4" />
          Share to X
        </button>
        <button
          onClick={handleShareLinkedIn}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0A66C2]/15 text-[#0A66C2] hover:bg-[#0A66C2]/25 transition-colors"
        >
          <Linkedin className="w-4 h-4" />
          LinkedIn
        </button>
        <button
          onClick={handleCopyToClipboard}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgba(255,255,255,0.1)] text-[#F9FAFB] hover:bg-[rgba(255,255,255,0.15)] transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-[var(--success)]" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Copied!' : 'Copy Text'}
        </button>
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[rgba(16,185,129,0.15)] text-[var(--success)] hover:bg-[rgba(16,185,129,0.25)] transition-colors disabled:opacity-50"
        >
          <Download className={`w-4 h-4 ${downloading ? 'animate-bounce' : ''}`} />
          {downloading ? 'Generating...' : 'Download PNG'}
        </button>
      </div>

      {/* Hashtag Suggestions */}
      <div className="mt-6 p-4 rounded-xl bg-[var(--bg-card)] border border-[rgba(255,255,255,0.06)]">
        <div className="text-xs text-[#6B7280] mb-2">Suggested Hashtags</div>
        <div className="flex flex-wrap gap-2">
          {['#XDC', '#XDCNetwork', '#WeAreXDC', '#Blockchain', '#EnterpriseBlockchain', '#Validator', '#DeFi', '#Web3'].map(tag => (
            <span 
              key={tag} 
              className="px-2 py-1 rounded-full bg-[rgba(30,144,255,0.1)] text-[var(--accent-blue)] text-xs cursor-pointer hover:bg-[rgba(30,144,255,0.2)] transition-colors"
              onClick={() => navigator.clipboard.writeText(tag)}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Stats Card Component
function StatsCard({ stats }: { stats: NetworkStats }) {
  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#0A0E1A] to-[#111827] border border-[rgba(255,255,255,0.1)] p-6">
      {/* Card Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1E90FF] to-[#10B981] flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium text-[#F9FAFB]">XDC Network Stats</span>
        </div>
        <span className="text-xs text-[#6B7280]">{new Date().toLocaleDateString()}</span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatBox icon={<Server className="w-4 h-4" />} label="Nodes" value={stats.nodeCount.toLocaleString()} color="#1E90FF" />
        <StatBox icon={<Clock className="w-4 h-4" />} label="Uptime" value={`${stats.uptime}%`} color="#10B981" />
        <StatBox icon={<Zap className="w-4 h-4" />} label="Block Time" value="2.0s" color="#F59E0B" />
        <StatBox icon={<BarChart3 className="w-4 h-4" />} label="Blocks" value={`${(stats.blockHeight / 1000000).toFixed(1)}M+`} color="#1E90FF" />
        <StatBox icon={<Users className="w-4 h-4" />} label="Peers" value={stats.peerCount.toLocaleString()} color="#10B981" />
        <StatBox icon={<Activity className="w-4 h-4" />} label="Daily TX" value={`${stats.dailyTx}M`} color="#F59E0B" />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-[rgba(255,255,255,0.06)]">
        <span className="text-xs text-[#6B7280]">
          🌍 {stats.countryCount} Countries • 🔗 {stats.ispCount} ISPs • 🏆 {stats.masternodeCount} Validators
        </span>
      </div>

      {/* Branding */}
      <div className="text-center mt-4">
        <span className="text-[12px] text-[#6B7280]">Powered by XDCNetOwn • xdc.network</span>
      </div>
    </div>
  );
}

// Growth Card Component  
function GrowthCard({ stats }: { stats: GrowthStats }) {
  const metrics = [
    { label: 'Total Nodes', last: stats.lastMonthNodes, current: stats.thisMonthNodes, growth: stats.nodeGrowth },
    { label: 'Daily Transactions', last: `${stats.lastMonthTx}M`, current: `${stats.thisMonthTx}M`, growth: stats.txGrowth },
    { label: 'Unique Addresses', last: '2.1M', current: '2.8M', growth: stats.addressGrowth },
    { label: 'Active Peers', last: '1,923', current: '2,847', growth: stats.peerGrowth },
  ];

  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#0A0E1A] to-[#111827] border border-[rgba(255,255,255,0.1)] p-6">
      {/* Card Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#10B981] to-[#1E90FF] flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium text-[#F9FAFB]">Monthly Growth Report</span>
        </div>
        <span className="text-xs text-[#6B7280]">Feb 2026</span>
      </div>

      {/* Metrics Table */}
      <div className="space-y-3">
        <div className="grid grid-cols-4 gap-2 text-xs text-[#6B7280] pb-2 border-b border-[rgba(255,255,255,0.06)]">
          <span>Metric</span>
          <span className="text-center">Last Month</span>
          <span className="text-center">This Month</span>
          <span className="text-right">Change</span>
        </div>
        
        {metrics.map((metric, i) => (
          <div key={i} className="grid grid-cols-4 gap-2 items-center">
            <span className="text-sm text-[#F9FAFB]">{metric.label}</span>
            <span className="text-sm text-[#6B7280] text-center">{typeof metric.last === 'number' ? metric.last.toLocaleString() : metric.last}</span>
            <span className="text-sm text-[#F9FAFB] text-center font-medium">{typeof metric.current === 'number' ? metric.current.toLocaleString() : metric.current}</span>
            <div className="flex items-center justify-end gap-1">
              <span className="text-sm font-medium text-[var(--success)]">+{metric.growth}%</span>
              {metric.growth > 30 ? <span>🚀</span> : <span>📈</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Growth Bar Visualization */}
      <div className="mt-6 space-y-2">
        {metrics.slice(0, 2).map((metric, i) => (
          <div key={i} className="space-y-1">
            <div className="text-xs text-[#6B7280]">{metric.label}</div>
            <div className="h-2 bg-[rgba(255,255,255,0.1)] rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-[#1E90FF] to-[#10B981]"
                style={{ width: `${Math.min(100, (1 + metric.growth / 100) * 50)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Branding */}
      <div className="text-center mt-6">
        <span className="text-[12px] text-[#6B7280]">Powered by XDCNetOwn • xdc.network</span>
      </div>
    </div>
  );
}

// Milestone Card Component
function MilestoneCard({ data, stats }: { data: MilestoneData; stats: NetworkStats }) {
  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#0A0E1A] via-[#111827] to-[#1E90FF]/10 border border-[rgba(30,144,255,0.3)] p-6">
      {/* Celebration Header */}
      <div className="text-center mb-6">
        <div className="text-3xl mb-2">🎉</div>
        <h3 className="text-lg font-bold text-[#F9FAFB]">MILESTONE REACHED</h3>
      </div>

      {/* Big Number */}
      <div className="text-center mb-6">
        <div className="text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#1E90FF] to-[#10B981]">
          {data.value.toLocaleString()}
        </div>
        <div className="text-xl font-medium text-[#F9FAFB] mt-2">{data.unit.toUpperCase()}</div>
      </div>

      {/* Description */}
      <div className="text-center mb-6">
        <p className="text-[#9CA3AF]">{data.description}</p>
      </div>

      {/* Achievement Stats */}
      <div className="flex items-center justify-center gap-6 text-sm text-[#6B7280]">
        <span>🌍 {stats.countryCount} countries</span>
        <span>🔗 {stats.ispCount} ISPs</span>
        <span>⏱️ {stats.uptime}% uptime</span>
      </div>

      {/* Thank You */}
      <div className="text-center mt-6 pt-4 border-t border-[rgba(255,255,255,0.06)]">
        <p className="text-sm text-[#9CA3AF]">Thank you to our incredible validator community! 🙏</p>
      </div>

      {/* Hashtags */}
      <div className="text-center mt-4">
        <span className="text-xs text-[var(--accent-blue)]">#XDC #XDCNetwork #Blockchain #Milestone</span>
      </div>
    </div>
  );
}

// Validator Card Component
function ValidatorCard({ data }: { data: ValidatorData }) {
  return (
    <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-[#0A0E1A] to-[#111827] border border-[rgba(245,158,11,0.3)] p-6">
      {/* Card Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F59E0B] to-[#EF4444] flex items-center justify-center">
            <Award className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium text-[#F9FAFB]">Validator Spotlight</span>
        </div>
        <span className="text-xs text-[#6B7280]">{new Date().toLocaleDateString()}</span>
      </div>

      {/* Validator Hero */}
      <div className="text-center mb-6">
        <div className="text-2xl mb-2">🏆</div>
        <h3 className="text-lg font-bold text-[#F9FAFB]">Validator of the Month</h3>
        <div className="mt-4 w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[#F59E0B]/20 to-[#F59E0B]/10 flex items-center justify-center text-3xl border-2 border-[#F59E0B]">
          {data.name.charAt(0)}
        </div>
        <h4 className="mt-3 text-xl font-semibold text-[#F9FAFB]">{data.name}</h4>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 rounded-xl bg-[rgba(255,255,255,0.03)]">
          <div className="text-xl font-bold text-[var(--success)]">{data.uptime}%</div>
          <div className="text-xs text-[#6B7280] mt-1">Uptime (30d)</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-[rgba(255,255,255,0.03)]">
          <div className="text-xl font-bold text-[var(--accent-blue)]">{(data.blocksProduced / 1000).toFixed(1)}K</div>
          <div className="text-xs text-[#6B7280] mt-1">Blocks</div>
        </div>
        <div className="text-center p-3 rounded-xl bg-[rgba(255,255,255,0.03)]">
          <div className="text-xl font-bold text-[var(--warning)]">{(data.rewards / 1000).toFixed(1)}K</div>
          <div className="text-xs text-[#6B7280] mt-1">XDC Earned</div>
        </div>
      </div>

      {/* Streak */}
      <div className="text-center p-3 rounded-xl bg-[rgba(245,158,11,0.1)] border border-[rgba(245,158,11,0.3)]">
        <span className="text-sm text-[var(--warning)]">🔥 {data.streak} Day Streak • Top {data.rank}% Performer</span>
      </div>

      {/* Call to Action */}
      <div className="text-center mt-6">
        <span className="text-xs text-[#6B7280]">Run your own validator: validators.xdc.network</span>
      </div>

      {/* Branding */}
      <div className="text-center mt-4">
        <span className="text-[12px] text-[#6B7280]">#XDC #Validator #Staking #XDCNetwork</span>
      </div>
    </div>
  );
}

// Helper Components
function StatBox({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="p-3 rounded-xl bg-[rgba(255,255,255,0.03)] text-center">
      <div className="flex items-center justify-center gap-1.5 mb-1" style={{ color }}>
        {icon}
      </div>
      <div className="text-lg font-bold text-[#F9FAFB]">{value}</div>
      <div className="text-[12px] text-[#6B7280] mt-1">{label}</div>
    </div>
  );
}
