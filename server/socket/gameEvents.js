import { GameService } from '../services/GameService.js';

export function setupGameEvents(io, activeLobbies) {
    
    // Game started event
    function broadcastGameStarted(lobbyCode) {
        const lobby = activeLobbies.get(lobbyCode);
        if (!lobby) return;

        io.to(lobbyCode).emit('gameStarted', {
            gameState: lobby.getGameState(),
            teams: {
                blue: lobby.getBlueTeam().map(p => ({ name: p.getName(), role: p.getRole() })),
                red: lobby.getRedTeam().map(p => ({ name: p.getName(), role: p.getRole() }))
            },
            captains: {
                blue: lobby.getBlueCaptain()?.getName(),
                red: lobby.getRedCaptain()?.getName()
            }
        });
    }

    // Round started event
    function broadcastRoundStarted(lobbyCode, roundData) {
        io.to(lobbyCode).emit('roundStarted', {
            roundNumber: roundData.roundNumber,
            question: roundData.question,
            roundStartTime: roundData.roundStartTime,
            roundLimit: roundData.roundLimit
        });
    }

    // Captain ready status update
    function broadcastCaptainReady(lobbyCode, team, ready, bothReady) {
        io.to(lobbyCode).emit('captainReady', {
            team: team,
            ready: ready,
            bothReady: bothReady
        });
    }

    // Answer submitted event
    function broadcastAnswerSubmitted(lobbyCode, team, bothAnswered) {
        io.to(lobbyCode).emit('answerSubmitted', {
            team: team,
            bothAnswered: bothAnswered
        });
    }

    // Round ended - reveal answers
    function broadcastRoundEnded(lobbyCode, roundData) {
        const lobby = activeLobbies.get(lobbyCode);
        if (!lobby) return;

        const currentRound = lobby.gameState.currentRound;
        if (!currentRound) return;

        io.to(lobbyCode).emit('roundEnded', {
            roundNumber: currentRound.getRoundNumber(),
            blueAnswer: currentRound.getTeamAnswer('blue'),
            redAnswer: currentRound.getTeamAnswer('red'),
            blueStole: currentRound.getTeamStole('blue'),
            redStole: currentRound.getTeamStole('red'),
            correctAnswer: currentRound.getAnswer()
        });
    }

    // Winner determined
    function broadcastWinnerDetermined(lobbyCode, winner, scores, gameEnded) {
        io.to(lobbyCode).emit('winnerDetermined', {
            winner: winner,
            scores: scores,
            gameEnded: gameEnded
        });
    }

    // Game ended
    function broadcastGameEnded(lobbyCode, finalScores) {
        io.to(lobbyCode).emit('gameEnded', {
            finalScores: finalScores,
            winner: finalScores.blue > finalScores.red ? 'blue' : 
                   finalScores.red > finalScores.blue ? 'red' : 'tie'
        });
    }

    // Team assignment update
    function broadcastTeamUpdate(lobbyCode) {
        const lobby = activeLobbies.get(lobbyCode);
        if (!lobby) return;

        io.to(lobbyCode).emit('teamUpdate', {
            blueTeam: lobby.getBlueTeam().map(p => ({ name: p.getName(), role: p.getRole() })),
            redTeam: lobby.getRedTeam().map(p => ({ name: p.getName(), role: p.getRole() })),
            spectators: lobby.getSpectators().map(p => ({ name: p.getName(), role: p.getRole() })),
            captains: {
                blue: lobby.getBlueCaptain()?.getName(),
                red: lobby.getRedCaptain()?.getName()
            }
        });
    }

    // Settings updated
    function broadcastSettingsUpdate(lobbyCode, settings) {
        io.to(lobbyCode).emit('settingsUpdated', {
            settings: settings
        });
    }

    return {
        broadcastGameStarted,
        broadcastRoundStarted,
        broadcastCaptainReady,
        broadcastAnswerSubmitted,
        broadcastRoundEnded,
        broadcastWinnerDetermined,
        broadcastGameEnded,
        broadcastTeamUpdate,
        broadcastSettingsUpdate
    };
} 