import { Request, Response } from 'express';
import { z } from 'zod';
import { RateLimiter } from '../middleware/rateLimiter';
import {
  validateBody,
  validateQuery,
  RegisterNodeSchema,
  UpdateNodeSchema,
  NodeQuerySchema,
  RecordMetricsSchema,
  MetricsQuerySchema,
  CreateAlertSchema,
  ApiKeySchema,
} from '../utils/validation';

/**
 * Example Route Configuration with Rate Limiting and Validation
 * This demonstrates how to apply the fixes for Issues #364 and #285
 */

const rateLimiter = new RateLimiter();

// Tier lookup function (example - implement based on your database)
async function getTierByApiKey(apiKey: string): Promise<string> {
  // Query your database to get the tier for this API key
  // Example implementation:
  // const key = await db.apiKeys.findOne({ key: apiKey });
  // return key?.tier || 'free';
  return 'free'; // Default fallback
}

/**
 * Node Routes with Rate Limiting and Validation
 */
export function configureNodeRoutes(app: any) {
  // Apply tiered rate limiting to all node routes
  app.use('/api/nodes', rateLimiter.tieredMiddleware(getTierByApiKey));

  // POST /api/nodes - Register a new node
  app.post(
    '/api/nodes',
    validateBody(RegisterNodeSchema),
    async (req: Request, res: Response) => {
      try {
        // Node registration logic here
        const nodeData = req.body;
        
        // Example response
        res.status(201).json({
          success: true,
          message: 'Node registered successfully',
          data: {
            nodeId: nodeData.nodeId,
            status: 'registered',
            registeredAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to register node',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );

  // GET /api/nodes - List nodes with pagination and filters
  app.get(
    '/api/nodes',
    validateQuery(NodeQuerySchema),
    async (req: Request, res: Response) => {
      try {
        const { page, limit, client, status, region, network } = req.query as any;
        
        // Node listing logic here
        res.json({
          success: true,
          data: {
            nodes: [], // Your node data
            pagination: {
              page,
              limit,
              total: 0,
              totalPages: 0,
            },
          },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch nodes',
        });
      }
    }
  );

  // PATCH /api/nodes/:nodeId - Update node status
  app.patch(
    '/api/nodes/:nodeId',
    validateBody(UpdateNodeSchema),
    async (req: Request, res: Response) => {
      try {
        const { nodeId } = req.params;
        const updateData = req.body;
        
        // Node update logic here
        res.json({
          success: true,
          message: 'Node updated successfully',
          data: {
            nodeId,
            ...updateData,
            updatedAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to update node',
        });
      }
    }
  );
}

/**
 * Metrics Routes with Rate Limiting and Validation
 */
export function configureMetricsRoutes(app: any) {
  // Apply rate limiting to metrics routes
  app.use('/api/metrics', rateLimiter.middleware('standard'));

  // POST /api/metrics - Record node metrics
  app.post(
    '/api/metrics',
    validateBody(RecordMetricsSchema),
    async (req: Request, res: Response) => {
      try {
        const metricsData = req.body;
        
        // Metrics recording logic here
        res.status(201).json({
          success: true,
          message: 'Metrics recorded successfully',
          data: {
            recordedAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to record metrics',
        });
      }
    }
  );

  // GET /api/metrics/:nodeId - Query metrics for a node
  app.get(
    '/api/metrics/:nodeId',
    validateQuery(MetricsQuerySchema),
    async (req: Request, res: Response) => {
      try {
        const { nodeId } = req.params;
        const { startTime, endTime, granularity } = req.query as any;
        
        // Metrics query logic here
        res.json({
          success: true,
          data: {
            nodeId,
            metrics: [], // Your metrics data
            granularity,
            startTime,
            endTime,
          },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch metrics',
        });
      }
    }
  );
}

/**
 * Alert Routes with Rate Limiting and Validation
 */
export function configureAlertRoutes(app: any) {
  // Apply stricter rate limiting to alert routes
  app.use('/api/alerts', rateLimiter.middleware('premium'));

  // POST /api/alerts - Create a new alert
  app.post(
    '/api/alerts',
    validateBody(CreateAlertSchema),
    async (req: Request, res: Response) => {
      try {
        const alertData = req.body;
        
        // Alert creation logic here
        res.status(201).json({
          success: true,
          message: 'Alert created successfully',
          data: {
            alertId: 'alert_' + Date.now(),
            ...alertData,
            createdAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to create alert',
        });
      }
    }
  );
}

/**
 * API Key Routes with Rate Limiting and Validation
 */
export function configureApiKeyRoutes(app: any) {
  // Apply enterprise rate limiting to API key routes
  app.use('/api/keys', rateLimiter.middleware('enterprise'));

  // POST /api/keys - Create new API key
  app.post(
    '/api/keys',
    validateBody(ApiKeySchema),
    async (req: Request, res: Response) => {
      try {
        const keyData = req.body;
        
        // API key generation logic here
        const generatedKey = 'xdc_' + Buffer.from(Math.random().toString()).toString('base64').slice(0, 32);
        
        res.status(201).json({
          success: true,
          message: 'API key created successfully',
          data: {
            key: generatedKey,
            ...keyData,
            createdAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: 'Failed to create API key',
        });
      }
    }
  );
}

export default {
  configureNodeRoutes,
  configureMetricsRoutes,
  configureAlertRoutes,
  configureApiKeyRoutes,
};
