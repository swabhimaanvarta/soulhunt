import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Investigation, Quest, Clue, Squad } from "@/models";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();
    const user = await getCurrentUser();

    const investigation = await Investigation.findById(id).lean();
    if (!investigation) {
      return NextResponse.json({ success: false, error: "Investigation not found" }, { status: 404 });
    }

    const [quest, clues, squad] = await Promise.all([
      Quest.findById(investigation.questId).populate("targetLocationId").lean(),
      Clue.find({ questId: investigation.questId }).select("-expectedAnswerNormalized").sort({ stageOrder: 1 }).populate("targetLocationId").lean(),
      investigation.squadId ? Squad.findById(investigation.squadId).lean() : null,
    ]);

    return NextResponse.json({
      success: true,
      data: {
        investigation,
        quest,
        clues,
        squad,
        currentUser: user ? { id: user._id, username: user.username, displayName: user.displayName, coins: user.coins } : null,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

