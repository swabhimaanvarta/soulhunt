import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User, Squad } from "@/models";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const currentUser = await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "HUNTERS"; // HUNTERS | SQUADS
    const timeframe = searchParams.get("timeframe") || "ALL_TIME"; // ALL_TIME | WEEKLY

    if (category === "SQUADS") {
      const sortCriteria: any =
        timeframe === "WEEKLY"
          ? { weeklyScore: -1, squadXp: -1, createdAt: 1, _id: 1 }
          : { squadXp: -1, completedHuntsCount: -1, createdAt: 1, _id: 1 };

      const topSquads = await Squad.find()
        .populate("leaderId", "displayName username avatarUrl")
        .sort(sortCriteria)
        .limit(25)
        .lean();

      let viewerSquadPosition = null;
      if (currentUser?.squadId) {
        const userSquad = await Squad.findById(currentUser.squadId).lean();
        if (userSquad) {
          const higherCount = await Squad.countDocuments({
            ...(timeframe === "WEEKLY"
              ? {
                  $or: [
                    { weeklyScore: { $gt: userSquad.weeklyScore || 0 } },
                    { weeklyScore: userSquad.weeklyScore || 0, squadXp: { $gt: userSquad.squadXp } },
                  ],
                }
              : {
                  $or: [
                    { squadXp: { $gt: userSquad.squadXp } },
                    { squadXp: userSquad.squadXp, completedHuntsCount: { $gt: userSquad.completedHuntsCount || 0 } },
                  ],
                }),
          });
          viewerSquadPosition = {
            squadId: userSquad._id.toString(),
            name: userSquad.name,
            tag: userSquad.tag,
            rank: higherCount + 1,
            squadXp: userSquad.squadXp,
            weeklyScore: userSquad.weeklyScore || 0,
          };
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          squads: topSquads,
          viewerSquadPosition,
        },
      });
    }

    // Category: HUNTERS
    // Deterministic sort: score desc, then xp desc, then level desc, then createdAt asc, then _id asc
    // Omit sensitive trustScore (only display trustTier) and exclude users opting out of public leaderboard
    const hunterSort: any =
      timeframe === "WEEKLY"
        ? { weeklyScore: -1, xp: -1, level: -1, createdAt: 1, _id: 1 }
        : { xp: -1, level: -1, createdAt: 1, _id: 1 };

    const topHunters = await User.find({
      accountStatus: "ACTIVE",
      isLeaderboardPublic: { $ne: false },
    })
      .select("displayName username avatarUrl level rankTitle xp weeklyScore trustTier stats.treasuresFound stats.questsCompleted stats.recoveriesCount department equippedTitle equippedFrame equippedTheme")
      .populate("squadId", "name tag emblemIcon")
      .sort(hunterSort)
      .limit(30)
      .lean();

    let viewerPosition = null;
    if (currentUser) {
      const dbUser = await User.findById(currentUser._id).select("xp level weeklyScore isLeaderboardPublic createdAt").lean();
      if (dbUser) {
        // Deterministic count of users ranked higher
        const higherCount = await User.countDocuments({
          accountStatus: "ACTIVE",
          isLeaderboardPublic: { $ne: false },
          ...(timeframe === "WEEKLY"
            ? {
                $or: [
                  { weeklyScore: { $gt: dbUser.weeklyScore || 0 } },
                  { weeklyScore: dbUser.weeklyScore || 0, xp: { $gt: dbUser.xp } },
                  { weeklyScore: dbUser.weeklyScore || 0, xp: dbUser.xp, level: { $gt: dbUser.level } },
                  { weeklyScore: dbUser.weeklyScore || 0, xp: dbUser.xp, level: dbUser.level, createdAt: { $lt: dbUser.createdAt } },
                ],
              }
            : {
                $or: [
                  { xp: { $gt: dbUser.xp } },
                  { xp: dbUser.xp, level: { $gt: dbUser.level } },
                  { xp: dbUser.xp, level: dbUser.level, createdAt: { $lt: dbUser.createdAt } },
                ],
              }),
        });

        const isPublic = dbUser.isLeaderboardPublic !== false;
        viewerPosition = {
          userId: dbUser._id.toString(),
          rank: isPublic ? higherCount + 1 : null,
          xp: dbUser.xp,
          level: dbUser.level,
          weeklyScore: dbUser.weeklyScore || 0,
          isLeaderboardPublic: isPublic,
        };
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        hunters: topHunters,
        viewerPosition,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


