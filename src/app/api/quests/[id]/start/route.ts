import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Quest, Investigation, Clue } from "@/models";
import { createPlayerClueVariants } from "@/lib/game/variants";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Please log in to accept quests." }, { status: 401 });
    }

    const { asSquad } = await req.json().catch(() => ({ asSquad: false }));
    await connectDB();

    const quest = await Quest.findById(id);
    if (!quest || quest.status !== "ACTIVE") {
      return NextResponse.json({ success: false, error: "This quest is not active." }, { status: 400 });
    }

    const isSquadInvestigation = Boolean(asSquad && user.squadId);

    // 1. Strict single-entry guard: check if user or squad already completed this quest
    const completed = await Investigation.findOne({
      questId: quest._id,
      status: "COMPLETED",
      $or: [
        { userId: user._id },
        ...(user.squadId ? [{ squadId: user.squadId }] : []),
        { participatingUserIds: user._id },
      ],
    });

    if (completed) {
      return NextResponse.json(
        {
          success: false,
          error: "You have already completed this quest and claimed your rewards. Multiple submissions are not permitted.",
          code: "ALREADY_COMPLETED",
          data: { investigationId: completed._id, isCompleted: true },
        },
        { status: 400 }
      );
    }

    // 2. Check if an active/in-progress investigation already exists to resume
    let existing = await Investigation.findOne({
      questId: quest._id,
      status: { $in: ["IN_PROGRESS", "READY_FOR_RECOVERY", "PAUSED"] },
      ...(isSquadInvestigation
        ? { squadId: user.squadId }
        : { userId: user._id, isSquadInvestigation: false }),
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        data: { investigationId: existing._id },
        message: "Continuing existing investigation room.",
      });
    }

    // Fetch quest clues to generate per-player question variants
    const clues = await Clue.find({ questId: quest._id })
      .select("+expectedAnswerNormalized +correctOptionId")
      .sort({ stageOrder: 1 })
      .lean();

    const stageVariants = createPlayerClueVariants(clues, {
      userId: user._id,
      squadId: user.squadId,
      isSquadInvestigation,
    });

    const investigation = await Investigation.create({
      questId: quest._id,
      userId: isSquadInvestigation ? null : user._id,
      squadId: isSquadInvestigation ? user.squadId : null,
      isSquadInvestigation,
      currentStage: 1,
      progressPct: 0,
      participatingUserIds: [user._id],
      stageVariants,
      status: "IN_PROGRESS",
      startedAt: new Date(),
    });

    return NextResponse.json(
      {
        success: true,
        data: { investigationId: investigation._id },
        message: "Quest accepted! Investigation room initialized.",
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

