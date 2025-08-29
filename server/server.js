import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import lobbyRoutes from './routes/lobbyRoutes.js';
import 'dotenv/config';
import { setupSocketHandlers } from './socket/socketHandlers.js';

const PORT = process.env.PORT || 5051;
const app = express();
const server = createServer(app);

await connectDB();  

// SECURE CORS CONFIGURATION FOR VERCEL + RAILWAY DEPLOYMENT
const getAllowedOrigins = () => {
    const origins = [];
    
    // Development origins
    if (process.env.NODE_ENV !== 'production') {
        origins.push(
            'http://localhost:5173',
            'http://localhost:5050',
            'http://127.0.0.1:5173',
            'http://127.0.0.1:5050',
            'http://172.16.95.42:5173',
        );
    }
    
    // Production Vercel frontend URLs
    if (process.env.FRONTEND_URL) {
        origins.push(process.env.FRONTEND_URL);
    }
    
    // Vercel preview deployments (format: https://your-app-*.vercel.app)
    if (process.env.VERCEL_PREVIEW_DOMAIN) {
        origins.push(`https://${process.env.VERCEL_PREVIEW_DOMAIN}`);
    }
    
    // Add your actual Vercel domain here (replace with your app name)
    const vercelDomain = process.env.VERCEL_DOMAIN || 'your-game-app.vercel.app';
    origins.push(`https://${vercelDomain}`);
    
    return origins;
};

const allowedOrigins = getAllowedOrigins();

// Log allowed origins for debugging (remove in production)
if (process.env.NODE_ENV !== 'production') {
    console.log('Allowed CORS origins:', allowedOrigins);
}

// Secure CORS middleware
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, server-to-server)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        } else {
            console.error(`CORS blocked request from origin: ${origin}`);
            return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400 // Cache preflight requests for 24 hours
}));

// Security headers middleware
app.use((req, res, next) => {
    // Security headers for production
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Only set HSTS in production with HTTPS
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    next();
});

// Request size limit and JSON parsing
app.use(express.json({ limit: '10mb' }));

// Health check endpoint for Railway
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Routes
app.use('/api/lobby', lobbyRoutes);

// Secure Socket.IO CORS configuration
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
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