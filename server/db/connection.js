import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.URI || "";

const connectDB = async () => {
    console.log(process.env.URI);
    const maxRetries = 5;
    let retries = 0;

    while (retries < maxRetries) {
        try {
            await mongoose.connect(uri, {
                serverSelectionTimeoutMS: 30000, // Increase timeout
                socketTimeoutMS: 45000,
                connectTimeoutMS: 30000,
                maxPoolSize: 5, // Reduce pool size
                retryWrites: true,
                w: 'majority'
            });

            console.log("Successfully connected to MongoDB using Mongoose.");
            return;
        } catch (err) {
            retries++;
            console.error(`Connection attempt ${retries} failed:`, err.message);
            
            if (retries === maxRetries) {
                console.error("Max retries reached. Exiting...");
                process.exit(1);
            }
            
            // Wait 2 seconds before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
}

// Connection Events
mongoose.connection.on('error', (err) => {
    console.error('MongoDB Connection error:', err)
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
});

export default connectDB;