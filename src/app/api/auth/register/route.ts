import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { SystemConfig, User } from "@/models";
import { generateEmailOtp, sendEmailVerificationChallenge } from "@/lib/email";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const RegisterSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/),
  displayName: z.string().min(2).max(40),
  password: z.string().min(8),
  department: z.string().min(2),
  yearOfStudy: z.number().int().min(1).max(5),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limit registration attempts per IP
    const clientIp = getClientIp(req);
    const limit = await checkRateLimit(`register_${clientIp}`, 10, 3600);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: `Too many registration attempts. Please try again in ${Math.ceil(limit.resetSeconds / 60)} minutes.`,
          },
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid registration fields.",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    await connectDB();
    const { email, username, displayName, password, department, yearOfStudy } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // 2. Enforce official institutional college domains
    const sysConfig = await SystemConfig.findOne({ key: "GLOBAL_CONFIG" });
    const configuredDomains: string[] = sysConfig?.allowedEmailDomains || [];
    const allowedDomains: string[] =
      configuredDomains.length > 0 ? configuredDomains : ["@aiemgoa.ac.in", "@aitdgoa.edu.in"];

    const domainAllowed = allowedDomains.some((domain: string) => {
      const cleanDomain = domain.toLowerCase().trim();
      const expectedSuffix = cleanDomain.startsWith("@") ? cleanDomain : "@" + cleanDomain;
      return normalizedEmail.endsWith(expectedSuffix);
    });

    if (!domainAllowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DOMAIN_NOT_ALLOWED",
            message: `Registration requires an official AIEM college email (${allowedDomains.join(
              " or "
            )}). Personal emails (@gmail, @yahoo, etc.) are strictly prohibited.`,
          },
        },
        { status: 403 }
      );
    }

    const cleanUsername = username.toLowerCase().trim();

    // 3a. Check if username is already taken by a different user
    const existingByUsername = await User.findOne({ username: cleanUsername });
    if (existingByUsername && existingByUsername.email !== normalizedEmail) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "USERNAME_TAKEN",
            message: "This hunter username is already taken. Please choose another username.",
          },
        },
        { status: 409 }
      );
    }

    // 3b. Check if email already exists
    const existingByEmail = await User.findOne({ email: normalizedEmail });
    if (existingByEmail) {
      if (existingByEmail.accountStatus === "ACTIVE") {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "EMAIL_EXISTS",
              message: "An account with this college email is already registered. Please sign in.",
            },
          },
          { status: 409 }
        );
      }

      if (existingByEmail.accountStatus === "PENDING_VERIFICATION") {
        const now = new Date();
        if (existingByEmail.emailVerificationResendAfter && existingByEmail.emailVerificationResendAfter > now) {
          const waitSecs = Math.ceil((existingByEmail.emailVerificationResendAfter.getTime() - now.getTime()) / 1000);
          return NextResponse.json(
            {
              success: false,
              pendingVerification: true,
              email: normalizedEmail,
              error: {
                code: "RESEND_COOLDOWN",
                message: `A verification code was recently generated. Please wait ${waitSecs} seconds before requesting a new code.`,
              },
            },
            { status: 429 }
          );
        }

        // Regenerate OTP and dispatch strictly to the email that owns this account
        const { code, codeHash, expiresAt } = await generateEmailOtp();
        existingByEmail.emailVerificationCodeHash = codeHash;
        existingByEmail.emailVerificationExpiresAt = expiresAt;
        existingByEmail.emailVerificationAttempts = 0;
        existingByEmail.emailVerificationResendAfter = new Date(Date.now() + 60 * 1000);
        await existingByEmail.save();

        const deliveryMethod = await sendEmailVerificationChallenge(normalizedEmail, existingByEmail.displayName, code);

        return NextResponse.json(
          {
            success: true,
            pendingVerification: true,
            message: "A verification code has been dispatched to your college email.",
            email: normalizedEmail,
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ACCOUNT_INACTIVE",
            message: "An account with this college email exists in an inactive or suspended state.",
          },
        },
        { status: 409 }
      );
    }

    // 4. Generate cryptographic 6-digit OTP challenge
    const { code, codeHash, expiresAt } = await generateEmailOtp();
    const passwordHash = await bcrypt.hash(password, 12);

    // 5. Create user in PENDING_VERIFICATION state (No session cookie issued!)
    const newUser = await User.create({
      email: normalizedEmail,
      passwordHash,
      username: username.toLowerCase(),
      displayName,
      department,
      yearOfStudy,
      role: "STUDENT",
      accountStatus: "PENDING_VERIFICATION",
      emailVerified: false,
      emailVerificationCodeHash: codeHash,
      emailVerificationExpiresAt: expiresAt,
      emailVerificationAttempts: 0,
      emailVerificationResendAfter: new Date(Date.now() + 60 * 1000),
      xp: 50,
      level: 1,
      rankTitle: "Rookie Scout",
      coins: 50,
      trustScore: 100,
      trustTier: "NEW_HUNTER",
    });

    // 6. Deliver OTP challenge via Nodemailer SMTP or dev server stdout
    const deliveryMethod = await sendEmailVerificationChallenge(normalizedEmail, displayName, code);

    return NextResponse.json(
      {
        success: true,
        pendingVerification: true,
        message: "Operative dossier registered! Enter the 6-digit clearance code sent to your college inbox.",
        email: newUser.email,
        username: newUser.username,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "USER_EXISTS",
            message: "An account with this college email or hunter username already exists.",
          },
        },
        { status: 409 }
      );
    }

    console.error("[POST /api/auth/register] Internal Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: "Registration failed. Please try again later." },
      },
      { status: 500 }
    );
  }
}
