import { SignJWT, jwtVerify } from "jose";

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  const isBuild = process.env.NEXT_PHASE === "phase-production-build" || process.env.npm_lifecycle_event === "build";
  if (process.env.NODE_ENV === "production" && !isBuild) {
    if (!secret || secret.length < 32) {
      throw new Error(
        "FATAL: Production deployment requires a high-entropy JWT_SECRET environment variable (minimum 32 characters). Refusing to start."
      );
    }
    return new TextEncoder().encode(secret);
  }
  // In development or build phase, allow local fallback
  return new TextEncoder().encode(secret || "aiem-hunt-local-dev-secret-key-32-chars-long-minimum!");
}

const JWT_SECRET = getSecretKey();

export type UserRole = "STUDENT" | "SAFE_DESK_STAFF" | "MODERATOR" | "ADMIN";

export interface SessionPayload {
  userId: string;
  email: string;
  username: string;
  role: UserRole;
  assignedStationId?: string;
  assignedStationIds?: string[];
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    secure: process.env.NODE_ENV === "production",
  };
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}
