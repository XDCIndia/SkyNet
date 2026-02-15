/**
 * OpenTelemetry Distributed Tracing Setup for XDCNetOwn Dashboard
 *
 * Usage:
 *   import { initTracing } from '@/lib/tracing';
 *   initTracing();  // Call once at app startup
 *
 * Install dependencies:
 *   npm install @opentelemetry/sdk-node @opentelemetry/api \
 *     @opentelemetry/exporter-trace-otlp-http \
 *     @opentelemetry/instrumentation-http \
 *     @opentelemetry/instrumentation-fetch \
 *     @opentelemetry/resources \
 *     @opentelemetry/semantic-conventions
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { Resource } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions";
import { trace, SpanStatusCode, type Span } from "@opentelemetry/api";

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || "xdcnet-dashboard";
const OTLP_ENDPOINT =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318";

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry tracing. Call once at application startup.
 */
export function initTracing(): void {
  if (sdk) return; // Already initialized

  const exporter = new OTLPTraceExporter({
    url: `${OTLP_ENDPOINT}/v1/traces`,
  });

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: SERVICE_NAME,
      [ATTR_SERVICE_VERSION]: process.env.npm_package_version || "0.0.0",
    }),
    traceExporter: exporter,
    instrumentations: [
      new HttpInstrumentation(),
      new FetchInstrumentation(),
    ],
  });

  sdk.start();
  console.log(`[tracing] OpenTelemetry initialized → ${OTLP_ENDPOINT}`);

  // Graceful shutdown
  process.on("SIGTERM", () => sdk?.shutdown());
  process.on("SIGINT", () => sdk?.shutdown());
}

/**
 * Get a tracer instance for manual instrumentation.
 */
export function getTracer(name = SERVICE_NAME) {
  return trace.getTracer(name);
}

/**
 * Wrap an async function in a span for easy tracing.
 *
 * Example:
 *   const result = await withSpan('fetchNodeMetrics', async (span) => {
 *     span.setAttribute('node_id', nodeId);
 *     return await db.query(...);
 *   });
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}
