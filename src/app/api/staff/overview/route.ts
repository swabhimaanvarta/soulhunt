import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CampusLocation, FoundItem, ClaimRequest } from "@/models";
import { isStaffOrModerator } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isStaffOrModerator(user)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Safe-Desk staff authorization required." } },
        { status: 403 }
      );
    }

    await connectDB();

    let stationId = user.assignedStationId?.toString();
    let station: any = null;

    if (stationId) {
      station = await CampusLocation.findById(stationId).lean();
    } else if (user.role === "ADMIN" || user.role === "MODERATOR") {
      // Admin / Moderator can default to the first active safe-desk
      station = await CampusLocation.findOne({ isSafeDesk: true }).lean();
      stationId = station?._id?.toString();
    } else {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "STAFF_UNASSIGNED",
            message: "Staff account has no assigned Safe-Desk station.",
          },
        },
        { status: 403 }
      );
    }

    if (!station) {
      return NextResponse.json(
        { success: false, error: { code: "STATION_NOT_FOUND", message: "Assigned station record not found." } },
        { status: 404 }
      );
    }

    // Items currently in physical custody at this station
    const custodyItems = await FoundItem.find({
      safeDeskLocationId: station._id,
      custodyStatus: "DEPOSITED_AT_SAFE_DESK",
    })
      .populate("finderId", "displayName username avatarUrl")
      .populate("foundLocationId", "name code")
      .sort({ updatedAt: -1 })
      .lean();

    // Approved claims awaiting physical handover for items at this station
    const custodyItemIds = custodyItems.map((i) => i._id);
    const pendingHandovers = await ClaimRequest.find({
      itemId: { $in: custodyItemIds },
      status: "APPROVED",
    })
      .populate("claimantId", "displayName username avatarUrl")
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      data: {
        station: {
          _id: station._id,
          name: station.name,
          code: station.code,
          operatingHours: station.operatingHours || "08:00 - 18:00",
          zoneType: station.zoneType,
        },
        stats: {
          itemsInCustody: custodyItems.length,
          pendingHandovers: pendingHandovers.length,
        },
        custodyItems,
        pendingHandovers,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "STAFF_OVERVIEW_FAILED", message: error.message || "Failed to load staff overview." } },
      { status: 500 }
    );
  }
}
