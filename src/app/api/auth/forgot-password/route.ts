import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { generateEmailOtp, sendPasswordResetChallenge } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const ForgotPasswordSchema = z.object({
  identifier: z
    .string()
    .min(2, "Identifier must be at least 2 characters")
    .max(120, "Identifier too long")
    .trim(),
});

function maskEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}${"*".repeat(Math.min(local.length - 2, 4))}${local[local.length - 1]}@${domain}`;
}

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const body = await req.json();
    const parsed = ForgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues[0]?.message || "Invalid account identifier.",
          },
        },
        { status: 400 }
      );
    }

    const { identifier } = parsed.data;
    const cleanIdentifier = identifier.toLowerCase().trim();

    // 1. Rate limit per IP and identifier (4 requests per 15 minutes)
    const limit = await checkRateLimit(`forgot_pw_${cleanIdentifier}_${clientIp}`, 4, 900);
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

    const escapedId = cleanIdentifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const user = await User.findOne({
      $or: [
        { email: cleanIdentifier },
        { email: { $regex: new RegExp(`^${escapedId}$`, "i") } },
        { username: cleanIdentifier },
        { username: { $regex: new RegExp(`^${escapedId}$`, "i") } },
      ],
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "USER_NOT_FOUND",
            message: "No operative account found matching this identifier. Please verify your email or username.",
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
            message: "This account has been suspended or deactivated. Please contact campus security administration.",
          },
        },
        { status: 403 }
      );
    }

    // 2. Check 60s resend cooldown
    if (user.passwordResetResendAfter && user.passwordResetResendAfter > new Date()) {
      const waitSecs = Math.ceil((user.passwordResetResendAfter.getTime() - Date.now()) / 1000);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "COOLDOWN_ACTIVE",
            message: `Please wait ${waitSecs}s before requesting a new recovery code.`,
          },
        },
        { status: 429 }
      );
    }

    // 3. Generate 6-digit OTP challenge
    const { code, codeHash, expiresAt } = await generateEmailOtp();

    user.passwordResetCodeHash = codeHash;
    user.passwordResetExpiresAt = expiresAt;
    user.passwordResetAttempts = 0;
    user.passwordResetResendAfter = new Date(Date.now() + 60 * 1000);
    await user.save();

    // 4. Dispatch verification challenge via SMTP or dev console fallback
    await sendPasswordResetChallenge(user.email, user.displayName, code);

    return NextResponse.json({
      success: true,
      message: "A 6-digit password reset clearance code has been dispatched to your institutional inbox.",
      maskedEmail: maskEmail(user.email),
    });
  } catch (error: any) {
    console.error("[POST /api/auth/forgot-password] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Failed to dispatch password recovery challenge." },
      },
      { status: 500 }
    );
  }
}
