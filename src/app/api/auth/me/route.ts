import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { Squad } from "@/models";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: true, data: null });
    }

    let squad = null;
    if (user.squadId) {
      squad = await Squad.findById(user.squadId).select("name tag squadLevel squadXp").lean();
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        department: user.department,
        yearOfStudy: user.yearOfStudy,
        role: user.role,
        avatarUrl: user.avatarUrl,
        level: user.level,
        rankTitle: user.rankTitle,
        coins: user.coins,
        xp: user.xp,
        trustScore: user.trustScore,
        trustTier: user.trustTier,
        equippedTitle: user.equippedTitle,
        equippedFrame: user.equippedFrame,
        squad,
        stats: user.stats,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}

