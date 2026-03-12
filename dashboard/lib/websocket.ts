import { Server as NetServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { query } from '@/lib/db';

// Socket.io server instance
let io: SocketIOServer | null = null;

/**
 * Initialize WebSocket server for real-time block updates
 */
export function initWebSocketServer(server: NetServer): SocketIOServer {
  if (io) {
    return io;
  }

  io = new SocketIOServer(server, {
    path: '/api/v1/ws',
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // Connection handling
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Subscribe to new blocks
    socket.on('subscribe:blocks', () => {
      socket.join('blocks');
      console.log(`Client ${socket.id} subscribed to blocks`);
    });

    // Subscribe to specific address
    socket.on('subscribe:address', (address: string) => {
      const normalizedAddr = address.toLowerCase();
      socket.join(`address:${normalizedAddr}`);
      console.log(`Client ${socket.id} subscribed to address ${normalizedAddr}`);
    });

    // Subscribe to transactions
    socket.on('subscribe:transactions', () => {
      socket.join('transactions');
      console.log(`Client ${socket.id} subscribed to transactions`);
    });

    // Unsubscribe handlers
    socket.on('unsubscribe:blocks', () => {
      socket.leave('blocks');
    });

    socket.on('unsubscribe:address', (address: string) => {
      socket.leave(`address:${address.toLowerCase()}`);
    });

    socket.on('unsubscribe:transactions', () => {
      socket.leave('transactions');
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  // Start broadcasting
  startBlockBroadcasting();

  return io;
}

/**
 * Broadcast new block to all subscribers
 */
export function broadcastBlock(blockData: any): void {
  if (!io) return;

  io.to('blocks').emit('block:new', {
    type: 'block',
    data: blockData,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast transaction to relevant subscribers
 */
export function broadcastTransaction(txData: any): void {
  if (!io) return;

  // Broadcast to transaction subscribers
  io.to('transactions').emit('transaction:new', {
    type: 'transaction',
    data: txData,
    timestamp: new Date().toISOString(),
  });

  // Broadcast to address subscribers
  if (txData.from) {
    io.to(`address:${txData.from.toLowerCase()}`).emit('transaction:from', txData);
  }
  if (txData.to) {
    io.to(`address:${txData.to.toLowerCase()}`).emit('transaction:to', txData);
  }
}

/**
 * Start polling for new blocks and broadcast updates
 */
function startBlockBroadcasting(): void {
  let lastBlockHeight = 0;

  const checkNewBlocks = async () => {
    try {
      // Get latest block from database
      const result = await query(`
        SELECT 
          (metrics->>'blockHeight')::bigint as block_height,
          node_id,
          collected_at
        FROM skynet.node_metrics
        WHERE collected_at > NOW() - INTERVAL '1 minute'
        ORDER BY (metrics->>'blockHeight')::bigint DESC
        LIMIT 1
      `);

      if (result.rows.length > 0) {
        const currentHeight = parseInt(result.rows[0].block_height);

        if (currentHeight > lastBlockHeight) {
          // New block detected
          const blockData = {
            height: currentHeight,
            nodeId: result.rows[0].node_id,
            timestamp: result.rows[0].collected_at,
          };

          broadcastBlock(blockData);
          lastBlockHeight = currentHeight;
        }
      }
    } catch (error) {
      console.error('Error checking for new blocks:', error);
    }
  };

  // Check every 2 seconds (XDC block time)
  setInterval(checkNewBlocks, 2000);
}

/**
 * Get WebSocket server instance
 */
export function getIO(): SocketIOServer | null {
  return io;
}
