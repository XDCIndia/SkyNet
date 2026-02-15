import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TelegramBot } from '@/lib/telegram';

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('TelegramBot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = 'test-token-123';
    process.env.TELEGRAM_CHAT_ID = '-100999';
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it('should detect when configured', () => {
    const bot = new TelegramBot();
    expect(bot.isConfigured()).toBe(true);
  });

  it('should detect when not configured', () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const bot = new TelegramBot();
    expect(bot.isConfigured()).toBe(false);
  });

  it('should accept explicit config over env vars', () => {
    const bot = new TelegramBot({ botToken: 'custom', chatId: '-111' });
    expect(bot.isConfigured()).toBe(true);
  });

  it('should send message successfully', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const bot = new TelegramBot();

    const result = await bot.sendMessage('Hello');

    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token-123/sendMessage',
      expect.objectContaining({ method: 'POST' })
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.chat_id).toBe('-100999');
    expect(body.text).toBe('Hello');
    expect(body.parse_mode).toBe('HTML');
  });

  it('should return false on API error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, text: async () => 'Forbidden' });
    const bot = new TelegramBot();

    const result = await bot.sendMessage('fail');
    expect(result).toBe(false);
  });

  it('should return false when not configured', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    const bot = new TelegramBot();

    const result = await bot.sendMessage('skip');
    expect(result).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should format and send alert', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const bot = new TelegramBot();

    const result = await bot.sendAlert({
      severity: 'critical',
      type: 'sync_stall',
      title: 'Block sync stalled',
      nodeName: 'node-1',
      nodeId: '550e8400-e29b-41d4-a716-446655440000',
      metrics: { blockHeight: 1000, peerCount: 3 },
    });

    expect(result).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('CRITICAL');
    expect(body.text).toContain('Sync Stall');
    expect(body.text).toContain('node-1');
  });

  it('should send resolution notification', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const bot = new TelegramBot();

    const result = await bot.sendResolution(
      { severity: 'warning', type: 'peer_drop', title: 'Low peers', nodeName: 'node-2' },
      'Peer count recovered to 8'
    );

    expect(result).toBe(true);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('RESOLVED');
    expect(body.text).toContain('Peer Drop');
    expect(body.text).toContain('recovered to 8');
  });

  it('should handle network errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const bot = new TelegramBot();

    const result = await bot.sendMessage('test');
    expect(result).toBe(false);
  });
});
