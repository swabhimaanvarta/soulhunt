import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Squad, SquadMember, User } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { normalizeSquadRole } from "@/lib/squadPermissions";
import { logAuditEvent } from "@/lib/audit";
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
      return apiError("UNAUTHORIZED", "Please sign in.", 401);
    }

    await connectDB();
    const squad = await Squad.findById(id);
    if (!squad) {
      return apiError("SQUAD_NOT_FOUND", "Squad not found", 404);
    }

    const membership = await SquadMember.findOne({ squadId: squad._id, userId: user._id });
    if (!membership) {
      return apiError("NOT_A_MEMBER", "You are not a member of this squad.", 400);
    }

    const membershipRole = normalizeSquadRole(membership.role || membership.squadRole);
    const isLeader = membershipRole === "LEADER" || squad.leaderId.toString() === user._id.toString();
    const otherMembersCount = await SquadMember.countDocuments({
      squadId: squad._id,
      userId: { $ne: user._id },
    });

    // Enforce safety rule: Sole leader cannot leave/self-remove if squad has other active members
    if (isLeader && otherMembersCount > 0) {
      return apiError(
        "LEADER_CANNOT_LEAVE",
        "You are the squad Leader. You must transfer leadership to another member before leaving the squad.",
        400
      );
    }

    await SquadMember.deleteOne({ _id: membership._id });
    await User.findByIdAndUpdate(user._id, { $unset: { squadId: 1 } });

    // If sole leader and no other members, disband squad
    if (isLeader && otherMembersCount === 0) {
      await Squad.deleteOne({ _id: squad._id });
    }

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "SQUAD_LEFT",
      targetType: "SQUAD",
      targetId: squad._id,
      targetLabel: squad.name,
      reason: isLeader && otherMembersCount === 0 ? "Sole leader left; squad disbanded." : "Member voluntarily left squad.",
    });

    return NextResponse.json({ success: true, message: "Left squad successfully." });
  } catch (error: any) {
    return apiServerError(error, "SQUAD_LEAVE_FAILED", "Failed to leave squad.");
  }
}
