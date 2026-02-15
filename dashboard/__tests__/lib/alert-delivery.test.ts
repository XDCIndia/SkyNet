import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { deliverAlert, deliverResolution } from '@/lib/alert-delivery';
import { mockQuery } from '@/lib/test-utils';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockIncident = {
  id: 1,
  node_id: '550e8400-e29b-41d4-a716-446655440000',
  type: 'sync_stall',
  severity: 'critical' as const,
  title: 'Block sync stalled',
  description: 'Block height unchanged for 5+ minutes',
  detected_at: new Date().toISOString(),
  status: 'active',
};

const mockNode = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'test-node-1',
  ipv4: '1.2.3.4',
  role: 'masternode',
};

describe('Alert Delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
    process.env.TELEGRAM_CHAT_ID = '-100123456';
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
    delete process.env.WEBHOOK_URL;
  });

  it('should deliver alert via Telegram using env vars', async () => {
    // Mock: loadAlertChannels DB query (fails, falls back to env), then logAlertHistory
    mockQuery
      .mockRejectedValueOnce(new Error('no table'))
      .mockResolvedValueOnce({ rows: [] });

    mockFetch.mockResolvedValueOnce({ ok: true });

    const result = await deliverAlert(mockIncident, mockNode, {
      blockHeight: 1000,
      peerCount: 5,
    });

    expect(result.channelsAttempted).toBe(1);
    expect(result.channelsSucceeded).toBe(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('api.telegram.org/bottest-bot-token/sendMessage'),
      expect.any(Object)
    );
  });

  it('should report no channels when none configured', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;

    mockQuery.mockRejectedValueOnce(new Error('no table'));

    const result = await deliverAlert(mockIncident, mockNode);

    expect(result.channelsAttempted).toBe(0);
    expect(result.success).toBe(false);
  });

  it('should deliver resolution notification', async () => {
    mockQuery.mockRejectedValueOnce(new Error('no table'));
    mockFetch.mockResolvedValueOnce({ ok: true });

    const result = await deliverResolution(
      { ...mockIncident, status: 'resolved' },
      mockNode,
      'Block height recovered: 1000 → 1050'
    );

    expect(result.channelsSucceeded).toBe(1);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('RESOLVED');
  });
});
