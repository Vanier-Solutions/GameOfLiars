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
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow localhost and IP addresses for development
    if (origin.includes('localhost') || 
        origin.includes('127.0.0.1') || 
        origin.includes('192.168.1.200') ||
        origin.includes('172.16.90.208')) {
      return callback(null, true);
    }
    
    // Allow specific production domains if needed
    // if (origin === 'https://yourdomain.com') {
    //   return callback(null, true);
    // }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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

// Setup Socket.io
const io = setupSocket(app);

// Setup game events and make them available to routes
const gameEvents = setupGameEvents(io, activeLobbies);
app.locals.gameEvents = gameEvents;

// Start server
app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
    console.log(`Local access: http://localhost:${PORT}`);
    
    // Get network IP for external access
    const os = require('os');
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