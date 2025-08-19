import express from "express";
import { createLobby, joinLobby, getLobby, leaveLobby, startGame, endLobby, teamSelect } from '../controllers/lobbyController.js';

const router = express.Router();

// POST /api/lobby/create
router.post('/create', createLobby);

// POST /api/lobby/join
router.post('/join', joinLobby);

// GET /api/lobby/:lobbyCode
router.get('/:lobbyCode', getLobby);

// POST /api/lobby/leave
router.post('/leave', leaveLobby);

// POST /api/lobby/start
router.post('/start', startGame);

// POST /api/lobby/end
router.post('/end', endLobby);

// POST /api/lobby/teamSelect
router.post('/teamSelect', teamSelect);

export default router;