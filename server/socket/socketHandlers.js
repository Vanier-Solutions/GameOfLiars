import { verifyToken } from '../services/lobbyService.js';
import * as lobbyService from '../services/lobbyService.js';
import { emitPlayerDisconnected } from '../socket/socketService.js';

// playerId -> Socket Connection
const playerSockets = new Map();
// lobbyCode -> Socket Connections
const lobbySockets = new Map();
// Track disconnected players during games (playerId -> timeout)
const disconnectedPlayers = new Map();

export const setupSocketHandlers = (io) => {
    // Set the io instance for use in utility functions
    setIoInstance(io);
    
    io.on('connection', (socket) => {

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

                // Store socket mappings (replace existing if reconnecting)
                const existingSocketId = playerSockets.get(playerId);
                
                // If player was disconnected, clear the timeout
                if (disconnectedPlayers.has(playerId)) {
                    clearTimeout(disconnectedPlayers.get(playerId));
                    disconnectedPlayers.delete(playerId);

                }
                
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
                // Get lobby to check game phase
                const lobby = lobbyService.getLobbyByCode(lobbyCode);
                
                if (!lobby) return; // Lobby already gone
                
                // Allow a grace period to reconnect in all phases (pre-game and playing)


                // Emit disconnected event but don't remove from lobby yet
                emitPlayerDisconnected(lobbyCode, playerId);

                // Set up a timeout to remove player if they don't reconnect within 2 minutes
                const timeout = setTimeout(() => {

                    disconnectedPlayers.delete(playerId);
                    lobbyService.leaveLobby(playerId, lobbyCode);
                }, 10000); // 10 seconds

                disconnectedPlayers.set(playerId, timeout);

                // Clean up socket mappings but keep player in lobby
                playerSockets.delete(playerId);
                if (lobbySockets.has(lobbyCode)) {
                    lobbySockets.get(lobbyCode).delete(socket.id);
                    if (lobbySockets.get(lobbyCode).size === 0) {
                        lobbySockets.delete(lobbyCode);
                    }
                }
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

        // Handle player kicked
        socket.on('player-kicked', (data) => {
            const { lobbyCode, player, kickedBy, lobby } = data;
            if (lobbyCode) {
                socket.to(lobbyCode).emit('player-kicked', data);
            }
        });

        // Handle chat messages
        socket.on('chat-message', (data) => {
            const { lobbyCode, message, playerId, playerName, chatType = 'game' } = data;
            if (lobbyCode) {
                // Get player info to include team
                const player = lobbyService.getPlayerById(playerId);
                const team = player ? player.getTeam() : 'blue';
                
                // For team chat, only send to players on the same team
                if (chatType === 'team') {
                    const lobby = lobbyService.getLobbyByCode(lobbyCode);
                    if (lobby) {
                        const teamPlayers = team === 'blue' ? lobby.getBlueTeam() : lobby.getRedTeam();
                        teamPlayers.forEach(p => {
                            const socketId = playerSockets.get(p.id);
                            if (socketId) {
                                io.to(socketId).emit('chat-message', {
                                    message,
                                    playerId,
                                    playerName,
                                    team,
                                    chatType,
                                    timestamp: new Date().toISOString()
                                });
                            }
                        });
                    }
                } else {
                    // For game chat, broadcast to all players in the lobby
                    io.to(lobbyCode).emit('chat-message', {
                        message,
                        playerId,
                        playerName,
                        team,
                        chatType,
                        timestamp: new Date().toISOString()
                    });
                }
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