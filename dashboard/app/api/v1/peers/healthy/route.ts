import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import net from 'net';

export const dynamic = 'force-dynamic';

// Simple in-memory cache
let cache: {
  data: any;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface PeerData {
  enode: string;
  ip: string;
  port: number;
  name: string;
  protocols: string[];
  direction: 'inbound' | 'outbound';
  country: string | null;
  city: string | null;
  connectedNodes: string[];
  lastSeen: Date;
}

// Check if a port is open with timeout
async function checkPort(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    socket.setTimeout(timeoutMs);
    
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.connect(port, host);
  });
}

// Extract IP and port from remoteAddress (format: IP:port)
function parseRemoteAddress(remoteAddress: string | null): { ip: string; port: number } | null {
  if (!remoteAddress) return null;
  
  const parts = remoteAddress.split(':');
  if (parts.length < 2) return null;
  
  // Handle IPv6 addresses
  if (remoteAddress.includes('[')) {
    const match = remoteAddress.match(/\[(.*?)\]:(\d+)/);
    if (match) {
      return { ip: match[1], port: parseInt(match[2], 10) };
    }
  }
  
  // IPv4
  const port = parseInt(parts[parts.length - 1], 10);
  const ip = parts.slice(0, parts.length - 1).join(':');
  
  return { ip, port };
}

// Parse enode: enode://pubkey@ip:port
function parseEnode(enode: string): { ip: string; port: number } | null {
  const match = enode.match(/@([^:]+):(\d+)/);
  if (!match) return null;
  return { ip: match[1], port: parseInt(match[2]) };
}

// Process peers in batches
async function checkPortsBatch(
  peers: PeerData[], 
  batchSize = 10
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();
  
  for (let i = 0; i < peers.length; i += batchSize) {
    const batch = peers.slice(i, i + batchSize);
    const batchPromises = batch.map(async (peer) => {
      const isOpen = await checkPort(peer.ip, peer.port);
      results.set(peer.enode, isOpen);
    });
    
    await Promise.all(batchPromises);
  }
  
  return results;
}

/**
 * GET /api/v1/peers/healthy
 * Returns healthy peers with TCP port verification
 * Public endpoint - no auth required
 * 
 * Query params:
 * - format: json (default) | static-nodes | text
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';

    // Check cache for JSON format only (other formats are processed differently)
    const now = Date.now();
    let cachedData = null;
    
    if (format === 'json' && cache && (now - cache.timestamp) < CACHE_DURATION) {
      cachedData = cache.data;
    }

    let healthyEnodes: string[] = [];
    let allPeers: PeerData[] = [];
    let unhealthyPeers: PeerData[] = [];
    let checkedAt = new Date().toISOString();

    if (cachedData) {
      // Use cached data
      healthyEnodes = cachedData.peers.map((p: HealthyPeer) => p.enode);
      allPeers = cachedData.allPeers || [];
      unhealthyPeers = cachedData.unhealthyPeers || [];
      checkedAt = cachedData.checkedAt;
    } else {
      // 1. Get all peers from latest peer_snapshots across all nodes (last 30 min)
      const peersResult = await query(
        `SELECT 
          ps.peer_enode,
          ps.peer_name,
          ps.remote_ip,
          ps.remote_port,
          ps.client_version,
          ps.protocols,
          ps.direction,
          ps.country,
          ps.city,
          ps.collected_at,
          n.name as node_name
        FROM skynet.peer_snapshots ps
        JOIN skynet.nodes n ON ps.node_id = n.id
        WHERE ps.collected_at > NOW() - INTERVAL '30 minutes'
        ORDER BY ps.collected_at DESC`
      );

      // 2. Also get enodes from node_metrics where peer_count > 0 (the nodes themselves)
      const nodeEnodesResult = await query(
        `SELECT DISTINCT
          n.enode,
          n.name,
          n.ipv4,
          n.client_version,
          nm.peer_count,
          nm.collected_at
        FROM skynet.nodes n
        JOIN skynet.node_metrics nm ON n.id = nm.node_id
        WHERE n.enode IS NOT NULL 
          AND nm.peer_count > 0
          AND nm.collected_at > NOW() - INTERVAL '30 minutes'
        ORDER BY nm.collected_at DESC`
      );

      // Deduplicate peers by enode
      const peerMap = new Map<string, PeerData>();
      
      // Add peer_snapshots data
      for (const row of peersResult.rows) {
        const enode = row.peer_enode;
        
        if (!enode || peerMap.has(enode)) continue;
        
        // Parse IP and port from remote_ip or enode
        let ip = row.remote_ip;
        let port = row.remote_port;
        
        if (!ip || !port) {
          // Try to extract from enode: enode://...@[IP]:port
          const match = enode.match(/@([^:]+):(\d+)$/);
          if (match) {
            ip = match[1];
            port = parseInt(match[2], 10);
          }
        }
        
        if (!ip || !port) continue;
        
        peerMap.set(enode, {
          enode,
          ip,
          port,
          name: row.peer_name || row.client_version || 'Unknown',
          protocols: row.protocols || [],
          direction: row.direction || 'outbound',
          country: row.country,
          city: row.city,
          connectedNodes: [row.node_name],
          lastSeen: row.collected_at,
        });
      }

      // Add node enodes (the nodes themselves as peers)
      for (const row of nodeEnodesResult.rows) {
        const enode = row.enode;
        if (!enode) continue;
        
        // Parse IP from enode if available
        const parsed = parseEnode(enode);
        if (!parsed) continue;
        
        // Use default XDC P2P port if not specified
        const ip = parsed.ip;
        const port = parsed.port || 30303;
        
        if (!peerMap.has(enode)) {
          peerMap.set(enode, {
            enode,
            ip,
            port,
            name: row.client_version || row.name || 'XDC Node',
            protocols: ['eth/68', 'xdc'],
            direction: 'outbound',
            country: null,
            city: null,
            connectedNodes: [row.name],
            lastSeen: row.collected_at,
          });
        } else {
          // Add connected node to existing peer
          const peer = peerMap.get(enode)!;
          if (!peer.connectedNodes.includes(row.name)) {
            peer.connectedNodes.push(row.name);
          }
        }
      }

      const uniquePeers = Array.from(peerMap.values());
      
      // Check ports for all peers
      const portResults = await checkPortsBatch(uniquePeers);
      
      // Filter only healthy peers (port is open)
      const healthyPeers = uniquePeers
        .filter(peer => portResults.get(peer.enode) === true);
      
      unhealthyPeers = uniquePeers.filter(
        peer => portResults.get(peer.enode) === false
      );

      healthyEnodes = healthyPeers.map(p => p.enode);
      allPeers = uniquePeers;
      
      // Cache the results
      cache = {
        data: {
          peers: healthyPeers,
          allPeers: uniquePeers,
          unhealthyPeers,
          checkedAt,
        },
        timestamp: now,
      };
    }

    // Return based on format
    switch (format) {
      case 'static-nodes':
        return new NextResponse(
          JSON.stringify(healthyEnodes, null, 2),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=300',
            },
          }
        );
      
      case 'text':
        return new NextResponse(
          healthyEnodes.join('\n'),
          {
            status: 200,
            headers: {
              'Content-Type': 'text/plain',
              'Cache-Control': 'public, max-age=300',
            },
          }
        );
      
      case 'json':
      default:
        const healthyPeersFormatted = (cache?.data?.peers || []).map((peer: PeerData) => ({
          enode: peer.enode,
          ip: peer.ip,
          port: peer.port,
          portOpen: true,
          name: peer.name,
          protocols: peer.protocols,
          direction: peer.direction,
          country: peer.country,
          city: peer.city,
          connectedNodes: peer.connectedNodes,
          lastSeen: peer.lastSeen.toISOString(),
        }));

        const unhealthyPeersFormatted = unhealthyPeers.map(peer => ({
          enode: peer.enode,
          ip: peer.ip,
          port: peer.port,
          portOpen: false,
          name: peer.name,
          protocols: peer.protocols,
          direction: peer.direction,
          country: peer.country,
          city: peer.city,
          connectedNodes: peer.connectedNodes,
          lastSeen: peer.lastSeen.toISOString(),
        }));

        return NextResponse.json({
          success: true,
          count: healthyEnodes.length,
          enodes: healthyEnodes,
          peers: healthyPeersFormatted,
          unhealthyPeers: unhealthyPeersFormatted,
          totalPeers: allPeers.length,
          healthyPeers: healthyEnodes.length,
          unhealthyPeersCount: unhealthyPeers.length,
          checkedAt,
          cached: !!cachedData,
        }, {
          headers: {
            'Cache-Control': 'public, max-age=300',
          },
        });
    }
  } catch (error: any) {
    console.error('Error fetching healthy peers:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch healthy peers', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// Type for formatted peer
interface HealthyPeer {
  enode: string;
  ip: string;
  port: number;
  portOpen: boolean;
  name: string;
  protocols: string[];
  direction: 'inbound' | 'outbound';
  country: string | null;
  city: string | null;
  connectedNodes: string[];
  lastSeen: string;
}
