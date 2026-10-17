import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Quest, Clue, SystemConfig } from "@/models";
import { getCurrentUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const status = searchParams.get("status") || "ACTIVE";

    const filter: any = {};
    if (status !== "ALL") filter.status = status;
    if (type && type !== "ALL") filter.questType = type;

    const quests = await Quest.find(filter)
      .populate("targetLocationId", "name code zoneType coordinates")
      .sort({ createdAt: -1 })
      .lean();

    // Include clue count for each quest
    const questIds = quests.map((q) => q._id);
    const clues = await Clue.find({ questId: { $in: questIds } }).select("questId stageOrder").lean();
    
    const clueCountMap = clues.reduce((acc: any, c: any) => {
      const qId = c.questId.toString();
      acc[qId] = (acc[qId] || 0) + 1;
      return acc;
    }, {});

    const enriched = quests.map((q) => ({
      ...q,
      totalStages: clueCountMap[q._id.toString()] || 0,
    }));

    return NextResponse.json({ success: true, data: enriched });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== "ADMIN" && user.role !== "MODERATOR")) {
      return NextResponse.json({ success: false, error: "Only Admins and Moderators can create quests." }, { status: 403 });
    }

    const body = await req.json();
    await connectDB();

    const count = await Quest.countDocuments();
    const questCode = `Quest #${String(count + 1).padStart(3, "0")}`;

    const {
      title,
      description,
      questType = "CAMPUS_TREASURE",
      difficulty = 3,
      targetLocationId,
      xpReward = 200,
      coinReward = 50,
      squadXpReward = 75,
      finderBonusXp = 30,
      clues = [],
    } = body;

    const quest = await Quest.create({
      questCode,
      title,
      description,
      questType,
      difficulty,
      targetLocationId,
      xpReward,
      coinReward,
      squadXpReward,
      finderBonusXp,
      status: "ACTIVE",
    });

    if (Array.isArray(clues) && clues.length > 0) {
      const clueDocs = clues.map((c: any, index: number) => ({
        questId: quest._id,
        stageOrder: index + 1,
        title: c.title || `Stage ${index + 1}`,
        clueText: c.clueText,
        verificationType: c.verificationType || "TEXT_RIDDLE",
        expectedAnswerNormalized: (c.expectedAnswer || "").toLowerCase().replace(/[^a-z0-9]/g, ""),
        targetLocationId: c.targetLocationId || targetLocationId,
        hintText: c.hintText || "",
        hintCoinCost: c.hintCoinCost || 10,
        unlockedBreadcrumbText: c.unlockedBreadcrumbText || "Clue solved! Proceed to next stage.",
      }));
      await Clue.insertMany(clueDocs);
    }

    return NextResponse.json({ success: true, data: quest }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

