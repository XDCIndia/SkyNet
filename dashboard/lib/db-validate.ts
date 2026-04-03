/**
 * Database URL startup validator — Issue #61
 *
 * Call validateDatabaseUrl() at app startup (e.g. in instrumentation.ts or
 * the first server action). Exits the process with a descriptive error if
 * DATABASE_URL is missing, malformed, or the DB is unreachable.
 */

import { logger } from '@/lib/logger';

const VALID_SCHEMES = ['postgresql://', 'postgres://'];

export function validateDatabaseUrl(): void {
  const url = process.env.DATABASE_URL;

  if (!url) {
    logger.error(
      '[DB Validate] DATABASE_URL is not set. ' +
        'Copy .env.example to .env and fill in your credentials.'
    );
    process.exit(1);
  }

  const hasValidScheme = VALID_SCHEMES.some((s) => url.startsWith(s));
  if (!hasValidScheme) {
    logger.error(
      '[DB Validate] DATABASE_URL must start with postgresql:// or postgres://. ' +
        `Got: "${url.slice(0, 40)}…"`
    );
    process.exit(1);
  }

  // Parse and validate structure
  try {
    const parsed = new URL(url);
    if (!parsed.hostname) throw new Error('missing hostname');
    if (!parsed.pathname || parsed.pathname === '/') throw new Error('missing database name');
  } catch (err: any) {
    logger.error(
      `[DB Validate] DATABASE_URL is malformed: ${err.message}. ` +
        'Expected format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE'
    );
    process.exit(1);
  }
}

/**
 * Async version that also attempts a test connection.
 * Call this in server startup only (not in edge runtime).
 */
export async function validateDatabaseConnection(): Promise<void> {
  validateDatabaseUrl();

  try {
    const { query } = await import('@/lib/db');
    await query('SELECT 1');
    logger.info('[DB Validate] Database connection OK');
  } catch (err: any) {
    logger.error(
      `[DB Validate] Cannot connect to database: ${err.message}. ` +
        'Check DATABASE_URL, ensure PostgreSQL/TimescaleDB is running, ' +
        'and verify network access.'
    );
    process.exit(1);
  }
}
