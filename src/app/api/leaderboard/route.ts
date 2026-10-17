import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User, Squad } from "@/models";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "HUNTERS"; // HUNTERS | SQUADS

    if (category === "SQUADS") {
      const topSquads = await Squad.find()
        .populate("leaderId", "displayName username avatarUrl")
        .sort({ squadXp: -1, completedHuntsCount: -1 })
        .limit(25)
        .lean();

      return NextResponse.json({ success: true, data: { squads: topSquads } });
    }

    const topHunters = await User.find({ accountStatus: "ACTIVE" })
      .select("displayName username avatarUrl level rankTitle xp coins trustScore trustTier stats department")
      .populate("squadId", "name tag")
      .sort({ xp: -1, "stats.recoveriesCount": -1 })
      .limit(30)
      .lean();

    return NextResponse.json({ success: true, data: { hunters: topHunters } });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

