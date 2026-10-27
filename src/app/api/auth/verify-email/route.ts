import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { signSessionToken, getSessionCookieOptions } from "@/lib/jwt";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const VerifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6).regex(/^\d{6}$/),
});

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const body = await req.json();
    const parsed = VerifyEmailSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Please enter a valid 6-digit verification code." },
        },
        { status: 400 }
      );
    }

    const { email, code } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Rate limit attempts per email and IP
    const limit = await checkRateLimit(`verify_email_${normalizedEmail}_${clientIp}`, 5, 900);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: `Too many verification attempts. Please wait ${Math.ceil(limit.resetSeconds / 60)} minutes before trying again.`,
          },
        },
        { status: 429 }
      );
    }

    await connectDB();
    const now = new Date();

    const user = await User.findOne({
      email: normalizedEmail,
      accountStatus: "PENDING_VERIFICATION",
    }).select("+emailVerificationCodeHash");

    if (!user) {
      // Check if user is already ACTIVE
      const alreadyActive = await User.findOne({ email: normalizedEmail, accountStatus: "ACTIVE" });
      if (alreadyActive) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "ALREADY_VERIFIED",
              message: "This account has already been verified. Please sign in.",
            },
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "No pending verification found for this email address.",
          },
        },
        { status: 400 }
      );
    }

    // 2. Check failed attempts count
    if ((user.emailVerificationAttempts || 0) >= 5) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ATTEMPTS_EXCEEDED",
            message: "Too many failed attempts. Verification locked. Please request a new verification code.",
          },
        },
        { status: 403 }
      );
    }

    // 3. Check expiration
    if (!user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < now) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CODE_EXPIRED",
            message: "Your clearance code has expired. Please request a new one.",
          },
        },
        { status: 400 }
      );
    }

    // 4. Compare cryptographic OTP hash
    if (!user.emailVerificationCodeHash) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_STATE", message: "Verification state invalid. Please resend." } },
        { status: 400 }
      );
    }

    const isMatch = await bcrypt.compare(code, user.emailVerificationCodeHash);
    if (!isMatch) {
      // Atomically increment failed attempts with ceiling check
      const failedUser = await User.findOneAndUpdate(
        {
          _id: user._id,
          accountStatus: "PENDING_VERIFICATION",
        },
        {
          $inc: { emailVerificationAttempts: 1 },
        },
        { new: true }
      );

      const attempts = failedUser?.emailVerificationAttempts || (user.emailVerificationAttempts || 0) + 1;
      const remaining = Math.max(0, 5 - attempts);

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CODE_MISMATCH",
            message: remaining > 0
              ? `Invalid clearance code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
              : "Too many failed attempts. Clearance code locked. Please request a new code.",
          },
        },
        { status: 401 }
      );
    }

    // 5. Atomic conditional activation (race-proof against concurrent requests or resend races)
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        accountStatus: "PENDING_VERIFICATION",
        emailVerificationCodeHash: user.emailVerificationCodeHash, // Must match the hash compared
        emailVerificationExpiresAt: { $gt: now }, // Must still be unexpired
        emailVerificationAttempts: { $lt: 5 }, // Must not have breached attempt lock
      },
      {
        $set: {
          accountStatus: "ACTIVE",
          emailVerified: true,
        },
        $unset: {
          emailVerificationCodeHash: 1,
          emailVerificationExpiresAt: 1,
          emailVerificationAttempts: 1,
          emailVerificationResendAfter: 1,
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      // Check if another concurrent request already activated the user
      const existingActive = await User.findOne({ _id: user._id, accountStatus: "ACTIVE" });
      if (existingActive) {
        const token = await signSessionToken({
          userId: existingActive._id.toString(),
          email: existingActive.email,
          username: existingActive.username,
          role: existingActive.role,
        });

        const resp = NextResponse.json(
          {
            success: true,
            message: "Account already verified. Welcome to AIEM Hunt.",
            data: {
              id: existingActive._id,
              email: existingActive.email,
              username: existingActive.username,
              displayName: existingActive.displayName,
              role: existingActive.role,
            },
          },
          { status: 200 }
        );
        resp.cookies.set("aiem_session", token, getSessionCookieOptions());
        return resp;
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CHALLENGE_STALE",
            message: "Verification challenge was already consumed, expired, or reset by a new code. Please request a new code.",
          },
        },
        { status: 409 }
      );
    }

    // 6. Sign session token and set secure cookie
    const token = await signSessionToken({
      userId: updatedUser._id.toString(),
      email: updatedUser.email,
      username: updatedUser.username,
      role: updatedUser.role,
    });

    const response = NextResponse.json(
      {
        success: true,
        message: "Institutional clearance verified! Welcome to AIEM Hunt.",
        data: {
          id: updatedUser._id,
          email: updatedUser.email,
          username: updatedUser.username,
          displayName: updatedUser.displayName,
          role: updatedUser.role,
          level: updatedUser.level,
          rankTitle: updatedUser.rankTitle,
          coins: updatedUser.coins,
          xp: updatedUser.xp,
        },
      },
      { status: 200 }
    );

    response.cookies.set("aiem_session", token, getSessionCookieOptions());

    return response;
  } catch (error: any) {
    console.error("[POST /api/auth/verify-email] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Verification failed. Please try again." },
      },
      { status: 500 }
    );
  }
}
