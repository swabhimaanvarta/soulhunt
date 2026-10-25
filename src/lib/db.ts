import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aiem_hunt";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache || { conn: null, promise: null };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (cached.conn) {
    return cached.conn;
  }

  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aiem_hunt";

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: 50,
      minPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    };

    cached.promise = mongoose
      .connect(uri, opts)
      .then((m) => {
        return m;
      })
      .catch((err) => {
        // Automatically reset promise on failure so next request can retry cleanly
        cached.promise = null;
        cached.conn = null;
        console.error("MongoDB connection error:", err.message);
        throw err;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (e) {
    cached.promise = null;
    cached.conn = null;
    throw e;
  }
}
