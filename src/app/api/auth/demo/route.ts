import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models";
import { signSessionToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { roleOrEmail } = await req.json();
    await connectDB();

    let query: any = {};
    if (roleOrEmail === "ADMIN") {
      query = { role: "ADMIN" };
    } else if (roleOrEmail === "MODERATOR") {
      query = { role: "MODERATOR" };
    } else if (roleOrEmail.includes("@")) {
      query = { email: roleOrEmail.toLowerCase().trim() };
    } else {
      query = { username: roleOrEmail.toLowerCase().trim() };
    }

    const user = await User.findOne(query);
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: `Demo user '${roleOrEmail}' not found.` } },
        { status: 404 }
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
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

