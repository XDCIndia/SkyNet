import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, badRequestResponse, hasPermission } from '@/lib/auth';

interface Metric {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp?: string;
}

/**
 * POST /api/v1/nodes/metrics
 * Batch metrics push (Prometheus-style)
 * For metrics-collector.sh to push Prometheus metrics
 * Auth: Bearer API key
 * Body: { nodeId, metrics: Array<{ name, value, labels?, timestamp? }> }
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }

    // Check permission
    if (!hasPermission(auth, 'metrics')) {
      return NextResponse.json(
        { error: 'Insufficient permissions for metrics', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { nodeId, metrics } = body;

    // Validation
    if (!nodeId) {
      return badRequestResponse('Missing required field: nodeId');
    }

    if (!metrics || !Array.isArray(metrics)) {
      return badRequestResponse('Missing or invalid metrics array');
    }

    // Verify node ownership (if using node-specific key)
    if (auth.nodeId && auth.nodeId !== nodeId) {
      return NextResponse.json(
        { error: 'API key does not match nodeId', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    // Process metrics and map to appropriate columns
    const metricMap: Record<string, number | null> = {};
    
    for (const metric of metrics as Metric[]) {
      const value = typeof metric.value === 'number' ? metric.value : parseFloat(metric.value);
      
      // Map common metric names to our schema
      switch (metric.name) {
        case 'xdc_block_height':
          metricMap.block_height = value;
          break;
        case 'xdc_sync_percent':
          metricMap.sync_percent = value;
          break;
        case 'xdc_peer_count':
          metricMap.peer_count = value;
          break;
        case 'xdc_cpu_percent':
          metricMap.cpu_percent = value;
          break;
        case 'xdc_memory_percent':
          metricMap.memory_percent = value;
          break;
        case 'xdc_disk_percent':
          metricMap.disk_percent = value;
          break;
        case 'xdc_disk_used_gb':
          metricMap.disk_used_gb = value;
          break;
        case 'xdc_disk_total_gb':
          metricMap.disk_total_gb = value;
          break;
        case 'xdc_tx_pool_pending':
          metricMap.tx_pool_pending = value;
          break;
        case 'xdc_tx_pool_queued':
          metricMap.tx_pool_queued = value;
          break;
        case 'xdc_gas_price':
          metricMap.gas_price = value;
          break;
        case 'xdc_rpc_latency_ms':
          metricMap.rpc_latency_ms = value;
          break;
      }
    }

    // Insert metrics into database
    await query(
      `INSERT INTO netown.node_metrics 
       (node_id, block_height, sync_percent, peer_count, 
        cpu_percent, memory_percent, disk_percent, disk_used_gb, disk_total_gb,
        tx_pool_pending, tx_pool_queued, gas_price, rpc_latency_ms,
        collected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
      [
        nodeId,
        metricMap.block_height ?? null,
        metricMap.sync_percent ?? null,
        metricMap.peer_count ?? null,
        metricMap.cpu_percent ?? null,
        metricMap.memory_percent ?? null,
        metricMap.disk_percent ?? null,
        metricMap.disk_used_gb ?? null,
        metricMap.disk_total_gb ?? null,
        metricMap.tx_pool_pending ?? null,
        metricMap.tx_pool_queued ?? null,
        metricMap.gas_price ? BigInt(metricMap.gas_price) : null,
        metricMap.rpc_latency_ms ?? null,
      ]
    );

    return NextResponse.json({
      ok: true,
      metricsReceived: metrics.length,
    });
  } catch (error: any) {
    console.error('Error processing metrics:', error);
    
    return NextResponse.json(
      { error: 'Failed to process metrics', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
