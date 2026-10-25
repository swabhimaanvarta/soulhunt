import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Squad, SquadMember, SquadMessage } from "@/models";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rateLimit";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { canModerateMessages, normalizeSquadRole } from "@/lib/squadPermissions";
import { logAuditEvent } from "@/lib/audit";
import { apiError, apiServerError } from "@/lib/api-error";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isFeatureEnabled("SQUAD_CHAT_ENABLED")) {
      return apiError("FEATURE_DISABLED", "Squad chat is temporarily disabled.", 403);
    }

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

    const isMember = await SquadMember.findOne({ squadId: squad._id, userId: user._id });
    const isStaff = user.role === "ADMIN" || user.role === "MODERATOR";

    if (!isMember && !isStaff) {
      return apiError(
        "FORBIDDEN",
        "You must be an active member of this squad to read chat messages.",
        403
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const before = searchParams.get("before"); // pagination cursor (timestamp or ID)
    const since = searchParams.get("since"); // polling cursor (get messages after timestamp)

    const query: any = {
      squadId: squad._id,
      expiresAt: { $gt: new Date() },
      moderationState: { $ne: "HIDDEN" },
    };

    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        query.createdAt = { $gt: sinceDate };
      }
    } else if (before) {
      const beforeDate = new Date(before);
      if (!isNaN(beforeDate.getTime())) {
        query.createdAt = { $lt: beforeDate };
      }
    }

    const messages = await SquadMessage.find(query)
      .populate("senderId", "displayName username avatarUrl rankTitle")
      .sort({ createdAt: since ? 1 : -1, _id: since ? 1 : -1 })
      .limit(limit)
      .lean();

    // In descending query (history), order chronologically
    const ordered = since ? messages : messages.reverse();
    const nextCursor = ordered.length > 0 ? (since ? ordered[ordered.length - 1].createdAt : ordered[0].createdAt) : null;

    return NextResponse.json({
      success: true,
      data: ordered,
      count: ordered.length,
      nextCursor,
      pageInfo: {
        nextCursor,
        hasMore: messages.length === limit,
        total: ordered.length,
      },
    });
  } catch (error: any) {
    return apiServerError(error, "MESSAGES_FETCH_FAILED", "Failed to retrieve chat messages.");
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let requestId: string | undefined;
  let squadIdStr: string | undefined;
  let userIdVal: any = undefined;
  try {
    if (!isFeatureEnabled("SQUAD_CHAT_ENABLED")) {
      return apiError("FEATURE_DISABLED", "Squad chat is temporarily disabled.", 403);
    }

    const { id } = await params;
    squadIdStr = id;
    if (!Types.ObjectId.isValid(id)) {
      return apiError("INVALID_SQUAD_ID", "Invalid squad identifier.", 400);
    }

    const user = await getCurrentUser();
    if (!user) {
      return apiError("UNAUTHORIZED", "Authentication required", 401);
    }
    userIdVal = user._id;

    await connectDB();
    const squad = await Squad.findById(id);
    if (!squad) {
      return apiError("SQUAD_NOT_FOUND", "Squad not found", 404);
    }

    const isMember = await SquadMember.findOne({ squadId: squad._id, userId: user._id });
    if (!isMember) {
      return apiError(
        "FORBIDDEN",
        "You must be an active member of this squad to send messages.",
        403
      );
    }

    const body = await req.json().catch(() => ({}));
    const rawText = (body && typeof body === "object" && typeof body.text === "string" ? body.text : "").trim();
    requestId = (body && typeof body === "object" && typeof body.requestId === "string" ? body.requestId.trim() : undefined) || undefined;

    // Idempotency check before rate limiting (replayed requests return existing message)
    if (requestId) {
      const existing = await SquadMessage.findOne({
        squadId: squad._id,
        senderId: user._id,
        requestId,
      }).populate("senderId", "displayName username avatarUrl rankTitle");

      if (existing) {
        return NextResponse.json({ success: true, data: existing, replayed: true });
      }
    }

    // Rate Limiting: 1 message per 2 seconds cooldown
    const cooldown = await checkRateLimit(`chat_cd:${user._id}`, 1, 2);
    if (!cooldown.allowed) {
      return apiError(
        "RATE_LIMITED",
        "Chat message cooldown. Please wait 2 seconds between messages.",
        429,
        requestId
      );
    }

    // Burst cap: 10 messages per minute
    const burst = await checkRateLimit(`chat_burst:${user._id}`, 10, 60);
    if (!burst.allowed) {
      return apiError(
        "RATE_LIMITED",
        "Chat burst rate limit exceeded. Max 10 messages per minute.",
        429,
        requestId
      );
    }

    if (!rawText) {
      return apiError("INVALID_INPUT", "Message text cannot be empty.", 400, requestId);
    }

    if (rawText.length > 1000) {
      return apiError(
        "MESSAGE_TOO_LONG",
        `Message exceeds maximum allowed length of 1,000 characters (actual: ${rawText.length}).`,
        400,
        requestId
      );
    }

    // Normalize whitespace & escape XSS
    const normalizedText = escapeHtml(rawText.replace(/\s+/g, " "));

    // 30 days retention
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const message = await SquadMessage.create({
      squadId: squad._id,
      senderId: user._id,
      text: normalizedText,
      moderationState: "VISIBLE",
      requestId: requestId || undefined,
      expiresAt,
      createdAt: now,
    });

    // Prune expired messages first for this squad to ensure they do not take up 500 cap slots
    await SquadMessage.deleteMany({
      squadId: squad._id,
      expiresAt: { $lte: now },
    });

    // Prune oldest messages beyond 500 cap using atomic boundary cutoff on unexpired messages
    const cutoff = await SquadMessage.find({ squadId: squad._id, expiresAt: { $gt: now } })
      .sort({ createdAt: -1, _id: -1 })
      .skip(499)
      .limit(1)
      .select("createdAt _id")
      .lean();

    if (cutoff.length > 0) {
      const b = cutoff[0];
      await SquadMessage.deleteMany({
        squadId: squad._id,
        $or: [
          { createdAt: { $lt: b.createdAt } },
          { createdAt: b.createdAt, _id: { $lt: b._id } },
        ],
      });
    }

    const populated = await SquadMessage.findById(message._id)
      .populate("senderId", "displayName username avatarUrl rankTitle")
      .lean();

    return NextResponse.json({ success: true, data: populated }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 11000 && requestId && squadIdStr) {
      try {
        const replayed = await SquadMessage.findOne({
          squadId: new Types.ObjectId(squadIdStr),
          senderId: userIdVal,
          requestId,
        })
          .populate("senderId", "displayName username avatarUrl rankTitle")
          .lean();

        if (replayed) {
          return NextResponse.json({ success: true, data: replayed, replayed: true });
        }
      } catch {
        // Fall through to server error envelope
      }
    }
    return apiServerError(error, "MESSAGE_SEND_FAILED", "Failed to transmit squad message.", requestId);
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
    const isStaff = user.role === "ADMIN" || user.role === "MODERATOR";

    if (!isStaff && (!userRole || !canModerateMessages(userRole))) {
      return apiError(
        "FORBIDDEN",
        "Only squad leadership (Leader, CoLeader, Elder) or staff can moderate messages.",
        403
      );
    }

    const body = await req.json().catch(() => ({}));
    const messageId = body && typeof body === "object" ? body.messageId : undefined;
    const reason = body && typeof body === "object" ? body.reason : undefined;
    if (!messageId || !Types.ObjectId.isValid(messageId)) {
      return apiError("INVALID_INPUT", "A valid messageId is required.", 400);
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

    message.moderationState = "REMOVED";
    message.text = "[This message was removed by squad leadership]";
    message.moderatedBy = user._id;
    message.moderationReason = typeof reason === "string" ? reason.slice(0, 200) : "Removed by squad leadership";
    await message.save();

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName || user.username,
      actorRole: user.role,
      action: "SQUAD_MESSAGE_MODERATED",
      targetType: "SQUAD",
      targetId: squad._id,
      targetLabel: `Squad Message ${message._id}`,
      reason: message.moderationReason,
    });

    return NextResponse.json({
      success: true,
      message: "Message moderated and replaced with tombstone.",
      data: {
        _id: message._id,
        moderationState: message.moderationState,
        text: message.text,
      },
    });
  } catch (error: any) {
    return apiServerError(error, "MESSAGE_MODERATION_FAILED", "Failed to moderate squad message.");
  }
}
