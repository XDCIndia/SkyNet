import { NextRequest, NextResponse } from 'next/server';

/**
 * WebSocket endpoint information
 * 
 * The actual WebSocket server is initialized in server initialization.
 * This endpoint provides connection info and documentation.
 * 
 * GET /api/v1/ws - Get WebSocket connection info
 */
export async function GET(request: NextRequest) {
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'ws' : 'wss';
  
  return NextResponse.json({
    websocket: {
      url: `${protocol}://${host}/api/v1/ws`,
      transports: ['websocket', 'polling'],
    },
    subscriptions: {
      'subscribe:blocks': 'Subscribe to new block notifications',
      'subscribe:transactions': 'Subscribe to new transaction notifications',
      'subscribe:address': 'Subscribe to address-specific events (param: address)',
    },
    events: {
      'block:new': 'New block mined',
      'transaction:new': 'New transaction',
      'transaction:from': 'Transaction from subscribed address',
      'transaction:to': 'Transaction to subscribed address',
    },
    example: {
      connection: `const socket = io('${protocol}://${host}/api/v1/ws');`,
      subscribe: `socket.emit('subscribe:blocks');`,
      listen: `socket.on('block:new', (data) => console.log(data));`,
    },
  });
}
