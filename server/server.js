import express from "express";
import cors from "cors";
import { createServer } from "http";
import dotenv from "dotenv";
import connectDB from "./db/connection.js";
import lobbyRoutes from "./routes/lobby.js";
import playerRoutes from "./routes/player.js";
import gameRoutes from "./routes/game.js";
import { setupSocket } from "./socket/socketManager.js";
import { setupGameEvents } from "./socket/gameEvents.js";
import { activeLobbies } from "./routes/lobby.js";

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 5051;
const app = express();
const server = createServer(app);

await connectDB();

app.use(cors()); // TODO: Need to add specific origin
app.use(express.json());

// API Routes
app.use("/api/lobby", lobbyRoutes);
app.use("/api/player", playerRoutes);
app.use("/api/game", gameRoutes);

// Setup Socket.io
const io = setupSocket(server);
const gameEvents = setupGameEvents(io, activeLobbies);

// Make gameEvents available to routes
app.locals.gameEvents = gameEvents;

server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});