/**
 * XDC SkyNet - Database Migration System
 * Manages schema versioning with up/down migrations
 */

import { Pool } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../lib/logger';

// =============================================================================
// Types
// =============================================================================

interface Migration {
  id: number;
  name: string;
  up: string;
  down: string;
}

interface MigrationRecord {
  id: number;
  name: string;
  applied_at: Date;
}

// =============================================================================
// Configuration
// =============================================================================

const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR || path.join(process.cwd(), 'migrations');
const DB_SCHEMA = process.env.DB_SCHEMA || 'skynet';

// =============================================================================
// Migration Table Setup
// =============================================================================

async function ensureMigrationTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${DB_SCHEMA}.schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}

// =============================================================================
// Migration Loading
// =============================================================================

async function loadMigrations(): Promise<Migration[]> {
  const migrations: Migration[] = [];
  
  try {
    const files = await fs.readdir(MIGRATIONS_DIR);
    
    // Filter and sort migration files
    const migrationFiles = files
      .filter(f => f.match(/^\d+_.+\.(up|down)\.sql$/))
      .sort();
    
    // Group by ID
    const grouped = new Map<number, { name: string; up?: string; down?: string }>();
    
    for (const file of migrationFiles) {
      const match = file.match(/^(\d+)_(.+)\.(up|down)\.sql$/);
      if (!match) continue;
      
      const [, idStr, name, direction] = match;
      const id = parseInt(idStr, 10);
      
      if (!grouped.has(id)) {
        grouped.set(id, { name });
      }
      
      const content = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf-8');
      const entry = grouped.get(id)!;
      
      if (direction === 'up') {
        entry.up = content;
      } else {
        entry.down = content;
      }
    }
    
    // Convert to array
    for (const [id, entry] of grouped) {
      if (entry.up) {
        migrations.push({
          id,
          name: entry.name,
          up: entry.up,
          down: entry.down || '',
        });
      }
    }
    
    return migrations.sort((a, b) => a.id - b.id);
  } catch (error) {
    logger.error('Failed to load migrations', error as Error);
    return [];
  }
}

async function getAppliedMigrations(pool: Pool): Promise<MigrationRecord[]> {
  const result = await pool.query(
    `SELECT id, name, applied_at FROM ${DB_SCHEMA}.schema_migrations ORDER BY id`
  );
  return result.rows;
}

// =============================================================================
// Migration Execution
// =============================================================================

export async function migrate(pool: Pool, target?: number): Promise<void> {
  await ensureMigrationTable(pool);
  
  const migrations = await loadMigrations();
  const applied = await getAppliedMigrations(pool);
  const appliedIds = new Set(applied.map(a => a.id));
  
  // Determine which migrations to apply
  const toApply = migrations.filter(m => {
    if (target !== undefined) {
      return m.id <= target && !appliedIds.has(m.id);
    }
    return !appliedIds.has(m.id);
  });
  
  if (toApply.length === 0) {
    logger.info('No migrations to apply');
    return;
  }
  
  logger.info(`Applying ${toApply.length} migration(s)...`);
  
  for (const migration of toApply) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      logger.info(`Applying migration ${migration.id}: ${migration.name}`);
      await client.query(migration.up);
      
      await client.query(
        `INSERT INTO ${DB_SCHEMA}.schema_migrations (id, name) VALUES ($1, $2)`,
        [migration.id, migration.name]
      );
      
      await client.query('COMMIT');
      logger.info(`Migration ${migration.id} applied successfully`);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      logger.error(`Migration ${migration.id} failed`, error as Error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  logger.info('All migrations applied successfully');
}

export async function rollback(pool: Pool, steps: number = 1): Promise<void> {
  await ensureMigrationTable(pool);
  
  const migrations = await loadMigrations();
  const applied = await getAppliedMigrations(pool);
  
  if (applied.length === 0) {
    logger.info('No migrations to rollback');
    return;
  }
  
  // Get migrations to rollback
  const toRollback = applied
    .slice(-steps)
    .map(a => migrations.find(m => m.id === a.id))
    .filter((m): m is Migration => m !== undefined)
    .reverse();
  
  if (toRollback.length === 0) {
    logger.info('No migrations to rollback');
    return;
  }
  
  logger.info(`Rolling back ${toRollback.length} migration(s)...`);
  
  for (const migration of toRollback) {
    if (!migration.down) {
      logger.warn(`Migration ${migration.id} has no down script, skipping`);
      continue;
    }
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      logger.info(`Rolling back migration ${migration.id}: ${migration.name}`);
      await client.query(migration.down);
      
      await client.query(
        `DELETE FROM ${DB_SCHEMA}.schema_migrations WHERE id = $1`,
        [migration.id]
      );
      
      await client.query('COMMIT');
      logger.info(`Migration ${migration.id} rolled back successfully`);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      logger.error(`Rollback of migration ${migration.id} failed`, error as Error);
      throw error;
    } finally {
      client.release();
    }
  }
  
  logger.info('Rollback completed');
}

export async function status(pool: Pool): Promise<void> {
  await ensureMigrationTable(pool);
  
  const migrations = await loadMigrations();
  const applied = await getAppliedMigrations(pool);
  const appliedIds = new Set(applied.map(a => a.id));
  
  console.log('\n📊 Migration Status\n');
  console.log('ID  | Name                           | Status    | Applied At');
  console.log('----|--------------------------------|-----------|----------------------');
  
  for (const migration of migrations) {
    const isApplied = appliedIds.has(migration.id);
    const appliedRecord = applied.find(a => a.id === migration.id);
    const status = isApplied ? '✅ Applied' : '⏳ Pending';
    const appliedAt = appliedRecord 
      ? appliedRecord.applied_at.toISOString() 
      : '-';
    
    console.log(
      `${migration.id.toString().padEnd(3)} | ${migration.name.padEnd(30)} | ${status.padEnd(9)} | ${appliedAt}`
    );
  }
  
  const pending = migrations.filter(m => !appliedIds.has(m.id)).length;
  console.log(`\n${applied.length} applied, ${pending} pending`);
}

export async function create(name: string): Promise<void> {
  const migrations = await loadMigrations();
  const nextId = migrations.length > 0 
    ? Math.max(...migrations.map(m => m.id)) + 1 
    : 1;
  
  const paddedId = nextId.toString().padStart(3, '0');
  const fileName = name.toLowerCase().replace(/\s+/g, '_');
  
  const upFile = `${paddedId}_${fileName}.up.sql`;
  const downFile = `${paddedId}_${fileName}.down.sql`;
  
  // Ensure migrations directory exists
  await fs.mkdir(MIGRATIONS_DIR, { recursive: true });
  
  // Create files
  await fs.writeFile(
    path.join(MIGRATIONS_DIR, upFile),
    `-- Migration ${nextId}: ${name}\n-- Up\n\n`,
    'utf-8'
  );
  
  await fs.writeFile(
    path.join(MIGRATIONS_DIR, downFile),
    `-- Migration ${nextId}: ${name}\n-- Down\n\n`,
    'utf-8'
  );
  
  logger.info(`Created migration files:`);
  logger.info(`  - ${upFile}`);
  logger.info(`  - ${downFile}`);
}

// =============================================================================
// CLI Interface
// =============================================================================

async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];
  
  const { getPool } = await import('./client');
  const pool = getPool();
  
  try {
    switch (command) {
      case 'up':
        await migrate(pool, arg ? parseInt(arg, 10) : undefined);
        break;
      
      case 'down':
        await rollback(pool, arg ? parseInt(arg, 10) : 1);
        break;
      
      case 'status':
        await status(pool);
        break;
      
      case 'create':
        if (!arg) {
          console.error('Usage: migrate create <migration-name>');
          process.exit(1);
        }
        await create(arg);
        break;
      
      default:
        console.log('Usage: migrate [up|down|status|create] [arg]');
        console.log('');
        console.log('Commands:');
        console.log('  up [target]    - Run pending migrations (up to optional target)');
        console.log('  down [steps]   - Rollback migrations (default: 1)');
        console.log('  status         - Show migration status');
        console.log('  create <name> - Create a new migration');
        process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
