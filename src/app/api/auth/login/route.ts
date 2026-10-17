import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { signSessionToken } from "@/lib/auth";

const LoginSchema = z.object({
  identifier: z.string().min(1), // email or username
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
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

    await connectDB();
    const { identifier, password } = parsed.data;
    const cleanId = identifier.trim().toLowerCase();

    const user = await User.findOne({
      $or: [{ email: cleanId }, { username: cleanId }],
    }).select("+passwordHash");

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_CREDENTIALS", message: "Invalid email/username or password." },
        },
        { status: 401 }
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
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_CREDENTIALS", message: "Invalid email/username or password." },
        },
        { status: 401 }
      );
    }

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

    response.cookies.set("aiem_session", token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: error.message || "Login failed" },
      },
      { status: 500 }
    );
  }
}

