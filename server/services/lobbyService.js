import { Lobby } from '../models/Lobby.js';
import { Player } from '../models/Player.js';
import { generateGameCode } from '../utils/generateCode.js';
import * as gameService from './gameService.js';
import jwt from 'jsonwebtoken';
import { 
    emitPlayerJoined, 
    emitPlayerLeft, 
    emitPlayerTeamChanged, 
    emitPlayerKicked, 
    emitLobbyEnded,
    emitSettingsUpdated,
    emitYouWereKicked,
    emitGameStarted,
    emitGameEnded
} from '../socket/socketService.js';

export const lobbyStore = new Map();
const playerToLobby = new Map(); // playerId -> lobbyCode

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '1h';

// Generate JWT token for a player
const generateToken = (player, lobbyCode) => {
    return jwt.sign(
        {
            sub: player.id,
            name: player.getName(),
            lobby: lobbyCode,
            isHost: player.getIsHost(),
            iat: Math.floor(Date.now() / 1000),
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN}
    );
};

// Verify JWT Token
export const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET)
    } catch (error) {
        console.log(error);
        return null;
    }
}

// Create a new lobby
export const createNewLobby = (playerName) => {
    let code;
    do {
        code = generateGameCode();
    } while (lobbyStore.has(code));

    const host = new Player(playerName.trim(), true);
    host.setTeam("blue");
    host.id = generatePlayerId();

    const lobby = new Lobby(code, host);
    lobbyStore.set(code, lobby);
    playerToLobby.set(host.id, code);

    const token = generateToken(host, code);

    return {
        success: true,
        token,
        lobby: getLobbySnapshot(lobby),
        player: {
            id: host.id,
            name: host.getName(),
            isHost: true
        }
    };
}

// Join an existing lobby
export const joinLobby = (playerName, code) => {
    const lobbyCode = code.trim().toUpperCase();
    const lobby = lobbyStore.get(lobbyCode);
    if (!lobby) {
        return { success: false, message: 'Lobby not found' };
    }
    if (lobby.getTotalPlayers() >= lobby.getMaxPlayers()) {
        return { success: false, message: 'Lobby is full' };
    }
    if (lobby.getGamePhase() !== 'pregame') {
        return { success: false, message: 'Game has already started' };
    }

    // Create player
    const player = new Player(playerName.trim(), false);
    player.id = generatePlayerId();

    addPlayerToSmallerTeam(player, lobby);
    playerToLobby.set(player.id, lobbyCode);

    const token = generateToken(player, lobbyCode);

    // Emit socket event for player joining
    emitPlayerJoined(lobbyCode, {
        id: player.id,
        name: player.getName(),
        team: player.getTeam(),
        isHost: player.getIsHost()
    }, getLobbySnapshot(lobby));

    return {
        success: true,
        token,
        lobby: getLobbySnapshot(lobby),
        player: {
            id: player.id,
            name: player.getName(),
            isHost: false
        }
    };  
};



// Update lobby settings (host only)
export const updateSettings = (playerId, code, settings) => {
    const lobby = lobbyStore.get(code);
    if (!lobby) {
        return { success: false, message: 'Lobby not found' };
    }

    // Check if player is host
    if (lobby.getHost().id !== playerId) {
        return { success: false, message: 'Only host can update settings' };
    }

    // Validate settings
    if (settings.rounds && (settings.rounds < 1 || settings.rounds > 20)) {
        return { success: false, message: 'Rounds must be between 1 and 20' };
    }
    
    if (settings.roundLimit && (settings.roundLimit < 15 || settings.roundLimit > 120)) {
        return { success: false, message: 'Round limit must be between 15 and 120 seconds' };
    }

    // Update settings
    Object.assign(lobby.settings, settings);

    emitSettingsUpdated(code, getLobbySnapshot(lobby));

    return { success: true, lobby: getLobbySnapshot(lobby) };
};

// Kick player (host only)
export const kickPlayer = (actorId, code, targetId) => {
    const lobby = lobbyStore.get(code);
    if (!lobby) {
        return { success: false, message: 'Lobby not found' };
    }

    if (lobby.getHost().id !== actorId) {
        return { success: false, message: 'Only host can kick players' };
    }

    const targetPlayer = lobby.getAllPlayers().find(p => p.id === targetId);
    if (!targetPlayer) {
        return { success: false, message: 'Target Player not found' };
    }
    if (targetPlayer.getIsHost()) {
        return { success: false, message: 'Host cannot be kicked' };
    }

    // Store player info before removal for socket event
    const playerInfo = {
        id: targetPlayer.id,
        name: targetPlayer.getName(),
        team: targetPlayer.getTeam(),
        isHost: targetPlayer.getIsHost()
    };

    // Send direct message to kicked player BEFORE removing them
    emitYouWereKicked(targetPlayer.id, 'You were kicked from the lobby', actorId);

    lobby.removePlayer(targetPlayer);
    playerToLobby.delete(targetPlayer.id);

    emitPlayerKicked(code, playerInfo, actorId, getLobbySnapshot(lobby));

    return { success: true, lobby: getLobbySnapshot(lobby) };
}

// Leave lobby
export const leaveLobby = (playerId, code) => {
    const lobby = lobbyStore.get(code);
    if (!lobby) {
        return { success: false, message: 'Lobby not found' };
    }

    // Find player
    const player = lobby.getAllPlayers().find(p => p.id === playerId);
    
    if (!player) {
        return { success: false, message: 'Player not found' };
    }

    // Store player info before removal for socket event
    const playerInfo = {
        id: player.id,
        name: player.getName(),
        team: player.getTeam(),
        isHost: player.getIsHost()
    };

    // Remove player
    lobby.removePlayer(player);
    playerToLobby.delete(playerId);

    // TODO: If host leaves, end lobby
    if (player.getIsHost()) {
        // Emit lobby ended event
        emitLobbyEnded(code, 'Host left the lobby');
        
        // Clean up any active round timers
        gameService.cleanupLobbyTimers(code);
        
        lobbyStore.delete(code);
        return { success: true, lobbyEnded: true };
    }

    // Emit socket event for player leaving
    emitPlayerLeft(code, playerInfo, getLobbySnapshot(lobby));

    return { success: true, lobby: getLobbySnapshot(lobby) };
};



// End lobby (host only)
export const endLobby = (playerId, code) => {
    const lobby = lobbyStore.get(code);
    if (!lobby) {
         return { success: false, message: 'Lobby not found' };
    }

    if (lobby.getHost().id !== playerId) {
        return { success: false, message: 'Only host can end the lobby' };
    }

    emitLobbyEnded(code, 'Host ended the lobby');

    // Clean up any active round timers
    gameService.cleanupLobbyTimers(code);

    // Remove player->lobby mappings
    for (const p of lobby.getAllPlayers()) {
        playerToLobby.delete(p.id);
    }
    lobbyStore.delete(code);

    return { success: true, lobbyEnded: true };
};

// Team select
export const teamSelect = (playerId, code, team, isCaptain) => {
    const lobby = lobbyStore.get(code);
    if (!lobby) {
        return { success: false, message: 'Lobby not found' };
    }

    const player = lobby.getAllPlayers().find(p => p.id === playerId);
    if (!player) {
        return { success: false, message: 'Player not found' };
    }

    try {
        if (team === 'blue' && lobby.getBlueTeamSize() >= lobby.getMaxTeamSize()) {
            return { success: false, message: 'Blue team is full' };
        }
        if (team === 'red' && lobby.getRedTeamSize() >= lobby.getMaxTeamSize()) {
            return { success: false, message: 'Red team is full' };
        }

        lobby.setPlayer(player, team, isCaptain);
        
        // Emit socket event for team change
        emitPlayerTeamChanged(code, {
            id: player.id,
            name: player.getName(),
            team: player.getTeam(),
            isCaptain: player.getIsCaptain()
        }, getLobbySnapshot(lobby));
        
        return { success: true, lobby: getLobbySnapshot(lobby) };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Start game
export const startGame = async (playerId, code) => {
	const lobby = lobbyStore.get(code);
	if (!lobby) {
		return { success: false, message: 'Lobby not found' };
	}

	// Only host can start the game
	if (lobby.getHost().id !== playerId) {
		return { success: false, message: 'Only host can start the game' };
	}

	// Must have captains selected
	if (!lobby.getBlueCaptain() || !lobby.getRedCaptain()) {
		return { success: false, message: 'Both teams must have a captain' };
	}

	// Prevent duplicate starts
	if (lobby.getGamePhase() !== 'pregame') {
		return { success: false, message: 'Game already started' };
	}

	try {
		return await gameService.startGame(lobby);
	} catch (error) {
		console.error('Error starting game in lobbyService:', error);
		return { success: false, message: 'Failed to start game' };
	}
};

// Add player to team with less players
const addPlayerToSmallerTeam = (player, lobby) => {
    if (lobby.getBlueTeamSize() <= lobby.getRedTeamSize()) {
        lobby.setPlayer(player, "blue");
    } else {
        lobby.setPlayer(player, "red");
    }
}

// Get Lobby snapshot
export const getLobbySnapshot = (lobby) => {
    const playerToDTO = (player) => ({
        id: player.id,
        name: player.getName(),
        team: player.getTeam(),
        isCaptain: player.getIsCaptain(),
        isConnected: player.getIsConnected(),
        isHost: player.getIsHost()
    });

    return {
        code: lobby.getCode(),
        settings: lobby.getSettings(),
        host: {
            id: lobby.getHost().id,
            name: lobby.getHost().getName()
        },
        blueTeam: lobby.getBlueTeam().map(playerToDTO),
        redTeam: lobby.getRedTeam().map(playerToDTO),
        captains: {
            blue: lobby.getBlueCaptain()?.id || null,
            red: lobby.getRedCaptain()?.id || null
        },
        counts: {
            blue: lobby.getBlueTeam().length,
            red: lobby.getRedTeam().length
        },
        maxTeamSize: lobby.getMaxTeamSize(),
        maxPlayers: lobby.getMaxPlayers(),
        gamePhase: lobby.getGamePhase()
    };
}

// Get lobby by code
export const getLobbyByCode = (code) => {
    return lobbyStore.get(code) || null;
};

// Get player by ID
export const getPlayerById = (playerId) => {
    const lobbyCode = playerToLobby.get(playerId);
    if (!lobbyCode) return null;

    const lobby = lobbyStore.get(lobbyCode);
    if (!lobby) return null;

    const allPlayers = [...lobby.getBlueTeam(), ...lobby.getRedTeam()];
    return allPlayers.find(p => p.id === playerId) || null;
}

// Generate unique player ID
const generatePlayerId = () => {
    return `player_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

