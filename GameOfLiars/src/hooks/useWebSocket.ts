import { useEffect, useRef, useState } from 'react';

interface WebSocketMessage {
  type: string;
  data: unknown;
}

export function useWebSocket(lobbyCode: string, playerName: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (!lobbyCode || !playerName) return;

    // Dynamic import to avoid build issues
    import('socket.io-client').then((socketModule) => {
      // Connect to Socket.io
      const socket = socketModule.default('http://192.168.1.200:5051');
      socketRef.current = socket;

      socket.on('connect', () => {
        console.log('Socket.io connected');
        setIsConnected(true);
        
        // Join lobby room
        socket.emit('joinLobby', { code: lobbyCode, playerName });
      });

      socket.on('disconnect', () => {
        console.log('Socket.io disconnected');
        setIsConnected(false);
      });

      socket.on('connect_error', (error: Error) => {
        console.error('Socket.io connection error:', error);
        setIsConnected(false);
      });

      // Listen for team updates
      socket.on('teamUpdate', (data: unknown) => {
        setLastMessage({ type: 'teamUpdate', data });
      });

      socket.on('playerJoined', (data: unknown) => {
        setLastMessage({ type: 'playerJoined', data });
      });

      socket.on('playerLeft', (data: unknown) => {
        setLastMessage({ type: 'playerLeft', data });
      });

      socket.on('settingsUpdate', (data: unknown) => {
        setLastMessage({ type: 'settingsUpdate', data });
      });

      socket.on('gameStarted', (data: unknown) => {
        setLastMessage({ type: 'gameStarted', data });
        // Navigate to game page when game starts
        window.location.href = `/game/${lobbyCode}`;
      });

      socket.on('error', (error: { message: string }) => {
        console.error('Socket error:', error.message);
        setLastMessage({ type: 'error', data: error });
      });
    });

    return () => {
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.disconnect();
      }
    };
  }, [lobbyCode, playerName]);

  const sendMessage = (type: string, data: unknown) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(type, data);
    }
  };

  return {
    isConnected,
    lastMessage,
    sendMessage
  };
} 