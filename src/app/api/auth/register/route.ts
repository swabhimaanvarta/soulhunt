import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { SystemConfig, User } from "@/models";
import { signSessionToken } from "@/lib/auth";

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

    const sysConfig = await SystemConfig.findOne({ key: "GLOBAL_CONFIG" });
    const allowedDomains: string[] = sysConfig?.allowedEmailDomains?.length
      ? sysConfig.allowedEmailDomains
      : [
          "@aiemgoa.ac.in",
          "@aitdgoa.edu.in",
          "@student.aiem.edu",
          "@aiem.edu",
        ];

    const domainAllowed = allowedDomains.some((domain: string) =>
      normalizedEmail.endsWith(domain.toLowerCase())
    );

    if (!domainAllowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DOMAIN_NOT_ALLOWED",
            message: `Registration requires an official AIEM college email (${allowedDomains.join(" or ")}).`,
          },
        },
        { status: 403 }
      );
    }

    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: username.toLowerCase() }],
    });

    if (existingUser) {
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

    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = await User.create({
      email: normalizedEmail,
      passwordHash,
      username: username.toLowerCase(),
      displayName,
      department,
      yearOfStudy,
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      xp: 50,
      level: 1,
      rankTitle: "Rookie Scout",
      coins: 50,
      trustScore: 100,
      trustTier: "NEW_HUNTER",
    });

    const token = await signSessionToken({
      userId: newUser._id.toString(),
      email: newUser.email,
      username: newUser.username,
      role: newUser.role,
    });

    const response = NextResponse.json({
      success: true,
      data: {
        id: newUser._id,
        email: newUser.email,
        username: newUser.username,
        displayName: newUser.displayName,
        role: newUser.role,
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
        error: { code: "INTERNAL_ERROR", message: error.message || "Registration failed" },
      },
      { status: 500 }
    );
  }
}
