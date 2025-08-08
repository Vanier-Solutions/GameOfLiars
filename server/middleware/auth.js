import { activeLobbies } from '../routes/lobby.js';

// Middleware check if user authenticated
export const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    req.user = req.session.user;
    next();
};

// Middleware to optionally populate user if authenticated
export const optionalAuth = (req, res, next) => {
    if (req.session.user) {
        req.user = req.session.user;
        return next();
    }

    // Fallback: derive identity from headers when cookies are blocked
    const headerPlayerId = req.get('x-player-id');
    const headerPlayerName = req.get('x-player-name');
    const headerLobbyCode = (req.get('x-lobby-code') || req.params.code || req.query.code || '').toUpperCase();

    if (headerLobbyCode && activeLobbies.has(headerLobbyCode)) {
        const lobby = activeLobbies.get(headerLobbyCode);
        let player = null;
        if (headerPlayerId) {
            player = lobby.getPlayerById(headerPlayerId);
        }
        if (!player && headerPlayerName) {
            player = lobby.getPlayerByName(headerPlayerName);
        }
        if (player) {
            req.user = { id: player.getId(), name: player.getName(), lobbyCode: headerLobbyCode };
        }
    }

    next();
};
