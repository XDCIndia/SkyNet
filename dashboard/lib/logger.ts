/**
 * XDC SkyNet - Structured Logging
 * Provides JSON structured logging with request context
 */

import { getRequestContext, getCurrentRequestId } from './request-context';

// =============================================================================
// Log Levels
// =============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

const CURRENT_LOG_LEVEL = (process.env.LOG_LEVEL as LogLevel) || 'info';

// =============================================================================
// Log Entry Structure
// =============================================================================

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  service: string;
  version: string;
}

// =============================================================================
// Logger Class
// =============================================================================

class Logger {
  private service = 'skynet';
  private version = process.env.npm_package_version || '0.2.0';

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[CURRENT_LOG_LEVEL];
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      requestId: getCurrentRequestId(),
      service: this.service,
      version: this.version,
    };

    if (context && Object.keys(context).length > 0) {
      entry.context = context;
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      };
    }

    return entry;
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, context, error);
    
    // In production, you'd send this to a log aggregator
    // For now, we use console with JSON formatting in prod, pretty in dev
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(entry));
    } else {
      const color = this.getColor(level);
      const reset = '\x1b[0m';
      const reqId = entry.requestId ? ` [${entry.requestId.slice(0, 8)}]` : '';
      console.log(`${color}[${entry.level.toUpperCase()}]${reset}${reqId} ${message}`);
      
      if (context && Object.keys(context).length > 0) {
        console.log('  Context:', context);
      }
      
      if (error && process.env.NODE_ENV === 'development') {
        console.error('  Error:', error.stack);
      }
    }
  }

  private getColor(level: LogLevel): string {
    switch (level) {
      case 'debug': return '\x1b[36m'; // Cyan
      case 'info': return '\x1b[32m'; // Green
      case 'warn': return '\x1b[33m'; // Yellow
      case 'error': return '\x1b[31m'; // Red
      case 'fatal': return '\x1b[35m'; // Magenta
      default: return '\x1b[0m';
    }
  }

  // Public API
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>, error?: Error): void {
    this.log('warn', message, context, error);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', message, context, error);
  }

  fatal(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('fatal', message, context, error);
  }

  // Request logging helper
  logRequest(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    extra?: Record<string, unknown>
  ): void {
    const context: Record<string, unknown> = {
      method,
      path,
      statusCode,
      durationMs,
      ...extra,
    };

    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    this.log(level, `${method} ${path} ${statusCode} ${durationMs}ms`, context);
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const logger = new Logger();

// =============================================================================
// Convenience Exports
// =============================================================================

export const log = {
  debug: logger.debug.bind(logger),
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
  fatal: logger.fatal.bind(logger),
  request: logger.logRequest.bind(logger),
};
