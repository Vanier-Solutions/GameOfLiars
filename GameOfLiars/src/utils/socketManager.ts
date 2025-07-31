// Simple browser-compatible event emitter
class EventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, listener: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  off(event: string, listener: Function) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(l => l !== listener);
  }

  emit(event: string, ...args: any[]) {
    if (!this.events[event]) return;
    this.events[event].forEach(listener => listener(...args));
  }
}

interface WebSocketMessage {
  type: string;
  data: unknown;
}

import { io, Socket } from 'socket.io-client';
import { API_URL } from '../config/api';

class SocketManager extends EventEmitter {
  private socket: Socket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private lobbyCode = '';
  private playerName = '';

  async connect(lobbyCode: string, playerName: string) {
    // If already connected to the same lobby, don't reconnect
    if (this.isConnected && this.lobbyCode === lobbyCode && this.playerName === playerName) {
      return;
    }

    // Disconnect existing connection if different lobby/player
    if (this.socket) {
      this.socket.disconnect();
    }

    this.lobbyCode = lobbyCode;
    this.playerName = playerName;

    try {
      console.log('Connecting to Socket.io server...');
      this.socket = io(API_URL, {
        withCredentials: true // Add session support for socket connections
      });

      this.socket.on('connect', () => {
        console.log('Socket.io connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.emit('connected');
        
        // Join lobby room
        this.socket.emit('joinLobby', { code: lobbyCode, playerName });
      });

      this.socket.on('disconnect', () => {
        console.log('Socket.io disconnected');
        this.isConnected = false;
        this.emit('connectionChange', false);
      });

      this.socket.on('connect_error', (error: Error) => {
        console.error('Socket.io connection error:', error);
        this.isConnected = false;
        this.emit('connectionChange', false);
      });

      // Set up event listeners
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to connect to Socket.io:', error);
    }
  }

  private setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('teamUpdate', (data: unknown) => {
      this.emit('message', { type: 'teamUpdate', data });
    });

    this.socket.on('playerJoined', (data: unknown) => {
      this.emit('message', { type: 'playerJoined', data });
    });

    this.socket.on('playerLeft', (data: unknown) => {
      this.emit('message', { type: 'playerLeft', data });
    });

    this.socket.on('settingsUpdate', (data: unknown) => {
      this.emit('message', { type: 'settingsUpdate', data });
    });

    this.socket.on('playerKicked', (data: any) => {
      this.emit('message', { type: 'playerKicked', data });
      
      // Check if current player was kicked
      const playerId = localStorage.getItem('playerId');
      const playerName = localStorage.getItem('playerName');
      
      const wasKickedById = playerId && data.kickedPlayerId === playerId;
      const wasKickedByName = playerName && data.kickedPlayer === playerName;
      
      if (wasKickedById || wasKickedByName) {
        alert('You have been kicked from the lobby by the host.');
        window.location.href = '/';
      }
    });

    this.socket.on('gameChat', (data: unknown) => {
      this.emit('message', { type: 'gameChat', data });
    });

    this.socket.on('teamChat', (data: unknown) => {
      this.emit('message', { type: 'teamChat', data });
    });

    this.socket.on('roundStarted', (data: unknown) => {
      this.emit('message', { type: 'roundStarted', data });
    });

    this.socket.on('answerSubmitted', (data: unknown) => {
      this.emit('message', { type: 'answerSubmitted', data });
    });

    this.socket.on('roundResults', (data: unknown) => {
      this.emit('message', { type: 'roundResults', data });
    });

    this.socket.on('nextRound', (data: unknown) => {
      this.emit('message', { type: 'nextRound', data });
    });

    this.socket.on('gameStarted', (data: unknown) => {
      this.emit('message', { type: 'gameStarted', data });
      // Navigate to game page when game starts
      window.location.href = `/game/${this.lobbyCode}`;
    });

    this.socket.on('gameEnded', (data: unknown) => {
      this.emit('message', { type: 'gameEnded', data });
    });

    this.socket.on('returnToLobby', (data: unknown) => {
      this.emit('message', { type: 'returnToLobby', data });
    });

    this.socket.on('error', (error: { message: string }) => {
      console.error('Socket error:', error.message);
      this.emit('message', { type: 'error', data: error });
    });
  }

  sendMessage(type: string, data: unknown) {
    if (this.socket && this.isConnected) {
      this.socket.emit(type, data);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  getConnectionStatus() {
    return this.isConnected;
  }
}

// Create a singleton instance
const socketManager = new SocketManager();
export default socketManager; 