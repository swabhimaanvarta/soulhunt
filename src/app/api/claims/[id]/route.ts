import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ClaimRequest, LostItem, FoundItem, Notification } from "@/models";
import { apiSuccess, apiError, apiServerError } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return apiError("UNAUTHORIZED", "Please log in to view claim details.", 401);
    }

    if (!Types.ObjectId.isValid(id)) {
      return apiError("INVALID_ID", "Invalid claim ID format.", 400);
    }

    await connectDB();

    const claim = await ClaimRequest.findById(id)
      .select("+handoverCode +handoverCodeHash")
      .populate("claimantId", "displayName username avatarUrl")
      .populate("counterpartyUserId", "displayName username avatarUrl")
      .populate("reviewedBy", "displayName username")
      .lean();

    if (!claim) {
      return apiError("NOT_FOUND", "Claim not found.", 404);
    }

    const callerIdStr = user._id.toString();
    const claimantIdStr = (claim.claimantId as any)?._id?.toString() || claim.claimantId?.toString();
    const counterpartyIdStr = (claim.counterpartyUserId as any)?._id?.toString() || claim.counterpartyUserId?.toString();

    const isClaimant = callerIdStr === claimantIdStr;
    const isCounterparty = callerIdStr === counterpartyIdStr;
    const isStaff =
      user.role === "ADMIN" ||
      user.role === "MODERATOR" ||
      user.role === "SAFE_DESK_STAFF";

    if (!isClaimant && !isCounterparty && !isStaff) {
      return apiError("FORBIDDEN", "You are not authorized to view this claim.", 403);
    }

    // Load associated item details
    let itemDoc: any = null;
    if (claim.itemType === "LOST") {
      itemDoc = await LostItem.findById(claim.itemId)
        .select("+rawPhotoUrl")
        .populate("reporterId", "displayName username")
        .populate("lastKnownLocationId", "name code isSafeDesk operatingHours")
        .lean();
    } else {
      itemDoc = await FoundItem.findById(claim.itemId)
        .select("+rawPhotoUrl")
        .populate("finderId", "displayName username")
        .populate("foundLocationId", "name code")
        .populate("currentCustodyLocationId", "name code isSafeDesk operatingHours")
        .lean();
    }

    // Determine who receives the handover PIN:
    // In FOUND flow: claimant is the owner recovering the item -> claimant holds PIN
    // In LOST flow: counterparty is the owner recovering the item -> counterparty holds PIN
    const isPinRecipient =
      (claim.itemType === "FOUND" && isClaimant) ||
      (claim.itemType === "LOST" && isCounterparty);

    let activeHandoverCode: string | undefined = undefined;
    const isApproved = claim.status === "APPROVED";
    const isExpired = Boolean(
      claim.handoverCodeExpiresAt && new Date() > new Date(claim.handoverCodeExpiresAt)
    );

    if (isApproved && isPinRecipient) {
      if (claim.handoverCode) {
        activeHandoverCode = claim.handoverCode;
      } else {
        // Fallback: look up generated PIN from notification
        const notif = await Notification.findOne({
          userId: user._id,
          category: "CLAIM_UPDATE",
          linkUrl: { $regex: claim.itemId.toString() },
          message: /PIN is (\d{6})/,
        }).sort({ createdAt: -1 });

        if (notif) {
          const match = notif.message.match(/PIN is (\d{6})/);
          if (match && match[1]) {
            activeHandoverCode = match[1];
            await ClaimRequest.findByIdAndUpdate(claim._id, { handoverCode: activeHandoverCode });
          }
        }
      }
    }

    const safePhoto =
      itemDoc?.photoUrl ||
      itemDoc?.blurredPhotoUrl ||
      (itemDoc?.photos && itemDoc.photos[0]) ||
      "/placeholder-item.png";

    const custodyStation =
      itemDoc?.currentCustodyLocationId ||
      (itemDoc?.lastKnownLocationId?.isSafeDesk ? itemDoc.lastKnownLocationId : null);

    const responseData = {
      _id: claim._id,
      itemType: claim.itemType,
      itemId: claim.itemId,
      status: claim.status,
      submittedAnswer: isClaimant || isCounterparty || isStaff ? claim.submittedAnswer : undefined,
      proofPhotoUrl: claim.proofPhotoUrl,
      notes: claim.notes,
      claimant: claim.claimantId,
      counterparty: claim.counterpartyUserId,
      reviewedBy: claim.reviewedBy,
      reviewedAt: claim.reviewedAt,
      handoverAttempts: claim.handoverAttempts || 0,
      handoverLocked: Boolean(claim.handoverLocked),
      lockoutUntil: claim.lockoutUntil || null,
      handoverCodeExpiresAt: claim.handoverCodeExpiresAt || null,
      isExpired,
      isClaimant,
      isCounterparty,
      isStaff,
      ...(activeHandoverCode ? { handoverCode: activeHandoverCode } : {}),
      safeDeskInstructions: isApproved
        ? {
            locationName: custodyStation?.name || "Campus Safe-Desk",
            operatingHours: custodyStation?.operatingHours || "08:00 AM - 06:00 PM",
            guidance:
              "Present your 6-digit verification PIN along with your AIEM Student Identity Card at the designated Safe-Desk station to complete physical custody handover.",
          }
        : null,
      item: itemDoc
        ? {
            _id: itemDoc._id,
            title: itemDoc.title || itemDoc.shortTitle || "Campus Belonging",
            itemType: claim.itemType,
            category: itemDoc.category,
            status: itemDoc.status,
            photoUrl: safePhoto,
            location:
              itemDoc.lastKnownLocationId?.name ||
              itemDoc.foundLocationId?.name ||
              "AIEM Campus",
            custodyStatus: itemDoc.custodyStatus || null,
          }
        : null,
      createdAt: (claim as any).createdAt,
      updatedAt: (claim as any).updatedAt,
    };

    return apiSuccess(responseData);
  } catch (error: any) {
    return apiServerError(error, "CLAIM_FETCH_FAILED", "Failed to retrieve claim detail.");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return apiError("UNAUTHORIZED", "Please log in to cancel your claim.", 401);
    }

    if (!Types.ObjectId.isValid(id)) {
      return apiError("INVALID_ID", "Invalid claim ID format.", 400);
    }

    await connectDB();

    const claim = await ClaimRequest.findById(id);
    if (!claim) {
      return apiError("NOT_FOUND", "Claim not found.", 404);
    }

    const callerIdStr = user._id.toString();
    const claimantIdStr = claim.claimantId.toString();

    if (callerIdStr !== claimantIdStr) {
      return apiError("FORBIDDEN", "Only the claimant can withdraw or cancel this claim.", 403);
    }

    if (claim.status !== "PENDING") {
      return apiError(
        "INVALID_CLAIM_STATE",
        `Only PENDING claims may be cancelled. Current status is ${claim.status}.`,
        400
      );
    }

    // Transition claim status to WITHDRAWN with note
    claim.status = "WITHDRAWN";
    claim.notes = (claim.notes ? claim.notes + " | " : "") + "Claim withdrawn by claimant.";
    claim.reviewedAt = new Date();
    await claim.save();

    // Free the item if no other active claims remain
    const itemDoc: any =
      claim.itemType === "LOST"
        ? await LostItem.findById(claim.itemId)
        : await FoundItem.findById(claim.itemId);

    if (itemDoc) {
      // Check if there are other active claims for this item
      const otherActiveClaim = await ClaimRequest.findOne({
        itemId: itemDoc._id,
        _id: { $ne: claim._id },
        status: { $in: ["PENDING", "APPROVED"] },
      }).sort({ createdAt: 1 });

      if (otherActiveClaim) {
        itemDoc.currentClaimId = otherActiveClaim._id;
      } else {
        itemDoc.currentClaimId = null;
        if (itemDoc.status === "CLAIMED") {
          itemDoc.status = "ACTIVE";
        }
      }

      itemDoc.stateHistory.push({
        state: itemDoc.status,
        actorId: user._id,
        note: `Active claim ${claim._id} withdrawn by claimant ${user.displayName}.`,
        timestamp: new Date(),
      });

      await itemDoc.save();
    }

    // Notify the counterparty that the claim was withdrawn
    await Notification.create({
      userId: claim.counterpartyUserId,
      category: "CLAIM_UPDATE",
      title: "Claim Withdrawn",
      message: `${user.displayName} withdrew their claim on "${itemDoc?.title || itemDoc?.shortTitle || "item"}".`,
      linkUrl: `/items/${claim.itemId}`,
    });

    return apiSuccess({
      message: "Claim successfully withdrawn.",
      claimId: claim._id,
      status: "WITHDRAWN",
    });
  } catch (error: any) {
    return apiServerError(error, "CLAIM_CANCEL_FAILED", "Failed to cancel claim.");
  }
}
