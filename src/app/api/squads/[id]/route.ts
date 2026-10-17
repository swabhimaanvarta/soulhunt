import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Squad, SquadMember, Investigation } from "@/models";
import { getCurrentUser } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectDB();
    const user = await getCurrentUser();

    const squad = await Squad.findById(id)
      .populate("leaderId", "displayName username avatarUrl department")
      .lean();

    if (!squad) {
      return NextResponse.json({ success: false, error: "Squad not found" }, { status: 404 });
    }

    const members = await SquadMember.find({ squadId: squad._id })
      .populate("userId", "displayName username avatarUrl level rankTitle trustTier xp")
      .sort({ contributedSquadXp: -1 })
      .lean();

    const activeInvestigations = await Investigation.find({
      squadId: squad._id,
      status: { $in: ["IN_PROGRESS", "READY_FOR_RECOVERY"] },
    })
      .populate("questId", "questCode title xpReward coinReward difficulty")
      .limit(10)
      .lean();

    const isMember = user && members.some((m: any) => m.userId?._id?.toString() === user._id.toString());
    const isLeader = user && squad.leaderId?._id?.toString() === user._id.toString();

    return NextResponse.json({
      success: true,
      data: {
        squad,
        members,
        activeInvestigations,
        isMember,
        isLeader,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

