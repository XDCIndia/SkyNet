import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://gateway:xdc_news_2025_secure@127.0.0.1:5433/xdc_gateway',
});

async function query(sql: string, params?: unknown[]) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

async function evaluateRules() {
  const results: Array<{ rule: string; newAlerts: number; skipped: number }> = [];

  const rules = await query(`
    SELECT * FROM skynet.alert_rules 
    WHERE enabled = true AND rule_type IS NOT NULL
  `);

  for (const rule of rules.rows) {
    let matchingNodes: { rows: Array<{ id: string; name: string }> } = { rows: [] };
    let newAlerts = 0;
    let skipped = 0;

    try {
      switch (rule.rule_type) {
        case 'node_offline': {
          // Nodes with no heartbeat for N minutes
          const minutes = rule.threshold || 5;
          matchingNodes = await query(`
            SELECT DISTINCT n.id, n.name 
            FROM skynet.nodes n
            WHERE n.is_active = true
              AND (
                n.last_heartbeat IS NULL
                OR n.last_heartbeat < NOW() - INTERVAL '${minutes} minutes'
              )
          `);
          break;
        }

        case 'sync_stalled': {
          // Block height unchanged for N minutes — look at last 2 metrics
          const minutes = rule.threshold || 10;
          matchingNodes = await query(`
            SELECT n.id, n.name
            FROM skynet.nodes n
            WHERE n.is_active = true
              AND EXISTS (
                SELECT 1 FROM (
                  SELECT block_height, collected_at
                  FROM skynet.node_metrics
                  WHERE node_id = n.id
                  ORDER BY collected_at DESC
                  LIMIT 2
                ) recent
                GROUP BY 1
                HAVING COUNT(*) >= 2 AND MIN(collected_at) < NOW() - INTERVAL '${minutes} minutes'
                  AND MIN(block_height) = MAX(block_height)
              )
          `);
          break;
        }

        case 'low_peers': {
          const threshold = rule.threshold || 2;
          matchingNodes = await query(`
            SELECT DISTINCT n.id, n.name
            FROM skynet.nodes n
            JOIN LATERAL (
              SELECT peer_count FROM skynet.node_metrics
              WHERE node_id = n.id
              ORDER BY collected_at DESC
              LIMIT 1
            ) m ON true
            WHERE n.is_active = true
              AND m.peer_count < ${threshold}
              AND EXISTS (
                SELECT 1 FROM skynet.node_metrics
                WHERE node_id = n.id AND collected_at > NOW() - INTERVAL '5 minutes'
              )
          `);
          break;
        }

        case 'disk_full': {
          const threshold = rule.threshold || 90;
          matchingNodes = await query(`
            SELECT DISTINCT n.id, n.name
            FROM skynet.nodes n
            JOIN LATERAL (
              SELECT disk_percent FROM skynet.node_metrics
              WHERE node_id = n.id
              ORDER BY collected_at DESC
              LIMIT 1
            ) m ON true
            WHERE n.is_active = true
              AND m.disk_percent > ${threshold}
              AND EXISTS (
                SELECT 1 FROM skynet.node_metrics
                WHERE node_id = n.id AND collected_at > NOW() - INTERVAL '5 minutes'
              )
          `);
          break;
        }

        case 'high_cpu': {
          const threshold = rule.threshold || 95;
          matchingNodes = await query(`
            SELECT DISTINCT n.id, n.name
            FROM skynet.nodes n
            JOIN LATERAL (
              SELECT cpu_percent FROM skynet.node_metrics
              WHERE node_id = n.id
              ORDER BY collected_at DESC
              LIMIT 1
            ) m ON true
            WHERE n.is_active = true
              AND m.cpu_percent > ${threshold}
              AND EXISTS (
                SELECT 1 FROM skynet.node_metrics
                WHERE node_id = n.id AND collected_at > NOW() - INTERVAL '5 minutes'
              )
          `);
          break;
        }

        default:
          continue;
      }
    } catch (err) {
      console.error(`Alert evaluation error for rule ${rule.id} (${rule.rule_type}):`, err);
      continue;
    }

    // Create alerts (with cooldown check)
    for (const node of matchingNodes.rows) {
      const cooldown = rule.cooldown_minutes || 30;
      const recent = await query(`
        SELECT id FROM skynet.alerts
        WHERE rule_id = $1 AND node_id = $2 
          AND status != 'resolved'
          AND triggered_at > NOW() - INTERVAL '${cooldown} minutes'
      `, [rule.id, node.id]);

      if (recent.rows.length === 0) {
        await query(`
          INSERT INTO skynet.alerts (rule_id, node_id, node_name, severity, title, message)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          rule.id,
          node.id,
          node.name,
          rule.severity || 'warning',
          `${rule.name || rule.rule_type}: ${node.name}`,
          `${rule.rule_type} threshold (${rule.threshold}) breached on node ${node.name}`,
        ]);
        newAlerts++;
      } else {
        skipped++;
      }
    }

    results.push({ rule: rule.name || rule.rule_type, newAlerts, skipped });
  }

  return results;
}

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/alerts/evaluate
 * Trigger alert rule evaluation (can be called by heartbeat/cron)
 */
export async function GET(_request: NextRequest) {
  try {
    const results = await evaluateRules();
    const totalNew = results.reduce((sum, r) => sum + r.newAlerts, 0);

    return NextResponse.json({
      success: true,
      data: {
        evaluated: results.length,
        totalNewAlerts: totalNew,
        results,
      },
    });
  } catch (error: any) {
    console.error('Alert evaluation failed:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(_request: NextRequest) {
  return GET(_request);
}
