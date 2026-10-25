import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Investigation, Clue, User, Transaction, HintUnlock } from "@/models";

const HintRequestSchema = z.object({
  stageOrder: z.number().int().min(1).max(30).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ID", message: "Invalid investigation ID." } },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in to unlock hints." } },
        { status: 401 }
      );
    }

    let body = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is handled with default stage
    }

    const parsed = HintRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "Invalid stageOrder parameter. Must be a positive integer." },
        },
        { status: 400 }
      );
    }

    await connectDB();

    const investigation = await Investigation.findById(id);
    if (!investigation) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Investigation not found." } },
        { status: 404 }
      );
    }

    // Participation Guard: caller must be assigned investigator, squad member, or admin
    const callerIdStr = user._id.toString();
    const isOwner = investigation.userId?.toString() === callerIdStr;
    const isParticipant =
      isOwner ||
      (Array.isArray(investigation.participatingUserIds) &&
        investigation.participatingUserIds.some((p: any) => p.toString() === callerIdStr)) ||
      user.role === "ADMIN" ||
      user.role === "MODERATOR";

    if (!isParticipant) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "FORBIDDEN", message: "You are not a registered participant in this investigation." },
        },
        { status: 403 }
      );
    }

    const targetStage = parsed.data.stageOrder || investigation.currentStage;

    // Stage Progression Check: cannot buy hints for unreached future stages
    if (targetStage > investigation.currentStage) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "STAGE_LOCKED",
            message: `Stage ${targetStage} is not yet reached. Current investigation stage is ${investigation.currentStage}.`,
          },
        },
        { status: 400 }
      );
    }

    const clue = await Clue.findOne({
      questId: investigation.questId,
      stageOrder: targetStage,
    });

    if (!clue || !clue.hintText) {
      return NextResponse.json(
        { success: false, error: { code: "NO_HINT", message: "No tactical hint is registered for this clue stage." } },
        { status: 404 }
      );
    }

    // Free Idempotent Retrieval: if stage already unlocked in this investigation, return free
    const isAlreadyUnlocked = (investigation.unlockedHintStages || []).includes(targetStage);
    if (isAlreadyUnlocked) {
      const freshUser = await User.findById(user._id);
      return NextResponse.json({
        success: true,
        data: {
          hintText: clue.hintText,
          coinsRemaining: freshUser?.coins ?? user.coins,
          alreadyUnlocked: true,
        },
      });
    }

    const cost = clue.hintCoinCost || 10;

    // Atomic Debit with { coins: { $gte: cost } } guard to prevent negative balance under concurrency
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: user._id,
        coins: { $gte: cost },
      },
      {
        $inc: { coins: -cost },
      },
      { new: true }
    );

    if (!updatedUser) {
      const freshUser = await User.findById(user._id);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INSUFFICIENT_COINS",
            message: `Insufficient Hunter Coins. Unlocking this hint requires ${cost} coins (Available: ${freshUser?.coins ?? 0}).`,
          },
        },
        { status: 400 }
      );
    }

    // Record unlocked hint on investigation and HintUnlock collection
    await Investigation.findByIdAndUpdate(investigation._id, {
      $addToSet: { unlockedHintStages: targetStage },
    });

    try {
      await HintUnlock.create({
        investigationId: investigation._id,
        stageOrder: targetStage,
        questId: clue.questId,
        unlockedByUserId: user._id,
        coinCost: cost,
        unlockedAt: new Date(),
      });
    } catch {
      // Duplicate key is safe (shared unlock)
    }

    // Create immutable Transaction record with unique idempotencyKey
    await Transaction.create({
      userId: user._id,
      deltaCoins: -cost,
      deltaXp: 0,
      deltaTrust: 0,
      reason: `Unlocked Hint for Stage ${clue.stageOrder} (${clue.title})`,
      referenceType: "QUEST",
      referenceId: clue.questId,
      idempotencyKey: `HINT_${investigation._id}_${targetStage}`,
    });

    return NextResponse.json({
      success: true,
      data: {
        hintText: clue.hintText,
        coinsRemaining: updatedUser.coins,
        alreadyUnlocked: false,
      },
    });
  } catch (error: any) {
    console.error("[Hint Purchase Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "HINT_UNLOCK_FAILED", message: "Failed to unlock clue hint." },
      },
      { status: 500 }
    );
  }
}
