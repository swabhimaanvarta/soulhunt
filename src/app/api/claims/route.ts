import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ClaimRequest, LostItem, FoundItem, Notification } from "@/models";
import { apiSuccess, apiError, apiServerError } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiError("UNAUTHORIZED", "Please log in to view your claims.", 401);
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const role = searchParams.get("role"); // "claimant" | "counterparty" | "owner" | "all"

    const validStatuses = ["PENDING", "APPROVED", "HANDOVER_COMPLETE", "REJECTED", "DISPUTED"];
    const query: any = {};

    if (role === "claimant") {
      query.claimantId = user._id;
    } else if (role === "counterparty" || role === "owner") {
      query.counterpartyUserId = user._id;
    } else {
      query.$or = [{ claimantId: user._id }, { counterpartyUserId: user._id }];
    }

    if (status && validStatuses.includes(status.toUpperCase())) {
      query.status = status.toUpperCase();
    }

    await connectDB();

    const claims = await ClaimRequest.find(query)
      .select("+handoverCode")
      .populate("claimantId", "displayName username avatarUrl")
      .populate("counterpartyUserId", "displayName username avatarUrl")
      .sort({ createdAt: -1 })
      .lean();

    // Group items for batch query
    const lostItemIds: Types.ObjectId[] = [];
    const foundItemIds: Types.ObjectId[] = [];

    for (const c of claims) {
      if (c.itemType === "LOST") {
        lostItemIds.push(c.itemId);
      } else {
        foundItemIds.push(c.itemId);
      }
    }

    const [lostItems, foundItems] = await Promise.all([
      lostItemIds.length > 0
        ? LostItem.find({ _id: { $in: lostItemIds } })
            .select("title category status photoUrl blurredPhotoUrl spotDetails")
            .populate("lastKnownLocationId", "name code isSafeDesk")
            .lean()
        : [],
      foundItemIds.length > 0
        ? FoundItem.find({ _id: { $in: foundItemIds } })
            .select("title shortTitle category status photoUrl blurredPhotoUrl custodyStatus spotDetails")
            .populate("foundLocationId", "name code")
            .populate("currentCustodyLocationId", "name code isSafeDesk operatingHours")
            .lean()
        : [],
    ]);

    const lostMap = new Map(lostItems.map((item: any) => [item._id.toString(), item]));
    const foundMap = new Map(foundItems.map((item: any) => [item._id.toString(), item]));

    const enrichedClaims = await Promise.all(
      claims.map(async (c: any) => {
        const itemDoc: any =
          c.itemType === "LOST"
            ? lostMap.get(c.itemId.toString())
            : foundMap.get(c.itemId.toString());

        const isClaimant = c.claimantId?._id?.toString() === user._id.toString();
        const isCounterparty = c.counterpartyUserId?._id?.toString() === user._id.toString();

        // Secure handover PIN handling:
        // Only claimant (or counterparty in LOST flow) with APPROVED status can receive active handoverCode
        let activeHandoverCode: string | undefined = undefined;
        const isPinRecipient =
          (c.itemType === "FOUND" && isClaimant) || (c.itemType === "LOST" && isCounterparty);

        if (c.status === "APPROVED" && isPinRecipient) {
          if (c.handoverCode) {
            activeHandoverCode = c.handoverCode;
          } else {
            // Fallback to notification retrieval if plaintext wasn't persisted in ClaimRequest
            const notif = await Notification.findOne({
              userId: user._id,
              category: "CLAIM_UPDATE",
              linkUrl: { $regex: c.itemId.toString() },
              message: /PIN is (\d{6})/,
            }).sort({ createdAt: -1 });

            if (notif) {
              const match = notif.message.match(/PIN is (\d{6})/);
              if (match && match[1]) {
                activeHandoverCode = match[1];
                await ClaimRequest.findByIdAndUpdate(c._id, { handoverCode: activeHandoverCode });
              }
            }
          }
        }

        const safePhoto =
          itemDoc?.photoUrl ||
          itemDoc?.blurredPhotoUrl ||
          (itemDoc?.photos && itemDoc.photos[0]) ||
          "/placeholder-item.png";

        return {
          _id: c._id,
          itemType: c.itemType,
          itemId: c.itemId,
          status: c.status,
          submittedAnswer: isClaimant || isCounterparty ? c.submittedAnswer : undefined,
          proofPhotoUrl: c.proofPhotoUrl,
          notes: c.notes,
          claimant: c.claimantId,
          counterparty: c.counterpartyUserId,
          isClaimant,
          isCounterparty,
          handoverAttempts: c.handoverAttempts || 0,
          handoverLocked: Boolean(c.handoverLocked),
          lockoutUntil: c.lockoutUntil || null,
          handoverCodeExpiresAt: c.handoverCodeExpiresAt || null,
          ...(activeHandoverCode ? { handoverCode: activeHandoverCode } : {}),
          item: itemDoc
            ? {
                _id: itemDoc._id,
                title: itemDoc.title || itemDoc.shortTitle || "Campus Belonging",
                itemType: c.itemType,
                category: itemDoc.category,
                status: itemDoc.status,
                photoUrl: safePhoto,
                location:
                  itemDoc.lastKnownLocationId?.name ||
                  itemDoc.foundLocationId?.name ||
                  "AIEM Campus",
                custodyLocation: itemDoc.currentCustodyLocationId?.name || null,
                custodyStatus: itemDoc.custodyStatus || null,
              }
            : null,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        };
      })
    );

    return apiSuccess(enrichedClaims);
  } catch (error: any) {
    return apiServerError(error, "CLAIMS_FETCH_FAILED", "Failed to retrieve claims.");
  }
}
