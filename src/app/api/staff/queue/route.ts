import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { FoundItem, ClaimRequest, CampusLocation } from "@/models";
import { canViewStationQueue, isStaffOrModerator } from "@/lib/permissions";
import { apiSuccess, apiError } from "@/lib/api-response";

/**
 * GET /api/staff/queue
 * Returns items currently deposited at the staff member's assigned campus station
 * (or all stations if requested by ADMIN/MODERATOR).
 *
 * Each item includes:
 * - Locker receipt code
 * - Item title
 * - Finder / reporter profile
 * - Custody date & timestamps
 * - Active claim status (PENDING, APPROVED, etc.) & lockout fields
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isStaffOrModerator(user)) {
      return apiError(
        "FORBIDDEN",
        "Safe-Desk staff authorization required.",
        403
      );
    }

    await connectDB();
    const { searchParams } = new URL(req.url);
    const requestedStationId = searchParams.get("stationId");
    const viewAll = searchParams.get("all") === "true";

    let targetStationId: string | null = null;
    let stationInfo: any = null;

    if (requestedStationId && requestedStationId !== "all") {
      if (!canViewStationQueue(user, requestedStationId)) {
        return apiError(
          "STATION_FORBIDDEN",
          "You are not authorized to view the custody queue of this Safe-Desk station.",
          403
        );
      }
      targetStationId = requestedStationId;
      stationInfo = await CampusLocation.findById(targetStationId).lean();
    } else if (requestedStationId === "all" || viewAll) {
      if (user.role !== "ADMIN" && user.role !== "MODERATOR") {
        return apiError(
          "FORBIDDEN",
          "Only Administrators and Moderators can view custody queues across all stations.",
          403
        );
      }
      targetStationId = null;
    } else {
      // Default to user's assigned station
      if (user.assignedStationId) {
        targetStationId = user.assignedStationId.toString();
        stationInfo = await CampusLocation.findById(targetStationId).lean();
      } else if (user.role === "ADMIN" || user.role === "MODERATOR") {
        // Find default primary safe-desk station if unassigned
        stationInfo = await CampusLocation.findOne({ isSafeDesk: true }).lean();
        targetStationId = stationInfo ? stationInfo._id.toString() : null;
      } else {
        return apiError(
          "STAFF_UNASSIGNED",
          "Staff account has no assigned Safe-Desk station.",
          403
        );
      }
    }

    const filter: Record<string, any> = {
      custodyStatus: "DEPOSITED_AT_SAFE_DESK",
    };

    if (targetStationId) {
      filter.safeDeskLocationId = targetStationId;
    }

    const items = await FoundItem.find(filter)
      .populate("finderId", "displayName username email avatarUrl")
      .populate("foundLocationId", "name code zoneType")
      .populate("safeDeskLocationId", "name code operatingHours zoneType isSafeDesk")
      .sort({ updatedAt: -1 })
      .lean();

    // Query active claim requests for these items
    const itemIds = items.map((i: any) => i._id);
    const claims = await ClaimRequest.find({
      itemId: { $in: itemIds },
      status: { $in: ["PENDING", "APPROVED", "DISPUTED"] },
    })
      .populate("claimantId", "displayName username email avatarUrl")
      .sort({ updatedAt: -1 })
      .lean();

    const claimMap = new Map<string, any>();
    for (const claim of claims) {
      const k = claim.itemId.toString();
      if (!claimMap.has(k)) {
        claimMap.set(k, claim);
      }
    }

    const formattedQueue = items.map((item: any) => {
      const activeClaim = claimMap.get(item._id.toString()) || null;
      return {
        _id: item._id.toString(),
        title: item.title || item.shortTitle || "Unidentified Belonging",
        category: item.category,
        publicDescription: item.publicDescription,
        spotDetails: item.spotDetails || "",
        lockerReceiptCode: item.lockerReceiptCode || null,
        custodyStatus: item.custodyStatus,
        custodyDate: item.updatedAt || item.createdAt,
        foundAt: item.foundAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        photoUrl: item.photoUrl || item.blurredPhotoUrl || null,
        finder: item.finderId
          ? {
              _id: item.finderId._id?.toString(),
              displayName: item.finderId.displayName,
              username: item.finderId.username,
              avatarUrl: item.finderId.avatarUrl,
            }
          : null,
        foundLocation: item.foundLocationId
          ? {
              _id: item.foundLocationId._id?.toString(),
              name: item.foundLocationId.name,
              code: item.foundLocationId.code,
              zoneType: item.foundLocationId.zoneType,
            }
          : null,
        safeDeskLocation: item.safeDeskLocationId
          ? {
              _id: item.safeDeskLocationId._id?.toString(),
              name: item.safeDeskLocationId.name,
              code: item.safeDeskLocationId.code,
              operatingHours: item.safeDeskLocationId.operatingHours,
              zoneType: item.safeDeskLocationId.zoneType,
            }
          : null,
        activeClaim: activeClaim
          ? {
              _id: activeClaim._id.toString(),
              status: activeClaim.status,
              handoverLocked: Boolean(activeClaim.handoverLocked),
              handoverAttempts: activeClaim.handoverAttempts || 0,
              lockoutUntil: activeClaim.lockoutUntil || null,
              claimant: activeClaim.claimantId
                ? {
                    _id: activeClaim.claimantId._id?.toString(),
                    displayName: activeClaim.claimantId.displayName,
                    username: activeClaim.claimantId.username,
                  }
                : null,
              createdAt: activeClaim.createdAt,
            }
          : null,
      };
    });

    return apiSuccess({
      station: stationInfo
        ? {
            _id: stationInfo._id.toString(),
            name: stationInfo.name,
            code: stationInfo.code,
            operatingHours: stationInfo.operatingHours || "08:00 - 18:00",
            zoneType: stationInfo.zoneType,
          }
        : null,
      items: formattedQueue,
      total: formattedQueue.length,
      stationId: targetStationId || "ALL",
    });
  } catch (error: any) {
    return apiError(
      "QUEUE_FETCH_FAILED",
      error.message || "Failed to load station custody queue.",
      500
    );
  }
}
