export type NodeRole = 'masternode' | 'fullnode' | 'archive' | 'rpc';

export interface ManagedNode {
  id: string;
  name: string;
  host: string;
  role: NodeRole;
  location: {
    city: string;
    country: string;
    lat: number;
    lng: number;
  };
  tags: string[];
  addedAt: string;
}

export interface NodeMetrics {
  nodeId: string;
  healthy: boolean;
  status: 'online' | 'degraded' | 'offline';
  blockHeight: number;
  syncPercent: number;
  peers: number;
  cpu: number;
  memory: number;
  disk: number;
  lastSeen: string;
  uptime: number;
}

// Mock node registry with 6 nodes spread across continents
export const registeredNodes: ManagedNode[] = [
  {
    id: 'xdc-prod-us1',
    name: 'xdc-prod-us1',
    host: 'https://rpc.xdc-prod-us1.network',
    role: 'masternode',
    location: {
      city: 'Virginia',
      country: 'United States',
      lat: 37.4316,
      lng: -78.6569,
    },
    tags: ['production', 'masternode', 'us-east'],
    addedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'xdc-prod-eu1',
    name: 'xdc-prod-eu1',
    host: 'https://rpc.xdc-prod-eu1.network',
    role: 'masternode',
    location: {
      city: 'Frankfurt',
      country: 'Germany',
      lat: 50.1109,
      lng: 8.6821,
    },
    tags: ['production', 'masternode', 'eu-central'],
    addedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'xdc-prod-ap1',
    name: 'xdc-prod-ap1',
    host: 'https://rpc.xdc-prod-ap1.network',
    role: 'fullnode',
    location: {
      city: 'Singapore',
      country: 'Singapore',
      lat: 1.3521,
      lng: 103.8198,
    },
    tags: ['production', 'fullnode', 'ap-southeast'],
    addedAt: '2024-02-20T08:00:00Z',
  },
  {
    id: 'xdc-archive-us1',
    name: 'xdc-archive-us1',
    host: 'https://rpc.xdc-archive-us1.network',
    role: 'archive',
    location: {
      city: 'Oregon',
      country: 'United States',
      lat: 44.0000,
      lng: -120.5000,
    },
    tags: ['production', 'archive', 'us-west'],
    addedAt: '2024-03-01T12:00:00Z',
  },
  {
    id: 'xdc-rpc-eu1',
    name: 'xdc-rpc-eu1',
    host: 'https://rpc.xdc-rpc-eu1.network',
    role: 'rpc',
    location: {
      city: 'London',
      country: 'United Kingdom',
      lat: 51.5074,
      lng: -0.1278,
    },
    tags: ['production', 'rpc', 'eu-west'],
    addedAt: '2024-03-15T09:00:00Z',
  },
  {
    id: 'xdc-dev-local',
    name: 'xdc-dev-local',
    host: 'http://localhost:8545',
    role: 'fullnode',
    location: {
      city: 'Localhost',
      country: 'Development',
      lat: 0,
      lng: 0,
    },
    tags: ['development', 'local'],
    addedAt: '2024-06-01T00:00:00Z',
  },
];

export function getNodeById(id: string): ManagedNode | undefined {
  return registeredNodes.find(node => node.id === id);
}

export function getNodesByRole(role: NodeRole): ManagedNode[] {
  return registeredNodes.filter(node => node.role === role);
}

export function getNodesByTag(tag: string): ManagedNode[] {
  return registeredNodes.filter(node => node.tags.includes(tag));
}
