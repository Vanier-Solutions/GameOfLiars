import { verifyToken } from '../services/lobbyService.js';
import * as lobbyService from '../services/lobbyService.js';

// playerId -> Socket Connection
const playerSockets = new Map();
// lobbyCode -> Socket Connections
const lobbySockets = new Map();

export const setupSocketHandlers = (io) => {
    // Set the io instance for use in utility functions
    setIoInstance(io);
    
    io.on('connection', (socket) => {
        console.log(`New socket connection: ${socket.id}`);

        // Handle player joining a lobby
        socket.on('join-lobby', async (data) => {
            try {
                const { token } = data;
                
                if (!token) {
                    socket.emit('error', { message: 'Authentication token required' });
                    return;
                }

                const payload = verifyToken(token);
                if (!payload) {
                    socket.emit('error', { message: 'Invalid authentication token' });
                    return;
                }

                const { sub: playerId, lobby: lobbyCode } = payload;

                // Verify that the player actually exists in the lobby
                const lobby = lobbyService.getLobbyByCode(lobbyCode);
                if (!lobby) {
                    socket.emit('error', { message: 'Lobby not found' });
                    return;
                }
                const playerExists = lobby.getAllPlayers().find(p => p.id === playerId);
                if (!playerExists) {
                    socket.emit('error', { message: 'Player no longer in lobby - please rejoin' });
                    return;
                }

                // Store socket mappings
                playerSockets.set(playerId, socket.id);
                
                if (!lobbySockets.has(lobbyCode)) {
                    lobbySockets.set(lobbyCode, new Set());
                }
                lobbySockets.get(lobbyCode).add(socket.id);

                // Join the socket room for this lobby
                socket.join(lobbyCode);
                
                // Store lobby info on socket for easy access
                socket.data.playerId = playerId;
                socket.data.lobbyCode = lobbyCode;

                console.log(`Player ${playerId} joined lobby ${lobbyCode}`);
                

            } catch (error) {
                console.error('Error in join-lobby:', error);
                socket.emit('error', { message: 'Failed to join lobby' });
            }
        });

        // Handle player leaving a lobby
        socket.on('leave-lobby', async (data) => {
            try {
                const { token } = data;
                
                if (!token) {
                    socket.emit('error', { message: 'Authentication token required' });
                    return;
                }

                const payload = verifyToken(token);
                if (!payload) {
                    socket.emit('error', { message: 'Invalid authentication token' });
                    return;
                }

                const { sub: playerId, lobby: lobbyCode } = payload;

                // Remove socket mappings
                playerSockets.delete(playerId);
                
                if (lobbySockets.has(lobbyCode)) {
                    lobbySockets.get(lobbyCode).delete(socket.id);
                    if (lobbySockets.get(lobbyCode).size === 0) {
                        lobbySockets.delete(lobbyCode);
                    }
                }

                // Leave the socket room
                socket.leave(lobbyCode);
                
                // Clear socket data
                socket.data.playerId = null;
                socket.data.lobbyCode = null;

                console.log(`Player ${playerId} left lobby ${lobbyCode}`);
                

            } catch (error) {
                console.error('Error in leave-lobby:', error);
                socket.emit('error', { message: 'Failed to leave lobby' });
            }
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            const playerId = socket.data.playerId;
            const lobbyCode = socket.data.lobbyCode;

            if (playerId && lobbyCode) {
                lobbyService.leaveLobby(playerId, lobbyCode);
            }
        });

        // Handle lobby updates (team changes, settings changes, etc.)
        socket.on('lobby-updated', (data) => {
            const { lobbyCode } = data;
            if (lobbyCode) {
                // Broadcast to all players in the lobby
                socket.to(lobbyCode).emit('lobby-updated', data);
            }
        });

        // Handle settings updated
        socket.on('settings-updated', (data) => {
            const { lobbyCode } = data;
            if (lobbyCode) {
                socket.to(lobbyCode).emit('settings-updated', data);
            }
        });

        // Handle chat messages
        socket.on('chat-message', (data) => {
            const { lobbyCode, message, playerId, playerName } = data;
            if (lobbyCode) {
                // Broadcast to all players in the lobby including sender
                io.to(lobbyCode).emit('chat-message', {
                    message,
                    playerId,
                    playerName,
                    timestamp: new Date().toISOString()
                });
            }
        });
    });
};

// Utility functions to emit events from other parts of the application
export const emitToLobby = (lobbyCode, event, data) => {
    const io = getIoInstance();
    if (io && lobbySockets.has(lobbyCode)) {
        io.to(lobbyCode).emit(event, data);
    }
};

export const emitToPlayer = (playerId, event, data) => {
    const io = getIoInstance();
    if (io) {
        const socketId = playerSockets.get(playerId);
        if (socketId) {
            io.to(socketId).emit(event, data);
        }
    }
};

// Get the io instance for use in other modules
let ioInstance = null;
export const setIoInstance = (io) => {
    ioInstance = io;
};

export const getIoInstance = () => {
    return ioInstance;
}; 