import mongoose from "mongoose";

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

// Next.js dev HMR re-evaluates modules; keep one connection on globalThis.
const globalForMongoose = globalThis as typeof globalThis & {
  _mongoose?: MongooseCache;
};
const cache: MongooseCache =
  globalForMongoose._mongoose ?? (globalForMongoose._mongoose = { conn: null, promise: null });

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.local.example to .env.local and set your MongoDB connection string.",
    );
  }
  cache.promise ??= mongoose.connect(uri);
  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
  return cache.conn;
}
