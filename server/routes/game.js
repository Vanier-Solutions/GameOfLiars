import express from "express";
import { activeLobbies } from "./lobby.js";
import { GameService } from "../services/GameService.js";

const router = express.Router();

// POST /api/game/:code/start
router.post("/:code/start", (req, res) => {
    try {
        const { code } = req.params;
        const { playerName } = req.body;
        
        const lobby = activeLobbies.get(code.toUpperCase());
        if (!lobby) {
            return res.status(404).json({ error: 'Lobby not found' });
        }
        
        // Verify the player is the host
        if (lobby.getHost().getName() !== playerName) {
            return res.status(403).json({ error: 'Only the host can start the game' });
        }
        
        const newRound = GameService.startGame(lobby);
        
        // Broadcast game started
        const gameEvents = req.app.locals.gameEvents;
        if (gameEvents) {
            gameEvents.broadcastGameStarted(code.toUpperCase());
        }
        
        res.json({
            success: true,
            gameState: lobby.getGameState(),
            roundData: {
                roundNumber: newRound.getRoundNumber(),
                question: newRound.getQuestion(),
                roundStartTime: newRound.roundStartTime
            }
        });
        
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Failed to start game' });
    }
});

// PUT /api/game/:code/round/ready
router.put("/:code/round/ready", (req, res) => {
    try {
        const { code } = req.params;
        const { playerName, ready } = req.body;
        
        const lobby = activeLobbies.get(code.toUpperCase());
        if (!lobby) {
            return res.status(404).json({ error: 'Lobby not found' });
        }
        
        if (lobby.gamePhase !== 'playing') {
            return res.status(400).json({ error: 'Game not in progress' });
        }
        
        const player = lobby.getPlayerByName(playerName);
        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }
        
        // Verify player is a captain
        if (!player.isCaptain()) {
            return res.status(403).json({ error: 'Only captains can ready up' });
        }
        
        const currentRound = lobby.gameState.currentRound;
        if (!currentRound) {
            return res.status(400).json({ error: 'No active round' });
        }
        
        const team = player.getTeam();
        const result = GameService.setCaptainReady(lobby, team, ready);
        
        // Broadcast captain ready status
        const gameEvents = req.app.locals.gameEvents;
        if (gameEvents) {
            gameEvents.broadcastCaptainReady(code.toUpperCase(), team, ready, result.bothReady);
            
            // If round started, broadcast round start
            if (result.roundStarted && result.roundData) {
                gameEvents.broadcastRoundStarted(code.toUpperCase(), result.roundData);
            }
        }
        
        res.json({
            success: true,
            ...result
        });
        
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Failed to update ready status' });
    }
});

// POST /api/game/:code/round/answer
router.post("/:code/round/answer", (req, res) => {
    try {
        const { code } = req.params;
        const { playerName, answer, isSteal } = req.body;
        
        const lobby = activeLobbies.get(code.toUpperCase());
        if (!lobby) {
            return res.status(404).json({ error: 'Lobby not found' });
        }
        
        if (lobby.gamePhase !== 'playing') {
            return res.status(400).json({ error: 'Game not in progress' });
        }
        
        const player = lobby.getPlayerByName(playerName);
        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }
        
        // Verify player is a captain
        if (!player.isCaptain()) {
            return res.status(403).json({ error: 'Only captains can submit answers' });
        }
        
        const currentRound = lobby.gameState.currentRound;
        if (!currentRound) {
            return res.status(400).json({ error: 'No active round' });
        }
        
        const team = player.getTeam();
        const result = GameService.submitAnswer(lobby, team, answer, isSteal);
        
        // Broadcast answer submitted
        const gameEvents = req.app.locals.gameEvents;
        if (gameEvents) {
            gameEvents.broadcastAnswerSubmitted(code.toUpperCase(), team, result.bothAnswered);
            
            // If both teams answered, broadcast round ended
            if (result.bothAnswered) {
                gameEvents.broadcastRoundEnded(code.toUpperCase());
            }
        }
        
        res.json({
            success: true,
            ...result
        });
        
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Failed to submit answer' });
    }
});

// POST /api/game/:code/round/winner
router.post("/:code/round/winner", (req, res) => {
    try {
        const { code } = req.params;
        const { playerName, winner } = req.body; // winner: "blue", "red", or "tie"
        
        const lobby = activeLobbies.get(code.toUpperCase());
        if (!lobby) {
            return res.status(404).json({ error: 'Lobby not found' });
        }
        
        // Verify the player is the host
        if (lobby.getHost().getName() !== playerName) {
            return res.status(403).json({ error: 'Only the host can determine winner' });
        }
        
        if (lobby.gamePhase !== 'playing') {
            return res.status(400).json({ error: 'Game not in progress' });
        }
        
        const currentRound = lobby.gameState.currentRound;
        if (!currentRound) {
            return res.status(400).json({ error: 'No active round' });
        }
        
        const result = GameService.determineWinner(lobby, winner);
        
        // Broadcast winner determined
        const gameEvents = req.app.locals.gameEvents;
        if (gameEvents) {
            gameEvents.broadcastWinnerDetermined(code.toUpperCase(), winner, lobby.gameState.scores, result.gameEnded);
            
            // If game ended, broadcast game ended
            if (result.gameEnded) {
                gameEvents.broadcastGameEnded(code.toUpperCase(), lobby.gameState.scores);
            }
        }
        
        res.json({
            success: true,
            winner: winner,
            scores: lobby.gameState.scores,
            gamePhase: lobby.gamePhase,
            currentRound: lobby.gameState.currentRoundNumber,
            gameEnded: result.gameEnded
        });
        
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Failed to determine winner' });
    }
});

// GET /api/game/:code/state
router.get("/:code/state", (req, res) => {
    try {
        const { code } = req.params;
        
        const lobby = activeLobbies.get(code.toUpperCase());
        if (!lobby) {
            return res.status(404).json({ error: 'Lobby not found' });
        }
        
        const currentRound = lobby.gameState.currentRound;
        let roundData = null;
        
        if (currentRound) {
            roundData = {
                roundNumber: currentRound.getRoundNumber(),
                question: currentRound.getQuestion(),
                roundStatus: currentRound.getRoundStatus(),
                roundStartTime: currentRound.roundStartTime,
                blueCaptainReady: currentRound.getCaptainReady('blue'),
                redCaptainReady: currentRound.getCaptainReady('red'),
                blueAnswered: currentRound.getTeamAnswer('blue') !== null,
                redAnswered: currentRound.getTeamAnswer('red') !== null
            };
        }
        
        res.json({
            success: true,
            gamePhase: lobby.gamePhase,
            scores: lobby.gameState.scores,
            currentRoundNumber: lobby.gameState.currentRoundNumber,
            roundData: roundData,
            settings: lobby.getSettings()
        });
        
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: 'Failed to get game state' });
    }
});

export default router;
