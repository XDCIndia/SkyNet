import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

import { query } from '@/lib/db';

// Use a known healthy node for RPC calls
const RPC_URL = process.env.XDC_RPC_URL || 'http://95.217.56.168:8989';

// Simple in-memory cache
let cache: {
  data: any;
  timestamp: number;
} | null = null;

const CACHE_TTL_MS = 5000; // 5 seconds

async function rpcCall(method: string, params: any[] = []) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  
  if (!res.ok) {
    throw new Error(`RPC error: ${res.status}`);
  }
  
  const data = await res.json();
  
  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }
  
  return data.result;
}

function formatGwei(hexValue: string): string {
  const wei = parseInt(hexValue, 16);
  const gwei = wei / 1e9;
  return `${gwei.toFixed(2)} Gwei`;
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() / 1000) - timestamp);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

/**
 * GET /api/v1/network/stats
 * Returns comprehensive network stats including blocks, gas, epoch, TPS
 */
export async function GET(request: NextRequest) {
  try {
    // Check cache
    if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(cache.data, {
        headers: { 'Cache-Control': 'public, s-maxage=5' },
      });
    }

    // Get active nodes count from database
    const nodesResult = await query(
      `SELECT COUNT(*) as count FROM skynet.nodes WHERE is_active = true`
    );
    const activeNodes = parseInt(nodesResult.rows[0]?.count || '0');

    // Fetch latest block
    const blockNumHex = await rpcCall('eth_blockNumber');
    const blockNum = parseInt(blockNumHex, 16);
    const latestBlock = await rpcCall('eth_getBlockByNumber', [blockNumHex, true]);

    // Fetch gas price
    const gasPriceHex = await rpcCall('eth_gasPrice');
    const gasPrice = formatGwei(gasPriceHex);

    // Fetch difficulty
    const difficultyHex = await rpcCall('eth_getBlockByNumber', [blockNumHex, false]);
    const difficulty = parseInt(difficultyHex?.difficulty || '1', 16).toString();

    // Get last 25 blocks for charts
    const blocks: any[] = [];
    const blockTimes: number[] = [];
    const txsPerBlock: number[] = [];
    const gasPerBlock: number[] = [];
    const lastBlocks: any[] = [];

    // Fetch blocks in parallel for better performance
    const blockPromises = [];
    for (let i = 0; i < 25; i++) {
      const bn = '0x' + (blockNum - i).toString(16);
      blockPromises.push(
        rpcCall('eth_getBlockByNumber', [bn, false]).then(b => ({ index: i, block: b }))
      );
    }

    const blockResults = await Promise.all(blockPromises);
    // Sort by block number descending (newest first)
    blockResults.sort((a, b) => b.index - a.index);

    for (const { index, block } of blockResults) {
      if (!block) continue;
      
      const timestamp = parseInt(block.timestamp, 16);
      const txCount = (block.transactions || []).length;
      const gasUsed = parseInt(block.gasUsed, 16);
      const gasLimit = parseInt(block.gasLimit, 16);
      
      blocks.push({
        number: parseInt(block.number, 16),
        timestamp,
        txCount,
        gasUsed,
        gasLimit,
        hash: block.hash,
        miner: block.miner || block.coinbase,
      });
    }

    // Calculate block times (absolute diff between consecutive blocks)
    for (let i = 1; i < blocks.length; i++) {
      const timeDiff = Math.abs(blocks[i].timestamp - blocks[i - 1].timestamp);
      // Cap at 60 seconds to handle outliers
      const cappedDiff = Math.min(timeDiff, 60);
      blockTimes.push(cappedDiff);
      txsPerBlock.push(blocks[i].txCount);
      gasPerBlock.push(blocks[i].gasUsed);
    }

    // Calculate average block time (filter out zero values)
    const validBlockTimes = blockTimes.filter(t => t > 0);
    const avgBlockTime = validBlockTimes.length > 0
      ? validBlockTimes.reduce((a, b) => a + b, 0) / validBlockTimes.length
      : 2.0;

    // Build last blocks array (most recent first)
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      lastBlocks.push({
        number: b.number,
        hash: b.hash,
        txCount: b.txCount,
        gasUsed: b.gasUsed,
        gasLimit: b.gasLimit,
        time: timeAgo(b.timestamp),
        miner: b.miner ? `${b.miner.slice(0, 11)}...` : 'Unknown',
      });
    }

    // Calculate TPS from recent blocks
    const recentTxCount = txsPerBlock.slice(-10).reduce((a, b) => a + b, 0);
    const tps = avgBlockTime > 0 ? (recentTxCount / 10 / avgBlockTime) : 0;

    // Get pending transactions count (if available)
    let pendingTxs = 0;
    try {
      const pendingCount = await rpcCall('eth_getBlockTransactionCountByNumber', ['pending']);
      pendingTxs = parseInt(pendingCount, 16);
    } catch (e) {
      // Pending count may not be available on all nodes
    }

    // Calculate epoch info (XDC has 900-block epochs)
    const EPOCH_BLOCKS = 900;
    const epochNumber = Math.floor(blockNum / EPOCH_BLOCKS);
    const epochProgress = blockNum % EPOCH_BLOCKS;
    const blocksRemaining = EPOCH_BLOCKS - epochProgress;
    const epochProgressPercent = Math.round((epochProgress / EPOCH_BLOCKS) * 100);

    // Estimate time to next epoch
    const secondsToNextEpoch = blocksRemaining * avgBlockTime;

    // Total transactions (approximation from block)
    const totalTransactions = parseInt(latestBlock?.totalDifficulty || '0', 16) || 0;

    const result = {
      bestBlock: blockNum,
      avgBlockTime: parseFloat(avgBlockTime.toFixed(2)),
      gasPrice,
      gasLimit: parseInt(latestBlock?.gasLimit || '420000000', 16),
      difficulty,
      activeNodes,
      totalTransactions,
      lastBlocks: lastBlocks.slice(0, 25),
      blockTimes: blockTimes.map(t => parseFloat(t.toFixed(2))),
      txsPerBlock,
      gasPerBlock,
      epoch: {
        number: epochNumber,
        progress: epochProgressPercent,
        blocksRemaining,
        secondsToNextEpoch: Math.round(secondsToNextEpoch),
      },
      tps: parseFloat(tps.toFixed(2)),
      pendingTxs,
      timestamp: new Date().toISOString(),
    };

    // Update cache
    cache = {
      data: result,
      timestamp: Date.now(),
    };

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'public, s-maxage=5' },
    });
  } catch (error: any) {
    console.error('Error fetching network stats:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch network stats',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
