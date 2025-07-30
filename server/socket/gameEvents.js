import { GameService } from '../services/GameService.js';

export function setupGameEvents(io, activeLobbies) {
    
    function broadcastGameStarted(lobbyCode) {
        io.to(lobbyCode).emit('gameStarted', { lobbyCode });
    }
    
    function broadcastRoundStarted(lobbyCode, roundData) {
        io.to(lobbyCode).emit('roundStarted', roundData);
    }
    
    function broadcastAnswerSubmitted(lobbyCode, data) {
        const { team, isSteal, bothAnswered } = data;
        const teamColor = team === 'blue' ? 'Blue' : 'Red';
        // Hide steal information - always show "submitted their answer"
        const action = 'submitted their answer';
        
        io.to(lobbyCode).emit('answerSubmitted', {
            team: team,
            teamColor: teamColor,
            action: action,
            message: `${teamColor} team has ${action}.`,
            bothAnswered: bothAnswered
        });
    }
    
    function broadcastRoundResults(lobbyCode, roundData) {
        io.to(lobbyCode).emit('roundResults', roundData);
    }
    
    function broadcastNextRound(lobbyCode, roundData) {
        io.to(lobbyCode).emit('nextRound', roundData);
    }
    
    function broadcastGameEnded(lobbyCode, gameData) {
        io.to(lobbyCode).emit('gameEnded', gameData);
    }
    
    function broadcastGameChat(lobbyCode, data) {
        io.to(lobbyCode).emit('gameChat', data);
    }
    
    function broadcastTeamChat(lobbyCode, data) {
        io.to(lobbyCode).emit('teamChat', data);
    }
    
    function broadcastTeamUpdate(lobbyCode) {
        const lobby = activeLobbies.get(lobbyCode);
        if (!lobby) return;
        
        io.to(lobbyCode).emit('teamUpdate', {
            blueTeam: lobby.getBlueTeam().map(p => ({ name: p.getName(), role: p.getRole() })),
            redTeam: lobby.getRedTeam().map(p => ({ name: p.getName(), role: p.getRole() })),
            spectators: lobby.getSpectators().map(p => ({ name: p.getName(), role: p.getRole() })),
            captains: {
                blue: lobby.getBlueCaptain()?.getName() || null,
                red: lobby.getRedCaptain()?.getName() || null
            }
        });
    }
    
    function broadcastSettingsUpdate(lobbyCode, settings) {
        io.to(lobbyCode).emit('settingsUpdate', { settings });
    }
    
    function broadcastReturnToLobby(lobbyCode) {
        io.to(lobbyCode).emit('returnToLobby');
    }
    
    function broadcastPlayerKicked(lobbyCode, kickedPlayerName, kickedPlayerId) {
        io.to(lobbyCode).emit('playerKicked', {
            kickedPlayer: kickedPlayerName,
            kickedPlayerId: kickedPlayerId
        });
    }
    
    return {
        broadcastGameStarted,
        broadcastRoundStarted,
        broadcastAnswerSubmitted,
        broadcastRoundResults,
        broadcastNextRound,
        broadcastGameEnded,
        broadcastGameChat,
        broadcastTeamChat,
        broadcastTeamUpdate,
        broadcastSettingsUpdate,
        broadcastReturnToLobby,
        broadcastPlayerKicked
    };
} 