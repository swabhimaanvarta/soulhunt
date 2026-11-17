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

    if (!rawQuest || (rawQuest.status === "DRAFT" && !isStaff)) {
      return NextResponse.json(
        { success: false, error: { code: "QUEST_NOT_FOUND", message: "Quest not found." } },
        { status: 404 }
      );
    }

    let userInvestigation: any = null;
    let soloInvestigation: any = null;
    let squadInvestigation: any = null;

    if (user) {
      soloInvestigation = await Investigation.findOne({
        questId: rawQuest._id,
        userId: user._id,
        isSquadInvestigation: false,
      })
        .sort({ updatedAt: -1 })
        .lean();

      if (user.squadId) {
        squadInvestigation = await Investigation.findOne({
          questId: rawQuest._id,
          squadId: user.squadId,
          isSquadInvestigation: true,
        })
          .sort({ updatedAt: -1 })
          .lean();
      }

      // Prioritize active solo room, then active squad room, then completed solo room
      if (
        soloInvestigation &&
        ["IN_PROGRESS", "READY_FOR_RECOVERY", "SUBMITTED_FOR_VERIFICATION"].includes(soloInvestigation.status)
      ) {
        userInvestigation = soloInvestigation;
      } else if (
        squadInvestigation &&
        ["IN_PROGRESS", "READY_FOR_RECOVERY", "SUBMITTED_FOR_VERIFICATION"].includes(squadInvestigation.status)
      ) {
        userInvestigation = squadInvestigation;
      } else if (soloInvestigation) {
        userInvestigation = soloInvestigation;
      } else if (squadInvestigation && squadInvestigation.status === "COMPLETED") {
        // Squad completed, but user has not started Solo Recon:
        // Keep userInvestigation null so the UI presents the "Start Solo Recon" action!
        userInvestigation = null;
      }
    }

    const isCompletedByUser = soloInvestigation?.status === "COMPLETED";
    const isCompletedBySquad = squadInvestigation?.status === "COMPLETED";

    const canRevealLocation = isStaff || isCompletedByUser || isCompletedBySquad || (
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
      isCompletedBySquad,
      userInvestigationStatus: userInvestigation?.status || (soloInvestigation?.status) || "NOT_STARTED",
      userInvestigationId: userInvestigation?._id?.toString() || null,
      userProgressPct: userInvestigation?.progressPct || 0,
      soloInvestigationStatus: soloInvestigation?.status || "NOT_STARTED",
      soloInvestigationId: soloInvestigation?._id?.toString() || null,
      squadInvestigationStatus: squadInvestigation?.status || "NOT_STARTED",
      squadInvestigationId: squadInvestigation?._id?.toString() || null,
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
        soloInvestigation,
        squadInvestigation,
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

