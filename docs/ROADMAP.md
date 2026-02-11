# XDCNetOwn Roadmap

## Vision

The definitive network monitoring and management platform for XDC Network — from 3 nodes to 3000.

We are building the infrastructure that will power the XDC Network's growth, providing operators with the observability they need to maintain a healthy, decentralized blockchain. Our goal is to be the **Datadog of blockchain node monitoring** — but purpose-built for XDC, open source, and cost-effective at scale.

---

## Phase 1: Foundation ✅ (Current)

**Status:** In Production  
**Nodes:** 3  
**Timeline:** Completed Q4 2025

### Delivered
- ✅ Dashboard with real-time fleet monitoring (Next.js + PostgreSQL)
- ✅ Heartbeat agent (`netown-agent.sh`) on 3 production servers
- ✅ PostgreSQL-backed node registry with health status
- ✅ Masternode integration via XDCValidator contract
- ✅ Healthy peer list with automated port checking
- ✅ Auto-incident detection and Telegram alerts
- ✅ Agent integration guide and documentation

### Architecture
```
┌─────────┐ ┌─────────┐ ┌─────────┐
│ Node 1  │ │ Node 2  │ │ Node 3  │
└────┬────┘ └────┬────┘ └────┬────┘
     │           │           │
     └───────────┼───────────┘
                 ▼
        ┌─────────────────┐
        │  XDCNetOwn API  │
        │   (Next.js)     │
        └────────┬────────┘
                 ▼
        ┌─────────────────┐
        │   PostgreSQL    │
        │  (Fleet + Data) │
        └─────────────────┘
```

---

## Phase 2: Scale to 50 Nodes (Q1 2026)

**Goal:** Validate queue-based architecture, improve reliability  
**Target:** 50 monitored nodes  
**Estimated Cost:** $100/month

### Deliverables

#### Agent v2 (Go Binary)
- [ ] Rewrite `netown-agent` in Go (cross-platform, single binary)
- [ ] Local metric buffering (survive network blips)
- [ ] Auto-discovery of node type (geth/erigon/XDC)
- [ ] Configurable push interval (30s default, 10s min)
- [ ] Self-update capability
- [ ] Resource budget: <50MB RAM, <1% CPU

#### Infrastructure
- [ ] Deploy NATS message queue cluster (3-node HA)
- [ ] Migrate metrics to TimescaleDB (PostgreSQL extension)
- [ ] Add Redis for real-time state caching
- [ ] Deploy Prometheus for internal monitoring

#### Dashboard Enhancements
- [ ] Replace polling with Server-Sent Events (SSE)
- [ ] Virtual scrolling for node lists (handles 1000+ rows)
- [ ] World map with node geolocation (Leaflet + OpenStreetMap)
- [ ] Alert notification system (Telegram, Slack, webhook)
- [ ] Basic filtering and search

#### API v2
- [ ] Queue consumer architecture (decouple from direct HTTP)
- [ ] Rate limiting per API key
- [ ] Improved error handling and retry logic

### Architecture Changes
```
┌─────────┐ ┌─────────┐ ┌─────────┐
│ Node 1  │ │ Node 2  │ │ ... 50  │
│ (agent) │ │ (agent) │ │ (agent) │
└────┬────┘ └────┬────┘ └────┬────┘
     │           │           │
     └───────────┼───────────┘
                 ▼ gRPC/HTTP2
        ┌─────────────────┐
        │  NATS Queue     │
        │  (3-node HA)    │
        └────────┬────────┘
                 ▼
        ┌─────────────────┐
        │  XDCNetOwn API  │
        │   (v2 - SSE)    │
        └────────┬────────┘
                 ▼
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌────────┐  ┌──────────┐  ┌────────┐
│PostgreSQL│  │TimescaleDB│  │ Redis  │
│(Fleet)  │  │(Metrics)  │  │(Cache) │
└────────┘  └──────────┘  └────────┘
```

---

## Phase 3: Regional Architecture (Q2 2026)

**Goal:** Geographic distribution, enterprise reliability  
**Target:** 200 monitored nodes  
**Estimated Cost:** $500/month

### Deliverables

#### Regional Collectors
- [ ] Deploy regional Prometheus collectors:
  - [ ] EU-West (Amsterdam)
  - [ ] US-East (Virginia)
  - [ ] Asia-Pacific (Singapore)
- [ ] Thanos federation for global query view
- [ ] Regional failover and HA

#### Advanced Alerting
- [ ] Anomaly detection (statistical, not just thresholds)
- [ ] Escalation policies (warn → alert → page)
- [ ] PagerDuty integration
- [ ] Alert grouping and deduplication
- [ ] On-call rotation support

#### Reporting
- [ ] Weekly/monthly PDF report generation
- [ ] SLA compliance tracking
- [ ] Uptime reports with board-ready summaries
- [ ] Scheduled report delivery

#### Multi-Tenancy
- [ ] Organization isolation
- [ ] Role-based access control (RBAC)
- [ ] Team management
- [ ] API key per organization

### Architecture Changes
```
                       ┌─────────────┐
                       │   Thanos    │
                       │   Query     │
                       └──────┬──────┘
                              │
           ┌──────────────────┼──────────────────┐
           │                  │                  │
           ▼                  ▼                  ▼
    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
    │ EU-West     │    │ US-East     │    │ Asia-Pacific│
    │ Collector   │    │ Collector   │    │ Collector   │
    │(Prometheus) │    │(Prometheus) │    │(Prometheus) │
    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘
           │                  │                  │
    ┌──────┴──────┐    ┌──────┴──────┐    ┌──────┴──────┐
    │ Local Nodes │    │ Local Nodes │    │ Local Nodes │
    │ 60-70 nodes │    │ 60-70 nodes │    │ 60-70 nodes │
    └─────────────┘    └─────────────┘    └─────────────┘
           │                  │                  │
           └──────────────────┼──────────────────┘
                              ▼
                    ┌─────────────────┐
                    │   Central API   │
                    └────────┬────────┘
                             ▼
                   ┌─────────────────┐
                   │  PostgreSQL +   │
                   │  TimescaleDB    │
                   └─────────────────┘
```

---

## Phase 4: Enterprise (Q3 2026)

**Goal:** Production-ready for large operators  
**Target:** 1000+ monitored nodes  
**Estimated Cost:** $2000/month

### Deliverables

#### Infrastructure
- [ ] Kubernetes deployment (EKS/GKE/self-hosted)
- [ ] Auto-scaling API pods (HPA)
- [ ] ClickHouse for high-cardinality analytics
- [ ] Global CDN for dashboard (CloudFlare)
- [ ] Disaster recovery with multi-region failover

#### Enterprise Features
- [ ] White-label dashboard support
- [ ] SSO/SAML integration (Okta, Azure AD)
- [ ] Audit logging and compliance reporting
- [ ] SLA monitoring with contractual guarantees
- [ ] Advanced RBAC with custom roles

#### Mobile
- [ ] React Native mobile app (iOS + Android)
- [ ] Push notifications for critical alerts
- [ ] Mobile-optimized dashboards

#### Security
- [ ] mTLS for all agent communication
- [ ] Hardware security module (HSM) support
- [ ] SOC 2 Type II compliance
- [ ] Penetration testing and security audit

---

## Phase 5: Network Intelligence (Q4 2026)

**Goal:** Predictive monitoring, network-wide analytics  
**Target:** 3000+ monitored nodes

### Deliverables

#### Network Crawler
- [ ] P2P network crawler for topology discovery
- [ ] Passive peer quality scoring
- [ ] Geographic distribution analysis
- [ ] Network partition detection

#### Analytics
- [ ] Consensus participation analytics
- [ ] Nakamoto coefficient tracking
- [ ] Delegation flow visualization
- [ ] Network health score (composite metric)

#### Machine Learning
- [ ] Predictive alerting (forecast failures before they happen)
- [ ] Anomaly detection at scale
- [ ] Capacity planning recommendations
- [ ] Auto-remediation for common issues

#### Cross-Chain
- [ ] Support for XDC subnets
- [ ] Cross-chain monitoring framework
- [ ] Bridge monitoring (if applicable)

---

## Migration Timeline

```
2025 Q4    2026 Q1        2026 Q2         2026 Q3         2026 Q4
   │          │              │               │               │
   ▼          ▼              ▼               ▼               ▼
┌─────┐   ┌────────┐    ┌─────────┐     ┌─────────┐     ┌──────────┐
│Phase│   │ Phase  │    │ Phase   │     │ Phase   │     │ Phase    │
│  1  │   │   2    │    │   3     │     │   4     │     │   5      │
│     │   │        │    │         │     │         │     │          │
│ 3   │ → │  50    │ →  │  200    │ →   │  1000   │ →   │  3000+   │
│nodes│   │ nodes  │    │ nodes   │     │ nodes   │     │ nodes    │
└─────┘   └────────┘    └─────────┘     └─────────┘     └──────────┘
             │               │                │               │
             ▼               ▼                ▼               ▼
         Go agent       Regional        Kubernetes       ML/AI
         NATS queue     collectors      White-label      Cross-chain
         TimescaleDB    Thanos          SSO/SAML         P2P crawler
```

---

## Success Metrics

| Metric | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|--------|---------|---------|---------|---------|---------|
| Nodes monitored | 3 | 50 | 200 | 1000 | 3000 |
| API uptime | 99% | 99.5% | 99.9% | 99.95% | 99.99% |
| P95 query latency | 500ms | 300ms | 200ms | 150ms | 100ms |
| Alert latency | 5 min | 2 min | 1 min | 30s | Real-time |
| Cost per node/mo | - | $2 | $2.50 | $2 | $1 |
| Self-serve onboarding | Manual | Semi-auto | Auto | Auto | Auto |

---

## Technical Debt & Maintenance

### Continuous Improvements
- [ ] Monthly dependency updates
- [ ] Quarterly security audits
- [ ] Annual architecture review
- [ ] Performance regression testing

### Deprecation Schedule
| Component | Current | Replacement | EOL Date |
|-----------|---------|-------------|----------|
| Bash agent | v1.x | Go agent v2 | Q2 2026 |
| Direct HTTP push | v1 API | NATS queue | Q2 2026 |
| Polling dashboard | v1 UI | SSE dashboard | Q1 2026 |

---

## Contributing

This roadmap is a living document. To propose changes:
1. Open an issue with the `roadmap` label
2. Discuss in Discord #dev channel
3. Submit PR to update this document

---

*Last updated: February 2026*  
*Next review: May 2026*
