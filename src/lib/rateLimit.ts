import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { RateLimitRecord } from "@/models";

// In-memory sliding window for development
interface MemoryBucket {
  count: number;
  resetAt: number;
}
const memoryBuckets = new Map<string, MemoryBucket>();

// Periodic cleanup of expired memory buckets
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of memoryBuckets.entries()) {
      if (bucket.resetAt <= now) {
        memoryBuckets.delete(key);
      }
    }
  }, 60000);
}

export function getClientIp(req: NextRequest): string {
  // 1. Check platform-authenticated ingress headers first
  const realIp = req.headers.get("x-real-ip");
  if (realIp && realIp.trim()) return realIp.trim();

  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp && cfIp.trim()) return cfIp.trim();

  // 2. If parsing X-Forwarded-For, inspect proxy chain
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((ip) => ip.trim()).filter(Boolean);
    if (hops.length > 0) {
      // Pick the rightmost hop added by the outermost trusted reverse proxy, preventing spoofed prepended IPs
      return hops[hops.length - 1];
    }
  }

  return "127.0.0.1";
}

/**
 * Check and record a rate-limit point for an identifier/key
 */
export async function checkRateLimit(
  key: string,
  maxPoints: number,
  windowSeconds: number
): Promise<{ allowed: boolean; remaining: number; resetSeconds: number }> {
  const now = Date.now();

  // If in production, use MongoDB-backed atomic TTL record
  if (process.env.NODE_ENV === "production") {
    try {
      await connectDB();
      const expireAt = new Date(now + windowSeconds * 1000);

      // Atomically increment points or reset if window expired (MongoDB 4.2+ pipeline update)
      const record = await RateLimitRecord.findOneAndUpdate(
        { key },
        [
          {
            $set: {
              points: {
                $cond: {
                  if: { $or: [{ $eq: [{ $type: "$expireAt" }, "missing"] }, { $lte: ["$expireAt", new Date(now)] }] },
                  then: 1,
                  else: { $add: [{ $ifNull: ["$points", 0] }, 1] },
                },
              },
              expireAt: {
                $cond: {
                  if: { $or: [{ $eq: [{ $type: "$expireAt" }, "missing"] }, { $lte: ["$expireAt", new Date(now)] }] },
                  then: expireAt,
                  else: "$expireAt",
                },
              },
            },
          },
        ],
        { upsert: true, new: true }
      );

      const count = record.points;
      const allowed = count <= maxPoints;
      const remaining = Math.max(0, maxPoints - count);
      const resetSeconds = Math.max(0, Math.ceil((record.expireAt.getTime() - now) / 1000));

      return { allowed, remaining, resetSeconds };
    } catch {
      // Fallback to in-memory if DB call fails
    }
  }

  // In-memory bucket
  let bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 1, resetAt: now + windowSeconds * 1000 };
    memoryBuckets.set(key, bucket);
    return { allowed: true, remaining: maxPoints - 1, resetSeconds: windowSeconds };
  }

  bucket.count += 1;
  const allowed = bucket.count <= maxPoints;
  const remaining = Math.max(0, maxPoints - bucket.count);
  const resetSeconds = Math.max(0, Math.ceil((bucket.resetAt - now) / 1000));

  return { allowed, remaining, resetSeconds };
}

