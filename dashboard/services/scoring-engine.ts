/**
 * Node Scoring Engine — AutoAgent Evaluator
 * Issue: https://github.com/XDCIndia/SkyNet/issues/66
 */
import { query } from '@/lib/db';

const WEIGHTS = { sync: 0.35, peers: 0.25, uptime: 0.25, resources: 0.15 };

export interface NodeScore {
  nodeId: string;
  syncScore: number;
  peerScore: number;
  uptimeScore: number;
  resourceScore: number;
  composite: number;
  grade: string;
}

function grade(score: number): string {
  if (score >= 0.9) return 'A';
  if (score >= 0.75) return 'B';
  if (score >= 0.5) return 'C';
  if (score >= 0.25) return 'D';
  return 'F';
}

export async function scoreNode(nodeId: string): Promise<NodeScore> {
  const node = await query(`SELECT * FROM nodes WHERE id = $1`, [nodeId]);
  if (!node.rows?.[0]) throw new Error('Node not found');
  const n = node.rows[0];

  // Sync: 1.0 if at head, decreasing by gap
  const maxBlock = (await query(`SELECT MAX(block_number) as max FROM nodes WHERE network = $1`, [n.network])).rows[0]?.max ?? 0;
  const gap = Math.max(0, maxBlock - (n.block_number ?? 0));
  const syncScore = Math.max(0, 1 - gap / 1000);

  // Peers: 1.0 at 10+, linear below
  const peerScore = Math.min(1, (n.peer_count ?? 0) / 10);

  // Uptime: based on last_seen recency
  const lastSeen = n.last_seen ? Date.now() - new Date(n.last_seen).getTime() : Infinity;
  const uptimeScore = lastSeen < 300000 ? 1.0 : lastSeen < 600000 ? 0.5 : 0;

  // Resources: placeholder (needs agent data)
  const resourceScore = 0.7;

  const composite = WEIGHTS.sync * syncScore + WEIGHTS.peers * peerScore + WEIGHTS.uptime * uptimeScore + WEIGHTS.resources * resourceScore;

  return { nodeId, syncScore, peerScore, uptimeScore, resourceScore, composite, grade: grade(composite) };
}

export async function leaderboard(network = 'mainnet', limit = 20) {
  const nodes = await query(`SELECT id FROM nodes WHERE network = $1 AND last_seen > NOW() - INTERVAL '10 minutes' ORDER BY block_number DESC LIMIT $2`, [network, limit]);
  const scores = await Promise.all(nodes.rows.map((n: any) => scoreNode(n.id).catch(() => null)));
  return scores.filter(Boolean).sort((a: any, b: any) => b.composite - a.composite);
}
