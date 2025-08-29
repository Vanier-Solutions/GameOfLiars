import { io, Socket } from 'socket.io-client';


class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private eventListeners: Map<string, Function[]> = new Map();

  // Connect to the socket server
  connect() {
    if (this.socket && this.isConnected) {
      return this.socket;
    }

    const serverUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5051';
    
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    this.setupEventHandlers();
    return this.socket;
  }

  // Disconnect from the socket server
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.eventListeners.clear();
    }
  }

  // Join a lobby with authentication token
  joinLobby(token: string) {
    if (!this.socket) {
      console.error('Socket not connected. Call connect() first.');
      return;
    }

    this.socket.emit('join-lobby', { token });
  }

  // Leave a lobby with authentication token
  leaveLobby(token: string) {
    if (!this.socket) {
      console.error('Socket not connected. Call connect() first.');
      return;
    }

    this.socket.emit('leave-lobby', { token });
  }

  // Send a chat message
  sendChatMessage(lobbyCode: string, message: string, playerId: string, playerName: string, team?: string, chatType: 'game' | 'team' = 'game') {
    if (!this.socket) {
      console.error('Socket not connected. Call connect() first.');
      return;
    }

    this.socket.emit('chat-message', {
      lobbyCode,
      message,
      playerId,
      playerName,
      team,
      chatType,
    });
  }

  // Emit lobby updated event
  emitLobbyUpdated(lobbyCode: string, updateData: any) {
    if (!this.socket) {
      console.error('Socket not connected. Call connect() first.');
      return;
    }

    this.socket.emit('lobby-updated', {
      lobbyCode,
      ...updateData,
    });
  }

  // Add event listener
  on(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);

    if (this.socket) {
      this.socket.on(event, callback as any);
    }
  }

  // Remove event listener
  off(event: string, callback?: Function) {
    if (callback) {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        const index = listeners.indexOf(callback);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
      if (this.socket) {
        this.socket.off(event, callback as any);
      }
    } else {
      this.eventListeners.delete(event);
      if (this.socket) {
        this.socket.off(event);
      }
    }
  }

  // Get connection status
  isSocketConnected(): boolean {
    return this.isConnected;
  }

  // Setup default event handlers
  private setupEventHandlers() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.isConnected = true;

      
      // If we have a token, rejoin the lobby after reconnection
      const token = localStorage.getItem('gameToken');
      if (token) {
        this.joinLobby(token);
      }
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;

      
      // Only show error for intentional disconnects or server issues
      if (reason === 'io server disconnect' || reason === 'ping timeout') {
        // Connection lost
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      this.isConnected = true;

      // Reconnected
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('Reconnection failed:', error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Failed to reconnect after maximum attempts');
      // Connection failed
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      // Connection error
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      // Socket error
    });

    // Re-attach all existing event listeners when socket reconnects
    this.eventListeners.forEach((callbacks, event) => {
      callbacks.forEach(callback => {
        this.socket!.on(event, callback as any);
      });
    });
  }
}

// Create and export a singleton instance
export const socketService = new SocketService();

// Event type definitions for better TypeScript support
export interface SocketEvents {
  'player-joined': (data: { player: any; lobby: any; timestamp: string }) => void;
  'player-left': (data: { player: any; lobby: any; timestamp: string }) => void;
  'player-disconnected': (data: { playerId: string; lobbyCode: string; timestamp: string }) => void;
  'player-team-changed': (data: { player: any; lobby: any; timestamp: string }) => void;
  'player-kicked': (data: { player: any; kickedBy: string; lobby: any; timestamp: string }) => void;
  'you-were-kicked': (data: { reason: string; kickedBy: string; timestamp: string }) => void;
  'lobby-updated': (data: { lobby: any; updateType: string; timestamp: string }) => void;
  'lobby-ended': (data: { reason: string; timestamp: string }) => void;
  'settings-updated': (data: { lobby: any; timestamp: string }) => void;
  'chat-message': (data: { message: string; playerId: string; playerName: string; team: string; chatType: 'game' | 'team'; timestamp: string }) => void;
  'game-started': (data: { lobbyCode: string; lobby: any; timestamp: string }) => void;
  'game-ended': (data: { lobbyCode: string; reason?: string; timestamp: string }) => void;
  'round-started': (data: { lobbyCode: string; game: { currentRoundNumber: number; currentRound: { question: string; roundNumber: number }; scores: { blue: number; red: number } }; timestamp: string }) => void;
  'round-results': (data: { lobbyCode: string; round: any; scores: { blue: number; red: number }; game: any; timestamp: string }) => void;
  'team-answer-submitted': (data: { team: string; isSteal: boolean; bothSubmitted: boolean; timestamp: string }) => void;
  'answer-processing-started': (data: { message: string; timestamp: string }) => void;
  'lobby-returned': (data: { lobby: any; message: string; timestamp: string }) => void;
}

// Helper function to add typed event listeners
export function addSocketListener<K extends keyof SocketEvents>(
  event: K,
  callback: SocketEvents[K]
) {
  socketService.on(event, callback);
}

// Helper function to remove typed event listeners
export function removeSocketListener<K extends keyof SocketEvents>(
  event: K,
  callback?: SocketEvents[K]
) {
  socketService.off(event, callback);
}