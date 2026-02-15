import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/v1/network/health/route';
import { createMockRequest, createAuthenticatedRequest, mockQuery } from '@/lib/test-utils';

describe('GET /api/v1/network/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty health data when no nodes are reporting', async () => {
    // First call: metrics query returns empty
    mockQuery.mockResolvedValue([]);

    const req = createMockRequest('GET', '/api/v1/network/health', {
      headers: { 'x-dashboard-read': '1' },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.totalNodes).toBe(0);
    expect(data.data.healthyNodes).toBe(0);
    expect(data.data.avgBlockHeight).toBe(0);
  });

  it('should compute aggregates from multiple nodes', async () => {
    const metricsRows = [
      { node_id: 'n1', block_height: 1000, peer_count: 10, sync_percent: 100, rpc_latency_ms: 50, cpu_percent: 30, is_syncing: false },
      { node_id: 'n2', block_height: 999, peer_count: 8, sync_percent: 99.5, rpc_latency_ms: 80, cpu_percent: 40, is_syncing: false },
      { node_id: 'n3', block_height: 998, peer_count: 5, sync_percent: 100, rpc_latency_ms: 60, cpu_percent: 20, is_syncing: false },
    ];

    // First call returns metrics, second call (INSERT into network_health) returns nothing
    mockQuery
      .mockResolvedValueOnce(metricsRows)
      .mockResolvedValueOnce([]);

    const req = createMockRequest('GET', '/api/v1/network/health', {
      headers: { 'x-dashboard-read': '1' },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.totalNodes).toBe(3);
    expect(data.data.healthyNodes).toBe(3);
    expect(data.data.maxBlockHeight).toBe(1000);
    expect(data.data.totalPeers).toBe(23);
    expect(data.data.nakamotoCoefficient).toBeGreaterThanOrEqual(1);
    expect(data.data.timestamp).toBeDefined();
  });

  it('should correctly identify degraded nodes', async () => {
    const metricsRows = [
      { node_id: 'n1', block_height: 1000, peer_count: 10, sync_percent: 100, rpc_latency_ms: 50, cpu_percent: 30, is_syncing: false },
      { node_id: 'n2', block_height: 500, peer_count: 0, sync_percent: 50, rpc_latency_ms: 200, cpu_percent: 90, is_syncing: true },
    ];

    mockQuery
      .mockResolvedValueOnce(metricsRows)
      .mockResolvedValueOnce([]);

    const req = createMockRequest('GET', '/api/v1/network/health', {
      headers: { 'x-dashboard-read': '1' },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.totalNodes).toBe(2);
    expect(data.data.healthyNodes).toBe(1); // Only n1 is healthy
  });

  it('should handle database errors gracefully', async () => {
    mockQuery.mockRejectedValue(new Error('DB connection failed'));

    const req = createMockRequest('GET', '/api/v1/network/health', {
      headers: { 'x-dashboard-read': '1' },
    });

    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});
