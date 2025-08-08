import express from "express";
import { Lobby } from "../models/Lobby.js";
import { User } from "../models/User.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";

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
        
        // Clean up any existing lobby with this code (shouldn't happen, but safety)
        if (activeLobbies.has(code)) {
            activeLobbies.delete(code);
        }
        
        const host = new User(playerName, true);
        const lobby = new Lobby(code, host);

        activeLobbies.set(code, lobby);

        // Store user session
        req.session.user = {
            id: host.getId(),
            name: playerName,
            lobbyCode: code
        };
        
        // Explicitly save the session
        req.session.save(() => {});
        
        const response = {
            success: true,
            code: lobby.getCode(),
            settings: lobby.getSettings(),
            playerId: host.getId()
        };
        
        res.status(201).json(response);

    } catch (error) {
        console.error('Error creating lobby:', error);
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
        
        const existingPlayer = lobby.getPlayerByName(playerName);
        if (existingPlayer) {
            return res.status(404).json({ error: 'Player name already taken' });
        }

        let newPlayer;
        try {
            newPlayer = new User(playerName);
            lobby.addPlayer(newPlayer);
        } catch (error) {
            return res.status(400).json({ error: 'Lobby Full/Couldnt add player' });
        }

        // Store user session
        req.session.user = {
            id: newPlayer.getId(),
            name: playerName,
            lobbyCode: actualCode.toUpperCase()
        };
        
        // Explicitly save the session
        req.session.save(() => {});

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
        console.error('Error joining lobby:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to join lobby'
        });
    }
});

// POST /api/lobby/kick
router.post('/kick', requireAuth, (req, res) => {
    const { code, playerName } = req.body;
    const lobby = activeLobbies.get(code.toUpperCase());
    if (!lobby) {
        return res.status(404).json({ error: 'Lobby not found' });
    }
    if (lobby.getHost().getId() !== req.user.id) {
        return res.status(403).json({ error: 'Only the host can kick players' });
    }
    const player = lobby.getPlayerByName(playerName);
    if (!player) {
        return res.status(404).json({ error: 'Player not found' });
    }
    lobby.removePlayerFromTeam(player);
    
    // Broadcast kick event to all players in the lobby
    const gameEvents = req.app.locals.gameEvents;
    if (gameEvents) {
        gameEvents.broadcastPlayerKicked(code.toUpperCase(), playerName, player.getId());
    }
    
    res.json({ success: true, message: 'Player kicked successfully' });
});

// POST /api/lobby/leave
router.post('/leave', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ error: 'Could not leave lobby' });
        }
        res.clearCookie('connect.sid'); // Default session cookie name
        res.json({ success: true, message: 'Left lobby successfully' });
    });
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

// GET /api/lobby/:code
router.get('/:code', optionalAuth, (req, res) => {
    try {
        const { code } = req.params;
        const upperCode = code.toUpperCase();
        
        // Debug session info
        console.log('GET lobby - Session info:', {
            sessionID: req.sessionID,
            user: req.user,
            userAgent: req.headers['user-agent']
        });
        
        const lobby = activeLobbies.get(upperCode);
        
        if (!lobby) {
            return res.status(404).json({ error: 'Lobby not found' });
        }
        
        // More robust authentication check
        let isAuthenticated = false;
        
        // Method 1: Check if user is authenticated via session
        if (req.user) {
            const isInCorrectLobby = req.user.lobbyCode === upperCode;
            const isPlayerInLobby = lobby.hasPlayerId(req.user.id);
            console.log('GET lobby - Auth check:', {
                isInCorrectLobby,
                isPlayerInLobby,
                userLobbyCode: req.user.lobbyCode,
                requestedCode: upperCode
            });
            if (isInCorrectLobby || isPlayerInLobby) {
                isAuthenticated = true;
            }
        }
        
        // Method 2: Try header-based authentication if session failed
        if (!isAuthenticated) {
            const headerPlayerId = req.get('x-player-id');
            const headerPlayerName = req.get('x-player-name');
            
            if (headerPlayerId || headerPlayerName) {
                let player = null;
                if (headerPlayerId) {
                    player = lobby.getPlayerById(headerPlayerId);
                }
                if (!player && headerPlayerName) {
                    player = lobby.getPlayerByName(headerPlayerName);
                }
                
                if (player) {
                    console.log('GET lobby - Header auth successful:', player.getName());
                    isAuthenticated = true;
                }
            }
        }
        
        if (!isAuthenticated) {
            console.log('GET lobby - Authentication failed');
            return res.status(403).json({ 
                error: 'You need to join this lobby to view it',
                needsToJoin: true,
                lobbyCode: upperCode
            });
        }
        
        console.log('GET lobby - Authentication successful');
        
        const response = {
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
        };
        
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get lobby info' });
    }
});


router.put('/:code/settings', optionalAuth, (req, res) => {
    try {
        const { code } = req.params;
        const { rounds, roundLimit, maxScore } = req.body;
        
        const lobby = activeLobbies.get(code.toUpperCase());
        if (!lobby) {
            return res.status(404).json({ error: 'Lobby not found' });
        }
        
        // More robust player finding - try session first, then headers
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
        
        if (!player) {
            return res.status(401).json({ error: 'Authentication required' });
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

// Endpoint for the host to end their lobby
router.delete('/:code', optionalAuth, (req, res) => {
    try {
        const { code } = req.params;
        
        const lobby = activeLobbies.get(code.toUpperCase());
        if (!lobby) {
            return res.status(404).json({ success: false, error: 'Lobby not found' });
        }
        
        // More robust authentication - try multiple methods
        let player = null;
        
        // Method 1: Try session user
        if (req.user) {
            player = lobby.getPlayerById(req.user.id);
        }
        
        // Method 2: Try headers if session failed
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
        
        if (!player) {
            return res.status(401).json({ success: false, error: 'Unauthorized - Player not found in lobby' });
        }
        
        // Verify the player is the host
        if (lobby.getHost().getId() !== player.getId()) {
            return res.status(403).json({ success: false, error: 'Only the host can end the lobby.' });
        }
        
        // Mark lobby as intentionally ended to prevent disconnect timeout
        lobby.markAsIntentionallyEnded();
        
        // Use gameEvents to notify clients and close sockets
        if (req.app.locals.gameEvents) {
            req.app.locals.gameEvents.broadcastLobbyClosed(code, 'The host has ended the lobby.');
        }
        
        activeLobbies.delete(code.toUpperCase());
        res.json({ success: true, message: 'Lobby has been successfully ended.' });
    } catch (error) {
        res.status(500).json({ success: false, error: 'Failed to end lobby' });
    }
});

// Debug route to clean up all lobbies (for testing)
router.post('/debug/cleanup', (req, res) => {
    for (const [code, lobby] of activeLobbies.entries()) {
        // Lobby state logging removed
    }
    
    activeLobbies.clear();
    
    res.json({ success: true, message: 'All lobbies cleared' });
});

export default router;