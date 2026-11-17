import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  let dbStatus = "disconnected";
  let latencyMs = -1;
  let isDbOk = false;

  try {
    await connectDB();
    const readyState = mongoose.connection.readyState;

    if (readyState === 1 && mongoose.connection.db) {
      const pingStart = Date.now();
      await mongoose.connection.db.admin().ping();
      latencyMs = Date.now() - pingStart;
      dbStatus = "connected";
      isDbOk = true;
    } else if (readyState === 2) {
      dbStatus = "connecting";
    } else {
      dbStatus = "disconnected";
    }
  } catch (error: any) {
    dbStatus = `error: ${error.message || "connection failure"}`;
  }

  const uptime = Math.floor(process.uptime());
  const mem = process.memoryUsage();
  const overallHealthy = isDbOk;

  const payload = {
    status: overallHealthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    uptimeSeconds: uptime,
    database: {
      status: dbStatus,
      latencyMs,
      host: mongoose.connection.host || "unknown",
      name: mongoose.connection.name || "unknown",
    },
    system: {
      nodeVersion: process.version,
      rssMemoryMb: Math.round(mem.rss / 1024 / 1024),
      heapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
    },
    durationMs: Date.now() - startTime,
  };

  return NextResponse.json(payload, {
    status: overallHealthy ? 200 : 503,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}

