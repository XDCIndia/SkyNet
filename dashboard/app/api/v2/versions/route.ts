/**
 * GET /api/v2/versions
 * Issue #44 — Client Version Tracking
 *
 * Returns client version distribution across the fleet,
 * alerts when nodes run different versions, and provides
 * an upgrade matrix showing who is behind.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://gateway:gateway@localhost:5433/xdc_gateway',
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGINS || '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

interface NodeVersionRow {
  id: string;
  name: string;
  host: string;
  client_type: string;
  client_version: string | null;
  status: string;
}

interface VersionGroup {
  version: string;
  count: number;
  nodes: { id: string; name: string; host: string; status: string }[];
  isLatest: boolean;
}

interface ClientVersions {
  clientType: string;
  versions: VersionGroup[];
  latestVersion: string | null;
  divergent: boolean;
  nodesNeedingUpgrade: number;
}

/** Naive semver comparison: returns 1 if a > b, -1 if a < b, 0 if equal */
function compareSemver(a: string, b: string): number {
  const normalize = (v: string) =>
    v
      .replace(/^[^0-9]*/, '') // strip leading "Geth/", "erigon-" etc.
      .split(/[.\-+]/)
      .slice(0, 3)
      .map((n) => parseInt(n, 10) || 0);

  const av = normalize(a);
  const bv = normalize(b);
  for (let i = 0; i < 3; i++) {
    if (av[i] !== bv[i]) return av[i] > bv[i] ? 1 : -1;
  }
  return 0;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientTypeFilter = searchParams.get('clientType');

  const client = await pool.connect();
  try {
    // Pull latest client version from node_metrics (most recent heartbeat)
    const result = await client.query<NodeVersionRow>(`
      SELECT
        n.id,
        n.name,
        n.host,
        COALESCE(n.client_type, 'unknown') AS client_type,
        COALESCE(m.client_version, n.client_version) AS client_version,
        CASE
          WHEN n.last_heartbeat IS NULL                         THEN 'unknown'
          WHEN n.last_heartbeat < NOW() - INTERVAL '5 minutes' THEN 'offline'
          ELSE 'online'
        END AS status
      FROM skynet.nodes n
      LEFT JOIN LATERAL (
        SELECT client_version
        FROM skynet.node_metrics
        WHERE node_id = n.id
        ORDER BY collected_at DESC
        LIMIT 1
      ) m ON true
      ${clientTypeFilter ? 'WHERE LOWER(n.client_type) = LOWER($1)' : ''}
      ORDER BY n.client_type, n.name
    `, clientTypeFilter ? [clientTypeFilter] : []);

    const rows = result.rows;

    // Group by client_type → version
    const byClientType = new Map<string, Map<string, NodeVersionRow[]>>();
    for (const row of rows) {
      const ct = row.client_type.toLowerCase();
      const cv = row.client_version ?? 'unknown';
      if (!byClientType.has(ct)) byClientType.set(ct, new Map());
      const vmap = byClientType.get(ct)!;
      if (!vmap.has(cv)) vmap.set(cv, []);
      vmap.get(cv)!.push(row);
    }

    const clientVersions: ClientVersions[] = [];

    for (const [clientType, versionMap] of byClientType) {
      // Find latest version (highest semver)
      const knownVersions = [...versionMap.keys()].filter((v) => v !== 'unknown');
      const latestVersion =
        knownVersions.length > 0
          ? knownVersions.reduce((best, cur) =>
              compareSemver(cur, best) > 0 ? cur : best
            )
          : null;

      const versions: VersionGroup[] = [...versionMap.entries()]
        .map(([version, nodeRows]) => ({
          version,
          count: nodeRows.length,
          nodes: nodeRows.map((r) => ({ id: r.id, name: r.name, host: r.host, status: r.status })),
          isLatest: version === latestVersion,
        }))
        .sort((a, b) => {
          if (a.version === 'unknown') return 1;
          if (b.version === 'unknown') return -1;
          return compareSemver(b.version, a.version); // descending
        });

      const divergent = knownVersions.length > 1;
      const nodesNeedingUpgrade = latestVersion
        ? (versionMap.get(latestVersion)?.length ?? 0) < rows.filter((r) => r.client_type.toLowerCase() === clientType).length
          ? rows.filter(
              (r) => r.client_type.toLowerCase() === clientType && (r.client_version ?? 'unknown') !== latestVersion
            ).length
          : 0
        : 0;

      clientVersions.push({
        clientType,
        versions,
        latestVersion,
        divergent,
        nodesNeedingUpgrade,
      });
    }

    // Fleet-wide alerts
    const alerts: { severity: 'critical' | 'warning'; message: string }[] = [];
    for (const cv of clientVersions) {
      if (cv.divergent) {
        alerts.push({
          severity: 'warning',
          message: `${cv.clientType} nodes are running ${cv.versions.filter((v) => v.version !== 'unknown').length} different versions. Latest: ${cv.latestVersion}.`,
        });
      }
      if (cv.nodesNeedingUpgrade > 0) {
        alerts.push({
          severity: 'warning',
          message: `${cv.nodesNeedingUpgrade} ${cv.clientType} node(s) are not on the latest version (${cv.latestVersion}).`,
        });
      }
    }

    // Upgrade matrix: for each client type, map old version → nodes that need upgrade
    const upgradeMatrix = clientVersions.map((cv) => ({
      clientType: cv.clientType,
      latestVersion: cv.latestVersion,
      rows: cv.versions
        .filter((v) => !v.isLatest && v.version !== 'unknown')
        .map((v) => ({
          currentVersion: v.version,
          count: v.count,
          nodes: v.nodes,
          targetVersion: cv.latestVersion,
        })),
    }));

    return NextResponse.json(
      {
        success: true,
        generatedAt: new Date().toISOString(),
        totalNodes: rows.length,
        alerts,
        clientVersions,
        upgradeMatrix,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: CORS_HEADERS }
    );
  } finally {
    client.release();
  }
}
