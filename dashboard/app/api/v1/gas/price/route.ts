import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

/**
 * Gas Price Oracle API
 * 
 * Provides real-time and predicted gas prices based on network congestion
 * Issue #687
 * 
 * GET /api/v1/gas/price
 */
export async function GET(request: NextRequest) {
  try {
    // Get recent gas prices from transactions
    const gasData = await query(`
      SELECT 
        AVG((metrics->>'gasPrice')::numeric) as avg_gas_price,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY (metrics->>'gasPrice')::numeric) as safe_gas,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY (metrics->>'gasPrice')::numeric) as avg_gas,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY (metrics->>'gasPrice')::numeric) as fast_gas,
        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY (metrics->>'gasPrice')::numeric) as fastest_gas,
        COUNT(*) as sample_size
      FROM skynet.node_metrics
      WHERE collected_at > NOW() - INTERVAL '10 minutes'
        AND (metrics->>'gasPrice')::numeric > 0
    `);

    const row = gasData.rows[0];
    
    // Default values if no data
    const safe = parseFloat(row?.safe_gas) || 0.25;
    const average = parseFloat(row?.avg_gas) || 0.5;
    const fast = parseFloat(row?.fast_gas) || 1.0;
    const fastest = parseFloat(row?.fastest_gas) || 2.0;

    // Calculate network congestion
    const congestion = calculateCongestion(parseFloat(row?.avg_gas_price) || 0.5);

    // Predict next block gas price (simple linear prediction)
    const prediction = await predictGasPrice(average, congestion);

    // Get historical trend
    const trend = await getGasPriceTrend();

    return NextResponse.json({
      safe,
      average,
      fast,
      fastest,
      predicted: prediction,
      congestion: {
        level: congestion.level,
        percentage: congestion.percentage,
      },
      trend,
      timestamp: new Date().toISOString(),
      unit: 'Gwei',
      sample_size: parseInt(row?.sample_size) || 0,
    }, { status: 200 });

  } catch (error) {
    console.error('Gas price fetch error:', error);
    
    // Return default values on error
    return NextResponse.json({
      safe: 0.25,
      average: 0.5,
      fast: 1.0,
      fastest: 2.0,
      predicted: {
        next_block: 0.6,
        next_5_blocks: 0.75,
      },
      congestion: {
        level: 'medium',
        percentage: 50,
      },
      trend: 'stable',
      timestamp: new Date().toISOString(),
      unit: 'Gwei',
      fallback: true,
    }, { status: 200 });
  }
}

/**
 * Calculate network congestion level
 */
function calculateCongestion(avgGasPrice: number): { level: string; percentage: number } {
  // XDC gas prices typically range from 0.1 to 10 Gwei
  if (avgGasPrice < 0.3) {
    return { level: 'low', percentage: 25 };
  } else if (avgGasPrice < 0.8) {
    return { level: 'medium', percentage: 50 };
  } else if (avgGasPrice < 2.0) {
    return { level: 'high', percentage: 75 };
  } else {
    return { level: 'very_high', percentage: 90 };
  }
}

/**
 * Predict gas prices for future blocks
 */
async function predictGasPrice(current: number, congestion: { level: string; percentage: number }) {
  // Simple prediction based on congestion trend
  const basePrediction = current * (1 + congestion.percentage / 200);
  
  return {
    next_block: Math.round(basePrediction * 100) / 100,
    next_5_blocks: Math.round(basePrediction * 1.2 * 100) / 100,
    confidence: congestion.percentage > 70 ? 'low' : 'medium',
  };
}

/**
 * Get gas price trend over time
 */
async function getGasPriceTrend(): Promise<string> {
  try {
    const result = await query(`
      SELECT 
        AVG(CASE WHEN collected_at > NOW() - INTERVAL '5 minutes' THEN (metrics->>'gasPrice')::numeric END) as recent_avg,
        AVG(CASE WHEN collected_at BETWEEN NOW() - INTERVAL '10 minutes' AND NOW() - INTERVAL '5 minutes' THEN (metrics->>'gasPrice')::numeric END) as previous_avg
      FROM skynet.node_metrics
      WHERE collected_at > NOW() - INTERVAL '10 minutes'
        AND (metrics->>'gasPrice')::numeric > 0
    `);

    const recent = parseFloat(result.rows[0]?.recent_avg) || 0;
    const previous = parseFloat(result.rows[0]?.previous_avg) || 0;

    if (recent > previous * 1.2) {
      return 'rising';
    } else if (recent < previous * 0.8) {
      return 'falling';
    } else {
      return 'stable';
    }
  } catch {
    return 'stable';
  }
}
