import { NextRequest } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { FoundItem, CampusLocation } from "@/models";
import { canManageStationCustody, canViewStationQueue, isStaffOrModerator } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { apiSuccess, apiError } from "@/lib/api-response";

/**
 * GET /api/staff/custody
 * Station-scoped custody queue query.
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
    const requestedStationId = searchParams.get("stationId") || user.assignedStationId?.toString();

    if (!requestedStationId) {
      return apiError(
        "STATION_REQUIRED",
        "Station ID parameter is required.",
        400
      );
    }

    if (!canViewStationQueue(user, requestedStationId)) {
      return apiError(
        "STATION_FORBIDDEN",
        "You are not authorized to view the custody queue of this Safe-Desk station.",
        403
      );
    }

    const items = await FoundItem.find({
      safeDeskLocationId: requestedStationId,
    })
      .populate("finderId", "displayName username email avatarUrl")
      .populate("foundLocationId", "name code")
      .sort({ updatedAt: -1 })
      .lean();

    return apiSuccess(items);
  } catch (error: any) {
    return apiError(
      "SERVER_ERROR",
      error.message || "Failed to load station custody.",
      500
    );
  }
}

/**
 * POST /api/staff/custody
 * Accepts physical custody of a found belonging into a Safe-Desk station
 * and generates a tracked locker receipt code (SD-${stationCode}-${randomInt(100, 999)}).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isStaffOrModerator(user)) {
      return apiError(
        "FORBIDDEN",
        "Safe-Desk staff authorization required.",
        403
      );
    }

    const body = await req.json();
    const { itemId, action = "DEPOSIT", stationId, lockerCode, conditionNote, reason } = body;

    if (!itemId) {
      return apiError(
        "ITEM_REQUIRED",
        "Item ID is required.",
        400
      );
    }

    if (action !== "DEPOSIT" && action !== "TRANSFER") {
      return apiError(
        "INVALID_ACTION",
        "Action must be DEPOSIT or TRANSFER.",
        400
      );
    }

    if (!reason || reason.trim().length < 5) {
      return apiError(
        "REASON_REQUIRED",
        "Audit reason required (minimum 5 characters).",
        400
      );
    }

    const targetStationId = stationId || user.assignedStationId?.toString();
    if (!targetStationId) {
      return apiError(
        "STATION_REQUIRED",
        "Target Safe-Desk station required.",
        400
      );
    }

    // Strict station-scoped authorization: HTTP 403 on unassigned station mutation
    if (!canManageStationCustody(user, targetStationId)) {
      return apiError(
        "CROSS_STATION_MUTATION_DENIED",
        "Staff members can only act on their assigned campus Safe-Desk station.",
        403
      );
    }

    await connectDB();

    const targetStation = await CampusLocation.findById(targetStationId);
    if (!targetStation || !targetStation.isSafeDesk) {
      return apiError(
        "INVALID_STATION",
        "Target location is not a registered Safe-Desk station.",
        400
      );
    }

    const item = await FoundItem.findById(itemId);
    if (!item) {
      return apiError(
        "ITEM_NOT_FOUND",
        "Found item not found.",
        404
      );
    }

    const previousCustody = {
      custodyStatus: item.custodyStatus,
      safeDeskLocationId: item.safeDeskLocationId,
      currentCustodyLocationId: item.currentCustodyLocationId,
      lockerReceiptCode: item.lockerReceiptCode,
    };

    const receiptCode =
      lockerCode && lockerCode.trim().length > 0
        ? lockerCode.trim().toUpperCase()
        : `SD-${targetStation.code}-${crypto.randomInt(100, 999)}`;

    const originalStateHistory = [...item.stateHistory];

    try {
      if (action === "DEPOSIT") {
        item.custodyStatus = "DEPOSITED_AT_SAFE_DESK";
        item.safeDeskLocationId = targetStation._id;
        item.currentCustodyLocationId = targetStation._id;
        item.lockerReceiptCode = receiptCode;
        item.stateHistory.push({
          state: item.status,
          actorId: user._id,
          note: `Deposited at ${targetStation.name} [Locker Receipt: ${receiptCode}]. Condition: ${conditionNote || "Good"}. Reason: ${reason}`,
          timestamp: new Date(),
        });
        await item.save();

        await logAuditEvent({
          actorId: user._id,
          actorName: user.displayName,
          actorRole: user.role,
          action: "CUSTODY_DEPOSIT",
          targetType: "FOUND_ITEM",
          targetId: item._id,
          targetLabel: item.title || item.shortTitle,
          reason,
          beforeState: previousCustody,
          afterState: {
            custodyStatus: item.custodyStatus,
            safeDeskLocationId: item.safeDeskLocationId,
            currentCustodyLocationId: item.currentCustodyLocationId,
            lockerReceiptCode: item.lockerReceiptCode,
            conditionNote,
          },
        });

        return apiSuccess({
          itemId: item._id.toString(),
          custodyStatus: item.custodyStatus,
          lockerReceiptCode: item.lockerReceiptCode,
          stationId: targetStation._id.toString(),
          stationName: targetStation.name,
          stationCode: targetStation.code,
          message: `Item deposited at ${targetStation.name} with locker receipt ${receiptCode}.`,
        });
      }

      if (action === "TRANSFER") {
        item.safeDeskLocationId = targetStation._id;
        item.currentCustodyLocationId = targetStation._id;
        item.lockerReceiptCode = receiptCode;
        item.stateHistory.push({
          state: item.status,
          actorId: user._id,
          note: `Custody transferred to ${targetStation.name} [New Receipt: ${receiptCode}]. Reason: ${reason}`,
          timestamp: new Date(),
        });
        await item.save();

        await logAuditEvent({
          actorId: user._id,
          actorName: user.displayName,
          actorRole: user.role,
          action: "CUSTODY_TRANSFER",
          targetType: "FOUND_ITEM",
          targetId: item._id,
          targetLabel: item.title || item.shortTitle,
          reason,
          beforeState: previousCustody,
          afterState: {
            custodyStatus: item.custodyStatus,
            safeDeskLocationId: item.safeDeskLocationId,
            currentCustodyLocationId: item.currentCustodyLocationId,
            lockerReceiptCode: item.lockerReceiptCode,
          },
        });

        return apiSuccess({
          itemId: item._id.toString(),
          safeDeskLocationId: item.safeDeskLocationId.toString(),
          lockerReceiptCode: item.lockerReceiptCode,
          stationId: targetStation._id.toString(),
          stationName: targetStation.name,
          stationCode: targetStation.code,
          message: `Item custody transferred to ${targetStation.name}.`,
        });
      }
    } catch (err) {
      item.custodyStatus = previousCustody.custodyStatus;
      item.safeDeskLocationId = previousCustody.safeDeskLocationId;
      item.currentCustodyLocationId = previousCustody.currentCustodyLocationId;
      item.lockerReceiptCode = previousCustody.lockerReceiptCode;
      item.stateHistory = originalStateHistory;
      await item.save().catch(() => {});
      throw err;
    }

    return apiError("INVALID_ACTION", "Invalid custody action.", 400);
  } catch (error: any) {
    return apiError(
      "CUSTODY_ERROR",
      error.message || "Failed to update custody.",
      500
    );
  }
}
