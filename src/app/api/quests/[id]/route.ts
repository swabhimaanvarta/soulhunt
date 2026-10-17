import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Quest, Clue, Investigation, Squad } from "@/models";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();
    const user = await getCurrentUser();

    const quest = await Quest.findById(id)
      .populate("targetLocationId", "name code zoneType coordinates isSafeDesk")
      .populate("linkedLostItemId")
      .lean();

    if (!quest) {
      return NextResponse.json({ success: false, error: "Quest not found" }, { status: 404 });
    }

    // Never leak normalized answers to client
    const clues = await Clue.find({ questId: quest._id })
      .select("-expectedAnswerNormalized")
      .sort({ stageOrder: 1 })
      .populate("targetLocationId", "name code")
      .lean();

    let userInvestigation = null;
    if (user) {
      userInvestigation = await Investigation.findOne({
        questId: quest._id,
        $or: [
          { userId: user._id },
          ...(user.squadId ? [{ squadId: user.squadId }] : []),
        ],
      }).lean();
    }

    return NextResponse.json({
      success: true,
      data: {
        quest,
        clues,
        investigation: userInvestigation,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

