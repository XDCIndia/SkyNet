// Cross-Client Block Divergence Detection for SkyNet
// Monitors multiple XDC clients and detects block divergence

import { consensus } from './consensus';

// Client RPC endpoints
interface ClientEndpoint {
  name: string;
  type: 'geth' | 'erigon' | 'nethermind' | 'reth';
  rpcUrl: string;
  enabled: boolean;
}

// Block data from a client
interface ClientBlock {
  clientName: string;
  clientType: string;
  blockNumber: number;
  blockHash: string;
  parentHash: string;
  timestamp: number;
  transactionsRoot: string;
  stateRoot: string;
  receiptsRoot: string;
  gasUsed: string;
  gasLimit: string;
  extraData: string;
}

// Divergence report
interface DivergenceReport {
  timestamp: number;
  blockNumber: number;
  severity: 'critical' | 'warning' | 'info';
  affectedClients: string[];
  expectedHash: string;
  divergentBlocks: Map<string, string>; // client -> hash
  details: string;
}

// Divergence detector configuration
interface DivergenceConfig {
  checkIntervalMs: number;
  confirmationDepth: number;
  alertThreshold: number; // Number of divergent blocks before alert
  clients: ClientEndpoint[];
}

// Default configuration
const DEFAULT_CONFIG: DivergenceConfig = {
  checkIntervalMs: 30000, // 30 seconds
  confirmationDepth: 6, // Wait for 6 confirmations
  alertThreshold: 3, // Alert after 3 divergent blocks
  clients: [
    {
      name: 'geth-main',
      type: 'geth',
      rpcUrl: process.env.GETH_RPC_URL || 'http://localhost:8545',
      enabled: true,
    },
    {
      name: 'erigon-main',
      type: 'erigon',
      rpcUrl: process.env.ERIGON_RPC_URL || 'http://localhost:8547',
      enabled: !!process.env.ERIGON_RPC_URL,
    },
    {
      name: 'nethermind-main',
      type: 'nethermind',
      rpcUrl: process.env.NETHERMIND_RPC_URL || 'http://localhost:8558',
      enabled: !!process.env.NETHERMIND_RPC_URL,
    },
    {
      name: 'reth-main',
      type: 'reth',
      rpcUrl: process.env.RETH_RPC_URL || 'http://localhost:7073',
      enabled: !!process.env.RETH_RPC_URL,
    },
  ],
};

// RPC helper for specific client
async function rpcCall(rpcUrl: string, method: string, params: any[]): Promise<any> {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`RPC error from ${rpcUrl}: ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`RPC error: ${data.error.message}`);
  }

  return data.result;
}

// Get block from a specific client
async function getBlockFromClient(
  client: ClientEndpoint,
  blockNumber: number | 'latest'
): Promise<ClientBlock | null> {
  try {
    const blockParam =
      blockNumber === 'latest'
        ? 'latest'
        : `0x${blockNumber.toString(16)}`;

    const result = await rpcCall(client.rpcUrl, 'eth_getBlockByNumber', [
      blockParam,
      false,
    ]);

    if (!result) return null;

    return {
      clientName: client.name,
      clientType: client.type,
      blockNumber: parseInt(result.number, 16),
      blockHash: result.hash,
      parentHash: result.parentHash,
      timestamp: parseInt(result.timestamp, 16),
      transactionsRoot: result.transactionsRoot,
      stateRoot: result.stateRoot,
      receiptsRoot: result.receiptsRoot,
      gasUsed: result.gasUsed,
      gasLimit: result.gasLimit,
      extraData: result.extraData,
    };
  } catch (error) {
    console.error(`Failed to get block from ${client.name}:`, error);
    return null;
  }
}

// Get latest block number from client
async function getLatestBlockNumber(client: ClientEndpoint): Promise<number> {
  try {
    const result = await rpcCall(client.rpcUrl, 'eth_blockNumber', []);
    return parseInt(result, 16);
  } catch (error) {
    console.error(`Failed to get block number from ${client.name}:`, error);
    return 0;
  }
}

// Check for divergence at a specific block
async function checkDivergenceAtBlock(
  config: DivergenceConfig,
  blockNumber: number
): Promise<DivergenceReport | null> {
  const enabledClients = config.clients.filter((c) => c.enabled);
  const blocks: ClientBlock[] = [];

  // Fetch blocks from all clients
  for (const client of enabledClients) {
    const block = await getBlockFromClient(client, blockNumber);
    if (block) {
      blocks.push(block);
    }
  }

  if (blocks.length < 2) {
    return null; // Not enough clients to compare
  }

  // Group by hash
  const hashGroups = new Map<string, ClientBlock[]>();
  for (const block of blocks) {
    const existing = hashGroups.get(block.blockHash) || [];
    existing.push(block);
    hashGroups.set(block.blockHash, existing);
  }

  // If all agree, no divergence
  if (hashGroups.size === 1) {
    return null;
  }

  // Find majority hash (if any)
  let majorityHash = '';
  let majorityCount = 0;
  for (const [hash, group] of hashGroups) {
    if (group.length > majorityCount) {
      majorityHash = hash;
      majorityCount = group.length;
    }
  }

  // Build divergence report
  const divergentBlocks = new Map<string, string>();
  const affectedClients: string[] = [];

  for (const block of blocks) {
    if (block.blockHash !== majorityHash) {
      divergentBlocks.set(block.clientName, block.blockHash);
      affectedClients.push(block.clientName);
    }
  }

  // Determine severity
  let severity: 'critical' | 'warning' | 'info' = 'warning';
  if (majorityCount === 1 && hashGroups.size > 2) {
    severity = 'critical'; // No clear majority - chain split
  } else if (affectedClients.length > 1) {
    severity = 'critical';
  }

  return {
    timestamp: Date.now(),
    blockNumber,
    severity,
    affectedClients,
    expectedHash: majorityHash,
    divergentBlocks,
    details: `Divergence detected at block ${blockNumber}. Expected: ${majorityHash}, but ${affectedClients.join(', ')} reported different hashes.`,
  };
}

// Divergence detector class
export class DivergenceDetector {
  private config: DivergenceConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private divergenceHistory: DivergenceReport[] = [];
  private lastCheckedBlock = 0;
  private consecutiveDivergences = 0;

  constructor(config: Partial<DivergenceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Start monitoring
  start(): void {
    if (this.intervalId) {
      console.log('Divergence detector already running');
      return;
    }

    console.log('Starting divergence detector...');
    this.intervalId = setInterval(() => {
      this.checkForDivergence();
    }, this.config.checkIntervalMs);

    // Initial check
    this.checkForDivergence();
  }

  // Stop monitoring
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Divergence detector stopped');
    }
  }

  // Check for divergence
  private async checkForDivergence(): Promise<void> {
    try {
      // Get the lowest block number across all clients
      const enabledClients = this.config.clients.filter((c) => c.enabled);
      const blockNumbers = await Promise.all(
        enabledClients.map((c) => getLatestBlockNumber(c))
      );

      const minBlock = Math.min(...blockNumbers);
      const checkBlock = minBlock - this.config.confirmationDepth;

      if (checkBlock <= this.lastCheckedBlock) {
        return; // Already checked this block
      }

      const report = await checkDivergenceAtBlock(this.config, checkBlock);

      if (report) {
        this.divergenceHistory.push(report);
        this.consecutiveDivergences++;

        // Keep only last 100 reports
        if (this.divergenceHistory.length > 100) {
          this.divergenceHistory.shift();
        }

        // Alert if threshold reached
        if (this.consecutiveDivergences >= this.config.alertThreshold) {
          await this.sendAlert(report);
        }
      } else {
        this.consecutiveDivergences = 0;
      }

      this.lastCheckedBlock = checkBlock;
    } catch (error) {
      console.error('Error checking for divergence:', error);
    }
  }

  // Send alert
  private async sendAlert(report: DivergenceReport): Promise<void> {
    console.error(`🚨 DIVERGENCE ALERT [${report.severity.toUpperCase()}]:`, report.details);

    // Integrate with notification system
    try {
      const { sendAlert: sendAlertNotification } = await import('./alerting');
      await sendAlertNotification({
        severity: report.severity,
        title: `Block Divergence Detected at #${report.blockNumber}`,
        message: report.details,
        metadata: {
          blockNumber: report.blockNumber,
          affectedClients: report.affectedClients,
          expectedHash: report.expectedHash,
          timestamp: new Date(report.timestamp).toISOString(),
        },
      });
    } catch (error) {
      console.error('Failed to send divergence alert notification:', error);
    }
  }

  // Get divergence history
  getHistory(): DivergenceReport[] {
    return [...this.divergenceHistory];
  }

  // Get current status
  getStatus(): {
    running: boolean;
    lastCheckedBlock: number;
    consecutiveDivergences: number;
    totalDivergences: number;
  } {
    return {
      running: !!this.intervalId,
      lastCheckedBlock: this.lastCheckedBlock,
      consecutiveDivergences: this.consecutiveDivergences,
      totalDivergences: this.divergenceHistory.length,
    };
  }

  // Force check at specific block
  async forceCheck(blockNumber: number): Promise<DivergenceReport | null> {
    return checkDivergenceAtBlock(this.config, blockNumber);
  }
}

// Compare blocks across clients for detailed analysis
export async function compareBlocks(
  config: DivergenceConfig,
  blockNumber: number
): Promise<{
  blockNumber: number;
  comparisons: {
    client: string;
    hash: string;
    stateRoot: string;
    transactionsRoot: string;
    receiptsRoot: string;
  }[];
  matches: boolean;
}> {
  const enabledClients = config.clients.filter((c) => c.enabled);
  const blocks: ClientBlock[] = [];

  for (const client of enabledClients) {
    const block = await getBlockFromClient(client, blockNumber);
    if (block) {
      blocks.push(block);
    }
  }

  const comparisons = blocks.map((b) => ({
    client: b.clientName,
    hash: b.blockHash,
    stateRoot: b.stateRoot,
    transactionsRoot: b.transactionsRoot,
    receiptsRoot: b.receiptsRoot,
  }));

  // Check if all match
  const hashes = new Set(blocks.map((b) => b.blockHash));
  const matches = hashes.size === 1 && blocks.length > 0;

  return {
    blockNumber,
    comparisons,
    matches,
  };
}

// Export singleton instance
export const divergenceDetector = new DivergenceDetector();
