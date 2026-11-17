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

/**
 * Validates database URI for production and managed cloud environments.
 * Supports standard mongodb: and managed cloud mongodb+srv: (e.g. MongoDB Atlas / Railway / AWS).
 * Enforces valid protocol, host/cluster, and database name without terminating the process.
 */
export function assertProductionDatabaseUri(uri: string): void {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error(`[DATABASE] Invalid database URI format: '${uri}'`);
  }
  if (parsed.protocol !== "mongodb:" && parsed.protocol !== "mongodb+srv:") {
    throw new Error(`[DATABASE] Invalid protocol. Must be 'mongodb:' or 'mongodb+srv:', got '${parsed.protocol}'`);
  }
  if (!parsed.hostname || parsed.hostname.length === 0) {
    throw new Error("[DATABASE] Missing database cluster/host in MONGODB_URI.");
  }
  if (!parsed.pathname || parsed.pathname === "/" || parsed.pathname.length <= 1) {
    throw new Error("[DATABASE] Production database URI must specify a target database name (e.g. /aiem_hunt).");
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
  const isProd = process.env.NODE_ENV === "production" || process.env.ALLOW_REMOTE_DB === "true";

  if (isProd) {
    assertProductionDatabaseUri(uri);
    // Disable auto-indexing in production to prevent connection stalls and write locks on cold boots
    mongoose.set("autoIndex", false);
  } else {
    assertSafeConnectionUri(uri, false);
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts: mongoose.ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: isProd ? 10 : 50,
      minPoolSize: isProd ? 1 : 5,
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      retryReads: true,
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
