/**
 * XDC SkyNet Database Module
 * Provides connection pooling, query helpers, and type-safe database access
 */

// Export from legacy client (for backward compatibility)
export {
  getPool,
  query,
  queryOne as queryOneLegacy,
  queryAll as queryAllLegacy,
  withTransaction as withTransactionLegacy,
  closePool,
  checkDatabaseHealth as checkDatabaseHealthLegacy,
} from './client';

// Export from resilient client (new, recommended)
export {
  queryWithResilience,
  queryOne,
  queryAll,
  withTransaction,
  checkDatabaseHealth,
  closePool as closePoolResilient,
  getPoolMetrics,
  DatabaseHealth,
} from './resilient-client';

// Re-export query as the default (uses resilient client)
export { queryWithResilience as query } from './resilient-client';

// Type exports
export type {
  Node,
  NodeMetric,
  PeerSnapshot,
  Incident,
  NetworkHealth,
  BannedPeer,
  UpgradePlan,
  ApiKey,
  CommandQueue,
} from './client';
