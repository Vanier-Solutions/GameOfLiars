import { Server } from 'socket.io';
import { activeLobbies } from '../routes/lobby.js';

export function setupSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: function (origin, callback) {
                // Allow requests with no origin
                if (!origin) return callback(null, true);
                
                // Allow Vercel domain
                if (origin.includes('game-of-liars.vercel.app')) {
                    return callback(null, true);
                }

                // Allow local development origins (localhost and LAN IPs)
                if (
                    origin.includes('localhost') ||
                    origin.includes('127.0.0.1') ||
                    /https?:\/\/[\d.]+(?::\d+)?$/.test(origin)
                ) {
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
                            console.log(`Host ${socket.playerName} disconnected from intentionally ended lobby ${socket.lobbyCode}`);
                            return;
                        }
                        
                        // Only trigger host disconnect if there's no existing timers (prevents multiple triggers)
                        if (!lobby.hostDisconnectTimeout && !lobby.hostDisconnectGraceTimer) {
                            // Mark pending and start a short grace period to allow navigation reconnects
                            lobby.hostDisconnectPending = true;
                            lobby.hostDisconnectGraceTimer = setTimeout(() => {
                                const currentLobby = activeLobbies.get(socket.lobbyCode);
                                if (!currentLobby) return;
                                
                                // If pending was cleared (host reconnected), do nothing
                                if (!currentLobby.hostDisconnectPending) {
                                    currentLobby.hostDisconnectGraceTimer = null;
                                    return;
                                }
                                
                                // Announce host disconnected and start the 30s shutdown timer
                                io.to(socket.lobbyCode).emit('hostDisconnected', { 
                                    message: 'The host has disconnected. The lobby will close in 30 seconds if they do not reconnect.' 
                                });
                                currentLobby.hostDisconnectedAnnounced = true;

                                currentLobby.hostDisconnectTimeout = setTimeout(() => {
                                    const finalLobby = activeLobbies.get(socket.lobbyCode);
                                    // Check if the lobby still exists and the timeout is still valid (host hasn't reconnected)
                                    if (finalLobby && finalLobby.hostDisconnectTimeout) {
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
                                
                                currentLobby.hostDisconnectGraceTimer = null;
                            }, 2000); // 2 second delay to allow for page navigation
                        }
                    } else if (player) {
                        // Regular player disconnected - DO NOT remove them immediately.
                        console.log(`Player ${socket.playerName} transiently disconnected from lobby ${socket.lobbyCode} - preserving team assignment.`);

                        // Check if host is now alone; if so, start a 3s grace then 30s shutdown sequence for host-only lobby
                        const room = io.sockets.adapter.rooms.get(socket.lobbyCode);
                        let nonHostPresent = false;
                        if (room) {
                            for (const socketId of room) {
                                const sock = io.sockets.sockets.get(socketId);
                                if (sock && sock.playerName && sock.playerName !== lobby.getHost().getName()) {
                                    nonHostPresent = true;
                                    break;
                                }
                            }
                        }
                        const hostStillConnected = !!room && Array.from(room).some(id => {
                            const s = io.sockets.sockets.get(id);
                            return s && s.playerName === lobby.getHost().getName();
                        });

                        if (!nonHostPresent && hostStillConnected) {
                            if (!lobby.noPlayersLeftTimeout && !lobby.noPlayersLeftGraceTimer) {
                                lobby.noPlayersLeftPending = true;
                                lobby.noPlayersLeftGraceTimer = setTimeout(() => {
                                    const currentLobby = activeLobbies.get(socket.lobbyCode);
                                    if (!currentLobby) return;
                                    // Recompute presence
                                    const r = io.sockets.adapter.rooms.get(socket.lobbyCode);
                                    let someoneElse = false;
                                    if (r) {
                                        for (const sid of r) {
                                            const so = io.sockets.sockets.get(sid);
                                            if (so && so.playerName && so.playerName !== currentLobby.getHost().getName()) {
                                                someoneElse = true; break;
                                            }
                                        }
                                    }
                                    const hostPresent = !!r && Array.from(r).some(id => {
                                        const s2 = io.sockets.sockets.get(id);
                                        return s2 && s2.playerName === currentLobby.getHost().getName();
                                    });
                                    if (!currentLobby.noPlayersLeftPending || someoneElse || !hostPresent) {
                                        currentLobby.noPlayersLeftGraceTimer = null;
                                        return;
                                    }
                                    // Notify host only
                                    for (const sid of r || []) {
                                        const s3 = io.sockets.sockets.get(sid);
                                        if (s3 && s3.playerName === currentLobby.getHost().getName()) {
                                            s3.emit('noPlayersLeft', { message: 'No players left. The lobby will close in 30 seconds if no one rejoins.' });
                                        }
                                    }
                                    currentLobby.noPlayersLeftAnnounced = true;
                                    currentLobby.noPlayersLeftTimeout = setTimeout(() => {
                                        const finalL = activeLobbies.get(socket.lobbyCode);
                                        if (finalL && finalL.noPlayersLeftTimeout) {
                                            io.to(socket.lobbyCode).emit('lobbyClosed', { message: 'Lobby closed because no players rejoined in time.' });
                                            const sockets = io.sockets.adapter.rooms.get(socket.lobbyCode);
                                            if (sockets) {
                                                sockets.forEach(socketId => {
                                                    const sock = io.sockets.sockets.get(socketId);
                                                    if (sock) sock.disconnect(true);
                                                });
                                            }
                                            activeLobbies.delete(socket.lobbyCode);
                                            console.log(`Lobby ${socket.lobbyCode} closed due to no players left.`);
                                        }
                                    }, 30000);
                                    currentLobby.noPlayersLeftGraceTimer = null;
                                }, 3000); // 3 second delay for player reconnects
                            }
                        }
                    }
                }
            }
        });

        // Join lobby room
        socket.on('joinLobby', (data) => {
            const { code, playerName, playerId } = data;
            
            const lobby = activeLobbies.get(code.toUpperCase());
            
            if (!lobby) {
                socket.emit('error', { message: 'Lobby not found' });
                return;
            }

            // Prefer identifying player by ID, fallback to name
            let player = null;
            if (playerId) {
                player = lobby.getPlayerById(playerId);
            }
            if (!player && playerName) {
                player = lobby.getPlayerByName(playerName);
            }
            
            if (!player) {
                socket.emit('error', { message: 'Player not found in lobby' });
                return;
            }

            // If the host has reconnected, clear the disconnect timeout and notify players
            if (lobby.getHost().getName() === player.getName()) {
                // Clear any grace timer
                if (lobby.hostDisconnectGraceTimer) {
                    clearTimeout(lobby.hostDisconnectGraceTimer);
                    lobby.hostDisconnectGraceTimer = null;
                }

                // Clear pending flag
                if (lobby.hostDisconnectPending) {
                    lobby.hostDisconnectPending = false;
                }

                // Clear the 30s timeout if it was set
                if (lobby.hostDisconnectTimeout) {
                    clearTimeout(lobby.hostDisconnectTimeout);
                    lobby.hostDisconnectTimeout = null;
                }

                // If we had announced a disconnect, notify that host reconnected
                if (lobby.hostDisconnectedAnnounced) {
                    lobby.hostDisconnectedAnnounced = false;
                    io.to(code.toUpperCase()).emit('hostReconnected', { message: 'The host has reconnected.' });
                    console.log(`Host ${player.getName()} reconnected to lobby ${code.toUpperCase()}`);
                }
            } else {
                // A non-host joined; clear no-players-left timers and notify host
                if (lobby.noPlayersLeftGraceTimer) {
                    clearTimeout(lobby.noPlayersLeftGraceTimer);
                    lobby.noPlayersLeftGraceTimer = null;
                }
                if (lobby.noPlayersLeftTimeout) {
                    clearTimeout(lobby.noPlayersLeftTimeout);
                    lobby.noPlayersLeftTimeout = null;
                }
                lobby.noPlayersLeftPending = false;
                if (lobby.noPlayersLeftAnnounced) {
                    lobby.noPlayersLeftAnnounced = false;
                    // Notify host to hide banner
                    const room = io.sockets.adapter.rooms.get(code.toUpperCase());
                    if (room) {
                        for (const sid of room) {
                            const s = io.sockets.sockets.get(sid);
                            if (s && s.playerName === lobby.getHost().getName()) {
                                s.emit('playersRejoined', { message: 'Players rejoined.' });
                            }
                        }
                    }
                }
            }

            // Leave any previous lobby room
            if (socket.lobbyCode && socket.lobbyCode !== code.toUpperCase()) {
                socket.leave(socket.lobbyCode);
            }

            // Join the lobby room
            socket.join(code.toUpperCase());
            socket.lobbyCode = code.toUpperCase();
            socket.playerName = player.getName();

            // Notify others that player joined
            socket.to(code.toUpperCase()).emit('playerJoined', {
                playerName: player.getName(),
                team: player.getTeam(),
                role: player.getRole()
            });

            // Send a lightweight teamUpdate to this socket so it refreshes state on (re)join
            socket.emit('teamUpdate', { reason: 'rejoin' });
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