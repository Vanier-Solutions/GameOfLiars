import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface WebSocketMessage {
  type: string;
  data: unknown;
}

export function useWebSocket(lobbyCode: string, playerName: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!lobbyCode || !playerName) return;

    // Connect to Socket.io
    const socket = io('http://localhost:5051');
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

    // Listen for lobby updates
    socket.on('lobbyUpdate', (data: unknown) => {
      setLastMessage({ type: 'lobbyUpdate', data });
    });

    socket.on('playerJoined', (data: unknown) => {
      setLastMessage({ type: 'playerJoined', data });
    });

    socket.on('playerLeft', (data: unknown) => {
      setLastMessage({ type: 'playerLeft', data });
    });

    socket.on('teamUpdate', (data: unknown) => {
      setLastMessage({ type: 'teamUpdate', data });
    });

    socket.on('gameStarted', (data: unknown) => {
      setLastMessage({ type: 'gameStarted', data });
      // Navigate to game
      window.location.href = `/game/${lobbyCode}`;
    });

    return () => {
      if (socket.connected) {
        socket.disconnect();
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