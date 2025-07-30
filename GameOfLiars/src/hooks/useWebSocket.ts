import { useEffect, useState } from 'react';
import socketManager from '../utils/socketManager';

interface WebSocketMessage {
  type: string;
  data: unknown;
}

export function useWebSocket(lobbyCode: string, playerName: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  useEffect(() => {
    if (!lobbyCode || !playerName) return;

    // Connect using the global socket manager
    socketManager.connect(lobbyCode, playerName);

    // Listen for connection changes
    const handleConnectionChange = (connected: boolean) => {
      setIsConnected(connected);
    };

    // Listen for messages
    const handleMessage = (message: WebSocketMessage) => {
      setLastMessage(message);
    };

    socketManager.on('connectionChange', handleConnectionChange);
    socketManager.on('message', handleMessage);

    // Set initial connection status
    setIsConnected(socketManager.getConnectionStatus());

    return () => {
      socketManager.off('connectionChange', handleConnectionChange);
      socketManager.off('message', handleMessage);
    };
  }, [lobbyCode, playerName]);

  const sendMessage = (type: string, data: unknown) => {
    socketManager.sendMessage(type, data);
  };

  return {
    isConnected,
    lastMessage,
    sendMessage
  };
} 