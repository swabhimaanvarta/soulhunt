import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ClaimRequest, LostItem, FoundItem, Notification } from "@/models";

const ReviewSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  decisionReason: z.string().min(3).max(500),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Please sign in to review claims." },
        { status: 401 }
      );
    }

    if (!Types.ObjectId.isValid(id)) {
      return NextResponse.json(
        { success: false, error: "Invalid claim ID." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = ReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { action, decisionReason } = parsed.data;

    await connectDB();
    const claim = await ClaimRequest.findById(id);
    if (!claim) {
      return NextResponse.json(
        { success: false, error: "Claim not found." },
        { status: 404 }
      );
    }

    if (claim.status !== "PENDING") {
      return NextResponse.json(
        {
          success: false,
          error: `Claim cannot be reviewed. Current status: ${claim.status}. Only PENDING claims can be reviewed.`,
        },
        { status: 400 }
      );
    }

    // Authorization: Only the item counterparty or authorized campus staff can decide
    const callerIdStr = user._id.toString();
    const counterpartyIdStr = claim.counterpartyUserId.toString();
    const isStaff = user.role === "ADMIN" || user.role === "MODERATOR" || user.role === "SAFE_DESK_STAFF";

    if (callerIdStr !== counterpartyIdStr && !isStaff) {
      return NextResponse.json(
        {
          success: false,
          error: "You are not authorized to review or approve this claim.",
        },
        { status: 403 }
      );
    }

    const now = new Date();
    const isLostItem = claim.itemType === "LOST";

    // Fetch the linked item document
    const itemDoc: any = isLostItem
      ? await LostItem.findById(claim.itemId)
      : await FoundItem.findById(claim.itemId);

    if (action === "APPROVE") {
      // 1. Generate cryptographic 6-digit PIN and bcrypt hash
      const handoverCode = crypto.randomInt(100000, 1000000).toString();
      const handoverCodeHash = await bcrypt.hash(handoverCode, 10);
      const handoverCodeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hour expiration policy

      claim.status = "APPROVED";
      claim.handoverCodeHash = handoverCodeHash;
      claim.handoverCodeExpiresAt = handoverCodeExpiresAt;
      claim.handoverAttempts = 0;
      claim.handoverLocked = false;
      claim.reviewedBy = user._id;
      claim.reviewedAt = now;
      await claim.save();

      // 2. Update item status and audit history
      if (itemDoc) {
        itemDoc.status = "VERIFICATION";
        itemDoc.currentClaimId = claim._id as Types.ObjectId;
        itemDoc.stateHistory.push({
          state: "VERIFICATION",
          actorId: user._id,
          note: `Claim approved by ${user.displayName}. Reason: ${decisionReason}`,
          timestamp: now,
        });
        await itemDoc.save();
      }

      // 3. Deliver notifications with PIN to the receiving party
      if (isLostItem) {
        // In LOST flow: claimant is the finder (custodian); counterparty is the owner (receiving party)
        // Owner receives the PIN to show the finder upon handover
        await Notification.create({
          userId: claim.counterpartyUserId,
          category: "CLAIM_UPDATE",
          title: "Claim Approved — Recovery PIN Generated",
          message: `Your lost item claim is approved! Your 6-digit recovery PIN is ${handoverCode}. Give this PIN to the finder when you receive your item.`,
          linkUrl: `/items/${claim.itemId}`,
        });

        // Finder is notified that claim is approved and to collect PIN upon handover
        await Notification.create({
          userId: claim.claimantId,
          category: "CLAIM_UPDATE",
          title: "Found Claim Approved — Ready for Handover",
          message: `Your report that you found this item was approved! Meet the owner to hand over the item and enter their 6-digit PIN to verify.`,
          linkUrl: `/items/${claim.itemId}`,
        });
      } else {
        // In FOUND flow: counterparty is the finder (custodian); claimant is the owner (receiving party)
        // Claimant receives the PIN to show the finder/safe-desk
        await Notification.create({
          userId: claim.claimantId,
          category: "CLAIM_UPDATE",
          title: "Claim Approved — Recovery PIN Generated",
          message: `Your claim was approved! Your 6-digit handover PIN is ${handoverCode}. Present this PIN to the custodian to receive your item.`,
          linkUrl: `/items/${claim.itemId}`,
        });

        // Finder is notified that claim was approved
        await Notification.create({
          userId: claim.counterpartyUserId,
          category: "CLAIM_UPDATE",
          title: "Claim Approved — Awaiting Handover",
          message: `Claim for "${itemDoc?.title || itemDoc?.shortTitle || "item"}" was approved. Meet the owner to verify their 6-digit PIN and complete handover.`,
          linkUrl: `/items/${claim.itemId}`,
        });
      }

      // Check if caller is the receiving party who should see the PIN in the direct response
      const callerIsReceiver = isLostItem
        ? callerIdStr === claim.counterpartyUserId.toString()
        : callerIdStr === claim.claimantId.toString();

      return NextResponse.json({
        success: true,
        message: "Claim has been approved for physical handover.",
        data: {
          claimId: claim._id,
          status: claim.status,
          ...(callerIsReceiver ? { handoverCode } : {}),
          expiresAt: handoverCodeExpiresAt,
        },
      });
    } else {
      // REJECT action
      claim.status = "REJECTED";
      claim.reviewedBy = user._id;
      claim.reviewedAt = now;
      await claim.save();

      if (itemDoc) {
        // Check if other active claims exist, otherwise restore to ACTIVE
        const otherActiveClaims = await ClaimRequest.countDocuments({
          itemId: claim.itemId,
          status: { $in: ["PENDING", "APPROVED"] },
        });

        if (otherActiveClaims === 0 && itemDoc.status !== "COMPLETED") {
          itemDoc.status = "ACTIVE";
          itemDoc.currentClaimId = null;
        }

        itemDoc.stateHistory.push({
          state: itemDoc.status,
          actorId: user._id,
          note: `Claim rejected by ${user.displayName}. Reason: ${decisionReason}`,
          timestamp: now,
        });
        await itemDoc.save();
      }

      // Notify the claimant of rejection with decision reason
      await Notification.create({
        userId: claim.claimantId,
        category: "CLAIM_UPDATE",
        title: "Claim Not Approved",
        message: `Your claim for "${itemDoc?.title || itemDoc?.shortTitle || "item"}" was not approved. Reason: ${decisionReason}`,
        linkUrl: `/items/${claim.itemId}`,
      });

      return NextResponse.json({
        success: true,
        message: "Claim has been rejected.",
        data: {
          claimId: claim._id,
          status: claim.status,
          decisionReason,
        },
      });
    }
  } catch (error: any) {
    console.error("[POST /api/claims/[id]/review] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process claim review." },
      { status: 500 }
    );
  }
}

