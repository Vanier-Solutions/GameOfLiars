import * as lobbyService from '../services/lobbyService.js';

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

        const lobby = await lobbyService.createNewLobby(playerName);

        res.status(201).json({
            success: true,
            data: result
        });
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

        if(!lobby.success) {
            return res.status(404).json(result);
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
		const lobby = await lobbyService.getLobbyByCode(lobbyCode);
		if (!lobby) {
			return res.status(404).json({
				success: false,
				message: 'Lobby not found'
			});
		}

		res.json({
			success: true,
			data: lobbyService.getLobbySnapshot(lobby)
		})
	} catch (error)  {
		console.error('Error getting lobby:', error);
		res.status(500).json({
			success: false,
			message: 'Internal server error'
		});
	}
};