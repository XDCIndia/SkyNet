import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/v1/nodes/metrics/route';
import { createAuthenticatedRequest, mockQuery } from '@/lib/test-utils';

describe('POST /api/v1/nodes/metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should accept valid metrics batch', async () => {
    mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

    const req = createAuthenticatedRequest('POST', '/api/v1/nodes/metrics', {
      body: {
        nodeId: '550e8400-e29b-41d4-a716-446655440000',
        metrics: [
          { name: 'cpu_usage', value: 45.2 },
          { name: 'memory_usage', value: 62.1, labels: { host: 'node1' } },
        ],
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('should return 400 when nodeId is missing', async () => {
    const req = createAuthenticatedRequest('POST', '/api/v1/nodes/metrics', {
      body: {
        metrics: [{ name: 'cpu_usage', value: 45.2 }],
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should return 401 without valid auth', async () => {
    const req = createAuthenticatedRequest('POST', '/api/v1/nodes/metrics', {
      apiKey: 'invalid_key',
      body: {
        nodeId: '550e8400-e29b-41d4-a716-446655440000',
        metrics: [],
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
