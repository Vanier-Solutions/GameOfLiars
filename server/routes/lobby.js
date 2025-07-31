import express from "express";
import { Lobby } from "../models/Lobby.js";
import { User } from "../models/User.js";

const router = express.Router();

// In-memory storage for active lobbies
export const activeLobbies = new Map();

// Generate unique lobby code
function generateLobbyCode() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let code;
    do {
        code = "";
        for (let i = 0; i < 4; i++) {
            code += letters[Math.floor(Math.random() * letters.length)];
        }
    } while (activeLobbies.has(code));
    return code;
}


// POST /api/lobby/create
router.post("/create", (req, res) => {
    try {
        const { playerName } = req.body;
        if (!playerName || playerName.trim().length === 0) {
            return res.status(400).json({ error: 'Player name is required' });
        }
        
        if (playerName.length > 20) {
            return res.status(400).json({ error: 'Player name too long (max 20 characters)' });
        }

        const code = generateLobbyCode();
        const host = new User(playerName, true);
        const lobby = new Lobby(code, host);

        activeLobbies.set(code, lobby);

        res.status(201).json({
            success: true,
            code: lobby.getCode(),
            settings: lobby.getSettings(),
            playerId: host.getId()
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            error: 'Failed to create lobby'
        });
    }
});

// POST /api/lobby/join
router.post("/join", (req, res) => {
    try {
        const { code, lobbyCode, playerName } = req.body;
        const actualCode = code || lobbyCode; // Accept both parameter names

        if (!actualCode || !playerName || actualCode.trim().length !== 4 || playerName.trim().length === 0) {
            return res.status(400).json({ error: 'Code and player name are required' });
        }
        if (playerName.trim().length > 20) {
            return res.status(400).json({ error: 'Player name too long (max 20 characters)' });
        }

        const lobby = activeLobbies.get(actualCode.toUpperCase());
        if (!lobby) {
            return res.status(404).json({ error: 'Lobby not found' });
        }
        if (lobby.gamePhase !== 'pregame') {
            return res.status(400).json({ error: 'Game already in progress' });
        }
        if (lobby.getPlayerByName(playerName)) {
            return res.status(404).json({ error: 'Player name already taken' });
        }

        let newPlayer;
        try {
            newPlayer = new User(playerName);
            lobby.addPlayer(newPlayer);
        } catch (error) {
            return res.status(400).json({ error: 'Failed to join lobby' });
        }

        // Broadcast team update
        const gameEvents = req.app.locals.gameEvents;
        if (gameEvents) {
            gameEvents.broadcastTeamUpdate(actualCode.toUpperCase());
        }

        res.json({
            success: true,
            code: actualCode.toUpperCase(),
            playerId: newPlayer.getId()
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            error: 'Failed to join lobby'
        });
    }
});

// GET /api/lobby/:code
router.get('/:code', (req, res) => {
    try {
        const { code } = req.params;
        const lobby = activeLobbies.get(code.toUpperCase());
        
        if (!lobby) {
            return res.status(404).json({ error: 'Lobby not found' });
        }
        
        res.json({
            success: true,
            lobby: {
                code: lobby.getCode(),
                host: lobby.getHost().getName(),
                settings: lobby.getSettings(),
                gamePhase: lobby.gamePhase,
                players: {
                    spectators: lobby.getSpectators().map(p => p.getName()),
                    blueTeam: lobby.getBlueTeam().map(p => p.getName()),
                    redTeam: lobby.getRedTeam().map(p => p.getName())
                },
                captains: {
                    blue: lobby.getBlueCaptain()?.getName() || null,
                    red: lobby.getRedCaptain()?.getName() || null
                }
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get lobby info' });
    }
});

// GET /api/lobby/:code/player/:playerId
router.get('/:code/player/:playerId', (req, res) => {
    try {
        const { code, playerId } = req.params;
        const lobby = activeLobbies.get(code.toUpperCase());
        
        if (!lobby) {
            return res.status(404).json({ success: false, error: 'Lobby not found' });
        }
        
        const player = lobby.getPlayerById(playerId);
        if (!player) {
            return res.status(404).json({ success: false, error: 'Player not found' });
        }
        
        res.json({
            success: true,
            player: {
                name: player.getName(),
                team: player.getTeam(),
                role: player.getRole(),
                isHost: player.getName() === lobby.getHost().getName()
            }
        });
    } catch (error) {
        console.error('Error fetching player info:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch player info' });
    }
});


router.put('/:code/settings', (req, res) => {
    try {
        const { code } = req.params;
        const { rounds, roundLimit, maxScore, playerName, playerId } = req.body;
        
        const lobby = activeLobbies.get(code.toUpperCase());
        if (!lobby) {
            return res.status(404).json({ error: 'Lobby not found' });
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
        
        // Verify the player is the host
        if (lobby.getHost().getName() !== player.getName()) {
            return res.status(403).json({ error: 'Only the host can change settings' });
        }
        
        if (lobby.gamePhase !== 'pregame') {
            return res.status(400).json({ error: 'Cannot change settings during game' });
        }
        
        // Update settings
        if (rounds !== undefined) {
            if (rounds < 1 || rounds > 20) {
                return res.status(400).json({ error: 'Rounds must be between 1 and 20' });
            }
            lobby.setNumberOfRounds(rounds);
        }
        
        if (roundLimit !== undefined) {
            if (roundLimit < 15 || roundLimit > 300) {
                return res.status(400).json({ error: 'Round limit must be between 15 and 300 seconds' });
            }
            lobby.setRoundLimit(roundLimit);
        }
        
        if (maxScore !== undefined) {
            if (maxScore < 1 || maxScore > 100) {
                return res.status(400).json({ error: 'Max score must be between 1 and 100' });
            }
            lobby.setMaxScore(maxScore);
        }
        
        // Broadcast settings update
        const gameEvents = req.app.locals.gameEvents;
        if (gameEvents) {
            gameEvents.broadcastSettingsUpdate(code.toUpperCase(), lobby.getSettings());
        }

        res.json({
            success: true,
            settings: lobby.getSettings()
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});


export default router;