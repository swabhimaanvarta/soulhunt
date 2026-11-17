import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  getCampusResetInfo,
  getDailyQuestSet,
  getCampusDateKey,
  claimDailyQuestReward,
} from "@/lib/dailyQuests";

const ClaimDailyQuestSchema = z.object({
  questKey: z.string().min(1, "questKey is required."),
  dateKey: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(req.url);
    const dateKeyParam = searchParams.get("dateKey");

    const resetInfo = getCampusResetInfo();
    const effectiveDateKey = dateKeyParam || resetInfo.dateKey;

    const questData = await getDailyQuestSet(effectiveDateKey, user?._id?.toString());

    return NextResponse.json({
      success: true,
      dateKey: questData.dateKey,
      resetAt: resetInfo.resetAt,
      secondsRemaining: resetInfo.secondsRemaining,
      quests: questData.quests,
      dailyStreak: questData.dailyStreak,
      longestDailyStreak: questData.longestDailyStreak,
    });
  } catch (error: any) {
    console.error("[GET /api/quests/daily] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "SERVER_ERROR", message: "Failed to retrieve daily quests." },
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Please sign in to claim daily quest rewards." },
        },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = ClaimDailyQuestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_INPUT", message: "Invalid claim payload." },
        },
        { status: 400 }
      );
    }

    const { questKey, dateKey } = parsed.data;
    const effectiveDateKey = dateKey || getCampusDateKey();

    const result = await claimDailyQuestReward(user._id.toString(), questKey, effectiveDateKey);

    if (!result.success) {
      const statusCode = result.alreadyClaimed ? 409 : 400;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: result.error || "CLAIM_FAILED",
            message: result.message || "Failed to claim reward.",
          },
        },
        { status: statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      xpAwarded: result.xpAwarded,
      coinsAwarded: result.coinsAwarded,
      trophiesAwarded: result.trophiesAwarded,
      newLevel: result.newLevel,
      newCoins: result.newCoins,
      newTrophies: result.newTrophies,
      streakUpdated: result.streakUpdated,
    });
  } catch (error: any) {
    console.error("[POST /api/quests/daily] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "SERVER_ERROR", message: "Internal error while claiming daily reward." },
      },
      { status: 500 }
    );
  }
}

