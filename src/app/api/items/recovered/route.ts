import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { ClaimRequest, LostItem, FoundItem } from "@/models";
import { sanitizePublicDescription } from "@/lib/privacy";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(30, Math.max(1, parseInt(searchParams.get("limit") || "12", 10)));
    const skip = (page - 1) * limit;

    await connectDB();

    // Query completed claims
    const completedClaims = await ClaimRequest.find({ status: "HANDOVER_COMPLETE" })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("counterpartyUserId", "username displayName identityMode publicAttributionPreference")
      .populate("claimantId", "username displayName identityMode publicAttributionPreference")
      .lean();

    const totalCount = await ClaimRequest.countDocuments({ status: "HANDOVER_COMPLETE" });

    // Fetch corresponding item documents
    const recoveredItems = await Promise.all(
      completedClaims.map(async (claim: any) => {
        let item: any = null;
        let isSafeDesk = false;
        let broadZone = "Campus Main";

        if (claim.itemType === "FOUND") {
          item = await FoundItem.findById(claim.itemId)
            .populate("foundLocationId", "name zoneType building")
            .populate("safeDeskLocationId", "name")
            .lean();
          if (item) {
            isSafeDesk = ["DEPOSITED_AT_SAFE_DESK", "SAFE_DESK"].includes(item.custodyStatus);
            broadZone = item.safeDeskLocationId?.name || item.foundLocationId?.name || "Campus Ground";
          }
        } else {
          item = await LostItem.findById(claim.itemId)
            .populate("lastKnownLocationId", "name zoneType building")
            .lean();
          if (item) {
            broadZone = item.lastKnownLocationId?.name || "Campus Ground";
          }
        }

        if (!item) return null;

        if (category && category !== "ALL" && item.category !== category) {
          return null;
        }

        // Determine finder attribution
        // In FOUND flow: counterparty is finder
        // In LOST flow: claimant is finder
        const finderUser = claim.itemType === "FOUND" ? claim.counterpartyUserId : claim.claimantId;
        let finderAttribution = "Anonymous Campus Helper";

        if (
          finderUser &&
          finderUser.publicAttributionPreference === "HANDLE" &&
          finderUser.identityMode === "PUBLIC"
        ) {
          finderAttribution = `@${finderUser.username}`;
        }

        // Format coarse date: YYYY-MM-DD only
        const dateObj = new Date(claim.updatedAt || claim.createdAt);
        const coarseDate = dateObj.toISOString().split("T")[0];

        const rawTitle = item.title || item.shortTitle || "Recovered Item";
        const sanitizedTitle = sanitizePublicDescription(rawTitle).sanitizedText;

        return {
          _id: item._id.toString(),
          title: sanitizedTitle,
          category: item.category,
          broadZone,
          coarseDate,
          finderAttribution,
          handoverMethod: isSafeDesk ? "Safe-Desk Station" : "Campus Handover",
        };
      })
    );

    // Filter out nulls from category filter
    const filteredItems = recoveredItems.filter(Boolean);

    return NextResponse.json({
      success: true,
      data: filteredItems,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: error.message || "Failed to load recovered items." } },
      { status: 500 }
    );
  }
}
