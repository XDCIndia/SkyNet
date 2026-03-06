import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://gateway:gateway@localhost:5433/xdc_gateway'
});

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();

    // Support both official agent format and legacy format
    const nodeId     = body.nodeId;
    const blockHeight = body.blockHeight ?? 0;
    const peerCount  = body.peerCount ?? 0;
    const network    = body.network ?? 'mainnet';
    const isSyncing  = body.syncing ?? body.isSyncing ?? false;
    const clientType = body.clientType ?? 'unknown';

    // Rich fields from official skynet-agent.sh
    const sys        = body.system ?? {};
    const cpuPct     = sys.cpuPercent   ?? body.cpuPercent    ?? 0;
    const memPct     = sys.memoryPercent?? body.memoryPercent ?? 0;
    const diskPct    = sys.diskPercent  ?? body.diskPercent   ?? 0;
    const diskUsed   = sys.diskUsedGb   ?? 0;
    const diskTotal  = sys.diskTotalGb  ?? 0;
    const txPending  = body.txPool?.pending ?? 0;
    const txQueued   = body.txPool?.queued  ?? 0;
    const gasPrice   = body.gasPrice ? parseInt(body.gasPrice, 16) || 0 : 0;
    const rpcLatency = body.rpcLatencyMs ?? 0;
    const syncPct    = body.syncProgress ?? null;
    const coinbase   = body.coinbase  ?? null;
    const clientVer  = body.clientVersion ?? null;
    const nodeType   = body.nodeType  ?? 'fullnode';
    const ipv4       = body.ipv4      ?? null;
    const osType     = body.os?.type     ?? null;
    const osRelease  = body.os?.release  ?? null;
    const osArch     = body.os?.arch     ?? null;
    const kernelVer  = body.os?.kernel   ?? null;
    const secScore   = body.security?.score ?? null;

    if (!nodeId) {
      return NextResponse.json({ success: false, error: 'nodeId required' }, { status: 400 });
    }

    // Upsert node record — never downgrade network from apothem→mainnet
    await client.query(
      `INSERT INTO skynet.nodes
         (id, name, network, status, last_heartbeat, client_type, ipv4, coinbase, is_active)
       VALUES ($1, $2, $3, 'active', NOW(), $4, $5, $6, true)
       ON CONFLICT (id) DO UPDATE SET
         network        = CASE
                            WHEN skynet.nodes.network = 'apothem' THEN 'apothem'
                            ELSE EXCLUDED.network
                          END,
         status         = 'active',
         last_heartbeat = NOW(),
         client_type    = EXCLUDED.client_type,
         ipv4           = COALESCE(EXCLUDED.ipv4, skynet.nodes.ipv4),
         coinbase       = COALESCE(EXCLUDED.coinbase, skynet.nodes.coinbase)`,
      [nodeId, nodeId, network, clientType, ipv4, coinbase]
    );

    // Insert full metrics row
    await client.query(
      `INSERT INTO skynet.node_metrics (
         node_id, block_height, peer_count, is_syncing, sync_percent,
         cpu_percent, memory_percent, disk_percent, disk_used_gb, disk_total_gb,
         tx_pool_pending, tx_pool_queued, gas_price, rpc_latency_ms,
         client_type, client_version, node_type, coinbase,
         ipv4, os_type, os_release, os_arch, kernel_version,
         collected_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
         $11,$12,$13,$14,$15,$16,$17,$18,
         $19,$20,$21,$22,$23, NOW()
       )`,
      [
        nodeId, blockHeight, peerCount, isSyncing, syncPct,
        cpuPct, memPct, diskPct, diskUsed, diskTotal,
        txPending, txQueued, gasPrice, rpcLatency,
        clientType, clientVer, nodeType, coinbase,
        ipv4, osType, osRelease, osArch, kernelVer
      ]
    );

    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error: any) {
    console.error('Heartbeat error:', error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
