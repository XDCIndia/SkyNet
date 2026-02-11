# XDCNetOwn — Social Metrics Specification

> **Turn network health into marketing momentum.**  
> Shareable cards. Automated posts. Board-ready reports.

---

## 1. Shareable Card Designs

### 1.1 Card Specifications

| Card Type | Dimensions | Format | Use Case |
|-----------|------------|--------|----------|
| **Twitter/X Post** | 1200×628px | PNG | Feed posts, announcements |
| **Twitter/X Banner** | 1500×500px | PNG | Profile headers |
| **Instagram Story** | 1080×1920px | PNG | Stories, Reels cover |
| **LinkedIn Post** | 1200×627px | PNG | Professional updates |
| **LinkedIn Banner** | 1584×396px | PNG | Company page header |
| **Discord/Telegram** | 1280×720px | PNG | Community announcements |
| **PDF Report Cover** | A4 (2480×3508px) | PDF | Board presentations |
| **Email Header** | 600×200px | PNG | Newsletter headers |

### 1.2 Card Content Templates

#### Template A: Weekly Health Card
```
┌─────────────────────────────────────────────────────────┐
│  [XDC Logo]                    XDC Network Health       │
│                                                         │
│                    Week of Feb 10, 2026                 │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │   108    │  │  99.97%  │  │   2.0s   │  │  12.4M  │ │
│  │  Nodes   │  │  Uptime  │  │ Block T  │  │  Daily  │ │
│  │  Online  │  │   (7d)   │  │   Avg    │  │   TX    │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                         │
│  🌍 42 Countries  │  🔗 108 Masternodes  │  ⛽ 0.25 Gwei│
│                                                         │
│            powered by XDCNetOwn.network                 │
└─────────────────────────────────────────────────────────┘
```

#### Template B: Milestone Celebration
```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│              🎉 MILESTONE ACHIEVED 🎉                   │
│                                                         │
│                    100,000,000                          │
│                     BLOCKS MINED                        │
│                                                         │
│              Feb 11, 2026 at 14:32 UTC                  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Time to 200M: ~2 years at current rate        │   │
│  │  Avg block time: 2.04s                         │   │
│  │  Network started: June 2019                    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│              #XDC #XDCNetwork #Blockchain               │
└─────────────────────────────────────────────────────────┘
```

#### Template C: Validator Performance
```
┌─────────────────────────────────────────────────────────┐
│  [Validator Logo]  Masternode Alpha Performance         │
│                                                         │
│                    Epoch 110234                         │
│                                                         │
│  Rank: #7 of 108                      Score: 97/100     │
│                                                         │
│  ┌────────────┐  ┌────────────┐  ┌────────────────┐    │
│  │  99.98%    │  │   847      │  │  1,247 XDC     │    │
│  │  Uptime    │  │ Blocks Made│  │  Rewards       │    │
│  └────────────┘  └────────────┘  └────────────────┘    │
│                                                         │
│  Top 10% Performer 🏆                                   │
│                                                         │
│            powered by XDCNetOwn.network                 │
└─────────────────────────────────────────────────────────┘
```

#### Template D: Network Comparison
```
┌─────────────────────────────────────────────────────────┐
│         Network Performance Comparison                  │
│                    February 2026                        │
│                                                         │
│  Metric        │  XDC   │ Polygon │ Ethereum │ Solana  │
│  ─────────────────────────────────────────────────────  │
│  Block Time    │  2.0s  │  2.3s   │  12s     │  0.4s   │
│  Finality      │  2s    │  ~15s   │  ~12min  │  ~12s   │
│  Avg TPS       │  150   │  300    │  12      │  800    │
│  Fee (avg)     │ $0.0001│ $0.001  │ $2.50    │ $0.00025│
│  Energy/Tx     │  Low   │  Low    │  High    │  Med    │
│                                                         │
│  XDC: Enterprise-Grade. Eco-Friendly. Cost-Effective.   │
└─────────────────────────────────────────────────────────┘
```

### 1.3 Branding Guidelines

**Colors:**
| Element | Hex | RGB |
|---------|-----|-----|
| Primary Blue | `#00A4E4` | rgb(0, 164, 228) |
| Dark Navy | `#0A1F44` | rgb(10, 31, 68) |
| Success Green | `#10B981` | rgb(16, 185, 129) |
| Warning Yellow | `#F59E0B` | rgb(245, 158, 11) |
| Danger Red | `#EF4444` | rgb(239, 68, 68) |
| Background | `#0F172A` | rgb(15, 23, 42) |
| Text Primary | `#F8FAFC` | rgb(248, 250, 252) |
| Text Secondary | `#94A3B8` | rgb(148, 163, 184) |

**Typography:**
- Headlines: Inter Bold, 48-72px
- Numbers: Fira Mono Medium, 36-64px
- Body: Inter Regular, 14-18px
- Captions: Inter Regular, 12px

**Logo Usage:**
- XDC logo: top-left, 60px height
- XDCNetOwn badge: bottom-center, "powered by" style
- Clear space: 2× logo height on all sides

---

## 2. Metrics to Highlight

### 2.1 Primary Metrics (Always Show)

| Metric | Source | Update Freq | Format |
|--------|--------|-------------|--------|
| **Nodes Online** | Fleet aggregator | Real-time | "108/108" or "108" |
| **Network Uptime** | SLA calculator | 1 minute | "99.97%" (2 decimals) |
| **Block Time** | Consensus monitor | Per block | "2.0s" (1 decimal) |
| **Daily Transactions** | Chain indexer | 1 hour | "12.4M" (compact) |
| **Current Block** | RPC | Real-time | "99,234,567" |
| **Active Validators** | XDPoS API | Per epoch | "108" |
| **Geographic Spread** | Geo IP | Daily | "42 Countries" |
| **Gas Price** | RPC | Real-time | "0.25 Gwei" |

### 2.2 Secondary Metrics (Rotate Weekly)

| Metric | Use Case |
|--------|----------|
| **TPS (Real-time)** | "Currently processing 156 TPS" |
| **TPS (Peak 24h)** | "Peak: 1,847 TPS at 14:32 UTC" |
| **Unique Addresses** | "2.4M unique addresses (+5.2% WoW)" |
| **Contract Deployments** | "1,247 contracts this week" |
| **Total Value Locked** | "$124M TVL across DeFi protocols" |
| **Staking APY** | "8.2% APY for masternodes" |
| **Energy per Tx** | "0.0000076 kWh (eco-friendly)" |
| **Cross-chain Volume** | "$45M bridged this month" |

### 2.3 Validator-Specific Metrics

| Metric | Description |
|--------|-------------|
| **Epoch Rank** | Position among 108 masternodes |
| **Blocks Signed** | Count in current/previous epoch |
| **Signing Rate** | % of rounds participated |
| **Rewards Earned** | XDC accumulated this epoch |
| **Uptime Streak** | Consecutive days at 100% |
| **Response Time** | Average block validation latency |
| **Slash Risk** | Warning if missing too many rounds |

### 2.4 Geographic Metrics

```
Top Regions by Node Count:
┌────────────────┬─────────┬──────────┐
│ Region         │ Nodes   │ Percent  │
├────────────────┼─────────┼──────────┤
│ Europe         │ 34      │ 31.5%    │
│ Asia-Pacific   │ 28      │ 25.9%    │
│ North America  │ 26      │ 24.1%    │
│ South America  │ 12      │ 11.1%    │
│ Middle East    │ 5       │ 4.6%     │
│ Africa         │ 3       │ 2.8%     │
└────────────────┴─────────┴──────────┘
```

---

## 3. Twitter/X API Integration

### 3.1 Authentication

```typescript
// Twitter API v2 Integration
interface TwitterConfig {
  appKey: string;           // TWITTER_API_KEY
  appSecret: string;        // TWITTER_API_SECRET
  accessToken: string;      // TWITTER_ACCESS_TOKEN
  accessSecret: string;     // TWITTER_ACCESS_SECRET
}

// OAuth 2.0 for posting
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});
```

### 3.2 Automated Post Triggers

| Trigger | Condition | Post Content |
|---------|-----------|--------------|
| **Milestone Block** | Every 1M blocks | "🎉 XDC Network just reached 100M blocks!" |
| **Uptime Record** | 30d at 99.99%+ | "99.99% uptime for 30 days straight 🚀" |
| **TPS Record** | New all-time high | "New record: 2,156 TPS processed!" |
| **Node Growth** | +10% peers WoW | "Network growth: +47 nodes this week" |
| **Weekly Digest** | Every Monday 09:00 | Weekly stats summary card |
| **Epoch Complete** | Every 900 blocks | Epoch summary for validators |

### 3.3 Post Templates

```typescript
// Milestone post
const milestonePost = {
  text: `🎉 MILESTONE: XDC Network just mined block ${blockNumber.toLocaleString()}!

⛓️ Avg Block Time: ${blockTime}s
🌍 Active Nodes: ${nodeCount}
💸 Avg Fee: $${avgFee}

#XDC #XDCNetwork #Blockchain #${milestoneTag}`,
  media: [generatedCardBuffer], // 1200x628 PNG
};

// Weekly digest
const weeklyDigest = {
  text: `📊 XDC Network Weekly Health Report

🟢 Uptime: ${uptime}%
🚀 Peak TPS: ${peakTPS}
🌍 Nodes: ${nodeCount} (${nodeGrowth > 0 ? '+' : ''}${nodeGrowth}%)
💰 TX Volume: ${txVolume}

Full report: ${reportUrl}

#XDC #WeeklyReport`,
  media: [weeklyCardBuffer],
};

// Validator performance
const validatorPost = {
  text: `🏆 Masternode ${validatorName} performance - Epoch ${epoch}

Rank: #${rank} of 108
Blocks: ${blocksSigned}
Rewards: ${rewards} XDC
Score: ${score}/100

Stake with us: ${stakingUrl}

#XDC #Masternode #Staking`,
  media: [validatorCardBuffer],
};
```

### 3.4 Rate Limiting

```typescript
// Twitter API v2 Limits
const RATE_LIMITS = {
  tweetsPerDay: 300,           // Per app
  tweetsPerHour: 50,           // Per user
  mediaUploadsPerDay: 1000,    // Per app
};

// Queue system for automation
interface QueuedPost {
  id: string;
  priority: 'high' | 'normal' | 'low';
  content: TweetContent;
  scheduledAt: Date;
  retryCount: number;
}

// Post with backoff
async function postWithRetry(post: QueuedPost): Promise<void> {
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await client.v2.tweet(post.content);
      return;
    } catch (error) {
      if (error.code === 429) {
        // Rate limited - wait and retry
        await sleep(Math.pow(2, i) * 60000); // Exponential backoff
      } else {
        throw error;
      }
    }
  }
}
```

---

## 4. LinkedIn Integration

### 4.1 Enterprise Updates

**Posting Schedule:**
| Day | Content Type | Audience |
|-----|--------------|----------|
| Monday | Weekly metrics summary | Followers |
| Wednesday | Technical deep-dive | Developers |
| Friday | Validator spotlight | Enterprise |
| Monthly | Board report highlights | Executives |

### 4.2 LinkedIn API

```typescript
// LinkedIn API v2
interface LinkedInConfig {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  organizationId: string;  // For company posts
}

// Post to company page
async function postToLinkedIn(content: LinkedInPost): Promise<void> {
  const response = await fetch('https://api.linkedin.com/v2/posts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: `urn:li:organization:${organizationId}`,
      commentary: content.text,
      visibility: 'PUBLIC',
      distribution: {
        linkedInDistributionTarget: {},
      },
      content: {
        media: {
          id: await uploadLinkedInImage(content.image),
        },
      },
    }),
  });
}
```

### 4.3 Content Templates

```
Professional Weekly Update:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

XDC Network Infrastructure Report
Week of February 10, 2026

📈 Key Metrics:
• Network Uptime: 99.97%
• Average Block Time: 2.04 seconds
• Active Validator Nodes: 108/108
• Daily Transaction Volume: 12.4M
• Geographic Distribution: 42 countries

🔧 Infrastructure Highlights:
• Zero unplanned downtime
• Successful epoch transitions: 7/7
• Average peer connectivity: 45 nodes
• Disk utilization: 67% (healthy)

🌱 Sustainability:
• Energy per transaction: 0.0000076 kWh
• 99.9% more efficient than proof-of-work

#Blockchain #Enterprise #Infrastructure #XDC #Sustainability
```

---

## 5. Weekly Digest Email Template

### 5.1 HTML Email Spec

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>XDC Network Weekly Report</title>
  <style>
    body { font-family: Inter, -apple-system, sans-serif; background: #0F172A; color: #F8FAFC; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; padding: 30px 0; }
    .score-card { background: linear-gradient(135deg, #00A4E4, #0A1F44); border-radius: 16px; padding: 30px; text-align: center; }
    .metric-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin: 20px 0; }
    .metric-box { background: #1E293B; border-radius: 12px; padding: 20px; text-align: center; }
    .metric-value { font-size: 32px; font-weight: 700; color: #00A4E4; }
    .footer { text-align: center; padding: 30px; color: #94A3B8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://xdcnetown.network/logo.png" alt="XDCNetOwn" width="200">
      <h1>Weekly Network Report</h1>
      <p>Week of {{weekStart}} - {{weekEnd}}</p>
    </div>
    
    <div class="score-card">
      <h2>Network Health Score</h2>
      <div style="font-size: 72px; font-weight: 700;">{{healthScore}}/100</div>
      <p style="font-size: 18px;">{{healthGrade}} Performance</p>
    </div>
    
    <div class="metric-grid">
      <div class="metric-box">
        <div class="metric-value">{{uptime}}%</div>
        <p>Uptime</p>
      </div>
      <div class="metric-box">
        <div class="metric-value">{{nodeCount}}</div>
        <p>Active Nodes</p>
      </div>
      <div class="metric-box">
        <div class="metric-value">{{avgBlockTime}}s</div>
        <p>Avg Block Time</p>
      </div>
      <div class="metric-box">
        <div class="metric-value">{{dailyTx}}M</div>
        <p>Daily Transactions</p>
      </div>
    </div>
    
    <div style="background: #1E293B; border-radius: 12px; padding: 20px; margin: 20px 0;">
      <h3>📊 Week-over-Week Growth</h3>
      <table style="width: 100%; color: #F8FAFC;">
        <tr>
          <td>Active Peers</td>
          <td style="text-align: right; color: #10B981;">+{{peerGrowth}}%</td>
        </tr>
        <tr>
          <td>Transaction Volume</td>
          <td style="text-align: right; color: #10B981;">+{{txGrowth}}%</td>
        </tr>
        <tr>
          <td>New Addresses</td>
          <td style="text-align: right; color: #10B981;">+{{addressGrowth}}%</td>
        </tr>
      </table>
    </div>
    
    <div class="footer">
      <p>Generated by XDCNetOwn.network</p>
      <p><a href="{{unsubscribeUrl}}">Unsubscribe</a> | <a href="{{preferencesUrl}}">Preferences</a></p>
    </div>
  </div>
</body>
</html>
```

### 5.2 Distribution List

| Segment | Recipients | Frequency | Content |
|---------|------------|-----------|---------|
| **Validators** | 108 masternodes | Weekly | Performance ranking, rewards |
| **Operators** | Fleet managers | Weekly | Fleet health, incidents |
| **Investors** | Board/stakeholders | Monthly | Growth metrics, comparisons |
| **Community** | General subscribers | Weekly | Public-friendly summary |

---

## 6. Monthly Board Report Template

### 6.1 Executive Summary Page

```
XDC NETWORK BOARD REPORT
February 2026

┌─────────────────────────────────────────────────────────────────┐
│ EXECUTIVE SUMMARY                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Health Score:        97/100  🟢 Excellent                      │
│  Network Uptime:      99.97%  (exceeded 99.9% SLA)              │
│  Active Validators:   108/108 (100% participation)              │
│  Geographic Spread:   42 countries across 6 continents          │
│  Nakamoto Coefficient 34 (target: 35)                           │
│                                                                 │
│  KEY HIGHLIGHTS:                                                │
│  • Zero critical incidents                                      │
│  • 2.4M new unique addresses (+18% MoM)                         │
│  • Average block time: 2.04s (target: 2.0s)                     │
│  • Peak TPS: 1,847 (new monthly record)                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Financial Metrics Section

```
REVENUE & ECONOMICS
━━━━━━━━━━━━━━━━━━━

Staking Rewards Distributed:    45,234 XDC
Average APY:                     8.2%
Transaction Fees (Total):        1,247 XDC
Network Value Secured:           $2.4B

COMPARISON TO COMPETITORS:
┌─────────────┬──────────┬──────────┬──────────┐
│ Metric      │ XDC      │ Polygon  │ Ethereum │
├─────────────┼──────────┼──────────┼──────────┤
│ Avg Fee     │ $0.0001  │ $0.001   │ $2.50    │
│ Finality    │ 2s       │ ~15s     │ ~12min   │
│ Energy/Tx   │ 0.000kWh │ Low      │ High     │
│ Decentraliz │ 34       │ 30       │ 45       │
└─────────────┴──────────┴──────────┴──────────┘
```

### 6.3 Technical Performance Section

```
INFRASTRUCTURE PERFORMANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━

Uptime by Service:
• Consensus Layer:        99.999% (1.3s downtime)
• RPC Endpoints:          99.97%  (13m downtime)
• P2P Network:            100%    (no outages)

Incident Summary:
┌──────────┬─────────┬──────────┬──────────────────────┐
│ Date     │ Severity│ Duration │ Description          │
├──────────┼─────────┼──────────┼──────────────────────┤
│ Feb 8    │ Low     │ 5 min    │ RPC latency spike    │
│ Feb 15   │ Medium  │ 12 min   │ Single node sync lag │
│ Feb 22   │ Low     │ 3 min    │ Peer drop on MN-042  │
└──────────┴─────────┴──────────┴──────────────────────┘

Mean Time to Resolution: 4.2 minutes
SLA Compliance: 99.97% (target: 99.9%)
```

### 6.4 Growth Trajectory

```
12-MONTH PROJECTION
━━━━━━━━━━━━━━━━━━━

Node Growth:
Current: 108 validators + 500 RPC nodes
6-Month: 120 validators + 750 RPC nodes (+35%)
12-Month: 150 validators + 1200 RPC nodes (+100%)

Transaction Growth:
Current: 12.4M daily
6-Month: 25M daily (+102%)
12-Month: 50M daily (+303%)

Infrastructure Investment Required:
• Storage expansion: +$12K (Q2)
• Monitoring upgrade: +$8K (Q3)
• CDN/Edge nodes: +$15K (Q4)
```

---

## 7. Comparison Benchmarks

### 7.1 How to Present XDC vs Competitors

**When XDC Leads:**
- "XDC delivers enterprise-grade finality in 2 seconds — 360x faster than Ethereum"
- "At $0.0001 per transaction, XDC is 25,000x more cost-effective than Ethereum"
- "XDC's energy efficiency: 0.0000076 kWh per transaction vs 150+ kWh for Bitcoin"

**When XDC is Competitive:**
- "XDC matches Polygon's speed with superior decentralization (Nakamoto 34 vs 30)"
- "XDC achieves 2s block times comparable to Solana, with enterprise reliability"

**When Others Lead:**
- "Solana processes more TPS, but XDC offers guaranteed finality for enterprise use"
- "Ethereum has broader adoption, but XDC offers predictable costs for B2B applications"

### 7.2 Benchmark Data Table

```
┌────────────────────┬────────────┬───────────┬───────────┬───────────┐
│ Metric             │ XDC        │ Polygon   │ Ethereum  │ Solana    │
├────────────────────┼────────────┼───────────┼───────────┼───────────┤
│ Consensus          │ XDPoS 2.0  │ PoS       │ PoS       │ PoH+PoS   │
│ Block Time         │ 2.0s       │ 2.3s      │ 12s       │ 0.4s      │
│ Finality           │ 2s         │ ~15s      │ ~12min    │ ~12s      │
│ Peak TPS           │ 2,000      │ 7,000     │ 15        │ 4,000     │
│ Avg TPS            │ 150        │ 300       │ 12        │ 800       │
│ Avg Fee            │ $0.0001    │ $0.001    │ $2.50     │ $0.00025  │
│ Energy/Tx          │ 0.000kWh   │ Low       │ High      │ Med       │
│ Nakamoto Coeff     │ 34         │ 30        │ 45        │ 19        │
│ EVM Compatible     │ ✅         │ ✅        │ ✅        │ ⚠️        │
│ Enterprise Ready   │ ✅         │ ✅        │ ⚠️        │ ❌        │
│ ISO 20022          │ ✅         │ ❌        │ ❌        │ ❌        │
└────────────────────┴────────────┴───────────┴───────────┴───────────┘
```

---

## 8. OG Image Generation

### 8.1 Dynamic OG Image Spec

**Endpoint:** `GET /api/v1/social/og-image`

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `metric` | string | "health" | health, nodes, tps, validators |
| `theme` | string | "dark" | dark, light, brand |
| `refresh` | number | 60 | Cache seconds |

**Generated Image Structure:**
```
┌────────────────────────────────────────────────────────────┐
│  [XDC Logo]                                                │
│                                                            │
│  Network Health Score                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                            │
│              97                                            │
│           ═══════                                          │
│                                                            │
│  Uptime: 99.97%  │  Nodes: 108  │  Block Time: 2.0s       │
│                                                            │
│              xdcnetown.network                             │
└────────────────────────────────────────────────────────────┘
```

### 8.2 Implementation (Satori + Sharp)

```typescript
import { ImageResponse } from '@vercel/og';

export async function generateOGImage(params: OGParams): Promise<Buffer> {
  const data = await fetchNetworkMetrics(params.metric);
  
  return new ImageResponse(
    (
      <div style={{
        width: '1200px',
        height: '630px',
        background: 'linear-gradient(135deg, #0A1F44 0%, #0F172A 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, sans-serif',
        color: '#F8FAFC',
      }}>
        <img src="/logo.png" width="120" height="40" style={{ position: 'absolute', top: 40, left: 40 }} />
        
        <h1 style={{ fontSize: 48, fontWeight: 700, marginBottom: 20 }}>
          XDC Network Health
        </h1>
        
        <div style={{ 
          fontSize: 120, 
          fontWeight: 800, 
          color: '#00A4E4',
          textShadow: '0 0 40px rgba(0, 164, 228, 0.5)',
        }}>
          {data.score}
        </div>
        
        <div style={{ display: 'flex', gap: 40, marginTop: 40, fontSize: 24 }}>
          <span>Uptime: {data.uptime}%</span>
          <span>Nodes: {data.nodes}</span>
          <span>TPS: {data.tps}</span>
        </div>
        
        <span style={{ position: 'absolute', bottom: 40, fontSize: 18, color: '#94A3B8' }}>
          xdcnetown.network
        </span>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
```

### 8.3 Meta Tags for Link Previews

```html
<!-- Standard OG -->
<meta property="og:title" content="XDC Network Health Dashboard">
<meta property="og:description" content="Real-time network metrics for XDC Blockchain. 108 validators, 99.97% uptime.">
<meta property="og:image" content="https://xdcnetown.network/api/v1/social/og-image?metric=health">
<meta property="og:url" content="https://xdcnetown.network">
<meta property="og:type" content="website">

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="XDC Network Health Dashboard">
<meta name="twitter:description" content="Real-time network metrics for XDC Blockchain">
<meta name="twitter:image" content="https://xdcnetown.network/api/v1/social/og-image?metric=health">

<!-- Refresh image every 5 minutes -->
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
```

---

## 9. Embeddable Widget Spec

### 9.1 Widget Types

| Widget | Size | Use Case |
|--------|------|----------|
| **Mini Stats** | 300×150px | Sidebar embeds |
| **Health Badge** | 200×80px | Footer links |
| **Full Dashboard** | 100%×600px | Dedicated page |
| **Validator Card** | 400×250px | Validator websites |
| **Network Map** | 100%×400px | Geographic display |

### 9.2 iframe Implementation

```html
<!-- Mini Stats Widget -->
<iframe 
  src="https://xdcnetown.network/widget/mini?theme=dark&metric=health"
  width="300" 
  height="150"
  frameborder="0"
  scrolling="no"
  style="border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
</iframe>

<!-- Full Dashboard Widget -->
<iframe 
  src="https://xdcnetown.network/widget/dashboard?theme=light&showValidators=true"
  width="100%"
  height="600"
  frameborder="0"
  style="border-radius: 16px;">
</iframe>

<!-- Validator Card (customize per validator) -->
<iframe 
  src="https://xdcnetown.network/widget/validator/0x...?theme=brand"
  width="400"
  height="250"
  frameborder="0">
</iframe>
```

### 9.3 Web Component (Modern Browsers)

```html
<!-- Import the web component -->
<script type="module" src="https://xdcnetown.network/widget/xdc-stats.js"></script>

<!-- Use in HTML -->
<xdc-stats 
  theme="dark"
  metrics="health,nodes,tps"
  refresh="30"
  style="--primary-color: #00A4E4;">
</xdc-stats>

<!-- Full configuration -->
<xdc-dashboard
  api-key="your-api-key"
  organization="your-org-id"
  view="executive"
  timeframe="7d"
  show-export="true">
</xdc-dashboard>
```

### 9.4 JavaScript SDK

```typescript
// NPM: npm install @xdcnetown/widget
import { XDCWidget } from '@xdcnetown/widget';

// Initialize
const widget = new XDCWidget({
  container: '#widget-container',
  type: 'mini',
  config: {
    theme: 'dark',
    metrics: ['health', 'nodes', 'uptime'],
    refreshInterval: 30, // seconds
  },
});

// Event handling
widget.on('metricClick', (event) => {
  console.log('User clicked:', event.metric);
  // Navigate to detailed view
});

widget.on('error', (error) => {
  console.error('Widget error:', error);
  // Fallback display
});

// Programmatic updates
widget.updateTheme('light');
widget.setMetrics(['tps', 'validators']);
widget.refresh();
```

### 9.5 Customization Options

```typescript
interface WidgetConfig {
  theme: 'dark' | 'light' | 'auto' | 'custom';
  colors?: {
    primary: string;
    background: string;
    text: string;
    success: string;
    warning: string;
    danger: string;
  };
  metrics: string[];
  refreshInterval: number;
  language: 'en' | 'zh' | 'ko' | 'ja' | 'de';
  showBranding: boolean;
  compact: boolean;
}

// Example custom theme
const customConfig: WidgetConfig = {
  theme: 'custom',
  colors: {
    primary: '#FF6B6B',
    background: '#1A1A2E',
    text: '#EAEAEA',
    success: '#4ECDC4',
    warning: '#FFE66D',
    danger: '#FF6B6B',
  },
  metrics: ['health', 'tps'],
  refreshInterval: 60,
  language: 'en',
  showBranding: false,
  compact: true,
};
```

---

## 10. Implementation Timeline

| Phase | Feature | Timeline | Status |
|-------|---------|----------|--------|
| 1 | PNG Card Generation | Week 1 | 🔜 |
| 1 | Twitter API Integration | Week 1 | 🔜 |
| 1 | OG Image Endpoint | Week 1 | 🔜 |
| 2 | Weekly Email Digest | Week 2 | 🔜 |
| 2 | LinkedIn Integration | Week 2 | 🔜 |
| 3 | Embeddable Widgets | Week 3 | 🔜 |
| 3 | JavaScript SDK | Week 3 | 🔜 |
| 4 | Monthly PDF Reports | Week 4 | 🔜 |
| 4 | Board Presentation Deck | Week 4 | 🔜 |

---

*Social metrics that drive network growth.*  
**XDCNetOwn — Share Your Network Success**
