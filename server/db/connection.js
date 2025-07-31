import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.URI;
  
  if (!uri) {
    throw new Error('MongoDB URI not found in environment variables');
  }

  console.log('Original URI:', uri);

  // Use the original URI and specify database name in options
  const connectionUri = uri;

  console.log('Final connection URI:', connectionUri);

  const options = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    dbName: 'gol' // Explicitly specify the database name
  };

  let retries = 0;
  const maxRetries = 5;

  while (retries < maxRetries) {
    try {
      await mongoose.connect(connectionUri, options);
      console.log("Successfully connected to MongoDB using Mongoose.");
      console.log("Database URI:", connectionUri);
      console.log("Connected to database:", mongoose.connection.db.databaseName);
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