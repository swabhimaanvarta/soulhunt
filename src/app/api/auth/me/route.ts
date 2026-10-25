import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Squad } from "@/models";

export async function GET() {
  try {
    await connectDB();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, data: null });
    }

    let squad = null;
    if (user.squadId) {
      squad = await Squad.findById(user.squadId).select("name tag squadLevel squadXp").lean();
    }

    const userData = {
      id: user._id,
      _id: user._id.toString(),
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      department: user.department,
      yearOfStudy: user.yearOfStudy,
      role: user.role,
      avatarUrl: user.avatarUrl,
      avatarPreset: user.avatarPreset || "recon",
      bio: user.bio || "",
      phoneNumber: user.phoneNumber || "",
      studentId: user.studentId || "",
      preferredContactMethod: user.preferredContactMethod || "SAFE_DESK",
      level: user.level,
      rankTitle: user.rankTitle,
      coins: user.coins,
      xp: user.xp,
      trustScore: user.trustScore,
      equippedTitle: user.equippedTitle || "Campus Pathfinder",
      equippedFrame: user.equippedFrame || "frame-emerald-pulse",
      equippedTheme: user.equippedTheme || "theme-obsidian-grid",
      ownedCosmetics: (user.ownedCosmetics || []).map((id: any) => id.toString()),
      isProfilePublic: user.isProfilePublic !== false,
      isLeaderboardPublic: user.isLeaderboardPublic !== false,
      squad,
      stats: user.stats,
    };

    return NextResponse.json({
      success: true,
      data: userData,
      user: userData,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

