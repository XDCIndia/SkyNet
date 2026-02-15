import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/v1/alerts/notify/route';
import { createAuthenticatedRequest, mockQuery } from '@/lib/test-utils';

// Mock the notifications module
vi.mock('@/lib/notifications', () => ({
  sendAlertNotification: vi.fn().mockResolvedValue(undefined),
  sendTelegramAlert: vi.fn().mockResolvedValue(undefined),
}));

describe('POST /api/v1/alerts/notify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send notification for a valid alert', async () => {
    // Mock: auth check, then alert query
    mockQuery
      .mockResolvedValueOnce({ id: 1, type: 'sync_stall', severity: 'critical', title: 'Sync stalled', node_id: 'n1', node_name: 'test-node', detected_at: new Date().toISOString() });

    const req = createAuthenticatedRequest('POST', '/api/v1/alerts/notify', {
      body: {
        alertId: 1,
        channels: ['telegram'],
      },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should return 404 for non-existent alert', async () => {
    mockQuery.mockResolvedValueOnce(null);

    const req = createAuthenticatedRequest('POST', '/api/v1/alerts/notify', {
      body: {
        alertId: 99999,
        channels: ['telegram'],
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it('should return 401 without authentication', async () => {
    const req = createAuthenticatedRequest('POST', '/api/v1/alerts/notify', {
      apiKey: 'invalid_key',
      body: {
        alertId: 1,
        channels: ['telegram'],
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
