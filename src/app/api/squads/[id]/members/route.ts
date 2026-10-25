import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Squad, SquadMember, User } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import {
  normalizeSquadRole,
  ROLE_HIERARCHY,
  canRemoveSquadMember,
  canPromoteDemoteElder,
  canPromoteDemoteCoLeader,
  canTransferOrDisband,
} from "@/lib/squadPermissions";
import { logAuditEvent } from "@/lib/audit";
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
    const squad = await Squad.findById(id);
    if (!squad) {
      return apiError("SQUAD_NOT_FOUND", "Squad not found", 404);
    }

    const user = await getCurrentUser();
    const isStaff = Boolean(user && (user.role === "ADMIN" || user.role === "MODERATOR"));

    const members = await SquadMember.find({ squadId: squad._id })
      .populate("userId", "displayName username avatarUrl level rankTitle trustTier xp")
      .sort({ contributedSquadXp: -1 })
      .lean();

    const isMember = Boolean(
      user && members.some((m: any) => m.userId?._id?.toString() === user._id.toString())
    );

    const isPrivate = squad.privacy === "PRIVATE" || squad.privacy === "INVITE_ONLY";
    if (isPrivate && !isMember && !isStaff) {
      return apiError("FORBIDDEN", "Squad roster is restricted to squad operatives.", 403);
    }

    return NextResponse.json({
      success: true,
      data: members.map((m: any) => ({
        ...m,
        role: normalizeSquadRole(m.role || m.squadRole),
      })),
    });
  } catch (error: any) {
    return apiServerError(error, "SQUAD_MEMBERS_FETCH_FAILED", "Failed to retrieve squad members.");
  }
}

export async function DELETE(
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
      return apiError("UNAUTHORIZED", "Authentication required", 401);
    }

    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const memberId = body.memberId || searchParams.get("memberId");

    if (!memberId || !Types.ObjectId.isValid(memberId)) {
      return apiError("INVALID_MEMBER_ID", "Valid member identifier is required.", 400);
    }

    await connectDB();
    const squad = await Squad.findById(id);
    if (!squad) {
      return apiError("SQUAD_NOT_FOUND", "Squad not found", 404);
    }

    const actorMember = await SquadMember.findOne({ squadId: squad._id, userId: user._id });
    if (!actorMember) {
      return apiError("FORBIDDEN", "You are not a member of this squad.", 403);
    }
    const actorRole = normalizeSquadRole(actorMember.role || actorMember.squadRole);

    const targetMember = await SquadMember.findOne({
      squadId: squad._id,
      $or: [{ userId: memberId }, { _id: memberId }],
    }).populate("userId", "displayName username");

    if (!targetMember) {
      return apiError("MEMBER_NOT_FOUND", "Target member not found in squad.", 404);
    }
    const targetRole = normalizeSquadRole(targetMember.role || targetMember.squadRole);
    const targetUserId = (targetMember.userId as any)?._id || targetMember.userId;

    const isSoleLeader = targetRole === "LEADER" && squad.leaderId.toString() === targetUserId.toString();
    if (isSoleLeader) {
      return apiError("LEADER_CANNOT_BE_REMOVED", "Cannot remove the squad Leader. Transfer leadership first.", 400);
    }

    if (targetUserId.toString() === user._id.toString()) {
      return apiError("FORBIDDEN", "Self-removal via member removal is prohibited. Use the leave squad endpoint instead.", 403);
    }

    if (!canRemoveSquadMember(actorRole, targetRole, isSoleLeader)) {
      return apiError(
        "FORBIDDEN",
        `Insufficient rank: A ${actorRole} cannot remove a ${targetRole}. You may only remove lower-ranked members.`,
        403
      );
    }

    const reason = typeof body.reason === "string" ? body.reason.slice(0, 200) : "Removed by squad leadership";

    await SquadMember.deleteOne({ _id: targetMember._id });
    await User.findByIdAndUpdate(targetUserId, { $unset: { squadId: 1 } });

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "SQUAD_MEMBER_REMOVED",
      targetType: "SQUAD",
      targetId: squad._id,
      targetLabel: squad.name,
      reason,
      beforeState: { memberId: targetUserId, targetRole },
    });

    return NextResponse.json({
      success: true,
      message: `Member removed from ${squad.name}.`,
    });
  } catch (error: any) {
    return apiServerError(error, "SQUAD_MEMBER_REMOVE_FAILED", "Failed to remove squad member.");
  }
}

export async function PATCH(
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
      return apiError("UNAUTHORIZED", "Authentication required", 401);
    }

    const body = await req.json().catch(() => ({}));
    const { memberId, action, targetRole, confirmTransfer, recipientUsername, reason } = body;

    if (!memberId || !Types.ObjectId.isValid(memberId)) {
      return apiError("INVALID_MEMBER_ID", "Valid member identifier is required.", 400);
    }

    await connectDB();
    const squad = await Squad.findById(id);
    if (!squad) {
      return apiError("SQUAD_NOT_FOUND", "Squad not found", 404);
    }

    const actorMember = await SquadMember.findOne({ squadId: squad._id, userId: user._id });
    if (!actorMember) {
      return apiError("FORBIDDEN", "You are not a member of this squad.", 403);
    }

    const getEffectiveRole = (m: any) => {
      const r1 = normalizeSquadRole(m.squadRole);
      const r2 = normalizeSquadRole(m.role);
      return ROLE_HIERARCHY[r1] >= ROLE_HIERARCHY[r2] ? r1 : r2;
    };
    const actorRole = getEffectiveRole(actorMember);

    const targetMember = await SquadMember.findOne({
      squadId: squad._id,
      $or: [{ userId: memberId }, { _id: memberId }],
    }).populate("userId", "displayName username");

    if (!targetMember) {
      return apiError("MEMBER_NOT_FOUND", "Target member not found in squad.", 404);
    }
    const targetCurrentRole = getEffectiveRole(targetMember);

    // Leadership transfer
    if (action === "TRANSFER_LEADERSHIP") {
      if (!canTransferOrDisband(actorRole)) {
        return apiError("FORBIDDEN", "Only the squad Leader can transfer leadership.", 403);
      }

      if (!confirmTransfer) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "CONFIRMATION_REQUIRED",
              message: "Leadership transfer requires explicit confirmation.",
            },
            needsConfirmation: true,
          },
          { status: 400 }
        );
      }

      const targetUser = targetMember.userId as any;
      if (recipientUsername && targetUser?.username?.toLowerCase() !== recipientUsername.toLowerCase()) {
        return apiError("CONFIRMATION_MISMATCH", "Recipient username does not match confirmation.", 400);
      }

      actorMember.role = "COLEADER";
      actorMember.squadRole = "COLEADER";
      targetMember.role = "LEADER";
      targetMember.squadRole = "LEADER";
      squad.leaderId = targetMember.userId._id || targetMember.userId;

      await Promise.all([actorMember.save(), targetMember.save(), squad.save()]);

      await logAuditEvent({
        actorId: user._id,
        actorName: user.displayName,
        actorRole: user.role,
        action: "SQUAD_LEADERSHIP_TRANSFERRED",
        targetType: "SQUAD",
        targetId: squad._id,
        targetLabel: squad.name,
        reason: reason || `Transferred leadership to ${targetUser?.username}`,
      });

      return NextResponse.json({
        success: true,
        message: `Leadership successfully transferred to ${targetUser?.username || "new leader"}.`,
      });
    }

    // Role change (promote/demote)
    if (action === "CHANGE_ROLE") {
      const desiredRole = normalizeSquadRole(targetRole);

      if (desiredRole === "LEADER") {
        return apiError("INVALID_ACTION", "Use TRANSFER_LEADERSHIP to assign the LEADER role.", 400);
      }

      if (desiredRole === "COLEADER" || targetCurrentRole === "COLEADER") {
        if (!canPromoteDemoteCoLeader(actorRole)) {
          return apiError("FORBIDDEN", "Only the Leader can promote or demote CoLeaders.", 403);
        }
      }

      if (desiredRole === "ELDER" || targetCurrentRole === "ELDER") {
        if (!canPromoteDemoteElder(actorRole)) {
          return apiError("FORBIDDEN", "Only the Leader or CoLeader can promote or demote Elders.", 403);
        }
      }

      const targetUserId = (targetMember.userId as any)?._id || targetMember.userId;

      // Guardrail: Self-demotion is strictly prohibited
      if (targetUserId.toString() === user._id.toString()) {
        return apiError("FORBIDDEN", "Self-demotion is strictly prohibited. Use leadership transfer or leave squad instead.", 403);
      }

      // Guardrail: Cannot alter role of peer or higher-ranking member
      if (ROLE_HIERARCHY[actorRole] <= ROLE_HIERARCHY[targetCurrentRole]) {
        return apiError("FORBIDDEN", "You cannot modify the role of a peer or higher-ranking member.", 403);
      }

      const prevRole = targetMember.role;
      targetMember.role = desiredRole;
      targetMember.squadRole = desiredRole;
      await targetMember.save();

      await logAuditEvent({
        actorId: user._id,
        actorName: user.displayName,
        actorRole: user.role,
        action: "SQUAD_MEMBER_ROLE_CHANGED",
        targetType: "SQUAD",
        targetId: squad._id,
        targetLabel: squad.name,
        reason: reason || `Changed role from ${prevRole} to ${desiredRole}`,
      });

      return NextResponse.json({
        success: true,
        message: `Updated member role to ${desiredRole}.`,
        data: { memberId: targetMember._id, role: desiredRole },
      });
    }

    return apiError("INVALID_ACTION", "Invalid action requested.", 400);
  } catch (error: any) {
    return apiServerError(error, "SQUAD_MEMBER_UPDATE_FAILED", "Failed to update member role.");
  }
}
