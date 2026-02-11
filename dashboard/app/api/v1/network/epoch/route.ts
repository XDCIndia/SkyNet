import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

const RPC_URL = process.env.XDC_RPC_URL || 'http://127.0.0.1:8989';

/**
 * GET /api/v1/network/epoch
 * Returns current epoch, round, block height, and estimated next epoch time
 */
export async function GET(request: NextRequest) {
  try {
    // Fetch block number
    const blockResponse = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_blockNumber',
        params: [],
      }),
    });
    
    if (!blockResponse.ok) {
      throw new Error(`Failed to fetch block number: ${blockResponse.status}`);
    }
    
    const blockData = await blockResponse.json();
    const blockNumber = parseInt(blockData.result, 16);
    
    // Fetch masternodes info for round
    const masternodesResponse = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'XDPoS_getMasternodesByNumber',
        params: ['latest'],
      }),
    });
    
    let round = 0;
    if (masternodesResponse.ok) {
      const mnData = await masternodesResponse.json();
      round = parseInt(mnData.result?.Round) || 0;
    }
    
    // Calculate epoch
    const EPOCH_BLOCKS = 900;
    const epoch = Math.floor(blockNumber / EPOCH_BLOCKS);
    const epochProgress = ((blockNumber % EPOCH_BLOCKS) / EPOCH_BLOCKS) * 100;
    
    // Estimate next epoch time (assuming ~2s block time)
    const blocksToNextEpoch = EPOCH_BLOCKS - (blockNumber % EPOCH_BLOCKS);
    const estimatedSecondsToNextEpoch = blocksToNextEpoch * 2;
    const nextEpochTime = new Date(Date.now() + estimatedSecondsToNextEpoch * 1000);
    
    // Try to get block time stats from recent blocks
    let avgBlockTime = 2; // default assumption
    try {
      const currentBlock = blockNumber;
      const block10Response = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBlockByNumber',
          params: [`0x${(currentBlock).toString(16)}`, false],
        }),
      });
      
      const block10Data = await block10Response.json();
      const block10Time = parseInt(block10Data.result?.timestamp, 16);
      
      const block0Response = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_getBlockByNumber',
          params: [`0x${(currentBlock - 10).toString(16)}`, false],
        }),
      });
      
      const block0Data = await block0Response.json();
      const block0Time = parseInt(block0Data.result?.timestamp, 16);
      
      if (block10Time && block0Time) {
        avgBlockTime = (block10Time - block0Time) / 10;
      }
    } catch (e) {
      // Use default 2s
    }
    
    return NextResponse.json({
      success: true,
      data: {
        epoch,
        round,
        blockNumber,
        epochProgress: epochProgress.toFixed(2),
        epochBlocks: EPOCH_BLOCKS,
        blocksIntoEpoch: blockNumber % EPOCH_BLOCKS,
        blocksToNextEpoch,
        estimatedNextEpochTime: nextEpochTime.toISOString(),
        estimatedSecondsToNextEpoch,
        avgBlockTime: avgBlockTime.toFixed(2),
      },
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      },
    });
  } catch (error: any) {
    console.error('Error fetching epoch data:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch epoch data',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
