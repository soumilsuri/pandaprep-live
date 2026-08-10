import mongoose from "mongoose";

/**
 * Global object caching for serverless environments (Vercel).
 * Preserves the database connection promise across warm container invocations.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  // Return active connection if already connected (readyState === 1)
  if (mongoose.connection.readyState === 1) {
    if (!cached.conn) {
      cached.conn = mongoose.connection;
    }
    return cached.conn;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured');
  }

  // If connection is disconnected (0) or disconnecting (3), clear cached promise to reconnect
  if (mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
    cached.promise = null;
    cached.conn = null;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // Prevent 10s query buffering deadlocks on broken/closed connections
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    };

    cached.promise = mongoose
      .connect(process.env.MONGODB_URI, opts)
      .then((connectionInstance) => {
        console.log(`\nMongoDB connected: ${connectionInstance.connection.host}`);
        return connectionInstance;
      })
      .catch((error) => {
        cached.promise = null;
        cached.conn = null;
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    cached.promise = null;
    cached.conn = null;
    throw error;
  }

  return cached.conn;
};

export default connectDB;

