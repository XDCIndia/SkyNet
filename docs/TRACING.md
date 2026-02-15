# Distributed Tracing with OpenTelemetry

This guide covers adding distributed tracing to XDCNetOwn using OpenTelemetry.

## Overview

OpenTelemetry provides end-to-end request tracing across the dashboard, API, and agent components. Traces help identify latency bottlenecks and debug failures across services.

## Setup

### 1. Install Dependencies

```bash
cd dashboard
npm install @opentelemetry/sdk-node @opentelemetry/api \
  @opentelemetry/exporter-trace-otlp-http \
  @opentelemetry/instrumentation-http \
  @opentelemetry/instrumentation-fetch \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions
```

### 2. Initialize Tracing

In your app entry point (e.g., `instrumentation.ts` for Next.js):

```typescript
import { initTracing } from '@/lib/tracing';
initTracing();
```

### 3. Manual Instrumentation

```typescript
import { withSpan } from '@/lib/tracing';

// Wrap any async operation
const metrics = await withSpan('db.getNodeMetrics', async (span) => {
  span.setAttribute('node_id', nodeId);
  return await db.query('SELECT * FROM node_metrics WHERE node_id = $1', [nodeId]);
});
```

## Collector Setup

### Docker Compose (Jaeger)

```yaml
services:
  jaeger:
    image: jaegertracing/all-in-one:1.53
    ports:
      - "16686:16686"  # Jaeger UI
      - "4318:4318"    # OTLP HTTP receiver
    environment:
      COLLECTOR_OTLP_ENABLED: "true"
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `OTEL_SERVICE_NAME` | `xdcnet-dashboard` | Service name in traces |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OTLP collector URL |

## Architecture

```
Dashboard (Next.js)  ──→  OTLP Collector  ──→  Jaeger / Grafana Tempo
Agent (Go)           ──→       ↑
```

## Next Steps

- [ ] Add tracing to Go agent (go.opentelemetry.io/otel)
- [ ] Instrument database queries
- [ ] Add trace context propagation to heartbeat API
- [ ] Connect to Grafana Tempo for production
