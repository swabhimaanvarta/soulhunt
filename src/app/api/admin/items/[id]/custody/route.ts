import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { FoundItem, CampusLocation } from "@/models";
import { canManageStationCustody } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";
import crypto from "crypto";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action, stationId, lockerCode, conditionNote, reason } = body;

    if (!action || !["DEPOSIT", "TRANSFER"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Action must be DEPOSIT or TRANSFER." },
        { status: 400 }
      );
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: "A valid audit reason is required (minimum 5 characters)." },
        { status: 400 }
      );
    }

    await connectDB();

    const item = await FoundItem.findById(id);
    if (!item) {
      return NextResponse.json({ success: false, error: "Found item not found." }, { status: 404 });
    }

    // Validate station
    const targetStation = await CampusLocation.findById(stationId);
    if (!targetStation || !targetStation.isSafeDesk) {
      return NextResponse.json(
        { success: false, error: "Target location must be a valid registered Safe-Desk station." },
        { status: 400 }
      );
    }

    // Permission check: ensure staff is authorized for this station
    if (!canManageStationCustody(user, stationId)) {
      return NextResponse.json(
        { success: false, error: "You are not authorized to manage custody at this Safe-Desk station." },
        { status: 403 }
      );
    }

    const previousCustody = {
      custodyStatus: item.custodyStatus,
      safeDeskLocationId: item.safeDeskLocationId,
      lockerReceiptCode: item.lockerReceiptCode,
    };

    const receiptCode = lockerCode && lockerCode.trim().length > 0
      ? lockerCode.trim().toUpperCase()
      : `SD-${targetStation.code}-${crypto.randomInt(100, 999)}`;

    const originalStateHistory = [...item.stateHistory];

    try {
      if (action === "DEPOSIT") {
        item.custodyStatus = "DEPOSITED_AT_SAFE_DESK";
        item.safeDeskLocationId = targetStation._id;
        item.lockerReceiptCode = receiptCode;
        item.stateHistory.push({
          state: item.status,
          actorId: user._id,
          note: `Item deposited at Safe-Desk ${targetStation.name} [Locker: ${receiptCode}]. Condition: ${conditionNote || "Inspected intact"}. Reason: ${reason}`,
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
            lockerReceiptCode: item.lockerReceiptCode,
            conditionNote,
          },
        });

        return NextResponse.json({
          success: true,
          message: `Item successfully accepted into Safe-Desk custody at ${targetStation.name}.`,
          data: {
            itemId: item._id,
            custodyStatus: item.custodyStatus,
            lockerReceiptCode: item.lockerReceiptCode,
            station: targetStation.name,
          },
        });
      }

      if (action === "TRANSFER") {
        item.safeDeskLocationId = targetStation._id;
        item.lockerReceiptCode = receiptCode;
        item.stateHistory.push({
          state: item.status,
          actorId: user._id,
          note: `Custody transferred to Safe-Desk ${targetStation.name} [New Receipt: ${receiptCode}]. Reason: ${reason}`,
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
            lockerReceiptCode: item.lockerReceiptCode,
          },
        });

        return NextResponse.json({
          success: true,
          message: `Item custody transferred to ${targetStation.name}.`,
          data: {
            itemId: item._id,
            safeDeskLocationId: item.safeDeskLocationId,
            lockerReceiptCode: item.lockerReceiptCode,
            station: targetStation.name,
          },
        });
      }
    } catch (saveOrAuditError) {
      // Rollback item mutation if audit logging or saving fails
      item.custodyStatus = previousCustody.custodyStatus;
      item.safeDeskLocationId = previousCustody.safeDeskLocationId;
      item.lockerReceiptCode = previousCustody.lockerReceiptCode;
      item.stateHistory = originalStateHistory;
      await item.save().catch(() => {});
      throw saveOrAuditError;
    }

    return NextResponse.json({ success: false, error: "Invalid action." }, { status: 400 });
  } catch (error: any) {
    console.error("[Custody Error]:", error);
    return NextResponse.json(
      { success: false, error: { code: "CUSTODY_MUTATION_FAILED", message: "Failed to update item custody." } },
      { status: 500 }
    );
  }
}

