import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Clue, Investigation, Quest, SystemConfig, User, Notification } from "@/models";
import { normalizeClueAnswer } from "@/lib/privacy";

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
      ? await Investigation.findById(investigationId).select("+stageVariants.customExpectedAnswer")
      : await Investigation.findOne({
          questId: quest._id,
          $or: [{ userId: user._id }, { squadId: user.squadId }],
        }).select("+stageVariants.customExpectedAnswer");

    if (!investigation) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NOT_ACCEPTED", message: "Accept this quest before solving clues." },
        },
        { status: 400 }
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

    let expectedNormalized = clue.expectedAnswerNormalized;
    let acceptableList = clue.acceptableAnswers || [];
    let tolerance = clue.numericTolerance || 0;
    let explanationText = clue.explanation || clue.unlockedBreadcrumbText;

    const playerVariant = investigation.stageVariants?.find(
      (v: any) => v.stageOrder === stageOrder
    );

    if (playerVariant?.customExpectedAnswer) {
      expectedNormalized = playerVariant.customExpectedAnswer;
      if (playerVariant.explanation) {
        explanationText = playerVariant.explanation;
      }
    }

    const normalizedInput = normalizeClueAnswer(submittedAnswer);
    let isCorrect = normalizedInput === normalizeClueAnswer(expectedNormalized);

    if (!isCorrect && Array.isArray(acceptableList) && acceptableList.length > 0) {
      isCorrect = acceptableList.some((acc: string) => normalizeClueAnswer(acc) === normalizedInput);
    }

    if (!isCorrect && tolerance > 0) {
      const numSubmitted = parseFloat(submittedAnswer);
      const numExpected = parseFloat(expectedNormalized);
      if (!isNaN(numSubmitted) && !isNaN(numExpected)) {
        isCorrect = Math.abs(numSubmitted - numExpected) <= tolerance;
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
    investigation.failedAttemptsCount = 0;
    investigation.cooldownUntil = null;

    investigation.solvedClues.push({
      clueId: clue._id as Types.ObjectId,
      stageOrder,
      solvedByUserId: user._id as Types.ObjectId,
      solvedByName: user.displayName,
      usedHint: false,
      solvedAt: new Date(),
    });

    if (
      !investigation.participatingUserIds.some(
        (id) => id.toString() === user._id.toString()
      )
    ) {
      investigation.participatingUserIds.push(user._id as Types.ObjectId);
    }

    const solvedCount = investigation.solvedClues.length;
    if (solvedCount >= totalCluesCount) {
      investigation.currentStage = totalCluesCount + 1;
      investigation.progressPct = 90;
      investigation.status = "READY_FOR_RECOVERY";
    } else {
      investigation.currentStage = stageOrder + 1;
      investigation.progressPct = Math.round((solvedCount / (totalCluesCount + 1)) * 100);
    }

    await investigation.save();

    await User.findByIdAndUpdate(user._id, {
      $inc: { "stats.cluesSolved": 1 },
    });

    if (investigation.isSquadInvestigation && investigation.squadId) {
      for (const teammateId of investigation.participatingUserIds) {
        if (teammateId.toString() !== user._id.toString()) {
          await Notification.create({
            userId: teammateId,
            category: "QUEST_SQUAD",
            title: `Clue #${stageOrder} Solved by ${user.displayName}!`,
            message: `${quest.questCode}: "${clue.unlockedBreadcrumbText}" is now unlocked on your Squad Board.`,
            linkUrl: `/investigations/${investigation._id}`,
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
        nextStage: investigation.currentStage,
        progressPct: investigation.progressPct,
        status: investigation.status,
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
