import { NextRequest } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { FoundItem, CampusLocation } from "@/models";
import { canManageStationCustody, isStaffOrModerator } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import { apiSuccess, apiError } from "@/lib/api-response";

/**
 * POST /api/staff/transfer
 * Transfers physical custody of an item from origin Safe-Desk station to destination station.
 * Enforces station authorization, issues a new locker receipt code for the destination station,
 * and records an immutable audit log.
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
    const { itemId, toStationId, conditionNote, reason, lockerCode } = body;

    if (!itemId) {
      return apiError(
        "ITEM_REQUIRED",
        "Item ID is required.",
        400
      );
    }

    if (!toStationId) {
      return apiError(
        "TARGET_STATION_REQUIRED",
        "Destination Safe-Desk station ID is required.",
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

    await connectDB();

    const destinationStation = await CampusLocation.findById(toStationId);
    if (!destinationStation || !destinationStation.isSafeDesk) {
      return apiError(
        "INVALID_STATION",
        "Destination location is not a registered Safe-Desk station.",
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

    const originStationId = item.safeDeskLocationId?.toString();
    if (originStationId && originStationId === destinationStation._id.toString()) {
      return apiError(
        "SAME_STATION",
        "Item is already deposited at this Safe-Desk station.",
        400
      );
    }

    // Permission check: Safe-Desk staff must have custody authority over origin or destination station
    const hasOriginAuth = originStationId ? canManageStationCustody(user, originStationId) : false;
    const hasDestAuth = canManageStationCustody(user, destinationStation._id.toString());

    if (!hasOriginAuth && !hasDestAuth) {
      return apiError(
        "CROSS_STATION_MUTATION_DENIED",
        "Staff members can only transfer items involving their assigned campus Safe-Desk station.",
        403
      );
    }

    const previousCustody = {
      custodyStatus: item.custodyStatus,
      safeDeskLocationId: item.safeDeskLocationId,
      currentCustodyLocationId: item.currentCustodyLocationId,
      lockerReceiptCode: item.lockerReceiptCode,
    };

    const newReceiptCode =
      lockerCode && lockerCode.trim().length > 0
        ? lockerCode.trim().toUpperCase()
        : `SD-${destinationStation.code}-${crypto.randomInt(100, 999)}`;

    const originStation = originStationId ? await CampusLocation.findById(originStationId).lean() : null;
    const originalStateHistory = [...item.stateHistory];

    try {
      item.custodyStatus = "DEPOSITED_AT_SAFE_DESK";
      item.safeDeskLocationId = destinationStation._id;
      item.currentCustodyLocationId = destinationStation._id;
      item.lockerReceiptCode = newReceiptCode;
      item.stateHistory.push({
        state: item.status,
        actorId: user._id,
        note: `Custody transferred from ${originStation?.name || "Previous Station"} to ${destinationStation.name} [New Locker Receipt: ${newReceiptCode}]. ${conditionNote ? `Condition: ${conditionNote}. ` : ""}Reason: ${reason}`,
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
          transferredFromStationId: originStationId,
          transferredToStationId: destinationStation._id,
          conditionNote,
        },
      });

      return apiSuccess({
        itemId: item._id.toString(),
        previousStationId: originStationId || null,
        previousStationName: originStation?.name || null,
        safeDeskLocationId: destinationStation._id.toString(),
        stationName: destinationStation.name,
        stationCode: destinationStation.code,
        lockerReceiptCode: newReceiptCode,
        message: `Item custody transferred to ${destinationStation.name} [Locker: ${newReceiptCode}].`,
      });
    } catch (saveErr) {
      item.custodyStatus = previousCustody.custodyStatus;
      item.safeDeskLocationId = previousCustody.safeDeskLocationId;
      item.currentCustodyLocationId = previousCustody.currentCustodyLocationId;
      item.lockerReceiptCode = previousCustody.lockerReceiptCode;
      item.stateHistory = originalStateHistory;
      await item.save().catch(() => {});
      throw saveErr;
    }
  } catch (error: any) {
    return apiError(
      "TRANSFER_ERROR",
      error.message || "Failed to transfer item custody.",
      500
    );
  }
}
