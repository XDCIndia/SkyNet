/**
 * Ethstats node scraper — connects to XDC stats server via WebSocket
 * and collects all registered node names, block heights, peer counts.
 *
 * stats.xinfin.network is behind Cloudflare (blocks server WS).
 * Direct connection to the raw stats server IP works: ws://45.82.64.150:3000
 */

import WebSocket from 'ws';

const ETHSTATS_WS = 'ws://45.82.64.150:3000/primus/';
const COLLECT_DURATION_MS = 10_000; // 10 seconds to collect all node updates
const WS_TIMEOUT_MS = 15_000;

export interface EthstatsNode {
  name: string;
  blockNumber: number;
  peers: number;
  active: boolean;
  mining: boolean;
  syncing: boolean;
  latency: number;
  uptime: number;
  miner?: string;       // coinbase from block data
  gasUsed?: number;
  gasLimit?: number;
}

export interface EthstatsResult {
  nodes: EthstatsNode[];
  totalCollected: number;
  messagesProcessed: number;
  scrapedAt: string;
  error?: string;
}

export async function scrapeEthstats(): Promise<EthstatsResult> {
  return new Promise((resolve) => {
    const nodes = new Map<string, Partial<EthstatsNode>>();
    let msgCount = 0;
    let startTime = 0;

    const ws = new WebSocket(ETHSTATS_WS + '?_primuscb=' + Date.now() + '-0', {
      headers: {
        'Origin': 'https://stats.xinfin.network',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      handshakeTimeout: 8000,
    });

    const cleanup = () => {
      try { ws.close(); } catch {}
    };

    const finish = () => {
      cleanup();
      const result: EthstatsNode[] = [];
      for (const [name, data] of nodes) {
        result.push({
          name,
          blockNumber: data.blockNumber || 0,
          peers: data.peers || 0,
          active: data.active ?? false,
          mining: data.mining ?? false,
          syncing: data.syncing ?? false,
          latency: data.latency || 0,
          uptime: data.uptime || 0,
          miner: data.miner,
          gasUsed: data.gasUsed,
          gasLimit: data.gasLimit,
        });
      }
      // Sort by block number descending
      result.sort((a, b) => b.blockNumber - a.blockNumber);
      resolve({
        nodes: result,
        totalCollected: result.length,
        messagesProcessed: msgCount,
        scrapedAt: new Date().toISOString(),
      });
    };

    const wsTimeout = setTimeout(() => {
      finish();
    }, WS_TIMEOUT_MS);

    ws.on('open', () => {
      startTime = Date.now();
      // Set timer to finish collecting after COLLECT_DURATION_MS
      setTimeout(() => {
        clearTimeout(wsTimeout);
        finish();
      }, COLLECT_DURATION_MS);
    });

    ws.on('message', (data: WebSocket.Data) => {
      msgCount++;
      try {
        const msg = JSON.parse(data.toString());
        const action = msg.action;
        const id = msg.data?.id;

        if (!id) return;

        if (!nodes.has(id)) {
          nodes.set(id, { name: id });
        }
        const node = nodes.get(id)!;

        switch (action) {
          case 'stats': {
            const s = msg.data.stats;
            if (s) {
              node.active = s.active;
              node.mining = s.mining;
              node.syncing = s.syncing;
              node.peers = parseInt(s.peers) || 0;
              node.latency = parseInt(s.latency) || 0;
              node.uptime = parseInt(s.uptime) || 0;
            }
            break;
          }
          case 'block': {
            const b = msg.data.block;
            if (b) {
              node.blockNumber = b.number || 0;
              node.miner = b.miner;
              node.gasUsed = b.gasUsed || 0;
              node.gasLimit = b.gasLimit || 0;
            }
            break;
          }
          case 'info': {
            const info = msg.data.info;
            if (info) {
              // ethstats doesn't expose IPs in the info message to dashboard clients
              // but may contain node version
            }
            break;
          }
        }
      } catch {
        // Non-JSON primus messages (pings, etc.)
      }
    });

    ws.on('error', (err: Error) => {
      clearTimeout(wsTimeout);
      resolve({
        nodes: [],
        totalCollected: 0,
        messagesProcessed: msgCount,
        scrapedAt: new Date().toISOString(),
        error: err.message,
      });
    });
  });
}
