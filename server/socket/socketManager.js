import { Server } from 'socket.io';
import { activeLobbies } from '../routes/lobby.js';

export function setupSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log('User connected:', socket.id);

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

            console.log(`${playerName} joined lobby ${code}`);
        });

        // Leave lobby room
        socket.on('leaveLobby', () => {
            if (socket.lobbyCode) {
                socket.leave(socket.lobbyCode);
                socket.to(socket.lobbyCode).emit('playerLeft', {
                    playerName: socket.playerName
                });
                console.log(`${socket.playerName} left lobby ${socket.lobbyCode}`);
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
            if (team === 'spectator') return;

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

        // Disconnect handling
        socket.on('disconnect', () => {
            if (socket.lobbyCode) {
                socket.to(socket.lobbyCode).emit('playerDisconnected', {
                    playerName: socket.playerName
                });
                console.log(`${socket.playerName} disconnected from lobby ${socket.lobbyCode}`);
            }
        });
    });

    return io;
} 