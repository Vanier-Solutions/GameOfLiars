import { emitToLobby, emitToPlayer } from './socketHandlers.js';

/**
 * Socket Service - Provides utility functions for emitting socket events
 * This service is used by other parts of the application to emit events
 * 
 * USAGE: Just call these functions from anywhere in your code!
 * Example: emitPlayerJoined('ABC123', playerData, lobbyData);
 */

// ===== LOBBY EVENTS =====

/**
 * Emit a player joined event to all players in a lobby
 * @param {string} lobbyCode - The lobby code
 * @param {Object} player - Player information
 * @param {Object} lobby - Updated lobby state
 */
export const emitPlayerJoined = (lobbyCode, player, lobby) => {
    emitToLobby(lobbyCode, 'player-joined', {
        player,
        lobby,
        timestamp: new Date().toISOString()
    });
};

/**
 * Emit a player left event to all players in a lobby
 * @param {string} lobbyCode - The lobby code
 * @param {Object} player - Player information
 * @param {Object} lobby - Updated lobby state
 */
export const emitPlayerLeft = (lobbyCode, player, lobby) => {
    emitToLobby(lobbyCode, 'player-left', {
        player,
        lobby,
        timestamp: new Date().toISOString()
    });
};

/**
 * Emit a player disconnected event to all players in a lobby
 * @param {string} lobbyCode - The lobby code
 * @param {string} playerId - Player ID
 */
export const emitPlayerDisconnected = (lobbyCode, playerId) => {
    emitToLobby(lobbyCode, 'player-disconnected', {
        playerId,
        lobbyCode,
        timestamp: new Date().toISOString()
    });
};

/**
 * Emit a player team changed event to all players in a lobby
 * @param {string} lobbyCode - The lobby code
 * @param {Object} player - Player information
 * @param {Object} lobby - Updated lobby state
 */
export const emitPlayerTeamChanged = (lobbyCode, player, lobby) => {
    emitToLobby(lobbyCode, 'player-team-changed', {
        player,
        lobby,
        timestamp: new Date().toISOString()
    });
};

/**
 * Emit a player kicked event to all players in a lobby
 * @param {string} lobbyCode - The lobby code
 * @param {Object} player - Kicked player information
 * @param {string} kickedBy - ID of the player who kicked
 * @param {Object} lobby - Updated lobby state
 */
export const emitPlayerKicked = (lobbyCode, player, kickedBy, lobby) => {
    emitToLobby(lobbyCode, 'player-kicked', {
        player,
        kickedBy,
        lobby,
        timestamp: new Date().toISOString()
    });
};

/**
 * Emit a lobby ended event to all players in a lobby
 * @param {string} lobbyCode - The lobby code
 * @param {string} reason - Reason for lobby ending
 */
export const emitLobbyEnded = (lobbyCode, reason) => {
    emitToLobby(lobbyCode, 'lobby-ended', {
        reason,
        timestamp: new Date().toISOString()
    });
};

/**
 * Emit a lobby updated event to all players in a lobby
 * @param {string} lobbyCode - The lobby code
 * @param {Object} lobby - Updated lobby state
 * @param {string} updateType - Type of update (e.g., 'settings', 'game-phase')
 */
export const emitLobbyUpdated = (lobbyCode, lobby, updateType) => {
    emitToLobby(lobbyCode, 'lobby-updated', {
        lobby,
        updateType,
        timestamp: new Date().toISOString()
    });
};

/**
 * Emit a chat message to all players in a lobby
 * @param {string} lobbyCode - The lobby code
 * @param {string} message - Chat message
 * @param {string} playerId - Player ID who sent the message
 * @param {string} playerName - Player name who sent the message
 */
export const emitChatMessage = (lobbyCode, message, playerId, playerName) => {
    emitToLobby(lobbyCode, 'chat-message', {
        message,
        playerId,
        playerName,
        timestamp: new Date().toISOString()
    });
};

// ===== UTILITY FUNCTIONS =====

/**
 * Emit a custom event to a specific player
 * @param {string} playerId - Player ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export const emitToSpecificPlayer = (playerId, event, data) => {
    emitToPlayer(playerId, event, data);
};

/**
 * Emit a custom event to all players in a lobby
 * @param {string} lobbyCode - The lobby code
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export const emitCustomEventToLobby = (lobbyCode, event, data) => {
    emitToLobby(lobbyCode, event, data);
};

// ===== HOW TO ADD NEW EVENTS =====
/*
To add a new event, just add a new function here following this pattern:

export const emitNewEventName = (lobbyCode, data) => {
    emitToLobby(lobbyCode, 'new-event-name', {
        ...data,
        timestamp: new Date().toISOString()
    });
};

Then in your game logic, just call:
emitNewEventName('ABC123', { someData: 'value' });

The frontend will automatically receive the 'new-event-name' event!
*/ 