import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

let cached: MongooseCache = globalThis.mongooseCache || { conn: null, promise: null };

if (!globalThis.mongooseCache) {
  globalThis.mongooseCache = cached;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1 && cached.conn) {
    return cached.conn;
  }

  if (mongoose.connection.readyState === 0 || mongoose.connection.readyState === 3) {
    cached.promise = null;
    cached.conn = null;
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    };

    logger.info({ uri: env.MONGODB_URI.replace(/\/\/.*@/, '//***@') }, 'Connecting to MongoDB...');

    cached.promise = mongoose
      .connect(env.MONGODB_URI, opts)
      .then((instance) => {
        logger.info(`MongoDB connected successfully to host: ${instance.connection.host}`);
        return instance;
      })
      .catch((error) => {
        logger.error({ err: error }, 'MongoDB connection error');
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
}

export async function disconnectDB(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    cached.conn = null;
    cached.promise = null;
    logger.info('MongoDB disconnected');
  }
}
