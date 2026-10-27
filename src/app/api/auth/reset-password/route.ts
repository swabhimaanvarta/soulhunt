import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const ResetPasswordSchema = z.object({
  identifier: z.string().min(2, "Identifier is required").trim(),
  code: z
    .string()
    .length(6, "Recovery code must be exactly 6 digits")
    .regex(/^\d{6}$/, "Recovery code must only contain digits"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const body = await req.json();
    const parsed = ResetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message || "Invalid input payload.",
          },
        },
        { status: 400 }
      );
    }

    const { identifier, code, newPassword } = parsed.data;
    const cleanIdentifier = identifier.toLowerCase().trim();

    // 1. Rate limit reset attempts per IP/identifier (5 attempts per 15 minutes)
    const limit = await checkRateLimit(`reset_pw_${cleanIdentifier}_${clientIp}`, 5, 900);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: `Too many password reset attempts. Please wait ${Math.ceil(limit.resetSeconds / 60)} minutes before trying again.`,
          },
        },
        { status: 429 }
      );
    }

    await connectDB();
    const now = new Date();

    const escapedId = cleanIdentifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const user = await User.findOne({
      $or: [
        { email: cleanIdentifier },
        { email: { $regex: new RegExp(`^${escapedId}$`, "i") } },
        { username: cleanIdentifier },
        { username: { $regex: new RegExp(`^${escapedId}$`, "i") } },
      ],
    }).select("+passwordResetCodeHash");

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "USER_NOT_FOUND",
            message: "No operative account found matching this identifier.",
          },
        },
        { status: 404 }
      );
    }

    if (user.accountStatus === "SUSPENDED" || user.accountStatus === "DEACTIVATED") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ACCOUNT_SUSPENDED",
            message: "This account has been suspended or deactivated. Contact campus security administration.",
          },
        },
        { status: 403 }
      );
    }

    // 2. Check if recovery challenge exists
    if (!user.passwordResetCodeHash) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NO_RESET_CHALLENGE",
            message: "No active recovery challenge found for this account. Please request a new code.",
          },
        },
        { status: 400 }
      );
    }

    // 3. Check failed attempts count
    if ((user.passwordResetAttempts || 0) >= 5) {
      user.passwordResetCodeHash = undefined;
      user.passwordResetExpiresAt = undefined;
      await user.save();

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ATTEMPTS_EXCEEDED",
            message: "Too many failed attempts. Recovery code locked. Please request a fresh clearance code.",
          },
        },
        { status: 403 }
      );
    }

    // 4. Check expiration
    if (!user.passwordResetExpiresAt || user.passwordResetExpiresAt < now) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CODE_EXPIRED",
            message: "Your recovery clearance code has expired. Please request a new code.",
          },
        },
        { status: 400 }
      );
    }

    // 5. Compare cryptographic bcrypt hash
    const isValid = await bcrypt.compare(code, user.passwordResetCodeHash);
    if (!isValid) {
      const attempts = (user.passwordResetAttempts || 0) + 1;
      user.passwordResetAttempts = attempts;
      await user.save();

      const remaining = 5 - attempts;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_CODE",
            message:
              remaining > 0
                ? `Invalid clearance code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
                : "Too many failed attempts. Recovery code locked. Please request a fresh code.",
          },
        },
        { status: 400 }
      );
    }

    // 6. Valid code: hash new password & update
    const newPasswordHash = await bcrypt.hash(newPassword, 12);
    user.passwordHash = newPasswordHash;

    // Reset recovery fields
    user.passwordResetCodeHash = undefined;
    user.passwordResetExpiresAt = undefined;
    user.passwordResetAttempts = 0;
    user.passwordResetResendAfter = undefined;

    // If account was pending verification, verified ownership activates the account
    if (user.accountStatus === "PENDING_VERIFICATION") {
      user.accountStatus = "ACTIVE";
      user.emailVerified = true;
      user.emailVerificationCodeHash = undefined;
      user.emailVerificationExpiresAt = undefined;
      user.emailVerificationAttempts = 0;
    }

    await user.save();

    return NextResponse.json({
      success: true,
      message: "Operative credentials updated successfully! You can now sign in with your new password.",
    });
  } catch (error: any) {
    console.error("[POST /api/auth/reset-password] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to reset password." },
      },
      { status: 500 }
    );
  }
}
