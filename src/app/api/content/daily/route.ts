import { NextRequest, NextResponse } from "next/server";
import { getOrRotateDailyQuest } from "@/lib/content/contentEngine";
import { getCurrentUser } from "@/lib/auth";
import { Investigation } from "@/models";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const { quest, clues, today } = await getOrRotateDailyQuest();

    let userInvestigation = null;
    if (user && quest) {
      userInvestigation = await Investigation.findOne({
        questId: quest._id,
        userId: user._id,
      })
        .select("currentStage progressPct status solvedClues")
        .lean();
    }

    return NextResponse.json({
      success: true,
      data: {
        quest,
        clues,
        today,
        userInvestigation,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to load Daily Hunt." },
      { status: 500 }
    );
  }
}

