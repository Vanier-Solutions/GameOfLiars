import express from 'express';
import { GameService } from '../services/GameService.js';
import { activeLobbies } from './lobby.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// POST /api/game/:code/start
router.post("/:code/start", optionalAuth, async (req, res) => {
    try {
        const { code } = req.params;
        
        const lobby = activeLobbies.get(code);
        if (!lobby) {
            return res.status(404).json({ success: false, error: 'Lobby not found' });
        }
        
        // Robust player finding - try session first, then headers
        let player = null;
        
        // Method 1: Try session user
        if (req.user && req.user.id) {
            player = lobby.getPlayerById(req.user.id);
        }
        
        // Method 2: Try header-based authentication if session failed
        if (!player) {
            const headerPlayerId = req.get('x-player-id');
            const headerPlayerName = req.get('x-player-name');
            
            if (headerPlayerId) {
                player = lobby.getPlayerById(headerPlayerId);
            }
            
            if (!player && headerPlayerName) {
                player = lobby.getPlayerByName(headerPlayerName);
            }
        }
        
        // Method 3: Try to find by session user name if ID didn't work
        if (!player && req.user && req.user.name) {
            player = lobby.getPlayerByName(req.user.name);
        }
        
        if (!player || player.getName() !== lobby.getHost().getName()) {
            return res.status(403).json({ success: false, error: 'Only the host can start the game' });
        }
        
        const round = await GameService.startGame(lobby, req);
        
        // Broadcast game started event
        if (req.app.locals.gameEvents) {
            req.app.locals.gameEvents.broadcastGameStarted(lobby.getCode());
        }
        
        res.json({
            success: true,
            gamePhase: lobby.gamePhase,
            roundNumber: round.getRoundNumber(),
            question: round.getQuestion()
        });
    } catch (error) {
        console.error('Error starting game:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/game/:code/round/start - New endpoint for starting individual rounds
router.post("/:code/round/start", optionalAuth, async (req, res) => {
    try {
        const { code } = req.params;
        
        const lobby = activeLobbies.get(code);
        if (!lobby) {
            return res.status(404).json({ success: false, error: 'Lobby not found' });
        }
        
        // Robust player finding - try session first, then headers
        let player = null;
        
        // Method 1: Try session user
        if (req.user && req.user.id) {
            player = lobby.getPlayerById(req.user.id);
        }
        
        // Method 2: Try header-based authentication if session failed
        if (!player) {
            const headerPlayerId = req.get('x-player-id');
            const headerPlayerName = req.get('x-player-name');
            
            if (headerPlayerId) {
                player = lobby.getPlayerById(headerPlayerId);
            }
            
            if (!player && headerPlayerName) {
                player = lobby.getPlayerByName(headerPlayerName);
            }
        }
        
        // Method 3: Try to find by session user name if ID didn't work
        if (!player && req.user && req.user.name) {
            player = lobby.getPlayerByName(req.user.name);
        }
        
        if (!player || player.getName() !== lobby.getHost().getName()) {
            return res.status(403).json({ success: false, error: 'Only the host can start rounds' });
        }
        
        const roundData = await GameService.startRound(lobby);
        
        // Broadcast round started event
        if (req.app.locals.gameEvents) {
            req.app.locals.gameEvents.broadcastRoundStarted(lobby.getCode(), roundData);
        }
        
        res.json({
            success: true,
            roundData: roundData
        });
    } catch (error) {
        console.error('Error starting round:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/game/:code/round/answer
router.post("/:code/round/answer", optionalAuth, (req, res) => {
    try {
        const { code } = req.params;
        const { answer, isSteal } = req.body;
        
        const lobby = activeLobbies.get(code);
        if (!lobby) {
            return res.status(404).json({ success: false, error: 'Lobby not found' });
        }
        
        // Find player using session
        let player = req.user ? lobby.getPlayerById(req.user.id) : null;
        
        // Fallback: if session is lost, try to find player by name from headers
        if (!player) {
            const playerName = req.get('x-player-name');
            if (playerName) {
                player = lobby.getPlayerByName(playerName);
            }
        }
        
        if (!player) {
            return res.status(404).json({ success: false, error: 'Player not found' });
        }
        
        if (!player.isCaptain()) {
            return res.status(403).json({ success: false, error: 'Only captains can submit answers' });
        }
        
        const team = player.getTeam();
        if (team === 'spectator') {
            return res.status(403).json({ success: false, error: 'Spectators cannot submit answers' });
        }
        
        const result = GameService.submitAnswer(lobby, team, answer, isSteal);
        
        // Broadcast answer submitted event
        if (req.app.locals.gameEvents) {
            req.app.locals.gameEvents.broadcastAnswerSubmitted(lobby.getCode(), {
                team: team,
                isSteal: isSteal,
                bothAnswered: result.bothAnswered
            });
            
            // If both teams answered, broadcast round results
            if (result.bothAnswered && result.roundData) {
                req.app.locals.gameEvents.broadcastRoundResults(lobby.getCode(), result.roundData);
            }
        }
        
        res.json({
            success: true,
            team: team,
            answer: answer,
            isSteal: isSteal,
            bothAnswered: result.bothAnswered,
            roundData: result.roundData
        });
    } catch (error) {
        console.error('Error submitting answer:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/game/:code/round/next
router.post("/:code/round/next", optionalAuth, async (req, res) => {
    try {
        const { code } = req.params;
        
        const lobby = activeLobbies.get(code);
        if (!lobby) {
            return res.status(404).json({ success: false, error: 'Lobby not found' });
        }
        
        // Robust player finding - try session first, then headers
        let player = null;
        
        // Method 1: Try session user
        if (req.user && req.user.id) {
            player = lobby.getPlayerById(req.user.id);
        }
        
        // Method 2: Try header-based authentication if session failed
        if (!player) {
            const headerPlayerId = req.get('x-player-id');
            const headerPlayerName = req.get('x-player-name');
            
            if (headerPlayerId) {
                player = lobby.getPlayerById(headerPlayerId);
            }
            
            if (!player && headerPlayerName) {
                player = lobby.getPlayerByName(headerPlayerName);
            }
        }
        
        // Method 3: Try to find by session user name if ID didn't work
        if (!player && req.user && req.user.name) {
            player = lobby.getPlayerByName(req.user.name);
        }
        
        if (!player || player.getName() !== lobby.getHost().getName()) {
            return res.status(403).json({ success: false, error: 'Only the host can start next round' });
        }
        
        const result = await GameService.nextRound(lobby);
        
        if (result.gameEnded) {
            // Game has ended, but don't broadcast match summary yet
            // Host will need to click "Match Summary" button
            res.json({
                success: true,
                gameEnded: true,
                message: 'Game has ended. Host can click "Match Summary" to see results.'
            });
        } else {
            // Broadcast next round event with round data
            if (req.app.locals.gameEvents) {
                req.app.locals.gameEvents.broadcastNextRound(lobby.getCode(), {
                    roundNumber: result.currentRoundNumber,
                    question: result.newRound.getQuestion(),
                    roundData: result.roundData
                });
            }
            
            res.json({
                success: true,
                gameEnded: false,
                roundNumber: result.currentRoundNumber,
                question: result.newRound.getQuestion(),
                roundData: result.roundData
            });
        }
    } catch (error) {
        console.error('Error starting next round:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/game/:code/state
router.get("/:code/state", optionalAuth, (req, res) => {
    try {
        const { code } = req.params;
        
        const lobby = activeLobbies.get(code);
        if (!lobby) {
            return res.status(404).json({ success: false, error: 'Lobby not found' });
        }
        
        if (req.user) {
            const isInCorrectLobby = req.user.lobbyCode === code;
            const isPlayerInLobby = lobby.hasPlayerId(req.user.id);
            if (!isInCorrectLobby && !isPlayerInLobby) {
                const playerByName = lobby.getPlayerByName(req.user.name);
                if (!playerByName) {
                    return res.status(403).json({ success: false, error: 'You are not a player in this lobby', needsToJoin: true, lobbyCode: code });
                }
            }
        } else {
            const headerPlayerId = req.get('x-player-id');
            const headerPlayerName = req.get('x-player-name');
            if (headerPlayerId || headerPlayerName) {
                let player = null;
                if (headerPlayerId) { player = lobby.getPlayerById(headerPlayerId); }
                if (!player && headerPlayerName) { player = lobby.getPlayerByName(headerPlayerName); }
                if (!player) { return res.status(403).json({ success: false, error: 'You are not a player in this lobby', needsToJoin: true, lobbyCode: code }); }
            }
        }
        
        const gameState = lobby.getGameState();
        const currentRound = gameState.currentRound;
        let roundData = null;
        if (currentRound) {
            roundData = {
                roundNumber: currentRound.getRoundNumber(),
                question: currentRound.getQuestion(),
                roundStatus: currentRound.getRoundStatus(),
                roundStartTime: currentRound.roundStartTime || undefined
            };
        }
        
        res.json({
            success: true,
            code: lobby.getCode(),
            gamePhase: lobby.gamePhase,
            scores: gameState.scores,
            roundData: roundData,
            settings: lobby.getSettings(),
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/game/:code/return-to-lobby
router.post("/:code/return-to-lobby", optionalAuth, (req, res) => {
    try {
        const { code } = req.params;
        
        const lobby = activeLobbies.get(code);
        if (!lobby) {
            return res.status(404).json({ success: false, error: 'Lobby not found' });
        }
        
        // Verify host using session
        const player = req.user ? lobby.getPlayerById(req.user.id) : null;
        if (!player || player.getName() !== lobby.getHost().getName()) {
            return res.status(403).json({ success: false, error: 'Only the host can return to lobby' });
        }
        
        // Reset lobby state back to pregame
        lobby.setGamePhase('pregame');
        lobby.setRoundNumber(0);
        lobby.setScore('blue', 0);
        lobby.setScore('red', 0);
        lobby.gameState.currentRound = null;
        lobby.rounds = [];
        
        // Broadcast return to lobby event
        if (req.app.locals.gameEvents) {
            req.app.locals.gameEvents.broadcastReturnToLobby(lobby.getCode());
        }
        
        res.json({
            success: true,
            message: 'Returning to lobby',
            gamePhase: lobby.gamePhase
        });
    } catch (error) {
        console.error('Error returning to lobby:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/game/:code/round/timeout
router.post("/:code/round/timeout", optionalAuth, (req, res) => {
    try {
        const { code } = req.params;
        
        const lobby = activeLobbies.get(code);
        if (!lobby) {
            return res.status(404).json({ success: false, error: 'Lobby not found' });
        }
        
        // Robust player finding - try session first, then headers
        let player = null;
        
        // Method 1: Try session user
        if (req.user && req.user.id) {
            player = lobby.getPlayerById(req.user.id);
        }
        
        // Method 2: Try header-based authentication if session failed
        if (!player) {
            const headerPlayerId = req.get('x-player-id');
            const headerPlayerName = req.get('x-player-name');
            
            if (headerPlayerId) {
                player = lobby.getPlayerById(headerPlayerId);
            }
            
            if (!player && headerPlayerName) {
                player = lobby.getPlayerByName(headerPlayerName);
            }
        }
        
        // Method 3: Try to find by session user name if ID didn't work
        if (!player && req.user && req.user.name) {
            player = lobby.getPlayerByName(req.user.name);
        }
        
        // Allow any player to trigger timeout, not just host
        if (!player) {
            return res.status(401).json({ success: false, error: 'Player not found' });
        }
        
        const currentRound = lobby.gameState.currentRound;
        if (!currentRound) {
            return res.status(404).json({ success: false, error: 'No active round' });
        }
        
        if (currentRound.getRoundStatus() !== 'QP') {
            return res.status(400).json({ success: false, error: 'Round is not in question period' });
        }
        
        // Evaluate the round with current answers
        const roundData = GameService.evaluateRound(lobby, currentRound);
        
        // Broadcast round results
        if (req.app.locals.gameEvents) {
            req.app.locals.gameEvents.broadcastRoundResults(lobby.getCode(), roundData);
        }
        
        res.json({
            success: true,
            roundData: roundData
        });
    } catch (error) {
        console.error('Error handling round timeout:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/game/:code/match-summary
router.post("/:code/match-summary", optionalAuth, async (req, res) => {
    try {
        const { code } = req.params;
        
        const lobby = activeLobbies.get(code);
        if (!lobby) {
            return res.status(404).json({ success: false, error: 'Lobby not found' });
        }
        
        // Verify host using session
        const player = req.user ? lobby.getPlayerById(req.user.id) : null;
        if (!player || player.getName() !== lobby.getHost().getName()) {
            return res.status(403).json({ success: false, error: 'Only the host can show match summary' });
        }
        
        // Check if game is actually ended
        if (lobby.gamePhase !== 'ended') {
            return res.status(400).json({ success: false, error: 'Game is not ended yet' });
        }
        
        const gameState = lobby.getGameState();
        const finalScores = gameState.scores;
        
        // Determine winner
        let winner = null;
        if (finalScores.blue > finalScores.red) {
            winner = 'blue';
        } else if (finalScores.red > finalScores.blue) {
            winner = 'red';
        } else {
            winner = 'tie';
        }
        
        const matchSummary = {
            winner: winner,
            finalScores: finalScores,
            totalRounds: lobby.rounds.length,
            rounds: lobby.rounds.map(round => ({
                roundNumber: round.getRoundNumber(),
                question: round.getQuestion(),
                blueAnswer: round.getTeamAnswer('blue'),
                redAnswer: round.getTeamAnswer('red'),
                winner: round.getWinner(),
                bluePoints: round.getTeamPoints('blue'),
                redPoints: round.getTeamPoints('red')
            }))
        };
        
        // Broadcast match summary event
        if (req.app.locals.gameEvents) {
            req.app.locals.gameEvents.broadcastMatchSummary(lobby.getCode(), matchSummary);
        }
        
        res.json({
            success: true,
            matchSummary: matchSummary
        });
    } catch (error) {
        console.error('Error showing match summary:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
