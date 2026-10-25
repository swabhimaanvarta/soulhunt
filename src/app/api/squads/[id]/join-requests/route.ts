import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Squad, SquadMember, SquadJoinRequest, User } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { canManageJoinRequests, normalizeSquadRole } from "@/lib/squadPermissions";
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

    if (!userRole || !canManageJoinRequests(userRole)) {
      return apiError(
        "FORBIDDEN",
        "Only Leader, CoLeader, or Elder can review join requests.",
        403
      );
    }

    const requests = await SquadJoinRequest.find({ squadId: squad._id, status: "PENDING" })
      .populate("userId", "displayName username avatarUrl level rankTitle trustTier department")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ success: true, data: requests });
  } catch (error: any) {
    return apiServerError(error, "JOIN_REQUESTS_FETCH_FAILED", "Failed to retrieve join requests.");
  }
}

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
      return apiError("UNAUTHORIZED", "Please log in to send a join request.", 401);
    }

    if (user.squadId) {
      return apiError(
        "ALREADY_IN_SQUAD",
        "You are already a member of a squad. Leave your current squad first.",
        400
      );
    }

    await connectDB();
    const squad = await Squad.findById(id);
    if (!squad) {
      return apiError("SQUAD_NOT_FOUND", "Squad not found", 404);
    }

    const memberCount = await SquadMember.countDocuments({ squadId: squad._id });
    const cap = squad.memberCap || 8;
    if (memberCount >= cap) {
      return apiError("SQUAD_FULL", `Squad is full (maximum ${cap} members).`, 400);
    }

    // Clash of Clans rule: Closed squads do not accept join requests
    if (squad.joinType === "CLOSED" || squad.privacy === "PRIVATE") {
      return apiError("SQUAD_CLOSED", "This squad is currently closed to new applications.", 403);
    }

    // Clash of Clans rule: Minimum level requirement
    const minLevel = squad.minLevelRequired || 1;
    const userLevel = user.level || 1;
    if (userLevel < minLevel) {
      return apiError(
        "MIN_LEVEL_NOT_MET",
        `This squad requires Hunter Level ${minLevel} or higher to apply (current: Level ${userLevel}).`,
        400
      );
    }

    // Check existing pending request
    const existing = await SquadJoinRequest.findOne({
      squadId: squad._id,
      userId: user._id,
      status: "PENDING",
    });

    if (existing) {
      return apiError(
        "REQUEST_PENDING",
        "You already have a pending join request for this squad.",
        409
      );
    }

    const body = await req.json().catch(() => ({}));
    const message = typeof body.message === "string" ? body.message.slice(0, 300).trim() : "";

    const joinRequest = await SquadJoinRequest.create({
      squadId: squad._id,
      userId: user._id,
      status: "PENDING",
      message,
    });

    return NextResponse.json(
      {
        success: true,
        message: `Join request submitted to ${squad.name}. Leadership will review your application.`,
        data: joinRequest,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.code === 11000) {
      return apiError(
        "REQUEST_PENDING",
        "You already have a pending join request for this squad.",
        409
      );
    }
    return apiServerError(error, "JOIN_REQUEST_CREATE_FAILED", "Failed to submit join request.");
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

    if (!userRole || !canManageJoinRequests(userRole)) {
      return apiError(
        "FORBIDDEN",
        "Only Leader, CoLeader, or Elder can accept or decline join requests.",
        403
      );
    }

    const body = await req.json().catch(() => ({}));
    const { requestId, action, decisionNote } = body;

    if (!requestId || !Types.ObjectId.isValid(requestId) || !["ACCEPT", "DECLINE"].includes(action)) {
      return apiError(
        "INVALID_INPUT",
        "Valid requestId and action ('ACCEPT' or 'DECLINE') are required.",
        400
      );
    }

    const joinReq = await SquadJoinRequest.findOne({
      _id: requestId,
      squadId: squad._id,
      status: "PENDING",
    });

    if (!joinReq) {
      return apiError("REQUEST_NOT_FOUND", "Join request not found or already processed.", 404);
    }

    if (action === "ACCEPT") {
      const memberCount = await SquadMember.countDocuments({ squadId: squad._id });
      const cap = squad.memberCap || 8;
      if (memberCount >= cap) {
        return apiError("SQUAD_FULL", `Squad has reached its member limit (${cap}).`, 400);
      }

      // Check if user already joined another squad
      const applicant = await User.findById(joinReq.userId);
      if (!applicant) {
        return apiError("USER_NOT_FOUND", "Applicant not found.", 404);
      }
      if (applicant.squadId) {
        joinReq.status = "DECLINED";
        joinReq.reviewedAt = new Date();
        joinReq.reviewedBy = user._id;
        joinReq.decisionNote = "User has already joined another squad.";
        await joinReq.save();
        return apiError("ALREADY_IN_SQUAD", "Applicant is already in another squad.", 400);
      }

      await SquadMember.create({
        squadId: squad._id,
        userId: joinReq.userId,
        role: "MEMBER",
        squadRole: "MEMBER",
        joinedAt: new Date(),
      });

      await User.findByIdAndUpdate(joinReq.userId, { $set: { squadId: squad._id } });

      joinReq.status = "ACCEPTED";
      joinReq.reviewedAt = new Date();
      joinReq.reviewedBy = user._id;
      joinReq.decisionNote = decisionNote || "Accepted by squad leadership";
      await joinReq.save();

      await logAuditEvent({
        actorId: user._id,
        actorName: user.displayName,
        actorRole: user.role,
        action: "SQUAD_JOIN_ACCEPTED",
        targetType: "SQUAD",
        targetId: squad._id,
        targetLabel: squad.name,
        reason: `Accepted join request for user ${applicant.username}`,
      });

      return NextResponse.json({
        success: true,
        message: `Accepted ${applicant.username} into ${squad.name}.`,
        data: joinReq,
      });
    } else {
      joinReq.status = "DECLINED";
      joinReq.reviewedAt = new Date();
      joinReq.reviewedBy = user._id;
      joinReq.decisionNote = decisionNote || "Declined by squad leadership";
      await joinReq.save();

      await logAuditEvent({
        actorId: user._id,
        actorName: user.displayName,
        actorRole: user.role,
        action: "SQUAD_JOIN_DECLINED",
        targetType: "SQUAD",
        targetId: squad._id,
        targetLabel: squad.name,
        reason: `Declined join request ${joinReq._id}`,
      });

      return NextResponse.json({
        success: true,
        message: "Join request declined.",
        data: joinReq,
      });
    }
  } catch (error: any) {
    return apiServerError(error, "JOIN_REQUEST_REVIEW_FAILED", "Failed to process join request.");
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
      return apiError("UNAUTHORIZED", "Please log in to withdraw your request.", 401);
    }
    await connectDB();
    const { searchParams } = new URL(req.url);
    let reqId = searchParams.get("requestId");
    if (!reqId) {
      try {
        const body = await req.json();
        if (body && typeof body === "object" && body.requestId) {
          reqId = String(body.requestId);
        }
      } catch {
        // Body was empty or non-JSON
      }
    }

    const query: any = {
      squadId: new Types.ObjectId(id),
      userId: user._id,
      status: "PENDING",
    };
    if (reqId && Types.ObjectId.isValid(reqId)) {
      query._id = new Types.ObjectId(reqId);
    }

    const joinReq = await SquadJoinRequest.findOne(query);

    if (!joinReq) {
      return apiError("REQUEST_NOT_FOUND", "No active pending join request found.", 404);
    }

    joinReq.status = "WITHDRAWN";
    await joinReq.save();

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "SQUAD_JOIN_WITHDRAWN",
      targetType: "SQUAD",
      targetId: new Types.ObjectId(id),
      targetLabel: "Join Request",
      reason: "Applicant voluntarily withdrew join request.",
    });

    return NextResponse.json({
      success: true,
      message: "Join request withdrawn successfully.",
      data: joinReq,
    });
  } catch (error: any) {
    return apiServerError(error, "JOIN_REQUEST_WITHDRAW_FAILED", "Failed to withdraw join request.");
  }
}

