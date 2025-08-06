import { Server } from 'socket.io';
import { activeLobbies } from '../routes/lobby.js';

export function setupSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: function (origin, callback) {
                // Allow requests with no origin
                if (!origin) return callback(null, true);
                
                // Allow localhost and IP addresses for development
                if (origin.includes('game-of-liars.vercel.app')) {
                    return callback(null, true);
                }
                
                callback(new Error('Not allowed by CORS'));
            },
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        // Handle disconnect
        socket.on('disconnect', () => {
            if (socket.lobbyCode) {
                const lobby = activeLobbies.get(socket.lobbyCode);
                if (lobby) {
                    const player = lobby.getPlayerByName(socket.playerName);
                    
                    if (lobby.getHost().getName() === socket.playerName) {
                        // Check if lobby was intentionally ended by host
                        if (lobby.intentionallyEnded) {
                            // Lobby was intentionally ended, don't show disconnect message
                            console.log(`Host ${socket.playerName} disconnected from intentionally ended lobby ${socket.lobbyCode}`);
                            return;
                        }
                        
                        // Host disconnected: Notify players and start a 30-second timer
                        io.to(socket.lobbyCode).emit('hostDisconnected', { 
                            message: 'The host has disconnected. The lobby will close in 30 seconds if they do not reconnect.' 
                        });

                        lobby.hostDisconnectTimeout = setTimeout(() => {
                            const currentLobby = activeLobbies.get(socket.lobbyCode);
                            // Check if the lobby still exists and the timeout is still valid (host hasn't reconnected)
                            if (currentLobby && currentLobby.hostDisconnectTimeout) {
                                io.to(socket.lobbyCode).emit('lobbyClosed', { message: 'Lobby closed because the host did not reconnect in time.' });

                                const sockets = io.sockets.adapter.rooms.get(socket.lobbyCode);
                                if (sockets) {
                                    sockets.forEach(socketId => {
                                        const sock = io.sockets.sockets.get(socketId);
                                        if (sock) sock.disconnect(true);
                                    });
                                }
                                
                                activeLobbies.delete(socket.lobbyCode);
                                console.log(`Lobby ${socket.lobbyCode} closed due to host timeout.`);
                            }
                        }, 30000); // 30 seconds
                    } else if (player) {
                        // Regular player disconnected - remove them from the lobby and notify others
                        lobby.removePlayer(player);
                        
                        // Notify other players
                        socket.to(socket.lobbyCode).emit('playerLeft', {
                            playerName: socket.playerName
                        });
                        
                        // Check if lobby should be deleted (no players left)
                        if (lobby.shouldBeDeleted()) {
                            io.to(socket.lobbyCode).emit('lobbyClosed', { message: 'Lobby closed because all players have left.' });
                            activeLobbies.delete(socket.lobbyCode);
                            console.log(`Lobby ${socket.lobbyCode} closed due to all players leaving.`);
                        }
                    }
                }
            }
        });

        // Join lobby room
        socket.on('joinLobby', (data) => {
            const { code, playerName } = data;
            
            const lobby = activeLobbies.get(code.toUpperCase());
            
            if (!lobby) {
                socket.emit('error', { message: 'Lobby not found' });
                return;
            }

            const player = lobby.getPlayerByName(playerName);
            if (!player) {
                socket.emit('error', { message: 'Player not found in lobby' });
                return;
            }

            // If the host has reconnected, clear the disconnect timeout and notify players
            if (lobby.getHost().getName() === playerName && lobby.hostDisconnectTimeout) {
                clearTimeout(lobby.hostDisconnectTimeout);
                lobby.hostDisconnectTimeout = null;
                io.to(code.toUpperCase()).emit('hostReconnected', { message: 'The host has reconnected.' });
            }

            // Leave any previous lobby room
            if (socket.lobbyCode && socket.lobbyCode !== code.toUpperCase()) {
                socket.leave(socket.lobbyCode);
            }

            // Join the lobby room
            socket.join(code.toUpperCase());
            socket.lobbyCode = code.toUpperCase();
            socket.playerName = playerName;

            // Notify others that player joined
            socket.to(code.toUpperCase()).emit('playerJoined', {
                playerName: playerName,
                team: player.getTeam(),
                role: player.getRole()
            });
        });

        // Host ends the lobby
        socket.on('endLobby', () => {
            const lobby = activeLobbies.get(socket.lobbyCode);
            if (lobby && lobby.getHost().getName() === socket.playerName) {
                // Mark lobby as intentionally ended to prevent disconnect timeout
                lobby.markAsIntentionallyEnded();
                
                // Notify players and disconnect them
                io.to(socket.lobbyCode).emit('lobbyClosed', { message: 'The host has ended the lobby.' });

                const sockets = io.sockets.adapter.rooms.get(socket.lobbyCode);
                if (sockets) {
                    sockets.forEach(socketId => {
                        const sock = io.sockets.sockets.get(socketId);
                        if (sock) {
                            sock.disconnect(true);
                        }
                    });
                }
                
                activeLobbies.delete(socket.lobbyCode);
                console.log(`Lobby ${socket.lobbyCode} ended by host.`);
            }
        });

        // Leave lobby room
        socket.on('leaveLobby', () => {
            if (socket.lobbyCode) {
                socket.leave(socket.lobbyCode);
                socket.to(socket.lobbyCode).emit('playerLeft', {
                    playerName: socket.playerName
                });
            }
        });

        // Team chat
        socket.on('teamChat', (data) => {
            const { playerName, message } = data;
            const lobby = activeLobbies.get(socket.lobbyCode);
            
            if (!lobby) return;

            const player = lobby.getPlayerByName(playerName || socket.playerName);
            if (!player) return;

            const team = player.getTeam();
            
            // Allow spectators to chat with other spectators
            if (team === 'spectator') {
                // Send to all spectators (including sender)
                io.to(socket.lobbyCode).emit('teamChat', {
                    playerName: playerName || socket.playerName,
                    team: 'spectator',
                    message: message
                });
                return;
            }

            // Send to all team members (including sender)
            io.to(socket.lobbyCode).emit('teamChat', {
                playerName: playerName || socket.playerName,
                team: team,
                message: message
            });
        });

        // Game chat (for all players)
        socket.on('gameChat', (data) => {
            const { playerName, message } = data;
            const lobby = activeLobbies.get(socket.lobbyCode);
            
            if (!lobby) return;

            const player = lobby.getPlayerByName(playerName || socket.playerName);
            if (!player) return;

            // Send to all players in the game (including sender)
            io.to(socket.lobbyCode).emit('gameChat', {
                playerName: playerName || socket.playerName,
                message: message
            });
        });

        // Lobby chat (for spectators)
        socket.on('lobbyChat', (data) => {
            const { message } = data;
            const lobby = activeLobbies.get(socket.lobbyCode);
            
            if (!lobby) return;

            const player = lobby.getPlayerByName(socket.playerName);
            if (!player) return;

            // Send to all in lobby
            socket.to(socket.lobbyCode).emit('lobbyChat', {
                playerName: socket.playerName,
                message: message
            });
        });

        // Settings update via Socket.io
        socket.on('updateSettings', (data) => {
            const { code, playerName, settings } = data;
            const lobby = activeLobbies.get(code?.toUpperCase() || socket.lobbyCode);
            
            if (!lobby) return;

            // Verify the player is the host
            if (lobby.getHost().getName() !== playerName) {
                socket.emit('error', { message: 'Only the host can change settings' });
                return;
            }

            if (lobby.gamePhase !== 'pregame') {
                socket.emit('error', { message: 'Cannot change settings during game' });
                return;
            }

            // Update settings
            if (settings.rounds !== undefined) {
                if (settings.rounds < 1 || settings.rounds > 20) {
                    socket.emit('error', { message: 'Rounds must be between 1 and 20' });
                    return;
                }
                lobby.setNumberOfRounds(settings.rounds);
            }
            
            if (settings.roundLimit !== undefined) {
                if (settings.roundLimit < 15 || settings.roundLimit > 300) {
                    socket.emit('error', { message: 'Round limit must be between 15 and 300 seconds' });
                    return;
                }
                lobby.setRoundLimit(settings.roundLimit);
            }

            if (settings.maxScore !== undefined) {
                if (settings.maxScore < 1 || settings.maxScore > 100) {
                    socket.emit('error', { message: 'Max score must be between 1 and 100' });
                    return;
                }
                lobby.setMaxScore(settings.maxScore);
            }

            // Broadcast settings update to all players in the lobby
            io.to(socket.lobbyCode).emit('settingsUpdate', lobby.getSettings());
        });
    });

    return io;
} 