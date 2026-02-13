import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from '@/app/api/v1/nodes/register/route';
import { createAuthenticatedRequest, mockWithTransaction, mockQuery } from '@/lib/test-utils';

describe('POST /api/v1/nodes/register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register a new node with valid data', async () => {
    const nodeId = '550e8400-e29b-41d4-a716-446655440000';
    
    mockWithTransaction.mockImplementation(async (fn) => {
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({ rows: [{ id: nodeId }] })
          .mockResolvedValueOnce({ rows: [] }),
      };
      return fn(mockClient);
    });

    const req = createAuthenticatedRequest('POST', '/api/v1/nodes/register', {
      body: {
        name: 'test-node-1',
        host: 'https://node1.example.com',
        role: 'masternode',
        rpcUrl: 'https://node1.example.com/rpc',
        tags: ['test', 'prod'],
      },
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.data.nodeId).toBe(nodeId);
    expect(data.data.apiKey).toBeDefined();
  });

  it('should return 401 without authentication', async () => {
    const req = createAuthenticatedRequest('POST', '/api/v1/nodes/register', {
      apiKey: 'invalid_key',
      body: {
        name: 'test-node',
        host: 'https://node.example.com',
        role: 'masternode',
        rpcUrl: 'https://node.example.com/rpc',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('should return 400 with invalid data', async () => {
    const req = createAuthenticatedRequest('POST', '/api/v1/nodes/register', {
      body: {
        name: '', // Invalid: empty name
        host: 'not-a-url',
        role: 'invalid-role',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('should return 409 on duplicate name', async () => {
    mockWithTransaction.mockRejectedValue({ code: '23505' });

    const req = createAuthenticatedRequest('POST', '/api/v1/nodes/register', {
      body: {
        name: 'existing-node',
        host: 'https://node.example.com',
        role: 'masternode',
        rpcUrl: 'https://node.example.com/rpc',
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});
