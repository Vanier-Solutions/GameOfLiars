import express from "express";
import { User } from "../models/User.js";
import { activeLobbies } from "./lobby.js";

const router = express.Router();

// PUT /api/player/team
router.put('/team', (req, res) => {
    try {
        const { code, playerName, playerId, team, role } = req.body;
        
        const lobby = activeLobbies.get(code.toUpperCase());
        if (!lobby) {
            return res.status(404).json({ error: 'Lobby not found' });
        }
        
        if (lobby.gamePhase !== 'pregame') {
            return res.status(400).json({ error: 'Cannot change teams during game' });
        }
        
        // Find player by UUID first, then by name as fallback
        let player;
        if (playerId) {
            player = lobby.getPlayerById(playerId);
        } else if (playerName) {
            player = lobby.getPlayerByName(playerName);
        }
        
        if (!player) {
            return res.status(404).json({ error: 'Player not found' });
        }
        
        // Validate team assignment
        if (team === 'blue' || team === 'red') {
            if (role === 'captain') {
                // Check if captain already exists for this team
                const existingCaptain = team === 'blue' ? lobby.getBlueCaptain() : lobby.getRedCaptain();
                if (existingCaptain && existingCaptain.getName() !== player.getName()) {
                    return res.status(400).json({ error: `${team} team already has a captain` });
                }
            }
        }
        
        lobby.setPlayer(player, team, role);
        
        // Broadcast team update
        const gameEvents = req.app.locals.gameEvents;
        if (gameEvents) {
            gameEvents.broadcastTeamUpdate(code.toUpperCase());
        }
        
        res.json({
            success: true,
            player: {
                id: player.getId(),
                name: player.getName(),
                team: player.getTeam(),
                role: player.getRole()
            },
            teams: {
                blue: lobby.getBlueTeam().map(p => ({ name: p.getName(), role: p.getRole() })),
                red: lobby.getRedTeam().map(p => ({ name: p.getName(), role: p.getRole() }))
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update team assignment' });
    }
});

// POST /api/player/kick
router.post('/kick', (req, res) => {
    try {
        const { code, hostName, playerToKick } = req.body;
        
        const lobby = activeLobbies.get(code.toUpperCase());
        if (!lobby) {
            return res.status(404).json({ error: 'Lobby not found' });
        }
        
        // Verify the player making the request is the host
        if (lobby.getHost().getName() !== hostName) {
            return res.status(403).json({ error: 'Only the host can kick players' });
        }
        
        // Find the player to kick
        const playerToKickObj = lobby.getPlayerByName(playerToKick);
        if (!playerToKickObj) {
            return res.status(404).json({ error: 'Player to kick not found' });
        }
        
        // Cannot kick the host
        if (playerToKickObj.getName() === lobby.getHost().getName()) {
            return res.status(400).json({ error: 'Cannot kick the host' });
        }
        
        const kickedPlayerName = playerToKickObj.getName();
        const kickedPlayerId = playerToKickObj.getId();
        
        // Remove player from all teams and lobby
        lobby.removePlayerFromTeam(playerToKickObj);
        
        // Broadcast player kicked event to notify the kicked player
        const gameEvents = req.app.locals.gameEvents;
        if (gameEvents) {
            gameEvents.broadcastPlayerKicked(code.toUpperCase(), kickedPlayerName, kickedPlayerId);
            // Also broadcast team update to refresh the UI for remaining players
            gameEvents.broadcastTeamUpdate(code.toUpperCase());
        }
        
        res.json({
            success: true,
            message: `${kickedPlayerName} has been kicked from the lobby`
        });
    } catch (error) {
        console.error('Kick player error:', error);
        res.status(500).json({ error: 'Failed to kick player' });
    }
});

export default router;