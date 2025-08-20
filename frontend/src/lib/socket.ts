import { io, Socket } from 'socket.io-client';
import { toast } from '@/components/ui/use-toast';

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
  sendChatMessage(lobbyCode: string, message: string, playerId: string, playerName: string) {
    if (!this.socket) {
      console.error('Socket not connected. Call connect() first.');
      return;
    }

    this.socket.emit('chat-message', {
      lobbyCode,
      message,
      playerId,
      playerName,
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
      console.log('Socket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: 'Failed to connect to the server. Please check your internet connection.',
      });
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      toast({
        variant: 'destructive',
        title: 'Socket Error',
        description: error.message || 'An unexpected error occurred.',
      });
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
  'lobby-updated': (data: { lobby: any; updateType: string; timestamp: string }) => void;
  'lobby-ended': (data: { reason: string; timestamp: string }) => void;
  'settings-updated': (data: { lobby: any; timestamp: string }) => void;
  'chat-message': (data: { message: string; playerId: string; playerName: string; timestamp: string }) => void;
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