#!/usr/bin/env node
/**
 * XDC SkyNet - Data Retention Job (Issue #614)
 * 
 * Deletes metrics older than 30 days from node_metrics table.
 * Table partitioning could be implemented as future work for better
 * performance with large time-series datasets (see Issue #450).
 * 
 * Run via: node scripts/retention-job.ts
 * Or cron: 0 2 * * * cd /path/to/dashboard && node scripts/retention-job.ts
 */

import { Pool } from 'pg';

// Retention policy: 30 days for time-series metrics
const METRICS_RETENTION_DAYS = 30;

export async function runRetentionJob(): Promise<{
  success: boolean;
  deleted: number;
  durationMs: number;
  error?: string;
}> {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 2,
  });
  
  const startTime = Date.now();
  
  try {
    console.log(`[${new Date().toISOString()}] Starting retention cleanup (>${METRICS_RETENTION_DAYS} days)...`);
    
    // Delete old metrics
    // Note: Table partitioning (Issue #450) could improve performance by
    // allowing DROP TABLE for old partitions instead of DELETE. Consider
    // implementing range partitioning by collected_at if table grows >100M rows.
    const result = await pool.query(`
      DELETE FROM skynet.node_metrics 
      WHERE collected_at < NOW() - INTERVAL '${METRICS_RETENTION_DAYS} days'
    `);
    
    const deleted = result.rowCount || 0;
    const durationMs = Date.now() - startTime;
    
    console.log(`[${new Date().toISOString()}] Retention cleanup completed in ${durationMs}ms`);
    console.log(`  Deleted ${deleted} rows from skynet.node_metrics`);
    
    return {
      success: true,
      deleted,
      durationMs,
    };
    
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[${new Date().toISOString()}] Retention cleanup failed after ${durationMs}ms:`, errorMsg);
    
    return {
      success: false,
      deleted: 0,
      durationMs,
      error: errorMsg,
    };
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runRetentionJob()
    .then((result) => {
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
