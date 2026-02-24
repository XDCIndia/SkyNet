#!/usr/bin/env node
/**
 * XDC SkyNet - Data Retention Policy
 * 
 * Deletes old data according to retention policy:
 * - node_metrics: 90 days
 * - peer_snapshots: 30 days
 * - system_metrics: 30 days
 * - logs: 7 days
 * 
 * Run via cron: 0 2 * * * /usr/bin/node /path/to/data-retention.js
 * Or schedule via systemd timer / AWS Lambda / etc.
 */

import { Pool } from 'pg';

const RETENTION_DAYS = {
  node_metrics: 90,
  peer_snapshots: 30,
  system_metrics: 30,
  logs: 7,
};

// Issue #67 fix: Using only skynet schema (netown was legacy name)
const SCHEMAS = ['skynet'];

export async function runRetention(): Promise<{
  success: boolean;
  duration: string;
  totalDeleted: number;
  details: Array<{ table: string; deleted?: number; retentionDays?: number; error?: string; status?: string }>;
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
  const results: Array<{ table: string; deleted?: number; retentionDays?: number; error?: string; status?: string }> = [];
  
  try {
    console.log(`[${new Date().toISOString()}] Starting data retention cleanup...`);
    
    // Clean node_metrics for each schema
    for (const schema of SCHEMAS) {
      try {
        const result = await pool.query(`
          DELETE FROM ${schema}.node_metrics 
          WHERE collected_at < NOW() - INTERVAL '${RETENTION_DAYS.node_metrics} days'
        `);
        results.push({
          table: `${schema}.node_metrics`,
          deleted: result.rowCount || 0,
          retentionDays: RETENTION_DAYS.node_metrics,
        });
        console.log(`  Deleted ${result.rowCount} rows from ${schema}.node_metrics`);
      } catch (err) {
        const error = err as Error;
        console.error(`  Error cleaning ${schema}.node_metrics:`, error.message);
        results.push({
          table: `${schema}.node_metrics`,
          error: error.message,
        });
      }
    }
    
    // Clean peer_snapshots for each schema
    for (const schema of SCHEMAS) {
      try {
        const result = await pool.query(`
          DELETE FROM ${schema}.peer_snapshots 
          WHERE collected_at < NOW() - INTERVAL '${RETENTION_DAYS.peer_snapshots} days'
        `);
        results.push({
          table: `${schema}.peer_snapshots`,
          deleted: result.rowCount || 0,
          retentionDays: RETENTION_DAYS.peer_snapshots,
        });
        console.log(`  Deleted ${result.rowCount} rows from ${schema}.peer_snapshots`);
      } catch (err) {
        const error = err as Error;
        console.error(`  Error cleaning ${schema}.peer_snapshots:`, error.message);
        results.push({
          table: `${schema}.peer_snapshots`,
          error: error.message,
        });
      }
    }
    
    // Clean system_metrics for each schema
    for (const schema of SCHEMAS) {
      try {
        const result = await pool.query(`
          DELETE FROM ${schema}.system_metrics 
          WHERE collected_at < NOW() - INTERVAL '${RETENTION_DAYS.system_metrics} days'
        `);
        results.push({
          table: `${schema}.system_metrics`,
          deleted: result.rowCount || 0,
          retentionDays: RETENTION_DAYS.system_metrics,
        });
        console.log(`  Deleted ${result.rowCount} rows from ${schema}.system_metrics`);
      } catch (err) {
        const error = err as Error;
        // Table might not exist, that's ok
        if ((err as { code?: string }).code === '42P01') { // undefined_table
          console.log(`  Table ${schema}.system_metrics does not exist, skipping`);
        } else {
          console.error(`  Error cleaning ${schema}.system_metrics:`, error.message);
          results.push({
            table: `${schema}.system_metrics`,
            error: error.message,
          });
        }
      }
    }
    
    // Clean old logs for each schema
    for (const schema of SCHEMAS) {
      try {
        const result = await pool.query(`
          DELETE FROM ${schema}.logs 
          WHERE created_at < NOW() - INTERVAL '${RETENTION_DAYS.logs} days'
        `);
        results.push({
          table: `${schema}.logs`,
          deleted: result.rowCount || 0,
          retentionDays: RETENTION_DAYS.logs,
        });
        console.log(`  Deleted ${result.rowCount} rows from ${schema}.logs`);
      } catch (err) {
        const error = err as Error;
        // Table might not exist, that's ok
        if ((err as { code?: string }).code === '42P01') { // undefined_table
          console.log(`  Table ${schema}.logs does not exist, skipping`);
        } else {
          console.error(`  Error cleaning ${schema}.logs:`, error.message);
          results.push({
            table: `${schema}.logs`,
            error: error.message,
          });
        }
      }
    }
    
    // Clean resolved incidents older than 90 days
    for (const schema of SCHEMAS) {
      try {
        const result = await pool.query(`
          DELETE FROM ${schema}.incidents 
          WHERE status = 'resolved' 
          AND resolved_at < NOW() - INTERVAL '90 days'
        `);
        results.push({
          table: `${schema}.incidents`,
          deleted: result.rowCount || 0,
          status: 'resolved older than 90 days',
        });
        console.log(`  Deleted ${result.rowCount} resolved incidents from ${schema}.incidents`);
      } catch (err) {
        const error = err as Error;
        console.error(`  Error cleaning ${schema}.incidents:`, error.message);
        results.push({
          table: `${schema}.incidents`,
          error: error.message,
        });
      }
    }
    
    const duration = Date.now() - startTime;
    const totalDeleted = results
      .filter((r): r is { table: string; deleted: number; retentionDays?: number } => r.deleted !== undefined)
      .reduce((sum, r) => sum + r.deleted, 0);
    
    console.log(`[${new Date().toISOString()}] Cleanup completed in ${duration}ms`);
    console.log(`Total rows deleted: ${totalDeleted}`);
    
    // Return summary for potential API response
    return {
      success: true,
      duration: `${duration}ms`,
      totalDeleted,
      details: results,
    };
    
  } catch (error) {
    console.error('Fatal error during retention cleanup:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runRetention()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
