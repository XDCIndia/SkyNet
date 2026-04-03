/**
 * AI Node Doctor — Incident Narratives
 * Issue: https://github.com/XDCIndia/SkyNet/issues/68
 */
import { query } from '@/lib/db';

interface Diagnosis {
  nodeId: string;
  status: 'healthy' | 'warning' | 'critical';
  narrative: string;
  recommendations: string[];
  timestamp: string;
}

const TEMPLATES: Record<string, (ctx: any) => { narrative: string; recommendations: string[] }> = {
  sync_stall: (ctx) => ({
    narrative: `Node "${ctx.name}" stopped syncing at block ${ctx.block?.toLocaleString()}. Last block change was ${ctx.stalledMinutes} minutes ago. Current peer count: ${ctx.peers}. ${ctx.peers < 2 ? 'Low peer count is likely the root cause.' : 'Peers are healthy — possible chain tip disagreement or processing bottleneck.'}`,
    recommendations: ctx.peers < 2
      ? ['Add static peers from fleet registry', 'Check firewall rules for P2P port', 'Restart container']
      : ['Check container logs for errors', 'Verify disk space', 'Restart container if persists >30min']
  }),
  offline: (ctx) => ({
    narrative: `Node "${ctx.name}" has been offline for ${ctx.offlineMinutes} minutes. Last seen at block ${ctx.block?.toLocaleString()}. ${ctx.offlineMinutes > 60 ? 'Extended outage — container may have crashed or server rebooted.' : 'Brief outage — likely a restart or network blip.'}`,
    recommendations: ['Check if container is running: docker ps', 'Check server connectivity', 'Review system logs for OOM or disk full']
  }),
  peer_drop: (ctx) => ({
    narrative: `Node "${ctx.name}" peer count dropped to ${ctx.peers} (from typical ${ctx.avgPeers}). ${ctx.peers === 0 ? 'Complete isolation — node cannot sync.' : 'Degraded connectivity — sync may slow.'}`,
    recommendations: ['Inject fleet peers via admin_addPeer', 'Check P2P port accessibility', 'Verify static-nodes.json is a file (not directory)']
  }),
  divergence: (ctx) => ({
    narrative: `Block hash divergence detected at height ${ctx.block?.toLocaleString()}. Node "${ctx.name}" reports hash ${ctx.hash?.slice(0, 18)}... while fleet consensus is ${ctx.expectedHash?.slice(0, 18)}... This indicates a consensus fork.`,
    recommendations: ['Stop node immediately', 'Compare with v2.6.8 reference node', 'Check for client-specific consensus bugs', 'May need rollback via debug_setHead']
  }),
  healthy: (_ctx) => ({
    narrative: 'Node is operating normally. Sync is at chain tip, peers are healthy, and no alerts are active.',
    recommendations: []
  })
};

export async function diagnoseNode(nodeId: string): Promise<Diagnosis> {
  const node = await query(`SELECT * FROM nodes WHERE id = $1`, [nodeId]);
  if (!node.rows?.[0]) throw new Error('Node not found');
  const n = node.rows[0];

  const alerts = await query(
    `SELECT * FROM alerts WHERE node_id = $1 AND resolved_at IS NULL ORDER BY created_at DESC LIMIT 5`,
    [nodeId]
  );

  const lastSeen = n.last_seen ? (Date.now() - new Date(n.last_seen).getTime()) / 60000 : Infinity;
  const ctx = { name: n.name, block: n.block_number, peers: n.peer_count ?? 0, avgPeers: 10, offlineMinutes: Math.round(lastSeen), stalledMinutes: Math.round(lastSeen) };

  let templateKey = 'healthy';
  let status: Diagnosis['status'] = 'healthy';

  if (lastSeen > 5) { templateKey = 'offline'; status = 'critical'; }
  else if (alerts.rows?.some((a: any) => a.type === 'divergence')) { templateKey = 'divergence'; status = 'critical'; }
  else if (alerts.rows?.some((a: any) => a.type === 'sync_stall')) { templateKey = 'sync_stall'; status = 'warning'; }
  else if ((n.peer_count ?? 0) < 2) { templateKey = 'peer_drop'; status = 'warning'; }

  const { narrative, recommendations } = TEMPLATES[templateKey](ctx);
  return { nodeId, status, narrative, recommendations, timestamp: new Date().toISOString() };
}
