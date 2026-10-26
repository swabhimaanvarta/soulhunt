import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ClaimRequest, LostItem, FoundItem, Transaction } from "@/models";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in to view recovery receipts." } },
        { status: 401 }
      );
    }

    await connectDB();

    const completedClaims = await ClaimRequest.find({
      $or: [{ claimantId: user._id }, { counterpartyUserId: user._id }],
      status: "HANDOVER_COMPLETE",
    })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();

    const receipts = await Promise.all(
      completedClaims.map(async (claim: any) => {
        let itemTitle = "Campus Item";
        let category = "OTHER";
        let stationName = "Direct Campus Handover";

        if (claim.itemType === "FOUND") {
          const found = await FoundItem.findById(claim.itemId)
            .populate("safeDeskLocationId", "name")
            .populate("foundLocationId", "name")
            .lean();
          if (found) {
            itemTitle = found.title || found.shortTitle || "Found Item";
            category = found.category;
            if (found.safeDeskLocationId) {
              stationName = (found.safeDeskLocationId as any).name || "Safe-Desk Station";
            }
          }
        } else {
          const lost = await LostItem.findById(claim.itemId)
            .populate("lastKnownLocationId", "name")
            .lean();
          if (lost) {
            itemTitle = lost.title || "Lost Item";
            category = lost.category;
          }
        }

        // Determine user's role
        // FOUND item: claimant is owner, counterparty is finder
        // LOST item: counterparty is owner, claimant is finder
        const isOwner =
          (claim.itemType === "FOUND" && claim.claimantId.toString() === user._id.toString()) ||
          (claim.itemType === "LOST" && claim.counterpartyUserId.toString() === user._id.toString());

        const userRole = isOwner ? "OWNER_RECIPIENT" : "FINDER_HELPER";

        // Query economy transaction if any was awarded
        const tx = await Transaction.findOne({
          userId: user._id,
          referenceType: "RECOVERY",
          referenceId: claim._id,
        }).lean();

        return {
          claimId: claim._id.toString(),
          itemTitle,
          category,
          userRole,
          completedAt: claim.updatedAt || claim.createdAt,
          stationName,
          coinsAwarded: tx ? tx.deltaCoins : 0,
          xpAwarded: tx ? tx.deltaXp : 0,
          transactionId: tx ? tx._id.toString() : null,
          settlementIdempotencyKey: claim.settlementIdempotencyKey || null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: receipts,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: error.message || "Failed to load recovery receipts." } },
      { status: 500 }
    );
  }
}
