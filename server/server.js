import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import lobbyRoutes from './routes/lobbyRoutes.js';
import { setupSocketHandlers } from './socket/socketHandlers.js';

const PORT = process.env.PORT || 5051;
const app = express();
const server = createServer(app);

console.log(process.env.TEST);

await connectDB();  

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/lobby', lobbyRoutes);

// Socket.IO setup
const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173", "http://localhost:5050", "http://172.16.90.241:5173", "http://172.16.90.241:5631"],
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Setup socket event handlers
setupSocketHandlers(io);

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Server is accessible on your local network:`);
    console.log(`Socket.IO server is ready for real-time connections`);
});