import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Squad, SquadMember, Investigation, SquadJoinRequest, User } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { canEditSquadSettings, canTransferOrDisband, normalizeSquadRole } from "@/lib/squadPermissions";
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
    const user = await getCurrentUser();
    const isStaff = Boolean(user && (user.role === "ADMIN" || user.role === "MODERATOR"));

    const squad = await Squad.findById(id)
      .populate("leaderId", "displayName username avatarUrl department")
      .lean();

    if (!squad) {
      return apiError("SQUAD_NOT_FOUND", "Squad not found", 404);
    }

    const members = await SquadMember.find({ squadId: squad._id })
      .populate("userId", "displayName username avatarUrl level rankTitle trustTier xp")
      .sort({ contributedSquadXp: -1 })
      .lean();

    const currentMember = user
      ? members.find((m: any) => m.userId?._id?.toString() === user._id.toString())
      : null;

    const isMember = Boolean(currentMember);
    const viewerRole = currentMember ? normalizeSquadRole(currentMember.role || currentMember.squadRole) : null;
    const isLeader = viewerRole === "LEADER" || (user && squad.leaderId?._id?.toString() === user._id.toString());

    // Check if user has an existing join request
    let myJoinRequest = null;
    if (user && !isMember) {
      let existingReq = await SquadJoinRequest.findOne({
        squadId: squad._id,
        userId: user._id,
        status: "PENDING",
      }).lean();

      if (!existingReq) {
        existingReq = await SquadJoinRequest.findOne({
          squadId: squad._id,
          userId: user._id,
        })
          .sort({ createdAt: -1 })
          .lean();
      }

      if (existingReq) {
        myJoinRequest = {
          _id: existingReq._id.toString(),
          status: existingReq.status,
          createdAt: existingReq.createdAt,
          message: existingReq.message,
        };
      }
    }

    // Privacy boundary: Private / invite-only squads must NOT reveal roster or internal investigations to nonmembers
    const isPrivate = squad.privacy === "PRIVATE" || squad.privacy === "INVITE_ONLY";
    const canViewInternal = !isPrivate || isMember || isStaff;

    let activeInvestigations: any[] = [];
    if (canViewInternal) {
      activeInvestigations = await Investigation.find({
        squadId: squad._id,
        status: { $in: ["IN_PROGRESS", "READY_FOR_RECOVERY"] },
      })
        .populate("questId", "questCode title xpReward coinReward difficulty")
        .limit(10)
        .lean();
    }

    return NextResponse.json({
      success: true,
      data: {
        squad: {
          ...squad,
          memberCount: members.length,
        },
        members: canViewInternal
          ? members.map((m: any) => ({
              ...m,
              role: normalizeSquadRole(m.role || m.squadRole),
            }))
          : [],
        memberCount: members.length,
        activeInvestigations,
        isMember,
        isLeader,
        viewerRole,
        myJoinRequest,
        canViewInternal,
      },
    });
  } catch (error: any) {
    return apiServerError(error, "SQUAD_FETCH_FAILED", "Failed to retrieve squad details.");
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

    await connectDB();
    const squad = await Squad.findById(id);
    if (!squad) {
      return apiError("SQUAD_NOT_FOUND", "Squad not found", 404);
    }

    const currentMember = await SquadMember.findOne({ squadId: squad._id, userId: user._id });
    const userRole = currentMember ? normalizeSquadRole(currentMember.role || currentMember.squadRole) : null;

    // Leader or CoLeader can edit squad settings
    if (!userRole || !canEditSquadSettings(userRole)) {
      return apiError("FORBIDDEN", "Only Leader or CoLeader can edit squad settings.", 403);
    }

    const body = await req.json().catch(() => ({}));
    const previousState = {
      name: squad.name,
      description: squad.description,
      privacy: squad.privacy,
      tags: squad.tags,
    };

    if (body.description !== undefined) squad.description = String(body.description).slice(0, 300).trim();
    if (body.emblemIcon) squad.emblemIcon = String(body.emblemIcon);
    if (body.bannerGradient) squad.bannerGradient = String(body.bannerGradient);
    if (body.joinType && ["OPEN", "INVITE_ONLY", "CLOSED"].includes(body.joinType)) {
      squad.joinType = body.joinType;
      squad.privacy = body.joinType === "OPEN" ? "PUBLIC" : body.joinType === "INVITE_ONLY" ? "INVITE_ONLY" : "PRIVATE";
    } else if (body.privacy && ["PUBLIC", "PRIVATE", "INVITE_ONLY"].includes(body.privacy)) {
      squad.privacy = body.privacy;
      squad.joinType = body.privacy === "PUBLIC" ? "OPEN" : body.privacy === "INVITE_ONLY" ? "INVITE_ONLY" : "CLOSED";
    }
    if (body.minLevelRequired !== undefined) {
      squad.minLevelRequired = Math.max(1, Math.min(10, Number(body.minLevelRequired) || 1));
    }
    if (Array.isArray(body.tags)) {
      squad.tags = body.tags.slice(0, 6).map((t: string) => String(t).slice(0, 30).trim());
    }

    await squad.save();

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "SQUAD_UPDATED",
      targetType: "SQUAD",
      targetId: squad._id,
      targetLabel: squad.name,
      reason: body.reason || "Squad settings updated by leadership",
      beforeState: previousState,
      afterState: {
        name: squad.name,
        description: squad.description,
        privacy: squad.privacy,
        tags: squad.tags,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Squad settings updated successfully.",
      data: squad,
    });
  } catch (error: any) {
    return apiServerError(error, "SQUAD_UPDATE_FAILED", "Failed to update squad settings.");
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

    await connectDB();
    const squad = await Squad.findById(id);
    if (!squad) {
      return apiError("SQUAD_NOT_FOUND", "Squad not found", 404);
    }

    const currentMember = await SquadMember.findOne({ squadId: squad._id, userId: user._id });
    const userRole = currentMember ? normalizeSquadRole(currentMember.role || currentMember.squadRole) : null;
    const isLeader = userRole === "LEADER" || squad.leaderId?.toString() === user._id.toString();

    // Guardrail: Only Leader can disband
    if (!isLeader || !userRole || !canTransferOrDisband(userRole)) {
      return apiError("FORBIDDEN", "Only the squad Leader can disband the squad.", 403);
    }

    // Guardrail: Sole leader cannot disband a squad with active members without transferring leadership first
    const otherMembersCount = await SquadMember.countDocuments({
      squadId: squad._id,
      userId: { $ne: user._id },
    });

    if (otherMembersCount > 0) {
      return apiError(
        "LEADER_CANNOT_DISBAND",
        "Sole leader cannot disband squad while other active members remain. You must remove members or transfer leadership first.",
        400
      );
    }

    // Delete members, join requests, and squad
    await SquadMember.deleteMany({ squadId: squad._id });
    await SquadJoinRequest.deleteMany({ squadId: squad._id });
    await User.findByIdAndUpdate(user._id, { $unset: { squadId: 1 } });
    await Squad.deleteOne({ _id: squad._id });

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "SQUAD_DISBANDED",
      targetType: "SQUAD",
      targetId: squad._id,
      targetLabel: squad.name,
      reason: "Sole leader disbanded the squad.",
    });

    return NextResponse.json({
      success: true,
      message: `Squad ${squad.name} successfully disbanded.`,
    });
  } catch (error: any) {
    return apiServerError(error, "SQUAD_DISBAND_FAILED", "Failed to disband squad.");
  }
}
