import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Geo cache for IPs
const GEO_CACHE_TTL = 300000; // 5 minutes
const geoCache = new Map<string, { country: string; city: string; lat: number; lon: number; asn: string }>();

function extractIP(remoteAddress: string): string | null {
  if (remoteAddress.startsWith('[')) return null; // IPv6 skip
  const parts = remoteAddress.split(':');
  return parts.length >= 2 ? parts[0] : remoteAddress;
}

function isPrivateIP(ip: string): boolean {
  const privateRanges = [
    /^10\./, /^172\.(1[6-9]|2[0-9]|3[01])\./, /^192\.168\./, /^127\./,
    /^::1$/, /^fc00:/i, /^fe80:/i,
  ];
  return privateRanges.some(range => range.test(ip));
}

async function getGeoLocation(ip: string): Promise<{ country: string; city: string; lat: number; lon: number; asn: string } | null> {
  if (isPrivateIP(ip)) return null;
  
  const cached = geoCache.get(ip);
  if (cached) return cached;

  try {
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,lat,lon,isp`,
      { headers: { 'Accept': 'application/json' } }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    if (data.status !== 'success') return null;
    
    const result = {
      country: data.countryCode || 'Unknown',
      city: data.city || 'Unknown',
      lat: data.lat || 0,
      lon: data.lon || 0,
      asn: data.isp || 'Unknown',
    };
    
    geoCache.set(ip, result);
    setTimeout(() => geoCache.delete(ip), GEO_CACHE_TTL);
    
    return result;
  } catch {
    return null;
  }
}

// GET /api/peers - Get combined real-time + historical peer data
export async function GET() {
  try {
    const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:8989';
    
    // Fetch real-time peers from RPC
    const rpcResponse = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'admin_peers',
        params: [],
        id: 1,
      }),
    });

    let livePeers: any[] = [];
    if (rpcResponse.ok) {
      const rpcData = await rpcResponse.json();
      livePeers = rpcData.result || [];
    }

    // Enrich with geo data and store in DB
    const enrichedPeers = [];
    const countries: Record<string, { name: string; count: number }> = {};
    const protocols: Record<string, number> = {};

    for (const peer of livePeers) {
      const remoteAddr = peer.network?.remoteAddress || '';
      const ip = extractIP(remoteAddr);
      const port = parseInt(remoteAddr.split(':').pop() || '30303');
      
      let geo = null;
      if (ip) {
        geo = await getGeoLocation(ip);
        if (geo) {
          if (!countries[geo.country]) {
            countries[geo.country] = { name: geo.country, count: 0 };
          }
          countries[geo.country].count++;
        }
      }

      // Extract protocol version
      const protocolVersion = peer.protocols?.eth?.version?.toString() || 'unknown';
      protocols[`eth/${protocolVersion}`] = (protocols[`eth/${protocolVersion}`] || 0) + 1;

      enrichedPeers.push({
        id: peer.id,
        enode: peer.enode,
        name: peer.name,
        ip,
        port,
        country: geo?.country || 'Unknown',
        city: geo?.city || 'Unknown',
        lat: geo?.lat || 0,
        lon: geo?.lon || 0,
        asn: geo?.asn || 'Unknown',
        direction: peer.network?.inbound ? 'inbound' : 'outbound',
        protocols: Object.keys(peer.protocols || {}).map(p => 
          `${p}/${peer.protocols[p]?.version || '?'}`
        ),
        clientVersion: peer.name,
      });
    }

    // Get banned peers from DB
    const bannedResult = await query(`
      SELECT * FROM skynet.banned_peers
      ORDER BY banned_at DESC
    `);

    // Get peer stats from DB (last 24h)
    const statsResult = await query(`
      SELECT 
        COUNT(DISTINCT peer_enode) as unique_peers_24h,
        COUNT(DISTINCT remote_ip) as unique_ips_24h,
        COUNT(*) FILTER (WHERE direction = 'inbound') as inbound_24h,
        COUNT(*) FILTER (WHERE direction = 'outbound') as outbound_24h
      FROM skynet.peer_snapshots
      WHERE collected_at > NOW() - INTERVAL '24 hours'
    `);

    return NextResponse.json({
      live: {
        peers: enrichedPeers,
        totalPeers: enrichedPeers.length,
        countries,
        protocols,
      },
      history: {
        uniquePeers24h: parseInt(statsResult.rows[0]?.unique_peers_24h || '0'),
        uniqueIps24h: parseInt(statsResult.rows[0]?.unique_ips_24h || '0'),
        inbound24h: parseInt(statsResult.rows[0]?.inbound_24h || '0'),
        outbound24h: parseInt(statsResult.rows[0]?.outbound_24h || '0'),
      },
      banned: bannedResult.rows,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching peers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch peers' },
      { status: 500 }
    );
  }
}
