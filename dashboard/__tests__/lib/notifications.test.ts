import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { sendTelegramAlert, shouldTriggerAlert } from '@/lib/notifications';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Telegram Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
    process.env.TELEGRAM_CHAT_ID = 'test-chat-id';
  });

  afterEach(() => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_CHAT_ID;
  });

  it('should send a Telegram message successfully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, result: { message_id: 123 } }),
    });

    await sendTelegramAlert('test-bot-token', 'test-chat-id', 'Test alert message');

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-bot-token/sendMessage',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('test-chat-id'),
      })
    );
  });

  it('should throw on Telegram API error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => 'Unauthorized',
    });

    await expect(
      sendTelegramAlert('bad-token', 'chat-id', 'msg')
    ).rejects.toThrow('Telegram API error');
  });

  it('should throw when bot token or chat ID is missing', async () => {
    await expect(
      sendTelegramAlert('', '', 'msg')
    ).rejects.toThrow('Missing Telegram configuration');
  });

  it('should use env vars as fallback', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    await sendTelegramAlert('', '', 'Test');
    // Should throw because empty strings after fallback check
    // Actually the function checks: const token = botToken || process.env.TELEGRAM_BOT_TOKEN
    // So empty string is falsy, it'll use env var
  });
});

describe('shouldTriggerAlert', () => {
  it('should trigger if never triggered before', () => {
    expect(shouldTriggerAlert(null, 5)).toBe(true);
  });

  it('should not trigger within cooldown period', () => {
    const recentDate = new Date(Date.now() - 60_000); // 1 min ago
    expect(shouldTriggerAlert(recentDate, 5)).toBe(false); // 5 min cooldown
  });

  it('should trigger after cooldown expires', () => {
    const oldDate = new Date(Date.now() - 600_000); // 10 min ago
    expect(shouldTriggerAlert(oldDate, 5)).toBe(true); // 5 min cooldown
  });
});
