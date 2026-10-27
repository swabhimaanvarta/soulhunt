import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { signSessionToken, getSessionCookieOptions } from "@/lib/jwt";
import { checkRateLimit, peekRateLimit, resetRateLimit, getClientIp } from "@/lib/rateLimit";

const LoginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Please enter your email/username and password." },
        },
        { status: 400 }
      );
    }

    const { identifier, password } = parsed.data;
    const cleanId = identifier.trim().toLowerCase();
    const rateLimitKey = `login_${clientIp}_${cleanId}`;

    // 1. Rate limiting check (peek: max 5 failed attempts per 5 minutes per identifier/IP)
    const limit = await peekRateLimit(rateLimitKey, 5);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: `Too many login attempts. Please wait ${Math.ceil(limit.resetSeconds / 60)} minutes before trying again.`,
          },
        },
        { status: 429 }
      );
    }

    await connectDB();

    // Case-insensitive user lookup with safe regex escaping
    const escapedId = cleanId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const user = await User.findOne({
      $or: [
        { email: cleanId },
        { email: { $regex: new RegExp(`^${escapedId}$`, "i") } },
        { username: cleanId },
        { username: { $regex: new RegExp(`^${escapedId}$`, "i") } },
      ],
    }).select("+passwordHash");

    if (!user) {
      // Record failed login attempt
      await checkRateLimit(rateLimitKey, 5, 300);
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_CREDENTIALS", message: "Invalid email/username or password." },
        },
        { status: 401 }
      );
    }

    if (user.accountStatus === "PENDING_VERIFICATION") {
      return NextResponse.json(
        {
          success: false,
          pendingVerification: true,
          email: user.email,
          error: {
            code: "EMAIL_NOT_VERIFIED",
            message: "Your institutional email has not been verified yet. Please enter your clearance code to activate.",
          },
        },
        { status: 403 }
      );
    }

    if (user.accountStatus !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          error: { code: "ACCOUNT_SUSPENDED", message: "Your account is currently suspended or deactivated." },
        },
        { status: 403 }
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      // Record failed password attempt
      await checkRateLimit(rateLimitKey, 5, 300);
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_CREDENTIALS", message: "Invalid email/username or password." },
        },
        { status: 401 }
      );
    }

    // Successfully authenticated: clear any failed attempt record
    await resetRateLimit(rateLimitKey);

    const token = await signSessionToken({
      userId: user._id.toString(),
      email: user.email,
      username: user.username,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        level: user.level,
        rankTitle: user.rankTitle,
        coins: user.coins,
        xp: user.xp,
        trustScore: user.trustScore,
        trustTier: user.trustTier,
      },
    });

    response.cookies.set("aiem_session", token, getSessionCookieOptions());

    return response;
  } catch (error: any) {
    console.error("[POST /api/auth/login] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: error?.message || "Login failed. Please try again later." },
      },
      { status: 500 }
    );
  }
}
