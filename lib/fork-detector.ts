/**
 * Network Fork Detection System
 * Detects consensus forks by comparing block hashes across multiple RPC endpoints
 * 
 * @module lib/fork-detector
 * @see https://github.com/AnilChinchawale/XDCNetOwn/issues/679
 * @see https://github.com/AnilChinchawale/XDCNetOwn/issues/452
 */

import { query } from './db';

export interface RpcEndpoint {
  name: string;
  url: string;
  clientType: 'geth' | 'erigon' | 'nethermind' | 'reth';
  region?: string;
  isHealthy: boolean;
}

export interface BlockData {
  number: number;
  hash: string;
  parentHash: string;
  timestamp: number;
  stateRoot: string;
  receiptRoot: string;
}

export interface ForkReport {
  detectedAt: Date;
  blockNumber: number;
  severity: 'critical' | 'warning' | 'info';
  affectedClients: string[];
  expectedHash: string;
  divergentHashes: Map<string, string[]>; // hash -> endpoint names
  details: string;
  recommendedAction: string;
}

export interface Divergence {
  blockNumber: number;
  hash1: string;
  hash2: string;
  endpoint1: string;
  endpoint2: string;
  timestamp: Date;
}

export class ForkDetector {
  private endpoints: RpcEndpoint[];
  private confirmationDepth: number;
  private checkIntervalMs: number;
  private alertThreshold: number;
  private isRunning: boolean = false;
  private checkTimer?: NodeJS.Timeout;

  constructor(config: {
    endpoints: RpcEndpoint[];
    confirmationDepth?: number;
    checkIntervalMs?: number;
    alertThreshold?: number;
  }) {
    this.endpoints = config.endpoints;
    this.confirmationDepth = config.confirmationDepth || 6;
    this.checkIntervalMs = config.checkIntervalMs || 30000;
    this.alertThreshold = config.alertThreshold || 3;
  }

  /**
   * Start continuous fork monitoring
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[ForkDetector] Starting fork detection monitoring...');
    
    // Run initial check
    this.checkForForks();
    
    // Schedule periodic checks
    this.checkTimer = setInterval(() => {
      this.checkForForks();
    }, this.checkIntervalMs);
  }

  /**
   * Stop fork monitoring
   */
  stop(): void {
    this.isRunning = false;
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
    console.log('[ForkDetector] Stopped fork detection monitoring');
  }

  /**
   * Check for forks across all configured endpoints
   */
  async checkForForks(): Promise<ForkReport | null> {
    try {
      const latestBlockNumber = await this.getLatestBlockNumber();
      if (!latestBlockNumber) return null;

      // Check blocks at confirmation depth behind head
      const checkBlockNumber = latestBlockNumber - this.confirmationDepth;
      
      const blockData = await this.fetchBlockFromAllEndpoints(checkBlockNumber);
      const divergence = this.detectDivergence(blockData);
      
      if (divergence) {
        const report = this.generateForkReport(divergence, blockData);
        await this.persistDivergenceEvent(report);
        await this.triggerAlert(report);
        return report;
      }

      return null;
    } catch (error) {
      console.error('[ForkDetector] Error checking for forks:', error);
      return null;
    }
  }

  /**
   * Fetch the same block from all endpoints
   */
  private async fetchBlockFromAllEndpoints(
    blockNumber: number
  ): Promise<Map<string, BlockData | null>> {
    const results = new Map<string, BlockData | null>();
    
    const promises = this.endpoints.map(async (endpoint) => {
      try {
        const block = await this.fetchBlock(endpoint, blockNumber);
        results.set(endpoint.name, block);
      } catch (error) {
        console.warn(`[ForkDetector] Failed to fetch from ${endpoint.name}:`, error);
        results.set(endpoint.name, null);
      }
    });
    
    await Promise.all(promises);
    return results;
  }

  /**
   * Fetch a block from a single endpoint
   */
  private async fetchBlock(
    endpoint: RpcEndpoint,
    blockNumber: number
  ): Promise<BlockData> {
    const hexBlockNumber = '0x' + blockNumber.toString(16);
    
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getBlockByNumber',
        params: [hexBlockNumber, false],
        id: 1,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }

    return {
      number: parseInt(data.result.number, 16),
      hash: data.result.hash,
      parentHash: data.result.parentHash,
      timestamp: parseInt(data.result.timestamp, 16),
      stateRoot: data.result.stateRoot,
      receiptRoot: data.result.receiptRoot,
    };
  }

  /**
   * Get the latest block number from the first healthy endpoint
   */
  private async getLatestBlockNumber(): Promise<number | null> {
    for (const endpoint of this.endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1,
          }),
        });

        const data = await response.json();
        if (data.result) {
          return parseInt(data.result, 16);
        }
      } catch (error) {
        continue;
      }
    }
    return null;
  }

  /**
   * Detect if there are any hash divergences between endpoints
   */
  private detectDivergence(
    blockData: Map<string, BlockData | null>
  ): Divergence | null {
    // Filter out failed fetches
    const validData = new Map<string, BlockData>();
    for (const [name, data] of blockData) {
      if (data) validData.set(name, data);
    }

    if (validData.size < 2) return null;

    // Group by hash
    const hashGroups = new Map<string, string[]>();
    for (const [name, data] of validData) {
      const hash = data.hash;
      if (!hashGroups.has(hash)) {
        hashGroups.set(hash, []);
      }
      hashGroups.get(hash)!.push(name);
    }

    // If only one hash group, no divergence
    if (hashGroups.size <= 1) return null;

    // Find the divergence
    const entries = Array.from(hashGroups.entries());
    const [hash1, endpoints1] = entries[0];
    const [hash2, endpoints2] = entries[1];

    return {
      blockNumber: validData.get(endpoints1[0])!.number,
      hash1,
      hash2,
      endpoint1: endpoints1[0],
      endpoint2: endpoints2[0],
      timestamp: new Date(),
    };
  }

  /**
   * Generate a comprehensive fork report
   */
  private generateForkReport(
    divergence: Divergence,
    blockData: Map<string, BlockData | null>
  ): ForkReport {
    // Group endpoints by hash
    const hashGroups = new Map<string, string[]>();
    for (const [name, data] of blockData) {
      if (data) {
        if (!hashGroups.has(data.hash)) {
          hashGroups.set(data.hash, []);
        }
        hashGroups.get(data.hash)!.push(name);
      }
    }

    // Determine majority hash
    let majorityHash = '';
    let maxCount = 0;
    for (const [hash, endpoints] of hashGroups) {
      if (endpoints.length > maxCount) {
        maxCount = endpoints.length;
        majorityHash = hash;
      }
    }

    // Get affected clients
    const affectedClients: string[] = [];
    for (const [hash, endpoints] of hashGroups) {
      if (hash !== majorityHash) {
        affectedClients.push(...endpoints);
      }
    }

    // Determine severity based on divergence type
    let severity: 'critical' | 'warning' | 'info' = 'warning';
    if (affectedClients.length >= this.alertThreshold) {
      severity = 'critical';
    }

    return {
      detectedAt: new Date(),
      blockNumber: divergence.blockNumber,
      severity,
      affectedClients,
      expectedHash: majorityHash,
      divergentHashes: hashGroups,
      details: `Consensus fork detected at block ${divergence.blockNumber}. ` +
        `${affectedClients.length} endpoint(s) reporting different hash. ` +
        `Expected: ${majorityHash.substring(0, 20)}... ` +
        `Divergent: ${divergence.hash2.substring(0, 20)}...`,
      recommendedAction: '1. Verify all nodes are running latest software version. ' +
        '2. Check network connectivity between affected nodes. ' +
        '3. Compare state roots and transaction receipts. ' +
        '4. Consider rolling back to last known good block if necessary.',
    };
  }

  /**
   * Persist divergence event to database
   */
  private async persistDivergenceEvent(report: ForkReport): Promise<void> {
    try {
      await query(
        `INSERT INTO skynet.divergence_events 
         (block_number, severity, affected_clients, expected_hash, divergent_hashes, detected_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (block_number, detected_at) DO NOTHING`,
        [
          report.blockNumber,
          report.severity,
          report.affectedClients,
          report.expectedHash,
          JSON.stringify(Object.fromEntries(report.divergentHashes)),
          report.detectedAt,
        ]
      );
    } catch (error) {
      console.error('[ForkDetector] Failed to persist divergence event:', error);
    }
  }

  /**
   * Trigger alerts for fork detection
   */
  private async triggerAlert(report: ForkReport): Promise<void> {
    // This will be integrated with the alert system
    console.error('[ForkDetector] 🚨 FORK DETECTED:', {
      blockNumber: report.blockNumber,
      severity: report.severity,
      affectedClients: report.affectedClients,
    });
  }

  /**
   * Get recent divergence history
   */
  static async getRecentDivergences(
    limit: number = 10
  ): Promise<ForkReport[]> {
    const result = await query(
      `SELECT * FROM skynet.divergence_events
       ORDER BY detected_at DESC
       LIMIT $1`,
      [limit]
    );

    return result.rows.map((row: any) => ({
      detectedAt: row.detected_at,
      blockNumber: row.block_number,
      severity: row.severity,
      affectedClients: row.affected_clients,
      expectedHash: row.expected_hash,
      divergentHashes: new Map(Object.entries(row.divergent_hashes)),
      details: '',
      recommendedAction: '',
    }));
  }
}

/**
 * Initialize fork detection with default XDC endpoints
 */
export function initializeForkDetector(): ForkDetector {
  const endpoints: RpcEndpoint[] = [
    {
      name: 'xdc-mainnet-1',
      url: process.env.XDC_RPC_URL_1 || 'https://rpc.xdc.org',
      clientType: 'geth',
      region: 'us-east',
      isHealthy: true,
    },
    {
      name: 'xdc-mainnet-2',
      url: process.env.XDC_RPC_URL_2 || 'https://erpc.xinfin.network',
      clientType: 'geth',
      region: 'eu-west',
      isHealthy: true,
    },
    {
      name: 'xdc-mainnet-3',
      url: process.env.XDC_RPC_URL_3 || 'https://rpc.xinfin.network',
      clientType: 'geth',
      region: 'asia-southeast',
      isHealthy: true,
    },
  ].filter(e => e.url);

  return new ForkDetector({
    endpoints,
    confirmationDepth: 6,
    checkIntervalMs: 30000,
    alertThreshold: 2,
  });
}

export default ForkDetector;
