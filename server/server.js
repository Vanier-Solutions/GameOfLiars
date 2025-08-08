import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import session from 'express-session';
import http from 'http';
import os from 'os';
import connectDB from './db/connection.js';
import lobbyRoutes, { activeLobbies } from './routes/lobby.js';
import playerRoutes from './routes/player.js';
import gameRoutes from './routes/game.js';
import { setupSocket } from './socket/socketManager.js';
import { setupGameEvents } from './socket/gameEvents.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5051;

// Middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow Vercel domain for production
    if (origin === 'https://game-of-liars.vercel.app') {
      return callback(null, true);
    }
    
    // Allow localhost and IP addresses for development
    if (origin.includes('localhost') || 
        origin.includes('127.0.0.1') || 
        origin.includes('192.168.1.200') ||
        origin.includes('172.16.90.208') ||
        origin.includes('172.16.92.228')) {
      return callback(null, true);
    }
    
    // Allow Vercel domains
    if (origin.includes('vercel.app') || 
        origin.includes('game-of-liars.vercel.app')) {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'x-player-id', 'x-player-name', 'x-lobby-code'],
  exposedHeaders: ['Set-Cookie']
}));

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is not set');
}

// Trust the first proxy
app.set('trust proxy', 1);

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Only secure in production
    httpOnly: false, // Allow JavaScript access for debugging
    maxAge: 4 * 60 * 60 * 1000, // 4 hours
    sameSite: 'lax' // Use 'lax' for better mobile compatibility
  },
  name: 'connect.sid'
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

// Setup Socket.io
const server = http.createServer(app);
const io = setupSocket(server);

// Setup game events and make them available to routes
const gameEvents = setupGameEvents(io, activeLobbies);
app.locals.gameEvents = gameEvents;

// Periodically check for inactive lobbies to clean up
setInterval(() => {
    const now = new Date();
    for (const [code, lobby] of activeLobbies.entries()) {
        const timeSincePhaseChange = now - lobby.phaseChangedAt;

        // Inactive for 5 minutes in pregame or ended phase
        if ((lobby.gamePhase === 'pregame' || lobby.gamePhase === 'ended') && timeSincePhaseChange > 5 * 60 * 1000) {
            // Notify all players in the lobby that the lobby is closing
            io.to(code).emit('lobbyClosed', { message: 'Lobby closed due to inactivity.' });

            // Disconnect all sockets in the lobby from the server-side
            const sockets = io.sockets.adapter.rooms.get(code);
            if (sockets) {
                sockets.forEach(socketId => {
                    const socket = io.sockets.sockets.get(socketId);
                    if (socket) {
                        socket.disconnect(true);
                    }
                });
            }

            // Finally, delete the lobby
            activeLobbies.delete(code);
            console.log(`Lobby ${code} has been closed and removed due to inactivity.`);
        }
    }
}, 30000); // Run every 30 seconds

// Start server
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is listening on port ${PORT}`);
    console.log(`Local access: http://localhost:${PORT}`);
    
    // Get network IP for external access
    const networkInterfaces = os.networkInterfaces();
    let networkUrl = '';
    
    for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                networkUrl = `http://${net.address}:${PORT}`;
                break;
            }
        }
        if (networkUrl) break;
    }
    
    if (networkUrl) {
        console.log(`Network access: ${networkUrl}`);
    }
});