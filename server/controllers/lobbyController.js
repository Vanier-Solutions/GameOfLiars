import * as lobbyService from '../services/lobbyService.js';

const getBearerToken = (req) => {
    const auth = req.headers.authorization || '';
    const [, token] = auth.split(' ');
    return token || null;
};

const MAX_NAME_LEN = 16;

// Create a new lobby
export const createLobby = async (req, res) => {
    try {
        const { playerName } = req.body;

        if (!playerName || !playerName.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Player name is required'
            });
        }

        if (playerName.trim().length > MAX_NAME_LEN) {
            return res.status(400).json({
                success: false,
                message: 'Player name must be less than 16 characters'
            });
        }

        const result = await lobbyService.createNewLobby(playerName);

        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

export const joinLobby = async (req, res) => {
    try {
        const { playerName, code } = req.body;

        if (!playerName || !playerName.trim() || !code) {
            return res.status(400).json({
                success: false,
                message: 'Player name and lobby code are required'
            });
        }

        if (playerName.trim().length > MAX_NAME_LEN) {
            return res.status(400).json({
                success: false,
                message: 'Player name must be less than 16 characters'
            });
        }

        const result = await lobbyService.joinLobby(playerName, code);

        if(!result.success) {
            // Lobby not found → 404; otherwise 400 for other errors
            const status = result.message === 'Lobby not found' ? 404 : 400;
            return res.status(status).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Error joining lobby:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}
 
export const getLobby = async (req, res) => {
    try {
        const { lobbyCode } = req.params;
        // Require valid token and ensure it matches this lobby
        const token = getBearerToken(req);
        if (!token) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const payload = lobbyService.verifyToken(token);
        if (!payload) {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }
        if (payload.lobby !== lobbyCode) {
            return res.status(403).json({ success: false, message: 'Forbidden' });
        }

        const lobby = await lobbyService.getLobbyByCode(lobbyCode);
        if (!lobby) {
            return res.status(404).json({ success: false, message: 'Lobby not found' });
        }

        res.json({ success: true, data: lobbyService.getLobbySnapshot(lobby) })
	} catch (error)  {
		console.error('Error getting lobby:', error);
		res.status(500).json({
			success: false,
			message: 'Internal server error'
		});
	}
};

// Leave lobby (uses Authorization bearer token)
export const leaveLobby = async (req, res) => {
    try {
        const token = getBearerToken(req);
        if (!token) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const payload = lobbyService.verifyToken(token);
        if (!payload) {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }

        const result = await lobbyService.leaveLobby(payload.sub, payload.lobby);
        if (!result.success) {
            return res.status(400).json(result);
        }
        res.json(result);
    } catch (error) {
        console.error('Error leaving lobby:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const startGame = async (req, res) => {
    try {
        const token = getBearerToken(req);
        if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const payload = lobbyService.verifyToken(token);
        if (!payload) return res.status(401).json({ success: false, message: 'Invalid token' });

        const result = lobbyService.startGame(payload.sub, payload.lobby);
        const status = result.success ? 200 : (result.message?.includes('not found') ? 404 : 400);
        return res.status(status).json(result);
    } catch (error) {
        console.error('Error starting game:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const endLobby = async (req, res) => {
    try {
        const token = getBearerToken(req);
        if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const payload = lobbyService.verifyToken(token);
        if (!payload) return res.status(401).json({ success: false, message: 'Invalid token' });

        const result = lobbyService.endLobby(payload.sub, payload.lobby);
        const status = result.success ? 200 : (result.message?.includes('not found') ? 404 : 400);
        return res.status(status).json(result);
    } catch (error) {
        console.error('Error ending lobby:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};