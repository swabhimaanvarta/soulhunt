import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { generateEmailOtp, sendEmailVerificationChallenge } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const ResendSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const body = await req.json();
    const parsed = ResendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid email address." } },
        { status: 400 }
      );
    }

    const { email } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Rate limit resend per email + IP
    const limit = await checkRateLimit(`resend_${normalizedEmail}_${clientIp}`, 3, 300);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: `Please wait ${limit.resetSeconds} seconds before requesting another code.`,
          },
        },
        { status: 429 }
      );
    }

    await connectDB();
    const user = await User.findOne({
      email: normalizedEmail,
      accountStatus: "PENDING_VERIFICATION",
    });

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "NOT_FOUND",
            message: "No pending account found for this email address.",
          },
        },
        { status: 404 }
      );
    }

    // Check 60-second cooldown
    if (user.emailVerificationResendAfter && user.emailVerificationResendAfter > new Date()) {
      const waitSecs = Math.ceil((user.emailVerificationResendAfter.getTime() - Date.now()) / 1000);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "COOLDOWN_ACTIVE",
            message: `Please wait ${waitSecs}s before requesting a new code.`,
          },
        },
        { status: 429 }
      );
    }

    // Generate new OTP and reset attempts
    const { code, codeHash, expiresAt } = await generateEmailOtp();
    user.emailVerificationCodeHash = codeHash;
    user.emailVerificationExpiresAt = expiresAt;
    user.emailVerificationAttempts = 0;
    user.emailVerificationResendAfter = new Date(Date.now() + 60 * 1000);
    await user.save();

    const deliveryMethod = await sendEmailVerificationChallenge(normalizedEmail, user.displayName, code);

    return NextResponse.json({
      success: true,
      message: "A new clearance code has been dispatched to your institutional inbox.",
    });
  } catch (error: any) {
    console.error("[POST /api/auth/resend-code] Error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to resend code." } },
      { status: 500 }
    );
  }
}

