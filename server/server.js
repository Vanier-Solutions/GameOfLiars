import express from 'express';
import cors from 'cors';
import connectDB from './config/db.js';
import lobbyRoutes from './routes/lobbyRoutes.js';

const PORT = process.env.PORT || 5051;
const app = express();

console.log(process.env.TEST);

await connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/lobby', lobbyRoutes);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});