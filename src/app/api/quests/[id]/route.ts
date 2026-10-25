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
    const isStaff = Boolean(user && (user.role === "ADMIN" || user.role === "MODERATOR"));

    const rawQuest: any = await Quest.findById(id)
      .populate("targetLocationId", "name code zoneType coordinates isSafeDesk operatingHours")
      .populate(isStaff ? "linkedLostItemId" : "")
      .lean();

    if (!rawQuest) {
      return NextResponse.json(
        { success: false, error: { code: "QUEST_NOT_FOUND", message: "Quest not found." } },
        { status: 404 }
      );
    }

    let userInvestigation: any = null;
    if (user) {
      const userInvs = await Investigation.find({
        questId: rawQuest._id,
        $or: [
          { userId: user._id },
          ...(user.squadId ? [{ squadId: user.squadId }] : []),
          { participatingUserIds: user._id },
        ],
      })
        .sort({ updatedAt: -1 })
        .lean();

      userInvestigation = userInvs.find((i: any) => i.status === "COMPLETED") || userInvs[0] || null;
    }

    const isCompletedByUser = userInvestigation?.status === "COMPLETED";

    const canRevealLocation = isStaff || isCompletedByUser || (
      userInvestigation &&
      userInvestigation.currentStage >= (rawQuest.unlockLocationAtStage || 3)
    );

    const safeQuest: any = {
      _id: rawQuest._id,
      questCode: rawQuest.questCode,
      title: rawQuest.title,
      description: rawQuest.description,
      questType: rawQuest.questType,
      difficulty: rawQuest.difficulty,
      xpReward: rawQuest.xpReward,
      coinReward: rawQuest.coinReward,
      squadXpReward: rawQuest.squadXpReward,
      finderBonusXp: rawQuest.finderBonusXp,
      isLocationRestricted: rawQuest.isLocationRestricted,
      unlockLocationAtStage: rawQuest.unlockLocationAtStage,
      status: rawQuest.status,
      createdAt: rawQuest.createdAt,
      isCompletedByUser,
      userInvestigationStatus: userInvestigation?.status || "NOT_STARTED",
      userInvestigationId: userInvestigation?._id?.toString() || null,
      userProgressPct: userInvestigation?.progressPct || 0,
    };

    if (rawQuest.targetLocationId) {
      const loc: any = rawQuest.targetLocationId;
      safeQuest.targetLocationId = {
        _id: loc._id,
        name: loc.name,
        code: loc.code,
        zoneType: loc.zoneType,
        isSafeDesk: Boolean(loc.isSafeDesk),
        operatingHours: loc.operatingHours,
        ...(canRevealLocation && loc.coordinates ? { coordinates: loc.coordinates } : {}),
      };
    }

    if (canRevealLocation || isStaff) {
      safeQuest.restrictedRoomNote = rawQuest.restrictedRoomNote;
    } else {
      safeQuest.restrictedRoomNote = rawQuest.isLocationRestricted
        ? "Exact Lab/Room coordinates locked until clues solved"
        : "";
    }

    if (isStaff) {
      safeQuest.linkedLostItemId = rawQuest.linkedLostItemId;
      safeQuest.linkedFoundItemId = rawQuest.linkedFoundItemId;
      safeQuest.revisions = rawQuest.revisions;
    }

    let visibleClues: any[] = [];

    if (isStaff) {
      visibleClues = await Clue.find({ questId: rawQuest._id })
        .select("-expectedAnswerNormalized")
        .sort({ stageOrder: 1 })
        .populate("targetLocationId", "name code")
        .lean();
    } else if (userInvestigation) {
      const isCompleted = userInvestigation.status === "COMPLETED";
      const currentStage = isCompleted ? 999 : (userInvestigation.currentStage || 1);
      const unlockedHints = new Set(userInvestigation.unlockedHintStages || []);

      const eligibleClues = await Clue.find({
        questId: rawQuest._id,
        ...(isCompleted ? {} : { stageOrder: { $lte: currentStage } }),
      })
        .select("-expectedAnswerNormalized")
        .sort({ stageOrder: 1 })
        .populate("targetLocationId", "name code")
        .lean();

      visibleClues = eligibleClues.map((clue: any) => {
        const isSolved = isCompleted || clue.stageOrder < currentStage;
        const hasHintUnlocked = isCompleted || unlockedHints.has(clue.stageOrder);

        return {
          _id: clue._id,
          questId: clue.questId,
          stageOrder: clue.stageOrder,
          title: clue.title,
          clueText: clue.clueText,
          verificationType: clue.verificationType,
          hintCoinCost: clue.hintCoinCost,
          hintText: hasHintUnlocked ? clue.hintText : "",
          isHintUnlocked: hasHintUnlocked,
          unlockedBreadcrumbText: isSolved ? clue.unlockedBreadcrumbText : "",
          targetLocationId: canRevealLocation || isSolved ? clue.targetLocationId : undefined,
        };
      });
    } else {
      // Public / Non-participant briefing: only stage 1 prompt preview, zero hints/breadcrumbs/answers
      const stageOneClue = await Clue.findOne({
        questId: rawQuest._id,
        stageOrder: 1,
      })
        .select("stageOrder title clueText verificationType hintCoinCost")
        .lean();

      if (stageOneClue) {
        visibleClues = [
          {
            _id: stageOneClue._id,
            stageOrder: stageOneClue.stageOrder,
            title: stageOneClue.title,
            clueText: stageOneClue.clueText,
            verificationType: stageOneClue.verificationType,
            hintCoinCost: stageOneClue.hintCoinCost,
            hintText: "",
            isHintUnlocked: false,
            unlockedBreadcrumbText: "",
          },
        ];
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        quest: safeQuest,
        clues: visibleClues,
        investigation: userInvestigation,
        isStaff,
        isAuthenticated: Boolean(user),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "QUEST_FETCH_FAILED", message: "Failed to retrieve quest details." } },
      { status: 500 }
    );
  }
}

