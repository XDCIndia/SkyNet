/**
 * Intelligent Peer Mesh — Issue #71
 *
 * Tracks peer connections between fleet nodes.
 * Scores peers by latency and reliability.
 * Exposes topology and optimisation endpoints.
 *
 * Routes (registered in app/api/v2/mesh/):
 *   GET  /api/v2/mesh/topology  → full peer graph
 *   POST /api/v2/mesh/optimize  → suggest optimal peer sets per node
 */

import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PeerEdge {
  fromNodeId: string;
  fromNodeName: string;
  toNodeId: string;
  toNodeName: string;
  /** Average latency in milliseconds; null if unknown */
  latencyMs: number | null;
  /** Fraction of probes that succeeded [0, 1] */
  reliability: number;
  /** Composite score [0, 100]; higher = better */
  score: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

export interface NodeVertex {
  nodeId: string;
  nodeName: string;
  clientType: string;
  isActive: boolean;
  peerCount: number;
  inboundEdges: number;
  outboundEdges: number;
  avgScore: number;
}

export interface MeshTopology {
  nodes: NodeVertex[];
  edges: PeerEdge[];
  generatedAt: Date;
}

export interface PeerSuggestion {
  nodeId: string;
  nodeName: string;
  suggestedPeers: Array<{
    nodeId: string;
    nodeName: string;
    enode: string | null;
    score: number;
    reason: string;
  }>;
  currentPeerCount: number;
  targetPeerCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scoring
// ─────────────────────────────────────────────────────────────────────────────

const LATENCY_WEIGHT = 0.4;
const RELIABILITY_WEIGHT = 0.6;
const MAX_GOOD_LATENCY_MS = 200; // anything below this is "excellent"

function computeScore(latencyMs: number | null, reliability: number): number {
  const latScore =
    latencyMs == null
      ? 50 // unknown latency → neutral
      : Math.max(0, 100 - (latencyMs / MAX_GOOD_LATENCY_MS) * 100);

  const relScore = reliability * 100;
  return Math.round(latScore * LATENCY_WEIGHT + relScore * RELIABILITY_WEIGHT);
}

// ─────────────────────────────────────────────────────────────────────────────
// Topology builder
// ─────────────────────────────────────────────────────────────────────────────

export async function getMeshTopology(): Promise<MeshTopology> {
  try {
    // Fetch all active fleet nodes
    const nodesResult = await query(`
      SELECT
        n.id          AS node_id,
        n.name        AS node_name,
        n.client_type,
        n.is_active,
        n.peer_count
      FROM skynet.nodes n
      WHERE n.is_active = true
      ORDER BY n.name
    `);

    // Fetch peer connections recorded in the peers table
    const peersResult = await query(`
      SELECT
        p.node_id     AS from_node_id,
        fn.name       AS from_node_name,
        p.peer_id     AS peer_enode,
        p.peer_name   AS to_node_name,
        p.latency_ms,
        p.is_trusted,
        p.created_at  AS first_seen_at,
        p.updated_at  AS last_seen_at
      FROM skynet.peers p
      LEFT JOIN skynet.nodes fn ON fn.id = p.node_id
      WHERE p.is_active = true
    `).catch(() => ({ rows: [] as any[] })); // table may not exist yet

    // Build edge list
    const edges: PeerEdge[] = peersResult.rows.map((row: any) => {
      const latencyMs = row.latency_ms ? Number(row.latency_ms) : null;
      const reliability = row.is_trusted ? 0.95 : 0.7;
      return {
        fromNodeId: String(row.from_node_id),
        fromNodeName: String(row.from_node_name ?? 'unknown'),
        toNodeId: String(row.peer_enode ?? 'unknown'),
        toNodeName: String(row.to_node_name ?? 'unknown'),
        latencyMs,
        reliability,
        score: computeScore(latencyMs, reliability),
        firstSeenAt: new Date(row.first_seen_at),
        lastSeenAt: new Date(row.last_seen_at),
      };
    });

    // Build vertex list with aggregated edge counts
    const nodes: NodeVertex[] = nodesResult.rows.map((row: any) => {
      const outbound = edges.filter((e) => e.fromNodeId === String(row.node_id));
      const inbound = edges.filter((e) => e.toNodeId === String(row.node_id));
      const allScores = [...outbound, ...inbound].map((e) => e.score);
      const avgScore =
        allScores.length > 0
          ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
          : 0;

      return {
        nodeId: String(row.node_id),
        nodeName: String(row.node_name),
        clientType: String(row.client_type ?? 'unknown'),
        isActive: Boolean(row.is_active),
        peerCount: Number(row.peer_count ?? 0),
        inboundEdges: inbound.length,
        outboundEdges: outbound.length,
        avgScore,
      };
    });

    return { nodes, edges, generatedAt: new Date() };
  } catch (err) {
    logger.error('[PeerMesh] getMeshTopology error', { err });
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Optimisation: suggest best peers for each node
// ─────────────────────────────────────────────────────────────────────────────

const TARGET_PEER_COUNT = 10;

export async function optimisePeerMesh(): Promise<PeerSuggestion[]> {
  const topology = await getMeshTopology();

  const suggestions: PeerSuggestion[] = [];

  for (const node of topology.nodes) {
    // Current peers this node is connected to
    const currentPeerIds = new Set(
      topology.edges
        .filter((e) => e.fromNodeId === node.nodeId)
        .map((e) => e.toNodeId)
    );

    // Score all other fleet nodes as candidate peers
    const candidates = topology.nodes
      .filter((n) => n.nodeId !== node.nodeId && !currentPeerIds.has(n.nodeId))
      .map((candidate) => {
        // Find any existing edge data for this pair
        const existingEdge = topology.edges.find(
          (e) =>
            (e.fromNodeId === node.nodeId && e.toNodeId === candidate.nodeId) ||
            (e.fromNodeId === candidate.nodeId && e.toNodeId === node.nodeId)
        );

        const score = existingEdge?.score ?? candidate.avgScore ?? 50;

        // Build a human-readable reason
        let reason = '';
        if (existingEdge) {
          reason = `Known peer, score ${score}/100`;
        } else if (candidate.clientType !== node.clientType) {
          reason = `Cross-client diversity (${candidate.clientType})`;
          // Slightly boost cross-client peers for diversity
        } else {
          reason = `Same client type (${candidate.clientType}), score ${score}/100`;
        }

        return {
          nodeId: candidate.nodeId,
          nodeName: candidate.nodeName,
          enode: null as string | null,
          score,
          reason,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, TARGET_PEER_COUNT);

    suggestions.push({
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      suggestedPeers: candidates,
      currentPeerCount: node.peerCount,
      targetPeerCount: TARGET_PEER_COUNT,
    });
  }

  return suggestions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Record a peer observation (called from telemetry pipeline or heartbeat)
// ─────────────────────────────────────────────────────────────────────────────

export async function recordPeerObservation(
  nodeId: string,
  peerEnode: string,
  peerName: string,
  latencyMs: number | null,
  isTrusted: boolean
): Promise<void> {
  try {
    await query(
      `INSERT INTO skynet.peers
         (node_id, peer_id, peer_name, latency_ms, is_trusted, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, true, NOW(), NOW())
       ON CONFLICT (node_id, peer_id)
       DO UPDATE SET
         peer_name   = EXCLUDED.peer_name,
         latency_ms  = EXCLUDED.latency_ms,
         is_trusted  = EXCLUDED.is_trusted,
         is_active   = true,
         updated_at  = NOW()`,
      [nodeId, peerEnode, peerName, latencyMs, isTrusted]
    );
  } catch (err: any) {
    // Silently skip if peers table not yet created
    if (!err.message?.includes('does not exist')) {
      logger.error('[PeerMesh] recordPeerObservation error', { err });
    }
  }
}
