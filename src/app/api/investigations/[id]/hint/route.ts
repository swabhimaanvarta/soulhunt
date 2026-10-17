import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Investigation, Clue, User, Transaction } from "@/models";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Please log in to unlock hints." }, { status: 401 });
    }

    const { stageOrder } = await req.json();
    await connectDB();

    const investigation = await Investigation.findById(id);
    if (!investigation) {
      return NextResponse.json({ success: false, error: "Investigation not found" }, { status: 404 });
    }

    const clue = await Clue.findOne({
      questId: investigation.questId,
      stageOrder: stageOrder || investigation.currentStage,
    });

    if (!clue || !clue.hintText) {
      return NextResponse.json({ success: false, error: "No hint available for this clue." }, { status: 404 });
    }

    const cost = clue.hintCoinCost || 10;
    if (user.coins < cost) {
      return NextResponse.json(
        { success: false, error: `Insufficient Hunter Coins. Unlocking this hint requires ${cost} coins.` },
        { status: 400 }
      );
    }

    // Deduct coins
    await User.findByIdAndUpdate(user._id, { $inc: { coins: -cost } });
    await Transaction.create({
      userId: user._id,
      deltaCoins: -cost,
      deltaXp: 0,
      deltaTrust: 0,
      reason: `Unlocked Hint for Stage ${clue.stageOrder} (${clue.title})`,
      referenceType: "QUEST",
      referenceId: clue.questId,
    });

    return NextResponse.json({
      success: true,
      data: {
        hintText: clue.hintText,
        coinsRemaining: user.coins - cost,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

