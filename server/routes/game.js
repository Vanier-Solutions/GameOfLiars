import express from 'express';
import { GameService } from '../services/GameService.js';
import { activeLobbies } from './lobby.js';

const router = express.Router();

// POST /api/game/:code/start
router.post("/:code/start", async (req, res) => {
    try {
        const { code } = req.params;
        const { playerId } = req.body;
        
        const lobby = activeLobbies.get(code);
        if (!lobby) {
            return res.status(404).json({ success: false, error: 'Lobby not found' });
        }
        
        // Verify host
        const player = lobby.getPlayerById(playerId) || lobby.getPlayerByName(req.body.playerName);
        if (!player || player.getName() !== lobby.getHost().getName()) {
            return res.status(403).json({ success: false, error: 'Only the host can start the game' });
        }
        
        const round = await GameService.startGame(lobby);
        
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
router.post("/:code/round/start", async (req, res) => {
    try {
        const { code } = req.params;
        const { playerId } = req.body;
        
        const lobby = activeLobbies.get(code);
        if (!lobby) {
            return res.status(404).json({ success: false, error: 'Lobby not found' });
        }
        
        // Verify host
        const player = lobby.getPlayerById(playerId) || lobby.getPlayerByName(req.body.playerName);
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
router.post("/:code/round/answer", (req, res) => {
    try {
        const { code } = req.params;
        const { playerName, answer, isSteal } = req.body;
        
        const lobby = activeLobbies.get(code);
        if (!lobby) {
            return res.status(404).json({ success: false, error: 'Lobby not found' });
        }
        
        // Find player and verify they are a captain
        const player = lobby.getPlayerByName(playerName);
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
router.post("/:code/round/next", async (req, res) => {
    try {
        const { code } = req.params;
        const { playerId } = req.body;
        
        const lobby = activeLobbies.get(code);
        if (!lobby) {
            return res.status(404).json({ success: false, error: 'Lobby not found' });
        }
        
        // Verify host
        const player = lobby.getPlayerById(playerId) || lobby.getPlayerByName(req.body.playerName);
        if (!player || player.getName() !== lobby.getHost().getName()) {
            return res.status(403).json({ success: false, error: 'Only the host can start next round' });
        }
        
        const result = await GameService.nextRound(lobby);
        
        if (result.gameEnded) {
            // Broadcast game ended event
            if (req.app.locals.gameEvents) {
                req.app.locals.gameEvents.broadcastGameEnded(lobby.getCode(), result);
            }
            
            res.json({
                success: true,
                gameEnded: true,
                winner: result.winner,
                finalScores: result.finalScores
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
router.get("/:code/state", (req, res) => {
    try {
        const { code } = req.params;
        const lobby = activeLobbies.get(code);
        
        if (!lobby) {
            return res.status(404).json({ success: false, error: 'Lobby not found' });
        }
        
        const gameState = lobby.getGameState();
        const currentRound = gameState.currentRound;
        
        let roundData = null;
        if (currentRound) {
            roundData = {
                roundNumber: currentRound.getRoundNumber(),
                question: currentRound.getQuestion(),
                roundStatus: currentRound.getRoundStatus(),
                roundStartTime: currentRound.roundStartTime,
                blueAnswer: currentRound.getTeamAnswer('blue'),
                redAnswer: currentRound.getTeamAnswer('red'),
                winner: currentRound.getWinner()
            };
        }
        
        res.json({
            success: true,
            gamePhase: lobby.gamePhase,
            currentRoundNumber: gameState.currentRoundNumber,
            scores: gameState.scores,
            settings: lobby.getSettings(),
            roundData: roundData
        });
    } catch (error) {
        console.error('Error fetching game state:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/game/:code/return-to-lobby
router.post("/:code/return-to-lobby", (req, res) => {
    try {
        const { code } = req.params;
        const { playerId } = req.body;
        
        const lobby = activeLobbies.get(code);
        if (!lobby) {
            return res.status(404).json({ success: false, error: 'Lobby not found' });
        }
        
        // Verify host
        const player = lobby.getPlayerById(playerId) || lobby.getPlayerByName(req.body.playerName);
        if (!player || player.getName() !== lobby.getHost().getName()) {
            return res.status(403).json({ success: false, error: 'Only the host can return to lobby' });
        }
        
        // Broadcast return to lobby event
        if (req.app.locals.gameEvents) {
            req.app.locals.gameEvents.broadcastReturnToLobby(lobby.getCode());
        }
        
        res.json({
            success: true,
            message: 'Returning to lobby'
        });
    } catch (error) {
        console.error('Error returning to lobby:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/game/:code/round/timeout
router.post("/:code/round/timeout", (req, res) => {
    try {
        const { code } = req.params;
        const { playerName } = req.body;
        
        const lobby = activeLobbies.get(code);
        if (!lobby) {
            return res.status(404).json({ success: false, error: 'Lobby not found' });
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

export default router;
