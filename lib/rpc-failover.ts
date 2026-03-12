/**
 * Automated Failover for Upstream RPC Endpoints
 * 
 * Implements health checks, circuit breakers, and automatic failover
 * for multiple upstream RPC endpoints.
 * 
 * @module lib/rpc-failover
 * @see https://github.com/AnilChinchawale/XDCNetOwn/issues/670
 */

import EventEmitter from 'events';

export interface UpstreamConfig {
  name: string;
  url: string;
  weight: number;
  region?: string;
  timeout: number;
  retries: number;
  healthCheck: {
    interval: number;
    path: string;
    method: string;
    expectedStatus: number;
  };
  circuitBreaker: {
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
  };
}

export interface UpstreamStatus {
  name: string;
  url: string;
  isHealthy: boolean;
  isCircuitOpen: boolean;
  lastChecked: Date;
  lastError?: string;
  responseTime: number;
  failureCount: number;
  successCount: number;
  requestCount: number;
  errorRate: number;
}

export interface RpcRequest {
  jsonrpc: string;
  method: string;
  params: any[];
  id: number;
}

export interface RpcResponse {
  jsonrpc: string;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
  id: number;
}

// Circuit breaker states
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreaker {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: Date;
  nextAttempt?: Date;
}

/**
 * RPC Failover Manager with health checks and circuit breakers
 */
export class RpcFailoverManager extends EventEmitter {
  private upstreams: Map<string, UpstreamConfig> = new Map();
  private status: Map<string, UpstreamStatus> = new Map();
  private circuits: Map<string, CircuitBreaker> = new Map();
  private healthCheckTimers: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;

  constructor(upstreams: UpstreamConfig[]) {
    super();
    
    for (const upstream of upstreams) {
      this.upstreams.set(upstream.name, upstream);
      this.status.set(upstream.name, {
        name: upstream.name,
        url: upstream.url,
        isHealthy: true,
        isCircuitOpen: false,
        lastChecked: new Date(),
        responseTime: 0,
        failureCount: 0,
        successCount: 0,
        requestCount: 0,
        errorRate: 0,
      });
      this.circuits.set(upstream.name, {
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
      });
    }
  }

  /**
   * Start health check monitoring
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[RpcFailover] Starting health check monitoring...');

    for (const [name, upstream] of this.upstreams) {
      // Run initial health check
      this.checkHealth(name);
      
      // Schedule periodic health checks
      const timer = setInterval(
        () => this.checkHealth(name),
        upstream.healthCheck.interval
      );
      this.healthCheckTimers.set(name, timer);
    }
  }

  /**
   * Stop health check monitoring
   */
  stop(): void {
    this.isRunning = false;
    
    for (const [name, timer] of this.healthCheckTimers) {
      clearInterval(timer);
      this.healthCheckTimers.delete(name);
    }
    
    console.log('[RpcFailover] Stopped health check monitoring');
  }

  /**
   * Execute RPC request with failover
   */
  async executeRequest(request: RpcRequest): Promise<RpcResponse> {
    const healthyUpstreams = this.getHealthyUpstreams();
    
    if (healthyUpstreams.length === 0) {
      throw new Error('No healthy upstreams available');
    }

    // Sort by weight (higher weight = preferred)
    const sortedUpstreams = healthyUpstreams.sort((a, b) => {
      const configA = this.upstreams.get(a.name)!;
      const configB = this.upstreams.get(b.name)!;
      return configB.weight - configA.weight;
    });

    let lastError: Error | undefined;

    for (const upstream of sortedUpstreams) {
      try {
        const response = await this.tryRequest(upstream.name, request);
        this.recordSuccess(upstream.name);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.recordFailure(upstream.name, lastError.message);
        console.warn(`[RpcFailover] Request to ${upstream.name} failed:`, lastError.message);
      }
    }

    throw lastError || new Error('All upstreams failed');
  }

  /**
   * Try request to a specific upstream
   */
  private async tryRequest(
    upstreamName: string,
    request: RpcRequest
  ): Promise<RpcResponse> {
    const upstream = this.upstreams.get(upstreamName)!;
    const circuit = this.circuits.get(upstreamName)!;

    // Check circuit breaker
    if (circuit.state === CircuitState.OPEN) {
      if (circuit.nextAttempt && Date.now() < circuit.nextAttempt.getTime()) {
        throw new Error(`Circuit breaker open for ${upstreamName}`);
      }
      // Try half-open
      circuit.state = CircuitState.HALF_OPEN;
    }

    const startTime = Date.now();

    try {
      const response = await fetch(upstream.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(upstream.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Update response time
      const responseTime = Date.now() - startTime;
      this.updateResponseTime(upstreamName, responseTime);

      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Health check an upstream
   */
  private async checkHealth(name: string): Promise<void> {
    const upstream = this.upstreams.get(name)!;
    const status = this.status.get(name)!;

    const startTime = Date.now();

    try {
      // Simple health check - call eth_blockNumber
      const response = await fetch(upstream.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
        signal: AbortSignal.timeout(upstream.timeout),
      });

      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const data = await response.json();
        if (data.result) {
          this.updateHealthStatus(name, true, responseTime);
        } else {
          this.updateHealthStatus(name, false, responseTime, 'Invalid response');
        }
      } else {
        this.updateHealthStatus(name, false, responseTime, `HTTP ${response.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.updateHealthStatus(name, false, Date.now() - startTime, message);
    }
  }

  /**
   * Update health status for an upstream
   */
  private updateHealthStatus(
    name: string,
    isHealthy: boolean,
    responseTime: number,
    errorMessage?: string
  ): void {
    const status = this.status.get(name)!;
    
    status.isHealthy = isHealthy;
    status.responseTime = responseTime;
    status.lastChecked = new Date();
    
    if (!isHealthy) {
      status.lastError = errorMessage;
      status.failureCount++;
    } else {
      status.successCount++;
    }
    
    status.requestCount = status.failureCount + status.successCount;
    status.errorRate = status.requestCount > 0 
      ? status.failureCount / status.requestCount 
      : 0;

    // Update circuit breaker status
    const circuit = this.circuits.get(name)!;
    status.isCircuitOpen = circuit.state === CircuitState.OPEN;

    this.emit('healthUpdate', { name, status });
  }

  /**
   * Record successful request
   */
  private recordSuccess(name: string): void {
    const circuit = this.circuits.get(name)!;
    
    if (circuit.state === CircuitState.HALF_OPEN) {
      circuit.successes++;
      
      if (circuit.successes >= this.upstreams.get(name)!.circuitBreaker.successThreshold) {
        circuit.state = CircuitState.CLOSED;
        circuit.failures = 0;
        circuit.successes = 0;
        console.log(`[RpcFailover] Circuit closed for ${name}`);
      }
    }
  }

  /**
   * Record failed request
   */
  private recordFailure(name: string, error: string): void {
    const upstream = this.upstreams.get(name)!;
    const circuit = this.circuits.get(name)!;
    const status = this.status.get(name)!;

    circuit.failures++;

    if (circuit.state === CircuitState.HALF_OPEN) {
      // Failed in half-open state, open circuit again
      this.openCircuit(name, upstream);
    } else if (circuit.failures >= upstream.circuitBreaker.failureThreshold) {
      // Threshold reached, open circuit
      this.openCircuit(name, upstream);
    }

    this.emit('failure', { name, error, status });
  }

  /**
   * Open circuit breaker
   */
  private openCircuit(name: string, upstream: UpstreamConfig): void {
    const circuit = this.circuits.get(name)!;
    
    circuit.state = CircuitState.OPEN;
    circuit.lastFailureTime = new Date();
    circuit.nextAttempt = new Date(Date.now() + upstream.circuitBreaker.timeout);
    
    console.warn(
      `[RpcFailover] Circuit opened for ${name}. ` +
      `Next attempt at ${circuit.nextAttempt.toISOString()}`
    );
    
    this.emit('circuitOpen', { name, nextAttempt: circuit.nextAttempt });
  }

  /**
   * Update response time
   */
  private updateResponseTime(name: string, responseTime: number): void {
    const status = this.status.get(name)!;
    // Exponential moving average
    const alpha = 0.3;
    status.responseTime = (alpha * responseTime) + ((1 - alpha) * status.responseTime);
  }

  /**
   * Get healthy upstreams
   */
  private getHealthyUpstreams(): UpstreamStatus[] {
    return Array.from(this.status.values()).filter(
      (s) => s.isHealthy && !s.isCircuitOpen
    );
  }

  /**
   * Get status of all upstreams
   */
  getAllStatus(): UpstreamStatus[] {
    return Array.from(this.status.values());
  }

  /**
   * Get status of specific upstream
   */
  getStatus(name: string): UpstreamStatus | undefined {
    return this.status.get(name);
  }

  /**
   * Manually mark upstream as unhealthy
   */
  markUnhealthy(name: string, reason: string): void {
    const status = this.status.get(name);
    if (status) {
      status.isHealthy = false;
      status.lastError = reason;
      this.emit('healthUpdate', { name, status });
    }
  }

  /**
   * Manually reset circuit breaker
   */
  resetCircuit(name: string): void {
    const circuit = this.circuits.get(name);
    if (circuit) {
      circuit.state = CircuitState.CLOSED;
      circuit.failures = 0;
      circuit.successes = 0;
      console.log(`[RpcFailover] Circuit manually reset for ${name}`);
    }
  }
}

/**
 * Initialize failover manager with default XDC upstreams
 */
export function initializeFailoverManager(): RpcFailoverManager {
  const upstreams: UpstreamConfig[] = [
    {
      name: 'xdc-primary',
      url: process.env.XDC_RPC_PRIMARY || 'https://rpc.xdc.org',
      weight: 100,
      region: 'us-east',
      timeout: 5000,
      retries: 3,
      healthCheck: {
        interval: 30000, // 30 seconds
        path: '/',
        method: 'POST',
        expectedStatus: 200,
      },
      circuitBreaker: {
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 60000, // 1 minute
      },
    },
    {
      name: 'xdc-secondary',
      url: process.env.XDC_RPC_SECONDARY || 'https://erpc.xinfin.network',
      weight: 80,
      region: 'eu-west',
      timeout: 5000,
      retries: 3,
      healthCheck: {
        interval: 30000,
        path: '/',
        method: 'POST',
        expectedStatus: 200,
      },
      circuitBreaker: {
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 60000,
      },
    },
    {
      name: 'xdc-tertiary',
      url: process.env.XDC_RPC_TERTIARY || 'https://rpc.xinfin.network',
      weight: 60,
      region: 'asia-southeast',
      timeout: 5000,
      retries: 3,
      healthCheck: {
        interval: 30000,
        path: '/',
        method: 'POST',
        expectedStatus: 200,
      },
      circuitBreaker: {
        failureThreshold: 5,
        successThreshold: 3,
        timeout: 60000,
      },
    },
  ].filter(u => u.url);

  return new RpcFailoverManager(upstreams);
}

export default RpcFailoverManager;
