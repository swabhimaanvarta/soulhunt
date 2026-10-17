import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Quest, Investigation, Clue } from "@/models";

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

    // Check if an investigation already exists
    let existing = await Investigation.findOne({
      questId: quest._id,
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

    const investigation = await Investigation.create({
      questId: quest._id,
      userId: isSquadInvestigation ? null : user._id,
      squadId: isSquadInvestigation ? user.squadId : null,
      isSquadInvestigation,
      currentStage: 1,
      progressPct: 0,
      participatingUserIds: [user._id],
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

