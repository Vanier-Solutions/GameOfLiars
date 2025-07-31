import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import connectDB from './db/connection.js';
import lobbyRoutes from './routes/lobby.js';
import playerRoutes from './routes/player.js';
import gameRoutes from './routes/game.js';
import { setupSocket } from './socket/socketManager.js';
import { setupGameEvents } from './socket/gameEvents.js';
import { activeLobbies } from './routes/lobby.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5051;

// Middleware
app.use(cors({
  origin: "http://192.168.1.200:5173", // Allow all origins for development
  credentials: true
}));

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is not set');
}

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false,
    maxAge: 4 * 60 * 60 * 1000 // 4 hours
  }
}));


app.use(express.json());


// Routes
app.use('/api/lobby', lobbyRoutes);
app.use('/api/player', playerRoutes);
app.use('/api/game', gameRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    message: err.message 
  });
});

// 404 handler - catch all unmatched routes
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Route not found',
    path: req.originalUrl 
  });
});

// Connect to MongoDB
connectDB();

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is listening on port ${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  
  // Use environment variable for network access or default to localhost
  const networkUrl = process.env.NETWORK_URL || `http://localhost:${PORT}`;
  console.log(`Network access: ${networkUrl}`);
});

// Setup Socket.io
const io = setupSocket(server);

// Setup game events and make them available to routes
const gameEvents = setupGameEvents(io, activeLobbies);
app.locals.gameEvents = gameEvents;

console.log('Server setup complete');