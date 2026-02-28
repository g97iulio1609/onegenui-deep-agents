import { useState, useEffect, useRef, useCallback } from "react";

export interface UseWebSocketOptions {
  url: string;
  autoConnect?: boolean;
  reconnectMs?: number;
}

export interface UseWebSocketReturn {
  connected: boolean;
  lastMessage: unknown | null;
  send: (data: unknown) => void;
  connect: () => void;
  disconnect: () => void;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { url, autoConnect = true, reconnectMs = 3000 } = options;
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<unknown | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (event) => {
        try {
          setLastMessage(JSON.parse(event.data));
        } catch {
          setLastMessage(event.data);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (reconnectMs > 0) {
          reconnectTimer.current = setTimeout(connect, reconnectMs);
        }
      };

      ws.onerror = () => ws.close();
    } catch { /* ignore */ }
  }, [url, reconnectMs]);

  const disconnect = useCallback(() => {
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
  }, []);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  useEffect(() => {
    if (autoConnect) connect();
    return () => disconnect();
  }, [autoConnect, connect, disconnect]);

  return { connected, lastMessage, send, connect, disconnect };
}
