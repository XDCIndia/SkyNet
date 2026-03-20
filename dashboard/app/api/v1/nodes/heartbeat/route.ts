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
    const dockerImg  = body.dockerImage ?? null;
    const healthScore = body.healthScore ?? null;

    // Consensus fields
    const consensus       = body.consensus ?? {};
    const consensusEpoch  = consensus.epoch   ?? null;
    const consensusRound  = consensus.round   ?? null;
    const consensusV2     = consensus.v2Active ?? false;
    const epochProgress   = consensus.epochProgress ?? null;
    const chainId         = consensus.chainId ?? null;

    // Database metrics (from SkyOne DB collection, ~every 5 min)
    const dbMetrics  = body.database ?? null;
    const dbEngine   = dbMetrics?.engine ?? null;
    const dbTotal    = dbMetrics?.totalSize ?? null;
    const dbChaindata = dbMetrics?.chaindata ?? null;
    const dbAncient  = dbMetrics?.ancient ?? null;
    const dbState    = dbMetrics?.state ?? null;

    if (!nodeId) {
      return NextResponse.json({ success: false, error: 'nodeId required' }, { status: 400 });
    }

    // Upsert node record — never downgrade network from apothem→mainnet
    await client.query(
      `INSERT INTO skynet.nodes
         (id, name, network, status, last_heartbeat, client_type, ipv4, coinbase, is_active, docker_image, health_score)
       VALUES ($1, $2, $3, 'active', NOW(), $4, $5, $6, true, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         network        = CASE
                            WHEN skynet.nodes.network = 'apothem' THEN 'apothem'
                            ELSE EXCLUDED.network
                          END,
         status         = 'active',
         last_heartbeat = NOW(),
         last_seen      = NOW(),
         block_height   = $7,
         peer_count     = $8,
         is_syncing     = $9,
         client_type    = EXCLUDED.client_type,
         ipv4           = COALESCE(EXCLUDED.ipv4, skynet.nodes.ipv4),
         coinbase       = COALESCE(EXCLUDED.coinbase, skynet.nodes.coinbase),
         docker_image   = COALESCE(EXCLUDED.docker_image, skynet.nodes.docker_image),
         health_score   = COALESCE(EXCLUDED.health_score, skynet.nodes.health_score)`,
      [nodeId, nodeId, network, clientType, ipv4, coinbase, blockHeight, peerCount, isSyncing, dockerImg, healthScore]
    );

    // Insert full metrics row (including DB size columns)
    await client.query(
      `INSERT INTO skynet.node_metrics (
         node_id, block_height, peer_count, is_syncing, sync_percent,
         cpu_percent, memory_percent, disk_percent, disk_used_gb, disk_total_gb,
         tx_pool_pending, tx_pool_queued, gas_price, rpc_latency_ms,
         client_type, client_version, node_type, coinbase,
         ipv4, os_type, os_release, os_arch, kernel_version,
         db_engine, db_total_size, db_chaindata_size, db_ancient_size, db_state_size,
         consensus_epoch, consensus_round, consensus_v2, epoch_progress, chain_id,
         health_score,
         collected_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
         $11,$12,$13,$14,$15,$16,$17,$18,
         $19,$20,$21,$22,$23,
         $24,$25,$26,$27,$28,
         $29,$30,$31,$32,$33,
         $34,
         NOW()
       )`,
      [
        nodeId, blockHeight, peerCount, isSyncing, syncPct,
        cpuPct, memPct, diskPct, diskUsed, diskTotal,
        txPending, txQueued, gasPrice, rpcLatency,
        clientType, clientVer, nodeType, coinbase,
        ipv4, osType, osRelease, osArch, kernelVer,
        dbEngine, dbTotal, dbChaindata, dbAncient, dbState,
        consensusEpoch, consensusRound, consensusV2, epochProgress, chainId,
        healthScore,
      ]
    );

    // Record DB history snapshot (max 1 per 10 min per node) when DB data is present
    if (dbTotal !== null) {
      await client.query(
        `INSERT INTO skynet.db_size_history (node_id, total_size, chaindata_size, ancient_size)
         SELECT $1, $2, $3, $4
         WHERE NOT EXISTS (
           SELECT 1 FROM skynet.db_size_history
           WHERE node_id = $1
             AND recorded_at > NOW() - INTERVAL '10 minutes'
         )`,
        [nodeId, dbTotal, dbChaindata, dbAncient]
      );
    }

    // Async alert evaluation — fire-and-forget, don't block heartbeat response
    // Evaluate every 5th heartbeat to reduce DB load (use modulo on timestamp minutes)
    const now = new Date();
    if (now.getMinutes() % 5 === 0) {
      // Fire-and-forget: call the evaluate API internally via relative URL
      // Use the pool directly to avoid circular HTTP calls
      evaluateAlertsAsync(client, nodeId).catch(err => 
        console.error('Background alert evaluation error:', err)
      );
    }

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

// Lightweight alert evaluation — only checks the node that just sent a heartbeat
async function evaluateAlertsAsync(client: any, nodeId: string): Promise<void> {
  try {
    // Get latest metrics for this node
    const metricsResult = await client.query(`
      SELECT disk_percent, cpu_percent, peer_count
      FROM skynet.node_metrics
      WHERE node_id = $1
      ORDER BY collected_at DESC
      LIMIT 1
    `, [nodeId]);

    const metrics = metricsResult.rows[0];
    if (!metrics) return;

    // Get enabled rules
    const rulesResult = await client.query(`
      SELECT * FROM skynet.alert_rules
      WHERE enabled = true AND rule_type IN ('disk_full', 'high_cpu', 'low_peers')
        AND (node_id IS NULL OR node_id = $1)
    `, [nodeId]);

    const nodeResult = await client.query(`
      SELECT name FROM skynet.nodes WHERE id = $1
    `, [nodeId]);
    const nodeName = nodeResult.rows[0]?.name || nodeId;

    for (const rule of rulesResult.rows) {
      let breached = false;
      switch (rule.rule_type) {
        case 'disk_full':
          breached = metrics.disk_percent > (rule.threshold || 90);
          break;
        case 'high_cpu':
          breached = metrics.cpu_percent > (rule.threshold || 95);
          break;
        case 'low_peers':
          breached = metrics.peer_count < (rule.threshold || 2);
          break;
      }

      if (!breached) continue;

      const cooldown = rule.cooldown_minutes || 30;
      const recent = await client.query(`
        SELECT id FROM skynet.alerts
        WHERE rule_id = $1 AND node_id = $2
          AND status != 'resolved'
          AND triggered_at > NOW() - INTERVAL '${cooldown} minutes'
      `, [rule.id, nodeId]);

      if (recent.rows.length === 0) {
        await client.query(`
          INSERT INTO skynet.alerts (rule_id, node_id, node_name, severity, title, message)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          rule.id,
          nodeId,
          nodeName,
          rule.severity || 'warning',
          `${rule.name}: ${nodeName}`,
          `${rule.rule_type} threshold (${rule.threshold}) breached on ${nodeName}`,
        ]);
      }
    }
  } catch (err) {
    console.error('evaluateAlertsAsync error:', err);
  }
}
