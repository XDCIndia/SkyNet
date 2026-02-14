/**
 * XDC SkyNet API Validation Library
 * Provides Zod schemas for all API endpoints
 */

import { z } from 'zod';

// =============================================================================
// Common Schemas
// =============================================================================

export const UUIDSchema = z.string().uuid();

export const PaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  direction: z.enum(['asc', 'desc']).default('desc'),
});

export const DateRangeBaseSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const DateRangeSchema = DateRangeBaseSchema.refine(
  (data) => !data.from || !data.to || data.from <= data.to,
  { message: 'from date must be before to date' }
);

// =============================================================================
// Node Schemas
// =============================================================================

export const NodeRoleSchema = z.enum(['masternode', 'fullnode', 'archive', 'rpc']);

export const NodeRegistrationSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Name can only contain letters, numbers, hyphens, and underscores'),
  host: z.string()
    .url('Host must be a valid URL')
    .max(255, 'Host URL must be 255 characters or less'),
  role: NodeRoleSchema,
  rpcUrl: z.string().url().max(255).optional(),
  locationCity: z.string().max(100).optional(),
  locationCountry: z.string().max(5).optional(),
  locationLat: z.coerce.number().min(-90).max(90).optional(),
  locationLng: z.coerce.number().min(-180).max(180).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
});

export const NodeUpdateSchema = NodeRegistrationSchema.partial();

export const NodeIdSchema = z.object({
  id: UUIDSchema,
});

// =============================================================================
// Heartbeat Schemas
// =============================================================================

export const SystemMetricsSchema = z.object({
  cpuPercent: z.coerce.number().min(0).max(100).optional(),
  memoryPercent: z.coerce.number().min(0).max(100).optional(),
  diskPercent: z.coerce.number().min(0).max(100).optional(),
  diskUsedGb: z.coerce.number().min(0).optional(),
  diskTotalGb: z.coerce.number().min(0).optional(),
  loadAvg1m: z.coerce.number().min(0).optional(),
  loadAvg5m: z.coerce.number().min(0).optional(),
  loadAvg15m: z.coerce.number().min(0).optional(),
  storageType: z.string().max(50).optional(),
  storageModel: z.string().max(200).optional(),
  iopsEstimate: z.coerce.number().int().min(0).optional(),
});

export const HeartbeatSchema = z.object({
  nodeId: UUIDSchema,
  blockHeight: z.coerce.number().int().min(0),
  syncing: z.boolean().default(false),
  syncPercent: z.coerce.number().min(0).max(100).optional(),
  peerCount: z.coerce.number().int().min(0).default(0),
  txPoolPending: z.coerce.number().int().min(0).optional(),
  txPoolQueued: z.coerce.number().int().min(0).optional(),
  gasPrice: z.coerce.bigint().optional(),
  clientVersion: z.string().max(200).optional(),
  protocolVersion: z.string().max(20).optional(),
  coinbase: z.string().max(50).optional(),
  system: SystemMetricsSchema.optional(),
});

// =============================================================================
// Metrics Schemas
// =============================================================================

export const MetricsBatchSchema = z.object({
  nodeId: UUIDSchema,
  metrics: z.array(z.object({
    name: z.string().max(100),
    value: z.number(),
    timestamp: z.coerce.date().optional(),
    labels: z.record(z.string().max(50)).optional(),
  })).max(1000),
});

// =============================================================================
// Alert Schemas
// =============================================================================

export const AlertSeveritySchema = z.enum(['critical', 'warning', 'info']);

export const AlertSchema = z.object({
  nodeId: UUIDSchema.optional(),
  type: z.string().max(50),
  severity: AlertSeveritySchema,
  title: z.string().max(200),
  description: z.string().max(2000).optional(),
  suggestedFix: z.string().max(2000).optional(),
});

export const AlertNotifySchema = z.object({
  alertId: z.coerce.number().int().positive(),
  channels: z.array(z.enum(['telegram', 'email', 'slack', 'webhook'])).min(1),
});

// =============================================================================
// Notification Schemas
// =============================================================================

export const NotificationSchema = z.object({
  nodeId: UUIDSchema.optional(),
  source: z.string().max(50).default('api'),
  severity: AlertSeveritySchema.default('info'),
  title: z.string().max(200),
  message: z.string().max(2000),
  data: z.record(z.unknown()).optional(),
});

// =============================================================================
// Masternode Schemas
// =============================================================================

export const MasternodeAddressSchema = z.object({
  address: z.string()
    .regex(/^xdc[a-fA-F0-9]{40}$|^0x[a-fA-F0-9]{40}$/, 'Invalid XDC address format'),
});

// =============================================================================
// Command Schemas
// =============================================================================

export const CommandSchema = z.object({
  command: z.enum(['restart', 'update', 'sync', 'backup', 'health-check']),
  params: z.record(z.unknown()).optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});

// =============================================================================
// Peer Schemas
// =============================================================================

export const BanPeerSchema = z.object({
  enode: z.string()
    .regex(/^enode:\/\/[a-fA-F0-9]{128}@/, 'Invalid enode format'),
  reason: z.string().max(200).optional(),
  duration: z.coerce.number().int().min(60).max(86400 * 365).optional(),
});

// =============================================================================
// API Key Schemas
// =============================================================================

export const ApiKeyCreateSchema = z.object({
  name: z.string().max(100).optional(),
  nodeId: UUIDSchema.optional(),
  permissions: z.array(z.enum([
    'heartbeat',
    'metrics',
    'notifications',
    'commands',
    'admin',
  ])).default(['heartbeat', 'metrics', 'notifications']),
});

// =============================================================================
// Upgrade Plan Schemas
// =============================================================================

export const UpgradePlanSchema = z.object({
  name: z.string().max(200),
  targetVersion: z.string().max(50).optional(),
  strategy: z.enum(['rolling', 'canary', 'blue-green']).default('rolling'),
  nodeIds: z.array(UUIDSchema).min(1),
  scheduledAt: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
});

// =============================================================================
// Query Parameter Schemas
// =============================================================================

export const NodeQuerySchema = z.object({
  status: z.enum(['healthy', 'degraded', 'syncing', 'offline']).optional(),
  role: NodeRoleSchema.optional(),
  search: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).optional(),
  sortBy: z.enum(['name', 'blockHeight', 'peerCount', 'lastSeen', 'securityScore']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
}).merge(PaginationSchema);

export const MetricsQuerySchema = z.object({
  nodeId: UUIDSchema,
  metric: z.string().max(100).optional(),
  resolution: z.enum(['1m', '5m', '15m', '1h', '1d']).default('5m'),
}).merge(DateRangeBaseSchema);

export const IncidentQuerySchema = z.object({
  status: z.enum(['active', 'acknowledged', 'resolved']).optional(),
  severity: AlertSeveritySchema.optional(),
  nodeId: UUIDSchema.optional(),
}).merge(PaginationSchema);

// =============================================================================
// Response Schemas (for documentation/typing)
// =============================================================================

export const ApiErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.record(z.unknown()).optional(),
  requestId: z.string().optional(),
});

export const ApiSuccessSchema = z.object({
  success: z.boolean(),
  data: z.unknown(),
  meta: z.object({
    requestId: z.string(),
    timestamp: z.string(),
  }).optional(),
});

// =============================================================================
// Type Exports
// =============================================================================

export type NodeRegistration = z.infer<typeof NodeRegistrationSchema>;
export type NodeUpdate = z.infer<typeof NodeUpdateSchema>;
export type Heartbeat = z.infer<typeof HeartbeatSchema>;
export type MetricsBatch = z.infer<typeof MetricsBatchSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type Notification = z.infer<typeof NotificationSchema>;
export type Command = z.infer<typeof CommandSchema>;
export type BanPeer = z.infer<typeof BanPeerSchema>;
export type ApiKeyCreate = z.infer<typeof ApiKeyCreateSchema>;
export type UpgradePlan = z.infer<typeof UpgradePlanSchema>;
export type NodeQuery = z.infer<typeof NodeQuerySchema>;
export type MetricsQuery = z.infer<typeof MetricsQuerySchema>;
export type IncidentQuery = z.infer<typeof IncidentQuerySchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;

// =============================================================================
// Re-export helpers from errors
// =============================================================================

export { validateBody, validateQuery, ValidationError } from './errors';
