import { z } from 'zod';

/**
 * Zod Input Validation Schemas for XDCNetOwn API
 * Fixes Issue #285: Add Zod Input Validation to API Routes
 * 
 * Provides comprehensive validation for all API endpoints
 * with detailed error messages and type safety.
 */

// ============================================================================
// Common Schemas
// ============================================================================

export const AddressSchema = z.string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address format')
  .transform(addr => addr.toLowerCase());

export const TxHashSchema = z.string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash format');

export const BlockNumberSchema = z.union([
  z.number().int().min(0),
  z.string().regex(/^0x[a-fA-F0-9]+$/),
  z.enum(['latest', 'earliest', 'pending']),
]);

export const HexStringSchema = z.string()
  .regex(/^0x[a-fA-F0-9]*$/, 'Invalid hex string format');

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================================
// Node API Schemas
// ============================================================================

export const RegisterNodeSchema = z.object({
  nodeId: z.string().min(1).max(64),
  client: z.enum(['geth', 'erigon', 'nethermind', 'reth']),
  version: z.string().min(1),
  ip: z.string().ip(),
  rpcPort: z.number().int().min(1).max(65535),
  wsPort: z.number().int().min(1).max(65535).optional(),
  region: z.string().min(1),
  network: z.enum(['mainnet', 'testnet', 'devnet']),
});

export const UpdateNodeSchema = z.object({
  status: z.enum(['online', 'offline', 'syncing', 'error']).optional(),
  blockHeight: z.number().int().min(0).optional(),
  syncProgress: z.number().min(0).max(100).optional(),
  peers: z.number().int().min(0).optional(),
  latency: z.number().min(0).optional(),
});

export const NodeQuerySchema = PaginationSchema.extend({
  client: z.enum(['geth', 'erigon', 'nethermind', 'reth']).optional(),
  status: z.enum(['online', 'offline', 'syncing', 'error']).optional(),
  region: z.string().optional(),
  network: z.enum(['mainnet', 'testnet', 'devnet']).optional(),
});

// ============================================================================
// Metrics API Schemas
// ============================================================================

export const RecordMetricsSchema = z.object({
  nodeId: z.string().min(1),
  timestamp: z.coerce.date(),
  cpu: z.object({
    usage: z.number().min(0).max(100),
    cores: z.number().int().min(1),
  }),
  memory: z.object({
    used: z.number().int().min(0),
    total: z.number().int().min(0),
    percentage: z.number().min(0).max(100),
  }),
  disk: z.object({
    used: z.number().int().min(0),
    total: z.number().int().min(0),
    percentage: z.number().min(0).max(100),
  }),
  network: z.object({
    inbound: z.number().int().min(0),
    outbound: z.number().int().min(0),
    peers: z.number().int().min(0),
  }),
  blockchain: z.object({
    blockHeight: z.number().int().min(0),
    syncProgress: z.number().min(0).max(100),
    latestBlockTime: z.coerce.date(),
  }),
});

export const MetricsQuerySchema = z.object({
  nodeId: z.string().min(1),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  granularity: z.enum(['1m', '5m', '15m', '1h', '1d']).default('5m'),
}).refine(data => data.endTime > data.startTime, {
  message: 'endTime must be after startTime',
});

// ============================================================================
// XDPoS 2.0 Consensus Schemas
// ============================================================================

export const EpochInfoSchema = z.object({
  epochNumber: z.number().int().min(0),
  startBlock: z.number().int().min(0),
  endBlock: z.number().int().min(0),
  masternodes: z.array(AddressSchema).min(1),
  validatorCount: z.number().int().min(1),
});

export const VoteInfoSchema = z.object({
  validator: AddressSchema,
  blockNumber: z.number().int().min(0),
  hash: TxHashSchema,
  timestamp: z.coerce.date(),
});

export const ConsensusHealthSchema = z.object({
  epoch: z.number().int().min(0),
  blockNumber: z.number().int().min(0),
  isCheckpoint: z.boolean(),
  masternodeCount: z.number().int().min(0),
  voteCount: z.number().int().min(0),
  timeoutCount: z.number().int().min(0),
  healthScore: z.number().min(0).max(100),
  status: z.enum(['healthy', 'degraded', 'critical']),
});

// ============================================================================
// Alert API Schemas
// ============================================================================

export const CreateAlertSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['node_down', 'sync_stall', 'high_latency', 'low_peers', 'consensus_failure']),
  severity: z.enum(['info', 'warning', 'critical']),
  conditions: z.array(z.object({
    metric: z.string(),
    operator: z.enum(['gt', 'lt', 'eq', 'gte', 'lte']),
    threshold: z.number(),
    duration: z.number().int().min(0), // seconds
  })),
  notifications: z.object({
    email: z.array(z.string().email()).optional(),
    webhook: z.array(z.string().url()).optional(),
    slack: z.array(z.string().url()).optional(),
  }),
  enabled: z.boolean().default(true),
});

// ============================================================================
// Authentication Schemas
// ============================================================================

export const ApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  tier: z.enum(['free', 'standard', 'premium', 'enterprise']).default('free'),
  permissions: z.array(z.string()).default(['read']),
  expiresAt: z.coerce.date().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

// ============================================================================
// Validation Middleware Factory
// ============================================================================

import { Request, Response, NextFunction } from 'express';

export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }
    
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    
    if (!result.success) {
      return res.status(400).json({
        error: 'Query validation failed',
        details: result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }
    
    req.query = result.data;
    next();
  };
}

export function validateParams<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.params);
    
    if (!result.success) {
      return res.status(400).json({
        error: 'Parameter validation failed',
        details: result.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }
    
    req.params = result.data;
    next();
  };
}
