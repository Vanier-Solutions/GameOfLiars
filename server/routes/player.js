import express from "express";
import { User } from "../models/User.js";
import { activeLobbies } from "./lobby.js";
import { optionalAuth } from "../middleware/auth.js";

const router = express.Router();

// PUT /api/player/team
router.put('/team', optionalAuth, (req, res) => {
    try {
        const { code, playerName, playerId, team, role } = req.body;
        
        const lobby = activeLobbies.get(code.toUpperCase());
        if (!lobby) {
            return res.status(404).json({ error: 'Lobby not found' });
        }
        
        if (lobby.gamePhase !== 'pregame') {
            return res.status(400).json({ error: 'Cannot change teams during game' });
        }
        
        // Find player by session first, then by UUID, then by name as fallback
        let player;
        if (req.user && req.user.id) {
            player = lobby.getPlayerById(req.user.id);
        } else if (playerId) {
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

export default router;