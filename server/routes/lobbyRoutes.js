import express from "express";
import { createLobby, joinLobby, getLobby } from '../controllers/lobbyController.js';

const router = express.Router();

// POST /api/lobby/create
router.post('/create', createLobby);

// POST /api/lobby/join
router.post('/join', joinLobby);

// GET /api/lobby/:lobbyCode
router.get('/:lobbyCode', getLobby);

export default router;