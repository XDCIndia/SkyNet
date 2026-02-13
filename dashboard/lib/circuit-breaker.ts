/**
 * XDC SkyNet - Circuit Breaker Pattern
 * Prevents cascading failures when external services are down
 */

import { logger } from './logger';

// =============================================================================
// Circuit Breaker States
// =============================================================================

export enum CircuitState {
  CLOSED = 'CLOSED',       // Normal operation
  OPEN = 'OPEN',           // Failing, rejecting requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

// =============================================================================
// Circuit Breaker Configuration
// =============================================================================

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening
  resetTimeoutMs: number;        // Time before attempting reset
  halfOpenMaxCalls: number;      // Max calls in half-open state
  successThreshold: number;      // Successes needed to close
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxCalls: 3,
  successThreshold: 2,
};

// =============================================================================
// Circuit Breaker Class
// =============================================================================

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private halfOpenCalls = 0;
  private lastFailureTime: number | null = null;
  private nextAttempt: number = Date.now();
  private name: string;
  private config: CircuitBreakerConfig;

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  getState(): CircuitState {
    // Check if we should transition from OPEN to HALF_OPEN
    if (this.state === CircuitState.OPEN && Date.now() >= this.nextAttempt) {
      this.state = CircuitState.HALF_OPEN;
      this.halfOpenCalls = 0;
      this.successes = 0;
      logger.info(`Circuit breaker '${this.name}' entering HALF_OPEN state`);
    }
    
    return this.state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === CircuitState.OPEN) {
      throw new CircuitBreakerError(
        `Circuit breaker '${this.name}' is OPEN`,
        this.nextAttempt - Date.now()
      );
    }

    if (currentState === CircuitState.HALF_OPEN) {
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        throw new CircuitBreakerError(
          `Circuit breaker '${this.name}' HALF_OPEN limit reached`,
          this.nextAttempt - Date.now()
        );
      }
      this.halfOpenCalls++;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      
      if (this.successes >= this.config.successThreshold) {
        this.reset();
      }
    } else {
      this.failures = Math.max(0, this.failures - 1);
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.config.failureThreshold) {
      this.trip();
    }
  }

  private trip(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.config.resetTimeoutMs;
    logger.warn(`Circuit breaker '${this.name}' OPENED until ${new Date(this.nextAttempt).toISOString()}`);
  }

  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.halfOpenCalls = 0;
    logger.info(`Circuit breaker '${this.name}' CLOSED (recovered)`);
  }

  forceOpen(): void {
    this.trip();
  }

  forceClose(): void {
    this.reset();
  }

  getMetrics(): {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailureTime: number | null;
    nextAttempt: number;
  } {
    return {
      state: this.getState(),
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt,
    };
  }
}

// =============================================================================
// Circuit Breaker Error
// =============================================================================

export class CircuitBreakerError extends Error {
  constructor(
    message: string,
    public readonly retryAfterMs: number
  ) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

// =============================================================================
// Global Circuit Breakers
// =============================================================================

const circuitBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(
  name: string,
  config?: Partial<CircuitBreakerConfig>
): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker(name, config));
  }
  return circuitBreakers.get(name)!;
}

export function getAllCircuitBreakerMetrics(): Record<string, ReturnType<CircuitBreaker['getMetrics']>> {
  const metrics: Record<string, ReturnType<CircuitBreaker['getMetrics']>> = {};
  
  for (const [name, breaker] of circuitBreakers) {
    metrics[name] = breaker.getMetrics();
  }
  
  return metrics;
}
