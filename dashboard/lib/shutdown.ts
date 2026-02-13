/**
 * XDC SkyNet - Graceful Shutdown Handler
 * Ensures clean shutdown of all services
 */

import { closePool } from './db/client';
import { closeRedis } from './redis';
import { stopWebSocketServer } from './ws-server';
import { logger } from './logger';

// =============================================================================
// Shutdown State
// =============================================================================

let isShuttingDown = false;
const shutdownTimeout = parseInt(process.env.SHUTDOWN_TIMEOUT || '30000');

// =============================================================================
// Cleanup Handlers
// =============================================================================

type CleanupHandler = () => Promise<void>;

const cleanupHandlers: Array<{ name: string; handler: CleanupHandler }> = [];

export function registerCleanupHandler(name: string, handler: CleanupHandler): void {
  cleanupHandlers.push({ name, handler });
}

// =============================================================================
// Graceful Shutdown
// =============================================================================

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn(`Shutdown already in progress, ignoring ${signal}`);
    return;
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Set a timeout for forced shutdown
  const forceShutdownTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, shutdownTimeout);

  try {
    // Run custom cleanup handlers
    for (const { name, handler } of cleanupHandlers) {
      try {
        logger.info(`Running cleanup: ${name}`);
        await handler();
        logger.info(`Cleanup completed: ${name}`);
      } catch (error) {
        logger.error(`Cleanup failed: ${name}`, error as Error);
      }
    }

    // Stop WebSocket server
    logger.info('Stopping WebSocket server...');
    await stopWebSocketServer();

    // Close Redis connection
    logger.info('Closing Redis connection...');
    await closeRedis();

    // Close database pool
    logger.info('Closing database pool...');
    await closePool();

    clearTimeout(forceShutdownTimer);
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', error as Error);
    clearTimeout(forceShutdownTimer);
    process.exit(1);
  }
}

// =============================================================================
// Signal Handlers
// =============================================================================

export function setupShutdownHandlers(): void {
  // Handle termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.fatal('Uncaught exception', error);
    gracefulShutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', reason as Error, {
      promise: String(promise),
    });
  });

  logger.info('Graceful shutdown handlers registered');
}

// =============================================================================
// Health Indicator
// =============================================================================

export function isHealthy(): boolean {
  return !isShuttingDown;
}

export function isShuttingDownStatus(): boolean {
  return isShuttingDown;
}
