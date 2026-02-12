import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// POST /api/diagnostics - Run diagnostics on a node (protected)
export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const auth = await authenticateRequest(request);
    if (!auth.valid) {
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json();
    const { nodeId, command } = body;

    if (!nodeId || !command) {
      return NextResponse.json(
        { error: 'Missing required fields: nodeId, command' },
        { status: 400 }
      );
    }

    // Validate node exists
    const nodeResult = await query(
      'SELECT * FROM netown.nodes WHERE id = $1',
      [nodeId]
    );

    if (nodeResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Node not found' },
        { status: 404 }
      );
    }

    const node = nodeResult.rows[0];
    const diagnosticsDir = '/root/.openclaw/workspace/XDC-Node-Setup/scripts';

    let result: { stdout: string; stderr: string } = { stdout: '', stderr: '' };
    let diagnosticData: Record<string, unknown> = {};

    switch (command) {
      case 'health_check': {
        // Check node health via RPC
        const startTime = Date.now();
        try {
          const response = await fetch(node.host, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'eth_syncing',
              params: [],
              id: 1,
            }),
            signal: AbortSignal.timeout(5000),
          });
          const latency = Date.now() - startTime;
          const data = await response.json();
          
          diagnosticData = {
            status: 'healthy',
            rpcLatency: latency,
            syncing: data.result,
            timestamp: new Date().toISOString(),
          };
        } catch (error) {
          diagnosticData = {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          };
        }
        break;
      }

      case 'sync_status': {
        const [syncing, blockNumber, peers] = await Promise.all([
          fetch(node.host, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_syncing', params: [], id: 1 }),
          }).then(r => r.json()).catch(() => ({ result: null })),
          fetch(node.host, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
          }).then(r => r.json()).catch(() => ({ result: '0x0' })),
          fetch(node.host, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', method: 'admin_peers', params: [], id: 1 }),
          }).then(r => r.json()).catch(() => ({ result: [] })),
        ]);

        const currentBlock = parseInt(blockNumber.result || '0x0', 16);
        diagnosticData = {
          currentBlock,
          syncing: syncing.result,
          peerCount: peers.result?.length || 0,
          timestamp: new Date().toISOString(),
        };
        break;
      }

      case 'peer_discovery': {
        const peersResponse = await fetch(node.host, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'admin_peers', params: [], id: 1 }),
        });
        const peersData = await peersResponse.json();
        
        const peers = peersData.result || [];
        const inbound = peers.filter((p: any) => p.network?.inbound).length;
        const outbound = peers.filter((p: any) => !p.network?.inbound).length;

        diagnosticData = {
          totalPeers: peers.length,
          inbound,
          outbound,
          peers: peers.slice(0, 10).map((p: any) => ({
            id: p.id?.slice(0, 16) + '...',
            name: p.name,
            direction: p.network?.inbound ? 'inbound' : 'outbound',
          })),
          timestamp: new Date().toISOString(),
        };
        break;
      }

      case 'disk_usage': {
        // Try to get disk usage from metrics
        const diskResult = await query(`
          SELECT disk_percent, disk_used_gb, disk_total_gb
          FROM netown.node_metrics
          WHERE node_id = $1
          ORDER BY collected_at DESC
          LIMIT 1
        `, [nodeId]);

        diagnosticData = {
          diskPercent: diskResult.rows[0]?.disk_percent || null,
          diskUsedGB: diskResult.rows[0]?.disk_used_gb || null,
          diskTotalGB: diskResult.rows[0]?.disk_total_gb || null,
          timestamp: new Date().toISOString(),
        };
        break;
      }

      case 'memory_profile': {
        const memResult = await query(`
          SELECT memory_percent
          FROM netown.node_metrics
          WHERE node_id = $1
          ORDER BY collected_at DESC
          LIMIT 1
        `, [nodeId]);

        diagnosticData = {
          memoryPercent: memResult.rows[0]?.memory_percent || null,
          timestamp: new Date().toISOString(),
        };
        break;
      }

      case 'rpc_test': {
        const tests = [];
        const methods = ['eth_blockNumber', 'eth_syncing', 'net_version', 'admin_peers'];
        
        for (const method of methods) {
          const startTime = Date.now();
          try {
            const response = await fetch(node.host, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ jsonrpc: '2.0', method, params: [], id: 1 }),
              signal: AbortSignal.timeout(5000),
            });
            const latency = Date.now() - startTime;
            const data = await response.json();
            
            tests.push({
              method,
              status: data.error ? 'error' : 'success',
              latency,
              error: data.error?.message,
            });
          } catch (error) {
            tests.push({
              method,
              status: 'failed',
              latency: Date.now() - startTime,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        diagnosticData = {
          tests,
          allPassed: tests.every((t: any) => t.status === 'success'),
          timestamp: new Date().toISOString(),
        };
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown command: ${command}` },
          { status: 400 }
        );
    }

    return NextResponse.json({
      nodeId,
      nodeName: node.name,
      command,
      result: diagnosticData,
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error running diagnostics:', error);
    return NextResponse.json(
      { error: 'Failed to run diagnostics' },
      { status: 500 }
    );
  }
}

// GET /api/diagnostics - Get available diagnostic commands
export async function GET() {
  return NextResponse.json({
    commands: [
      { id: 'health_check', name: 'Health Check', description: 'Quick RPC health check' },
      { id: 'sync_status', name: 'Sync Status', description: 'Get current sync status' },
      { id: 'peer_discovery', name: 'Peer Discovery', description: 'List connected peers' },
      { id: 'disk_usage', name: 'Disk Usage', description: 'Check disk utilization' },
      { id: 'memory_profile', name: 'Memory Profile', description: 'Check memory usage' },
      { id: 'rpc_test', name: 'RPC Test', description: 'Test RPC method availability' },
    ],
  });
}
