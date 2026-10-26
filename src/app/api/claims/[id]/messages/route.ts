import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ClaimRequest, LostItem, FoundItem, HandoverMessage, Notification, User } from "@/models";
import { checkRateLimit } from "@/lib/rateLimit";
import { sanitizePublicDescription } from "@/lib/privacy";

const MessagePostSchema = z.object({
  text: z.string().min(1).max(500),
  isPreset: z.boolean().optional(),
  presetCode: z.string().max(50).optional(),
});

const MessageReportSchema = z.object({
  messageId: z.string(),
  reason: z.string().min(3).max(300),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in to view handover messages." } },
        { status: 401 }
      );
    }

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ID", message: "Invalid claim ID." } },
        { status: 400 }
      );
    }

    await connectDB();
    const claim = await ClaimRequest.findById(id);
    if (!claim) {
      return NextResponse.json(
        { success: false, error: { code: "CLAIM_NOT_FOUND", message: "Claim not found." } },
        { status: 404 }
      );
    }

    const callerId = user._id.toString();
    const isClaimant = claim.claimantId.toString() === callerId;
    const isCounterparty = claim.counterpartyUserId.toString() === callerId;
    const isStaff = ["ADMIN", "MODERATOR", "SAFE_DESK_STAFF"].includes(user.role);

    if (!isClaimant && !isCounterparty && !isStaff) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "You are not a participant in this claim handover." } },
        { status: 403 }
      );
    }

    // Check item custody
    let custodyStatus = "HELD_BY_FINDER";
    let safeDeskName: string | null = null;
    let safeDeskHours: string | null = null;

    if (claim.itemType === "FOUND") {
      const foundItem: any = await FoundItem.findById(claim.itemId).populate("safeDeskLocationId currentCustodyLocationId");
      if (foundItem) {
        custodyStatus = foundItem.custodyStatus || "HELD_BY_FINDER";
        const loc = foundItem.safeDeskLocationId || foundItem.currentCustodyLocationId;
        if (loc) {
          safeDeskName = loc.name;
          safeDeskHours = loc.operatingHours || "08:00 AM - 06:00 PM";
        }
      }
    }

    const isSafeDeskCustody = ["DEPOSITED_AT_SAFE_DESK", "SAFE_DESK"].includes(custodyStatus);

    const messages = await HandoverMessage.find({
      claimId: claim._id,
      expiresAt: { $gt: new Date() },
    })
      .populate("senderId", "username displayName identityMode avatarUrl avatarPreset")
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();

    const formattedMessages = messages.map((m: any) => {
      const sender = m.senderId;
      let displayLabel = "Investigator";
      if (sender) {
        if (sender.identityMode === "PUBLIC") {
          displayLabel = sender.displayName || sender.username;
        } else if (sender.identityMode === "ANONYMOUS") {
          displayLabel = "Anonymous Campus Helper";
        } else {
          displayLabel = `@${sender.username}`;
        }
      }

      const isMe = sender?._id?.toString() === callerId;

      return {
        _id: m._id.toString(),
        text: m.text,
        isPreset: Boolean(m.isPreset),
        presetCode: m.presetCode || "",
        isReported: Boolean(m.isReported),
        createdAt: m.createdAt,
        isMe,
        senderLabel: displayLabel,
        avatarPreset: sender?.avatarPreset || "recon",
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        claimId: claim._id.toString(),
        claimStatus: claim.status,
        custodyStatus,
        isSafeDeskCustody,
        safeDeskName,
        safeDeskHours,
        canChat: claim.status === "APPROVED" && !isSafeDeskCustody,
        messages: formattedMessages,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: error.message || "Failed to load messages." } },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in to send a message." } },
        { status: 401 }
      );
    }

    if (user.accountStatus === "PENDING_VERIFICATION") {
      return NextResponse.json(
        { success: false, error: { code: "UNVERIFIED", message: "Please verify your email before sending messages." } },
        { status: 403 }
      );
    }

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_ID", message: "Invalid claim ID." } },
        { status: 400 }
      );
    }

    // Rate limit: 10 messages per 10 minutes per user
    const rateLimit = await checkRateLimit(`handover_msg_${user._id}`, 10, 600);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: { code: "RATE_LIMITED", message: "Message rate limit reached. Please wait a few minutes." } },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = MessagePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: parsed.error.issues[0]?.message || "Invalid message format." } },
        { status: 400 }
      );
    }

    await connectDB();
    const claim = await ClaimRequest.findById(id);
    if (!claim) {
      return NextResponse.json(
        { success: false, error: { code: "CLAIM_NOT_FOUND", message: "Claim not found." } },
        { status: 404 }
      );
    }

    if (claim.status !== "APPROVED") {
      return NextResponse.json(
        { success: false, error: { code: "CLAIM_NOT_APPROVED", message: "Handover messages are only allowed for APPROVED claims." } },
        { status: 400 }
      );
    }

    const callerId = user._id.toString();
    const isClaimant = claim.claimantId.toString() === callerId;
    const isCounterparty = claim.counterpartyUserId.toString() === callerId;
    const isStaff = ["ADMIN", "MODERATOR", "SAFE_DESK_STAFF"].includes(user.role);

    if (!isClaimant && !isCounterparty && !isStaff) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "You are not authorized to message in this claim thread." } },
        { status: 403 }
      );
    }

    // Check custody
    if (claim.itemType === "FOUND") {
      const foundItem = await FoundItem.findById(claim.itemId);
      if (foundItem && ["DEPOSITED_AT_SAFE_DESK", "SAFE_DESK"].includes(foundItem.custodyStatus)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "CUSTODY_AT_SAFE_DESK",
              message: "This item is held in custody at the Safe Desk. Direct coordination is closed. Please visit the Safe Desk station.",
            },
          },
          { status: 400 }
        );
      }
    }

    const recipientUserId = isClaimant ? claim.counterpartyUserId : claim.claimantId;

    let sanitizedText = parsed.data.text
      .replace(/\b\d{6}\b/g, "[REDACTED_SECURITY_PIN]")
      .trim();
    sanitizedText = sanitizePublicDescription(sanitizedText).sanitizedText;

    // 30 days retention policy
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const messageDoc = await HandoverMessage.create({
      claimId: claim._id,
      senderId: user._id,
      text: sanitizedText,
      isPreset: Boolean(parsed.data.isPreset),
      presetCode: parsed.data.presetCode || "",
      isReported: false,
      expiresAt,
    });

    // Notify recipient without leaking text or PIN in notification
    await Notification.create({
      userId: recipientUserId,
      category: "CLAIM_UPDATE",
      title: "New Handover Coordination Message",
      message: "You have a new coordination update regarding your approved item handover.",
      linkUrl: `/items/${claim.itemId}`,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          _id: messageDoc._id.toString(),
          text: messageDoc.text,
          isPreset: messageDoc.isPreset,
          presetCode: messageDoc.presetCode,
          createdAt: messageDoc.createdAt,
          isMe: true,
          senderLabel: user.identityMode === "PUBLIC" ? user.displayName : `@${user.username}`,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: error.message || "Failed to send message." } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in to report a message." } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = MessageReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_FAILED", message: "Invalid report request." } },
        { status: 400 }
      );
    }

    await connectDB();
    const message = await HandoverMessage.findOne({ _id: parsed.data.messageId, claimId: id });
    if (!message) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Message not found." } },
        { status: 404 }
      );
    }

    message.isReported = true;
    message.reportedBy = user._id as Types.ObjectId;
    message.reportReason = parsed.data.reason;
    await message.save();

    return NextResponse.json({
      success: true,
      message: "Message has been flagged for campus moderation review.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: error.message || "Failed to report message." } },
      { status: 500 }
    );
  }
}
