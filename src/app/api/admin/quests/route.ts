import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Quest, Clue, CampusLocation } from "@/models";
import { canManageContent } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json({ success: false, error: "Content management permissions required." }, { status: 403 });
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";
    const questType = searchParams.get("questType") || "";
    const search = (searchParams.get("search") || "").trim().slice(0, 60).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));
    const skip = (page - 1) * limit;

    const query: any = {};
    if (status) query.status = status;
    if (questType) query.questType = questType;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { questCode: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const [quests, total] = await Promise.all([
      Quest.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("targetLocationId", "name code isSafeDesk")
        .lean(),
      Quest.countDocuments(query),
    ]);

    // Attach clue count for each quest
    const enriched = await Promise.all(
      quests.map(async (q: any) => {
        const clueCount = await Clue.countDocuments({ questId: q._id });
        return { ...q, clueCount };
      })
    );

    return NextResponse.json({
      success: true,
      data: enriched,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !canManageContent(user)) {
      return NextResponse.json({ success: false, error: "Content management permissions required." }, { status: 403 });
    }

    await connectDB();
    const body = await req.json();

    const {
      title,
      description,
      questType = "CAMPUS_TREASURE",
      difficulty = 3,
      targetLocationId,
      xpReward = 200,
      coinReward = 40,
      squadXpReward = 70,
      finderBonusXp = 25,
      maxCompletions = 1,
      status = "DRAFT", // Default to DRAFT for safe workflow
      clues = [],
    } = body;

    if (!title || !description || !targetLocationId) {
      return NextResponse.json(
        { success: false, error: "Title, description, and target location are required." },
        { status: 400 }
      );
    }

    // Verify location
    const location = await CampusLocation.findById(targetLocationId);
    if (!location) {
      return NextResponse.json({ success: false, error: "Target location not found." }, { status: 400 });
    }

    const questCode = `Q-${questType.slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`;

    const quest = await Quest.create({
      questCode,
      title: title.trim(),
      description: description.trim(),
      questType,
      difficulty: Number(difficulty),
      targetLocationId,
      xpReward: Number(xpReward),
      coinReward: Number(coinReward),
      squadXpReward: Number(squadXpReward),
      finderBonusXp: Number(finderBonusXp),
      maxCompletions: Number(maxCompletions),
      status: ["DRAFT", "ACTIVE"].includes(status) ? status : "DRAFT",
      generationSource: "ADMIN",
      revisions: [
        {
          editedBy: user._id,
          editedByName: user.displayName,
          note: `Initial quest creation (${status})`,
          timestamp: new Date(),
        },
      ],
    });

    // Create clues if provided
    if (Array.isArray(clues) && clues.length > 0) {
      for (let i = 0; i < clues.length; i++) {
        const c = clues[i];
        await Clue.create({
          questId: quest._id,
          stageOrder: i + 1,
          title: c.title || `Stage ${i + 1}`,
          clueText: c.clueText || "Follow the clue trail.",
          verificationType: c.verificationType || "TEXT_RIDDLE",
          expectedAnswerNormalized: (c.expectedAnswer || "solve").trim().toLowerCase(),
          hintText: c.hintText || "",
          hintCoinCost: Number(c.hintCoinCost || 10),
          unlockedBreadcrumbText: c.unlockedBreadcrumbText || "",
        });
      }
    }

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: status === "ACTIVE" ? "QUEST_PUBLISHED" : "QUEST_DRAFT_CREATED",
      targetType: "QUEST",
      targetId: quest._id,
      targetLabel: quest.title,
      reason: `Created quest "${quest.title}" (${status}) with ${clues.length} clue stages.`,
      afterState: { questCode, title, status, cluesCount: clues.length },
    });

    return NextResponse.json({
      success: true,
      message: `Quest "${quest.title}" successfully created (${quest.status}).`,
      data: quest,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

