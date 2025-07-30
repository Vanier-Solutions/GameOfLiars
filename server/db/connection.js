import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.URI;
  
  if (!uri) {
    throw new Error('MongoDB URI not found in environment variables');
  }

  let connectionUri = uri;
  
  // Ensure we're connecting to the 'gol' database
  if (!uri.includes('/gol')) {
    connectionUri = uri.replace('mongodb+srv://', 'mongodb+srv://').replace('?', '/gol?');
  }

  const options = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  };

  let retries = 0;
  const maxRetries = 5;

  while (retries < maxRetries) {
    try {
      await mongoose.connect(connectionUri, options);
      console.log("Successfully connected to MongoDB using Mongoose.");
      return;
    } catch (err) {
      retries++;
      console.error(`Connection attempt ${retries} failed:`, err.message);
      
      if (retries >= maxRetries) {
        console.error('Max retries reached. Could not connect to MongoDB.');
        throw err;
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
};

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