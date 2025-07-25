import { Server } from 'socket.io';
import { activeLobbies } from '../routes/lobby.js';

export function setupSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: "*", // TODO: Set specific origin in production
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
            const { message } = data;
            const lobby = activeLobbies.get(socket.lobbyCode);
            
            if (!lobby) return;

            const player = lobby.getPlayerByName(socket.playerName);
            if (!player) return;

            const team = player.getTeam();
            if (team === 'spectator') return;

            // Send to team members only
            socket.to(socket.lobbyCode).emit('teamChat', {
                playerName: socket.playerName,
                team: team,
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