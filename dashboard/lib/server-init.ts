/**
 * Server-side initialization
 * 
 * This file runs once on server startup to initialize background services.
 * Must be imported in a server component (like layout.tsx) to execute.
 * 
 * Issue: #684 - Alert Trigger Engine Not Connected
 */

import { startBackgroundJobs } from '@/services/background-jobs';
import { logger } from '@/lib/logger';

// Track if initialization has already run
let initialized = false;

/**
 * Initialize server-side services
 * This function is safe to call multiple times - it only runs once
 */
export function initializeServer(): void {
  if (initialized) {
    return;
  }

  // Only run on server
  if (typeof window !== 'undefined') {
    return;
  }

  logger.info('=== XDC SkyNet Server Initialization ===');

  try {
    // Start all background jobs
    startBackgroundJobs();
    
    initialized = true;
    logger.info('=== Server Initialization Complete ===');
  } catch (error) {
    logger.error('Server initialization failed', { error });
  }
}

// Auto-initialize when this module is imported
initializeServer();
