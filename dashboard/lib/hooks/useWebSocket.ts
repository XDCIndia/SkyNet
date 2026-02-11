'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: 'metrics' | 'incidents' | 'peers' | 'health' | 'error' | 'ack';
  data: unknown;
  timestamp: string;
}

interface UseWebSocketReturn {
  metrics: unknown | null;
  incidents: unknown | null;
  peers: unknown | null;
  health: unknown | null;
  connected: boolean;
  error: string | null;
  send: (message: Record<string, unknown>) => void;
  subscribe: (channels: string[]) => void;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3006';
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;

export function useWebSocket(): UseWebSocketReturn {
  const ws = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<unknown | null>(null);
  const [incidents, setIncidents] = useState<unknown | null>(null);
  const [peers, setPeers] = useState<unknown | null>(null);
  const [health, setHealth] = useState<unknown | null>(null);

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    try {
      const socket = new WebSocket(WS_URL);
      ws.current = socket;

      socket.onopen = () => {
        console.log('[WebSocket] Connected');
        setConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
        
        // Subscribe to default channels
        socket.send(JSON.stringify({
          type: 'subscribe',
          channels: ['metrics', 'incidents', 'peers', 'health']
        }));
      };

      socket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'metrics':
              setMetrics(message.data);
              break;
            case 'incidents':
              setIncidents(message.data);
              break;
            case 'peers':
              setPeers(message.data);
              break;
            case 'health':
              setHealth(message.data);
              break;
            case 'error':
              console.error('[WebSocket] Server error:', message.data);
              setError(message.data as string);
              break;
          }
        } catch (err) {
          console.error('[WebSocket] Failed to parse message:', err);
        }
      };

      socket.onerror = (err) => {
        console.error('[WebSocket] Error:', err);
        setError('WebSocket error');
      };

      socket.onclose = () => {
        console.log('[WebSocket] Disconnected');
        setConnected(false);
        ws.current = null;

        // Attempt reconnection with exponential backoff
        const delay = Math.min(
          RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts.current),
          RECONNECT_MAX_DELAY
        );
        
        reconnectAttempts.current++;
        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
        
        reconnectTimeout.current = setTimeout(() => {
          connect();
        }, delay);
      };
    } catch (err) {
      console.error('[WebSocket] Failed to create connection:', err);
      setError('Failed to create WebSocket connection');
    }
  }, []);

  const send = useCallback((message: Record<string, unknown>) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send, not connected');
    }
  }, []);

  const subscribe = useCallback((channels: string[]) => {
    send({ type: 'subscribe', channels });
  }, [send]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  return {
    metrics,
    incidents,
    peers,
    health,
    connected,
    error,
    send,
    subscribe,
  };
}
