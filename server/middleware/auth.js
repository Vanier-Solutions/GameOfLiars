import { activeLobbies } from '../routes/lobby.js';

// Middleware check if user authenticated
export const requireAuth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    req.user = req.session.user;
    next();
};

// Middleware to optionally populate user if authenticated
export const optionalAuth = (req, res, next) => {
    if (req.session.user) {
        req.user = req.session.user;
    }
    next();
};
