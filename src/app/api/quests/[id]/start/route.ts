import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Quest, Investigation, Clue, SquadMember } from "@/models";
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

    const isSquadInvestigation = Boolean(asSquad);

    if (isSquadInvestigation) {
      // Squad Membership Enforcement: Validate user has squadId and active SquadMember record
      if (!user.squadId) {
        return NextResponse.json(
          {
            success: false,
            error: "You must belong to a squad to launch a Squad Raid. Join or create a squad first.",
            code: "SQUAD_MEMBERSHIP_REQUIRED",
          },
          { status: 400 }
        );
      }

      const activeMember = await SquadMember.findOne({
        squadId: user.squadId,
        userId: user._id,
      });

      if (!activeMember) {
        return NextResponse.json(
          {
            success: false,
            error: "You must belong to a squad to launch a Squad Raid. Join or create a squad first.",
            code: "SQUAD_MEMBERSHIP_REQUIRED",
          },
          { status: 400 }
        );
      }

      // Check if squad already completed this quest
      const completed = await Investigation.findOne({
        questId: quest._id,
        squadId: user.squadId,
        isSquadInvestigation: true,
        status: "COMPLETED",
      });

      if (completed) {
        return NextResponse.json(
          {
            success: false,
            error: "Your squad has already completed this quest and claimed your rewards. Multiple submissions are not permitted.",
            code: "ALREADY_COMPLETED",
            data: { investigationId: completed._id, isCompleted: true },
          },
          { status: 400 }
        );
      }

      // Check if active raid exists for this squad
      const existing = await Investigation.findOne({
        questId: quest._id,
        squadId: user.squadId,
        isSquadInvestigation: true,
        status: { $in: ["IN_PROGRESS", "READY_FOR_RECOVERY", "PAUSED"] },
      });

      if (existing) {
        // Atomically register joining squad member into participatingUserIds
        await Investigation.findByIdAndUpdate(existing._id, {
          $addToSet: { participatingUserIds: user._id },
        });

        return NextResponse.json({
          success: true,
          data: { investigationId: existing._id },
          message: "Continuing existing squad raid.",
        });
      }

      // Fetch quest clues to generate shared squad question variants
      const clues = await Clue.find({ questId: quest._id })
        .select("+expectedAnswerNormalized +correctOptionId")
        .sort({ stageOrder: 1 })
        .lean();

      const stageVariants = createPlayerClueVariants(clues, {
        userId: user._id,
        squadId: user.squadId,
        isSquadInvestigation: true,
      });

      const investigation = await Investigation.create({
        questId: quest._id,
        userId: null,
        squadId: user.squadId,
        isSquadInvestigation: true,
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
          message: "Squad Raid launched! Investigation room initialized.",
        },
        { status: 201 }
      );
    } else {
      // Solo Recon (asSquad === false)
      // Strict Decoupling: check completion strictly against user's solo investigation
      const completed = await Investigation.findOne({
        questId: quest._id,
        userId: user._id,
        isSquadInvestigation: false,
        status: "COMPLETED",
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

      // Check if active solo investigation already exists
      const existing = await Investigation.findOne({
        questId: quest._id,
        userId: user._id,
        isSquadInvestigation: false,
        status: { $in: ["IN_PROGRESS", "READY_FOR_RECOVERY", "PAUSED"] },
      });

      if (existing) {
        return NextResponse.json({
          success: true,
          data: { investigationId: existing._id },
          message: "Continuing existing investigation room.",
        });
      }

      // Fetch quest clues to generate individual per-player question variants
      const clues = await Clue.find({ questId: quest._id })
        .select("+expectedAnswerNormalized +correctOptionId")
        .sort({ stageOrder: 1 })
        .lean();

      const stageVariants = createPlayerClueVariants(clues, {
        userId: user._id,
        squadId: null,
        isSquadInvestigation: false,
      });

      const investigation = await Investigation.create({
        questId: quest._id,
        userId: user._id,
        squadId: null,
        isSquadInvestigation: false,
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
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

