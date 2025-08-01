import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.URI;

if (!uri) {
    console.error('MongoDB URI not found in environment variables');
    process.exit(1);
}

// Connect to MongoDB
const connectionUri = uri;

mongoose.connect(connectionUri, {
    dbName: 'gol'
});

// Handle connection events
mongoose.connection.on('connected', () => {
    console.log("Successfully connected to MongoDB using Mongoose.");
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

// Handle application termination
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
});

export default mongoose;