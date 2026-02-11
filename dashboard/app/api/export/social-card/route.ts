import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET /api/export/social-card - Generate social card data
export async function GET() {
  try {
    // Get latest network health
    const healthResult = await query(`
      SELECT * FROM netown.network_health
      ORDER BY collected_at DESC
      LIMIT 1
    `);

    // Get latest metrics for TPS calculation
    const metricsResult = await query(`
      SELECT 
        AVG(block_height)::bigint as avg_block_height,
        MAX(block_height)::bigint as max_block_height,
        SUM(peer_count) as total_peers,
        COUNT(DISTINCT node_id) as active_nodes
      FROM netown.node_metrics
      WHERE collected_at > NOW() - INTERVAL '5 minutes'
    `);

    // Get active incidents
    const incidentsResult = await query(`
      SELECT COUNT(*) as count FROM netown.incidents WHERE status = 'active'
    `);

    const health = healthResult.rows[0];
    const metrics = metricsResult.rows[0];
    const incidents = incidentsResult.rows[0];

    // Calculate estimated TPS (simplified)
    const estimatedTPS = 2.1; // XDC Network averages around 2 TPS

    const socialCardData = {
      network: 'XDC Network',
      chainId: '50',
      stats: {
        blockHeight: parseInt(metrics?.max_block_height || '0'),
        activeNodes: parseInt(metrics?.active_nodes || '0'),
        totalPeers: parseInt(metrics?.total_peers || '0'),
        healthScore: health?.health_score || 0,
        estimatedTPS,
        activeIncidents: parseInt(incidents?.count || '0'),
      },
      status: health?.health_score >= 90 ? 'healthy' : 
              health?.health_score >= 70 ? 'degraded' : 'critical',
      colors: {
        primary: '#1E90FF',
        secondary: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
      },
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(socialCardData);
  } catch (error) {
    console.error('Error generating social card data:', error);
    return NextResponse.json(
      { error: 'Failed to generate social card data' },
      { status: 500 }
    );
  }
}
