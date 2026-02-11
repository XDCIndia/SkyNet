import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest, unauthorizedResponse, isDashboardReadRequest } from '@/lib/auth';
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
async function checkPort(host: string, port: number, timeoutMs = 2000): Promise<boolean> {
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
 * Returns healthy peers with port check
 * Auth: Bearer API key
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate request
    if (!isDashboardReadRequest(request)) {
      const auth = await authenticateRequest(request);
      if (!auth.valid) {
        return unauthorizedResponse(auth.error);
      }
    }

    // Check cache
    const now = Date.now();
    if (cache && (now - cache.timestamp) < CACHE_DURATION) {
      return NextResponse.json({
        ...cache.data,
        cached: true,
        cachedAt: new Date(cache.timestamp).toISOString(),
      });
    }

    // Get all peers from latest peer_snapshots across all nodes
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
      FROM netown.peer_snapshots ps
      JOIN netown.nodes n ON ps.node_id = n.id
      WHERE ps.collected_at > NOW() - INTERVAL '5 minutes'
      ORDER BY ps.collected_at DESC`
    );

    // Deduplicate peers by enode
    const peerMap = new Map<string, PeerData>();
    
    for (const row of peersResult.rows) {
      const enode = row.peer_enode;
      
      if (!peerMap.has(enode)) {
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
      } else {
        // Add connected node to existing peer
        const peer = peerMap.get(enode)!;
        if (!peer.connectedNodes.includes(row.node_name)) {
          peer.connectedNodes.push(row.node_name);
        }
        // Update lastSeen if newer
        if (new Date(row.collected_at) > new Date(peer.lastSeen)) {
          peer.lastSeen = row.collected_at;
        }
      }
    }

    const uniquePeers = Array.from(peerMap.values());
    
    // Check ports for all peers
    const portResults = await checkPortsBatch(uniquePeers);
    
    // Filter only healthy peers (port is open)
    const healthyPeers = uniquePeers
      .filter(peer => portResults.get(peer.enode) === true)
      .map(peer => ({
        ...peer,
        portOpen: true,
      }));
    
    const unhealthyPeers = uniquePeers.filter(
      peer => portResults.get(peer.enode) === false
    ).map(peer => ({
      ...peer,
      portOpen: false,
    }));

    // Prepare export formats
    const enodeList = healthyPeers.map(p => p.enode).join(',');
    const staticNodesJson = healthyPeers.map(p => p.enode);

    const healthyPeersFormatted = healthyPeers.map(peer => ({
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

    const response = {
      totalPeers: uniquePeers.length,
      healthyPeers: healthyPeers.length,
      unhealthyPeers: unhealthyPeers.length,
      peers: healthyPeersFormatted,
      unhealthyPeersList: unhealthyPeersFormatted,
      enodeList,
      staticNodesJson,
      checkedAt: new Date().toISOString(),
    };

    // Update cache
    cache = {
      data: response,
      timestamp: now,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Error fetching healthy peers:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch healthy peers', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
