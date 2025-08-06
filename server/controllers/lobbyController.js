import * as lobbyService from '../services/lobbyService.js';

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

        if (playerName.trim().length > 10) {
            return res.status(400).json({
                success: false,
                message: 'Player name must be less than 10 characters'
            });
        }

        const lobby = await lobbyService.createNewLobby(playerName);

        res.status(201).json({
            success: true,
            data: lobbyService,
            message: 'Lobby created successfully'
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
        const { playerName, gameCode } = req.body;

        if (!playerName || !playerName.trim() || !gameCode) {
            return res.status(400).json({
                success: false,
                message: 'Player name and lobby code are required'
            });
        }

        const result = await lobbyService.joinLobby(playerName, gameCode); // TODO: Handle lobby in progress

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

// TODO: Require AUTH
export const getLobby = async (req, res) => {
    try {
        const { lobbyCode } = req.params;
		const lobby = await lobbyService.getLobbyByCode(lobbyCode);
		if (!lobby) {
			return res.status(404).json({
				success: false,
				message: 'Game not found'
			});
		}

		res.json({
			success: true,
			data: game
		})
	} catch (error)  {
		console.error('Error getting lobby:', error);
		res.status(500).json({
			success: false,
			message: 'Internal server error'
		});
	}
};