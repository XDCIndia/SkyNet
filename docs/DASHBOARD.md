# XDCNetOwn (SkyNet) - Dashboard Features Guide

## Overview

This document describes the features and functionality of the XDCNetOwn (SkyNet) dashboard for monitoring XDC Network nodes.

## Dashboard Views

### 1. Executive Dashboard

The main dashboard provides a high-level overview of your entire XDC node fleet.

#### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| **Fleet Health Score** | Overall health (0-100) | < 80 warning, < 60 critical |
| **Active Nodes** | Online / Total nodes | - |
| **Average Block Height** | Mean block across fleet | - |
| **Consensus Health** | XDPoS 2.0 status | - |
| **Active Alerts** | Open incidents by severity | > 0 critical |

#### Visual Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    Executive Dashboard                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Health    │  │   Nodes     │  │   Alerts    │            │
│  │    92/100   │  │  10/12 🟢   │  │  2 ⚠️ 0 🔴  │            │
│  │    🟢       │  │             │  │             │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Block Height Trend (24h)                    │   │
│  │  📈                                                    │   │
│  │     ╱╲      ╱╲      ╱╲      ╱╲      ╱╲                │   │
│  │    ╱  ╲    ╱  ╲    ╱  ╲    ╱  ╲    ╱  ╲               │   │
│  │   ╱    ╲  ╱    ╲  ╱    ╲  ╱    ╲  ╱    ╲              │   │
│  │  ╱      ╲╱      ╲╱      ╲╱      ╲╱      ╲             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Geographic Distribution                     │   │
│  │  🗺️  [World Map with Node Locations]                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Fleet Management

Comprehensive view of all registered nodes with filtering and sorting capabilities.

#### Node Card

```
┌─────────────────────────────────────────────────────────────┐
│  🔷 xdc-node-01                              [🟢 Healthy]   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Client: Geth v2.6.8        Type: Full Node                 │
│  Network: Mainnet           Mode: Full Sync                 │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Block      │  │  Peers      │  │  Storage    │         │
│  │  89,234,567 │  │  25/50      │  │  450GB      │         │
│  │  +156/min   │  │  🟢         │  │  78% full   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │
│  CPU: 45%  │  Memory: 62%  │  Disk: 78%                    │
│                                                              │
│  [View Details]  [Restart]  [Logs]  [Settings]             │
└─────────────────────────────────────────────────────────────┘
```

#### Client Type Badges

| Badge | Client | Status |
|-------|--------|--------|
| 🔷 | Geth-XDC | Production |
| 🔶 | Erigon-XDC | Experimental |
| 🟢 | Geth PR5 | Testing |
| ⚡ | Nethermind-XDC | Beta |
| 🔴 | Reth-XDC | Alpha |

#### Status Indicators

| Status | Icon | Description |
|--------|------|-------------|
| Healthy | 🟢 | Node operating normally |
| Syncing | 🟡 | Node is syncing |
| Degraded | 🟠 | Performance issues |
| Offline | 🔴 | Node unreachable |
| Unknown | ⚪ | Status unknown |

### 3. Node Detail View

Deep-dive into individual node performance and configuration.

#### Tabs

1. **Overview** - Key metrics and health status
2. **Metrics** - Historical performance charts
3. **Peers** - Connected peers and network topology
4. **Logs** - Recent log entries
5. **Configuration** - Node settings
6. **Alerts** - Node-specific incidents

#### Metrics Charts

```
┌─────────────────────────────────────────────────────────────────┐
│                    Node Metrics - xdc-node-01                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Time Range: [1h] [6h] [24h] [7d] [30d] [Custom]              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Block Height                                           │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │                                                 │   │   │
│  │  │    ╱╲      ╱╲      ╱╲      ╱╲      ╱╲        │   │   │
│  │  │   ╱  ╲    ╱  ╲    ╱  ╲    ╱  ╲    ╱  ╲       │   │   │
│  │  │  ╱    ╲  ╱    ╲  ╱    ╲  ╱    ╲  ╱    ╲      │   │   │
│  │  │ ╱      ╲╱      ╲╱      ╲╱      ╲╱      ╲     │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │  10:00    12:00    14:00    16:00    18:00           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────┐             │
│  │  CPU Usage          │  │  Memory Usage       │             │
│  │  [Sparkline]        │  │  [Sparkline]        │             │
│  │  Avg: 45%           │  │  Avg: 62%           │             │
│  │  Peak: 78%          │  │  Peak: 85%          │             │
│  └─────────────────────┘  └─────────────────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4. XDPoS 2.0 Monitoring

Specialized view for XDPoS 2.0 consensus monitoring.

#### Epoch View

```
┌─────────────────────────────────────────────────────────────────┐
│                    XDPoS 2.0 - Epoch 99150                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Progress: [████████████████████░░░░░░░░] 67% (603/900)        │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │  Start      │  │  Current    │  │  End        │            │
│  │  89,235,000 │  │  89,235,603 │  │  89,235,900 │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                  │
│  Masternodes: 108/108 active    Vote Participation: 98.5%      │
│  QC Formation: 450ms avg        Timeouts: 2                    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Masternode List                             │   │
│  │  [Table with 108 masternodes, status, performance]      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Consensus Health Score

| Component | Weight | Score |
|-----------|--------|-------|
| QC Formation Time | 30% | 95/100 |
| Vote Participation | 40% | 99/100 |
| Timeout Rate | 30% | 98/100 |
| **Overall** | - | **97/100** |

### 5. Network Topology

Visual representation of node connections and geographic distribution.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Network Topology                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │     🖥️ US-West                    🖥️ EU-Central        │   │
│  │        │                              │                │   │
│  │        │ 45ms                         │ 120ms          │   │
│  │        ▼                              ▼                │   │
│  │     🖥️ US-East ◄──────60ms─────► 🖥️ Asia-Pacific      │   │
│  │        │                              │                │   │
│  │        │ 80ms                         │ 90ms           │   │
│  │        ▼                              ▼                │   │
│  │     🖥️ South-America            🖥️ Africa             │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Legend: 🖥️ Node  │  ─── Connection (latency)                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6. Alerts Management

Centralized view of all alerts with filtering and management capabilities.

#### Alert Card

```
┌─────────────────────────────────────────────────────────────────┐
│  🔴 CRITICAL  Sync Stalled  │  Occurrences: 3                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Node: xdc-node-01 (192.168.1.100)                              │
│  Time: 2026-02-26 12:30:00 UTC                                  │
│  Duration: 15 minutes                                           │
│                                                                  │
│  Description:                                                   │
│  Block sync has stalled at height 89,234,567 for over 10        │
│  minutes. Peer count dropped to 5.                              │
│                                                                  │
│  Diagnostics:                                                   │
│  • Block Height: 89,234,567                                     │
│  • Peer Count: 5 (expected: 25+)                                │
│  • CPU: 45%                                                     │
│  • Memory: 62%                                                  │
│                                                                  │
│  Suggested Solution:                                            │
│  1. Check network connectivity                                  │
│  2. Verify firewall rules                                       │
│  3. Restart node if necessary                                   │
│                                                                  │
│  [View Logs]  [Restart Node]  [Mark Resolved]  [Escalate]      │
└─────────────────────────────────────────────────────────────────┘
```

#### Alert Filters

- **Status**: Open, Resolved, All
- **Severity**: Critical, High, Medium, Low, Info
- **Type**: sync_stall, peer_drop, disk_critical, rpc_error, etc.
- **Time Range**: Last hour, 24h, 7d, 30d, Custom

### 7. Multi-Client Comparison

Compare performance across different XDC clients.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Multi-Client Comparison                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Metric: [Block Height ▼]  Time: [Last 24h ▼]                  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Block Height                                           │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │  ─── Geth    ─ ─ Erigon   ··· Nethermind        │   │   │
│  │  │                                                 │   │   │
│  │  │    ╱╲      ╱╲      ╱╲      ╱╲      ╱╲        │   │   │
│  │  │   ╱  ╲    ╱  ╲    ╱  ╲    ╱  ╲    ╱  ╲       │   │   │
│  │  │  ╱    ╲  ╱    ╲  ╱    ╲  ╱    ╲  ╱    ╲      │   │   │
│  │  │ ╱      ╲╱      ╲╱      ╲╱      ╲╱      ╲     │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌──────────┬─────────┬───────────┬────────────┬───────────┐  │
│  │ Client   │ Avg Sync│ Disk Usage│ Memory Use │ Stability │  │
│  ├──────────┼─────────┼───────────┼────────────┼───────────┤  │
│  │ Geth     │ 2.1s    │ 500GB     │ 4GB        │ 99.9%     │  │
│  │ Erigon   │ 1.8s    │ 400GB     │ 8GB        │ 99.5%     │  │
│  │ Nethermind│ 1.5s   │ 350GB     │ 12GB       │ 99.7%     │  │
│  │ Reth     │ 1.2s    │ 300GB     │ 16GB       │ 98.5%     │  │
│  └──────────┴─────────┴───────────┴────────────┴───────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Dashboard Configuration

### User Preferences

```typescript
interface DashboardPreferences {
  theme: 'dark' | 'light' | 'system';
  refreshInterval: number;  // seconds
  defaultTimeRange: '1h' | '6h' | '24h' | '7d' | '30d';
  alertNotifications: boolean;
  emailAlerts: boolean;
  slackWebhook?: string;
}
```

### Custom Dashboards

Users can create custom dashboards with selected widgets:

1. **Widget Library**:
   - Metric Card
   - Line Chart
   - Bar Chart
   - Pie Chart
   - Node List
   - Alert Feed
   - World Map
   - Status Panel

2. **Layout Options**:
   - Grid layout (responsive)
   - Freeform layout
   - Tabbed sections

## Mobile Responsiveness

The dashboard is fully responsive and optimized for mobile devices.

### Mobile View

```
┌─────────────────────────┐
│  ☰  XDC SkyNet    🔔   │
├─────────────────────────┤
│                         │
│  ┌─────────────────┐   │
│  │  Health: 92/100 │   │
│  │  🟢             │   │
│  └─────────────────┘   │
│                         │
│  Nodes: 10/12 🟢       │
│  Alerts: 2 ⚠️          │
│                         │
│  [Node List]           │
│  ┌─────────────────┐   │
│  │ 🔷 xdc-node-01  │   │
│  │ 🟢 89,234,567   │   │
│  └─────────────────┘   │
│  ┌─────────────────┐   │
│  │ 🔶 xdc-node-02  │   │
│  │ 🟡 Syncing...   │   │
│  └─────────────────┘   │
│                         │
└─────────────────────────┘
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `?` | Show help |
| `r` | Refresh data |
| `f` | Focus search |
| `n` | New node registration |
| `a` | Go to alerts |
| `1-9` | Switch dashboard tabs |
| `Esc` | Close modal/dialog |

## Accessibility

- WCAG 2.1 AA compliant
- Keyboard navigation support
- Screen reader compatible
- High contrast mode
- Font size adjustment

## See Also

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [API.md](./API.md) - API reference
- [ALERTS.md](./ALERTS.md) - Alert configuration
- [METRICS.md](./METRICS.md) - Metrics collection
