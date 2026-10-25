import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Squad, SquadMember, SquadMessage } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { normalizeSquadRole, canModerateMessages } from "@/lib/squadPermissions";
import { logAuditEvent } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rateLimit";
import { apiError, apiServerError } from "@/lib/api-error";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const { id, messageId } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return apiError("INVALID_SQUAD_ID", "Invalid squad identifier.", 400);
    }
    if (!Types.ObjectId.isValid(messageId)) {
      return apiError("INVALID_MESSAGE_ID", "Invalid message identifier.", 400);
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

    const member = await SquadMember.findOne({ squadId: squad._id, userId: user._id });
    const isStaff = user.role === "ADMIN" || user.role === "MODERATOR";
    const userRole = member ? normalizeSquadRole(member.role || member.squadRole) : null;

    if (!isStaff && (!userRole || !canModerateMessages(userRole))) {
      return apiError(
        "FORBIDDEN",
        "Only Leader, CoLeader, or Elder can moderate chat messages.",
        403
      );
    }

    const message = await SquadMessage.findOne({ _id: messageId, squadId: squad._id });
    if (!message) {
      return apiError("MESSAGE_NOT_FOUND", "Message not found.", 404);
    }

    if (message.moderationState === "REMOVED") {
      return NextResponse.json({
        success: true,
        message: "Message is already moderated and replaced with tombstone.",
        data: {
          _id: message._id,
          moderationState: message.moderationState,
          text: message.text,
        },
      });
    }

    const body = await req.json().catch(() => ({}));
    const reason = (body && typeof body === "object" && typeof body.reason === "string" ? body.reason : "Removed by squad leadership").slice(0, 200);

    // Replace with standard tombstone without copying original body into audit
    message.moderationState = "REMOVED";
    message.text = "[This message was removed by squad leadership]";
    message.moderatedBy = user._id;
    message.moderationReason = reason;
    await message.save();

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "SQUAD_MESSAGE_REMOVED",
      targetType: "SQUAD",
      targetId: squad._id,
      targetLabel: squad.name,
      reason,
      // Privacy safeguard: do not store removed message text in audit log
      beforeState: { messageId, senderId: message.senderId },
      afterState: { moderationState: "REMOVED" },
    });

    return NextResponse.json({
      success: true,
      message: "Message successfully moderated and replaced with tombstone.",
      data: {
        _id: message._id,
        moderationState: message.moderationState,
        text: message.text,
      },
    });
  } catch (error: any) {
    return apiServerError(error, "MESSAGE_REMOVE_FAILED", "Failed to remove squad message.");
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; messageId: string }> }
) {
  try {
    const { id, messageId } = await params;
    if (!Types.ObjectId.isValid(id)) {
      return apiError("INVALID_SQUAD_ID", "Invalid squad identifier.", 400);
    }
    if (!Types.ObjectId.isValid(messageId)) {
      return apiError("INVALID_MESSAGE_ID", "Invalid message identifier.", 400);
    }

    const user = await getCurrentUser();
    if (!user) {
      return apiError("UNAUTHORIZED", "Authentication required", 401);
    }

    // Rate limit reporting
    const limit = await checkRateLimit(`report_msg:${user._id}`, 5, 300);
    if (!limit.allowed) {
      return apiError(
        "RATE_LIMITED",
        "Too many message reports. Please wait before filing another report.",
        429
      );
    }

    await connectDB();
    const message = await SquadMessage.findOne({ _id: messageId, squadId: id });
    if (!message) {
      return apiError("MESSAGE_NOT_FOUND", "Message not found.", 404);
    }

    const body = await req.json().catch(() => ({}));
    const reason = (body && typeof body === "object" && typeof body.reason === "string" ? body.reason : "Flagged inappropriate message").slice(0, 200).trim();

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "SQUAD_MESSAGE_REPORTED",
      targetType: "SQUAD",
      targetId: message.squadId,
      targetLabel: `Message ${message._id}`,
      reason,
      beforeState: { messageId, senderId: message.senderId },
    });

    return NextResponse.json({
      success: true,
      message: "Report received. Squad leadership and moderators have been notified.",
    });
  } catch (error: any) {
    return apiServerError(error, "MESSAGE_REPORT_FAILED", "Failed to report squad message.");
  }
}
