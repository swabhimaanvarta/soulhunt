import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Squad, SquadMember, User } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { apiError, apiServerError } from "@/lib/api-error";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return apiError("INVALID_SQUAD_ID", "Invalid squad identifier.", 400);
    }

    const user = await getCurrentUser();
    if (!user) {
      return apiError("UNAUTHORIZED", "Please sign in to join a squad.", 401);
    }

    if (user.squadId) {
      return apiError("ALREADY_IN_SQUAD", "You are already a member of a squad.", 400);
    }

    await connectDB();
    const squad = await Squad.findById(id);
    if (!squad) {
      return apiError("SQUAD_NOT_FOUND", "Squad not found", 404);
    }

    const memberCap = squad.memberCap || 8;
    const memberCount = await SquadMember.countDocuments({ squadId: squad._id });
    if (memberCount >= memberCap) {
      return apiError("SQUAD_FULL", `This squad is currently full (max ${memberCap} members).`, 400);
    }

    // Clash of Clans rule: Closed squads do not accept join attempts
    if (squad.joinType === "CLOSED" || squad.privacy === "PRIVATE") {
      return apiError(
        "SQUAD_CLOSED",
        "This squad is currently closed to new recruits. No new join requests are accepted.",
        403
      );
    }

    // Clash of Clans rule: Minimum level requirement
    const minLevel = squad.minLevelRequired || 1;
    const userLevel = user.level || 1;
    if (userLevel < minLevel) {
      return apiError(
        "MIN_LEVEL_NOT_MET",
        `This squad requires Hunter Level ${minLevel} or higher to join (current: Level ${userLevel}). Complete more quests to qualify!`,
        400
      );
    }

    // Clash of Clans rule: Invite-only requires join request
    if (squad.joinType === "INVITE_ONLY" || squad.privacy === "INVITE_ONLY") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "REQUIRES_JOIN_REQUEST",
            message: "This squad is Invite Only. Please submit a join application for leadership review.",
          },
          requiresJoinRequest: true,
        },
        { status: 403 }
      );
    }

    await SquadMember.create({
      squadId: squad._id,
      userId: user._id,
      role: "MEMBER",
      squadRole: "MEMBER",
      joinedAt: new Date(),
    });

    await User.findByIdAndUpdate(user._id, { $set: { squadId: squad._id } });

    return NextResponse.json({ success: true, message: `Joined ${squad.name} successfully!` });
  } catch (error: any) {
    return apiServerError(error, "SQUAD_JOIN_FAILED", "Failed to join squad.");
  }
}

