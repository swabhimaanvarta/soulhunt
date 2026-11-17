import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Squad, SquadMember, Investigation, SquadHuntRecord } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { apiError, apiServerError } from "@/lib/api-error";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return apiError("INVALID_SQUAD_ID", "Invalid squad identifier.", 400);
    }

    await connectDB();

    const squad = await Squad.findById(id).lean();
    if (!squad) {
      return apiError("SQUAD_NOT_FOUND", "Squad not found.", 404);
    }

    const user = await getCurrentUser();
    const isStaff = Boolean(user && (user.role === "ADMIN" || user.role === "MODERATOR"));

    let isMember = false;
    if (user) {
      const memberRecord = await SquadMember.findOne({
        squadId: squad._id,
        userId: user._id,
      }).lean();
      isMember = Boolean(memberRecord);
    }

    // Privacy boundary: Private / invite-only squads require active membership or staff status
    const isPrivate = squad.privacy === "PRIVATE" || squad.privacy === "INVITE_ONLY";
    if (isPrivate && !isMember && !isStaff) {
      return apiError(
        "FORBIDDEN",
        "This squad is private. Tactical raid records are restricted to active syndicate operatives.",
        403
      );
    }

    // 1. Query active raids currently in progress or awaiting recovery
    const activeHunts = await Investigation.find({
      squadId: squad._id,
      status: { $in: ["IN_PROGRESS", "READY_FOR_RECOVERY"] },
    })
      .populate(
        "questId",
        "questCode title xpReward coinReward trophyReward squadXpReward difficulty targetLocationId"
      )
      .populate("participatingUserIds", "displayName username avatarUrl")
      .sort({ updatedAt: -1 })
      .lean();

    // 2. Query persistent history logs of completed raids
    const pastHunts = await SquadHuntRecord.find({ squadId: squad._id })
      .sort({ completedAt: -1 })
      .limit(30)
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        activeHunts,
        pastHunts,
      },
    });
  } catch (err) {
    return apiServerError(
      err,
      "SQUAD_HUNTS_FETCH_FAILED",
      "Failed to retrieve squad hunts."
    );
  }
}
