import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Clue, Investigation, Quest, SystemConfig, User, Notification } from "@/models";
import { normalizeClueAnswer } from "@/lib/privacy";
import { recordDailyQuestAction } from "@/lib/dailyQuests";

const SolveClueSchema = z.object({
  stageOrder: z.number().int().min(1),
  submittedAnswer: z.string().min(1),
  investigationId: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please sign in." } },
        { status: 401 }
      );
    }

    const { id: questId } = await context.params;
    const body = await req.json();
    const parsed = SolveClueSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "Invalid clue payload." } },
        { status: 400 }
      );
    }

    await connectDB();
    const { stageOrder, submittedAnswer, investigationId } = parsed.data;

    const quest = await Quest.findById(questId);
    if (!quest || quest.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, error: { code: "QUEST_INACTIVE", message: "Quest is not active." } },
        { status: 404 }
      );
    }

    const investigation = investigationId
      ? await Investigation.findById(investigationId).select(
          "+stageVariants.customExpectedAnswer +stageVariants.acceptableAnswers +stageVariants.explanation"
        )
      : await Investigation.findOne({
          questId: quest._id,
          $or: [
            { userId: user._id },
            { participatingUserIds: user._id },
            ...(user.squadId ? [{ squadId: user.squadId }] : []),
          ],
        }).select(
          "+stageVariants.customExpectedAnswer +stageVariants.acceptableAnswers +stageVariants.explanation"
        );

    if (!investigation || investigation.questId.toString() !== quest._id.toString()) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_ACCEPTED", message: "Accept this quest before solving clues." },
        },
        { status: 400 }
      );
    }

    const callerIdStr = user._id.toString();
    const isOwner = investigation.userId?.toString() === callerIdStr;
    const isSquadMember = Boolean(
      investigation.squadId &&
      user.squadId &&
      investigation.squadId.toString() === user.squadId.toString()
    );
    const isParticipant =
      isOwner ||
      isSquadMember ||
      (Array.isArray(investigation.participatingUserIds) &&
        investigation.participatingUserIds.some((p: any) => p.toString() === callerIdStr)) ||
      user.role === "ADMIN" ||
      user.role === "MODERATOR";

    if (!isParticipant) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You are not authorized to solve clues for this investigation.",
          },
        },
        { status: 403 }
      );
    }

    if (investigation.cooldownUntil && investigation.cooldownUntil > new Date()) {
      const waitSeconds = Math.ceil(
        (investigation.cooldownUntil.getTime() - Date.now()) / 1000
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "COOLDOWN_ACTIVE",
            message: `Too many wrong attempts. Try again in ${waitSeconds}s.`,
          },
        },
        { status: 429 }
      );
    }

    if (stageOrder !== investigation.currentStage) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "STAGE_LOCKED",
            message: `You must solve Stage ${investigation.currentStage} first.`,
          },
        },
        { status: 400 }
      );
    }

    const clue = await Clue.findOne({ questId: quest._id, stageOrder }).select(
      "+expectedAnswerNormalized"
    );

    if (!clue) {
      return NextResponse.json(
        { success: false, error: { code: "CLUE_NOT_FOUND", message: "Clue not found." } },
        { status: 404 }
      );
    }

    const playerVariant = investigation.stageVariants?.find(
      (v: any) => v.stageOrder === stageOrder
    );

    let isCorrect = false;
    let explanationText = clue.explanation || clue.unlockedBreadcrumbText;
    const normalizedInput = normalizeClueAnswer(submittedAnswer);

    if (playerVariant && playerVariant.customExpectedAnswer) {
      // 1. Personalized / Squad Variant Evaluation:
      // Grade STRICTLY against this variant's custom expected answer and variant-specific acceptable answers.
      // NEVER fall back to the clue's shared acceptableAnswers or base expectedAnswer to prevent answer copying.
      const expectedNormalized = playerVariant.customExpectedAnswer;
      if (playerVariant.explanation) {
        explanationText = playerVariant.explanation;
      }

      isCorrect = normalizedInput === normalizeClueAnswer(expectedNormalized);

      const variantAcceptables = Array.isArray((playerVariant as any).acceptableAnswers)
        ? (playerVariant as any).acceptableAnswers
        : [];
      if (!isCorrect && variantAcceptables.length > 0) {
        isCorrect = variantAcceptables.some(
          (acc: string) => normalizeClueAnswer(acc) === normalizedInput
        );
      }

      const variantTolerance =
        typeof (playerVariant as any).numericTolerance === "number"
          ? (playerVariant as any).numericTolerance
          : clue.numericTolerance || 0;

      if (!isCorrect && variantTolerance > 0) {
        const numSubmitted = parseFloat(submittedAnswer);
        const numExpected = parseFloat(expectedNormalized);
        if (!isNaN(numSubmitted) && !isNaN(numExpected)) {
          isCorrect = Math.abs(numSubmitted - numExpected) <= variantTolerance;
        }
      }
    } else {
      // 2. Base Clue Evaluation (when no personalized variant exists):
      const expectedNormalized = clue.expectedAnswerNormalized;
      const acceptableList = clue.acceptableAnswers || [];
      const tolerance = clue.numericTolerance || 0;

      isCorrect = normalizedInput === normalizeClueAnswer(expectedNormalized);

      if (!isCorrect && Array.isArray(acceptableList) && acceptableList.length > 0) {
        isCorrect = acceptableList.some(
          (acc: string) => normalizeClueAnswer(acc) === normalizedInput
        );
      }

      if (!isCorrect && tolerance > 0) {
        const numSubmitted = parseFloat(submittedAnswer);
        const numExpected = parseFloat(expectedNormalized);
        if (!isNaN(numSubmitted) && !isNaN(numExpected)) {
          isCorrect = Math.abs(numSubmitted - numExpected) <= tolerance;
        }
      }
    }

    if (!isCorrect) {
      const config = await SystemConfig.findOne({ key: "GLOBAL_CONFIG" });
      const cooldownSchedule = config?.clueCooldownSeconds ?? [30, 120, 300];
      const attemptIdx = Math.min(
        investigation.failedAttemptsCount,
        cooldownSchedule.length - 1
      );
      const cooldownSec = cooldownSchedule[attemptIdx];

      investigation.failedAttemptsCount += 1;
      investigation.cooldownUntil = new Date(Date.now() + cooldownSec * 1000);
      await investigation.save();

      return NextResponse.json(
        {
          success: false,
          error: {
            code: "WRONG_ANSWER",
            message: `Deduction mismatch! Cooldown active for ${cooldownSec} seconds.`,
          },
        },
        { status: 400 }
      );
    }

    const totalCluesCount = await Clue.countDocuments({ questId: quest._id });
    const isLastStage = stageOrder >= totalCluesCount;
    const nextStage = isLastStage ? totalCluesCount + 1 : stageOrder + 1;
    const nextStatus = isLastStage ? "READY_FOR_RECOVERY" : "IN_PROGRESS";
    const nextProgressPct = isLastStage ? 90 : Math.round((stageOrder / (totalCluesCount + 1)) * 100);

    const updated = await Investigation.findOneAndUpdate(
      {
        _id: investigation._id,
        currentStage: stageOrder, // Optimistic concurrency lock
      },
      {
        $set: {
          currentStage: nextStage,
          progressPct: nextProgressPct,
          status: nextStatus,
          failedAttemptsCount: 0,
          cooldownUntil: null,
        },
        $push: {
          solvedClues: {
            clueId: clue._id as Types.ObjectId,
            stageOrder,
            solvedByUserId: user._id as Types.ObjectId,
            solvedByName: user.displayName,
            usedHint: false,
            solvedAt: new Date(),
          },
        },
        $addToSet: { participatingUserIds: user._id },
      },
      { new: true }
    );

    if (!updated) {
      // Concurrently solved by a teammate
      const latest = await Investigation.findById(investigation._id);
      return NextResponse.json({
        success: true,
        data: {
          alreadySolved: true,
          stageSolved: stageOrder,
          unlockedBreadcrumb: clue.unlockedBreadcrumbText,
          explanation: explanationText,
          nextStage: latest?.currentStage || (stageOrder + 1),
          progressPct: latest?.progressPct || 90,
          status: latest?.status || "IN_PROGRESS",
          message: "This stage was just solved by your squad mate! Advancing...",
        },
      });
    }

    await User.findByIdAndUpdate(user._id, {
      $inc: { "stats.cluesSolved": 1 },
    });

    await recordDailyQuestAction(user._id.toString(), "SOLVE_CLUE").catch((err) => {
      console.error("[DailyQuest] Failed to record clue solve:", err);
    });

    if (updated.isSquadInvestigation && updated.squadId) {
      for (const teammateId of updated.participatingUserIds) {
        if (teammateId.toString() !== user._id.toString()) {
          await Notification.create({
            userId: teammateId,
            category: "QUEST_SQUAD",
            title: `Clue #${stageOrder} Solved by ${user.displayName}!`,
            message: `${quest.questCode}: "${clue.unlockedBreadcrumbText}" is now unlocked on your Squad Board.`,
            linkUrl: `/investigations/${updated._id}`,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        stageSolved: stageOrder,
        unlockedBreadcrumb: clue.unlockedBreadcrumbText,
        explanation: explanationText,
        nextStage: updated.currentStage,
        progressPct: updated.progressPct,
        status: updated.status,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: error.message || "Error solving clue" },
      },
      { status: 500 }
    );
  }
}
