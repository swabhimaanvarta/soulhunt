import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aiem_hunt";

/**
 * Validates that database URI strictly connects to a loopback host using mongodb: protocol,
 * and if isTestRunner is true, ensures the database name begins with /aiem_hunt_test_.
 * Immediately prints security alert and exits process if invalid.
 */
export function assertSafeConnectionUri(uri: string, isTestRunner: boolean = false): void {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch (e) {
    console.error("[SECURITY ALERT] Invalid database URI format:", uri);
    process.exit(1);
  }
  if (parsed.protocol !== "mongodb:") {
    console.error("[SECURITY ALERT] Invalid protocol. Must be 'mongodb:':", parsed.protocol);
    process.exit(1);
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    console.error("[SECURITY ALERT] Disallowed database host. Must be 127.0.0.1 or localhost:", hostname);
    process.exit(1);
  }
  if (isTestRunner && !parsed.pathname.startsWith("/aiem_hunt_test_")) {
    console.error("[SECURITY ALERT] Test runner must connect to database starting with '/aiem_hunt_test_':", parsed.pathname);
    process.exit(1);
  }
}

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
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/aiem_hunt";
  assertSafeConnectionUri(uri, false);

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (cached.conn) {
    return cached.conn;
  }


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
