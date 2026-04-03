/**
 * ChatOps Telegram Bot
 * Issue: https://github.com/XDCIndia/SkyNet/issues/69
 *
 * Commands: /status, /node <name>, /alerts, /score <name>
 * Auto-sends critical alerts to configured TELEGRAM_CHAT_ID
 */
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? '';
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

import { query } from '@/lib/db';
import { scoreNode } from '@/services/scoring-engine';

async function sendMessage(chatId: string, text: string, parseMode = 'HTML') {
  if (!BOT_TOKEN) return;
  await fetch(`${API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode })
  });
}

export async function handleUpdate(update: any) {
  const msg = update.message;
  if (!msg?.text) return;
  const chatId = msg.chat.id.toString();
  const [cmd, ...args] = msg.text.split(' ');

  switch (cmd) {
    case '/status': {
      const nodes = await query(`SELECT name, client_type, block_number, peer_count, last_seen FROM nodes WHERE last_seen > NOW() - INTERVAL '10 minutes' ORDER BY block_number DESC`);
      const lines = nodes.rows.map((n: any) => `• <b>${n.name}</b> [${n.client_type}] — Block ${n.block_number?.toLocaleString()} | ${n.peer_count} peers`);
      await sendMessage(chatId, `🟢 <b>Fleet Status</b>\n${lines.join('\n') || 'No nodes online'}`);
      break;
    }
    case '/node': {
      const name = args.join(' ');
      const node = await query(`SELECT * FROM nodes WHERE name ILIKE $1 LIMIT 1`, [`%${name}%`]);
      if (!node.rows?.[0]) { await sendMessage(chatId, `❌ Node "${name}" not found`); break; }
      const n = node.rows[0];
      await sendMessage(chatId, `📊 <b>${n.name}</b>\nClient: ${n.client_type}\nBlock: ${n.block_number?.toLocaleString()}\nPeers: ${n.peer_count}\nSync: ${n.sync_percent}%\nLast seen: ${n.last_seen}`);
      break;
    }
    case '/alerts': {
      const alerts = await query(`SELECT * FROM alerts WHERE resolved_at IS NULL ORDER BY created_at DESC LIMIT 10`);
      const lines = alerts.rows.map((a: any) => `🔴 [${a.type}] ${a.node_name} — ${a.message}`);
      await sendMessage(chatId, `⚠️ <b>Active Alerts</b>\n${lines.join('\n') || '✅ No active alerts'}`);
      break;
    }
    case '/score': {
      const name = args.join(' ');
      const node = await query(`SELECT id FROM nodes WHERE name ILIKE $1 LIMIT 1`, [`%${name}%`]);
      if (!node.rows?.[0]) { await sendMessage(chatId, `❌ Node not found`); break; }
      try {
        const score = await scoreNode(node.rows[0].id);
        await sendMessage(chatId, `🏆 <b>${name}</b> Score: ${(score.composite * 100).toFixed(0)}% (${score.grade})\nSync: ${(score.syncScore * 100).toFixed(0)}% | Peers: ${(score.peerScore * 100).toFixed(0)}% | Uptime: ${(score.uptimeScore * 100).toFixed(0)}%`);
      } catch { await sendMessage(chatId, `❌ Could not score node`); }
      break;
    }
    default:
      await sendMessage(chatId, '🤖 Commands: /status, /node <name>, /alerts, /score <name>');
  }
}

export async function sendCriticalAlert(alert: { type: string; nodeName: string; message: string }) {
  if (!CHAT_ID) return;
  await sendMessage(CHAT_ID, `🚨 <b>CRITICAL ALERT</b>\n[${alert.type}] ${alert.nodeName}\n${alert.message}`);
}
