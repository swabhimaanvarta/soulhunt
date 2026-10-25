import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ClaimRequest, FoundItem, LostItem } from "@/models";
import { canManageStationCustody, isStaffOrModerator } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !isStaffOrModerator(user)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Safe-Desk staff authorization required." } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { claimId, reason } = body;

    if (!claimId) {
      return NextResponse.json(
        { success: false, error: { code: "CLAIM_REQUIRED", message: "Claim ID is required." } },
        { status: 400 }
      );
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: { code: "REASON_REQUIRED", message: "Audit reason required (minimum 5 characters)." } },
        { status: 400 }
      );
    }

    await connectDB();

    const claim = await ClaimRequest.findById(claimId);
    if (!claim) {
      return NextResponse.json(
        { success: false, error: { code: "CLAIM_NOT_FOUND", message: "Claim not found." } },
        { status: 404 }
      );
    }

    if (claim.status !== "APPROVED") {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_STATE", message: "Only approved claims can have their handover PIN reset." } },
        { status: 400 }
      );
    }

    // Check station scoping if the caller is Safe-Desk staff
    if (user.role === "SAFE_DESK_STAFF") {
      let itemStationId: string | null = null;
      if (claim.itemType === "FOUND") {
        const found = await FoundItem.findById(claim.itemId).select("safeDeskLocationId currentCustodyLocationId");
        itemStationId = (found?.safeDeskLocationId || found?.currentCustodyLocationId)?.toString() || null;
      } else if (claim.itemType === "LOST") {
        const lost = await LostItem.findById(claim.itemId).select("lastKnownLocationId");
        itemStationId = lost?.lastKnownLocationId?.toString() || null;
      }
      if (!canManageStationCustody(user, itemStationId)) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "STATION_MISMATCH",
              message: "You can only reset PINs for items held at your assigned Safe-Desk station.",
            },
          },
          { status: 403 }
        );
      }
    }

    // Generate new 6-digit cryptographic PIN
    const newRawPin = crypto.randomInt(100000, 999999).toString();
    const newPinHash = await bcrypt.hash(newRawPin, 10);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const beforeState = {
      handoverLocked: claim.handoverLocked,
      handoverAttempts: claim.handoverAttempts,
      lockoutUntil: claim.lockoutUntil,
      status: claim.status,
    };

    claim.handoverLocked = false;
    claim.handoverAttempts = 0;
    claim.lockoutUntil = null;
    claim.handoverCodeHash = newPinHash;
    claim.handoverCodeExpiresAt = expiresAt;
    await claim.save();

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "CUSTODIAN_PIN_RESET",
      targetType: "CLAIM",
      targetId: claim._id,
      targetLabel: `Claim for item ${claim.itemId}`,
      reason,
      beforeState,
      afterState: {
        handoverLocked: false,
        handoverAttempts: 0,
        lockoutUntil: null,
        status: claim.status,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Handover PIN successfully reset and unlocked.",
      data: {
        claimId: claim._id,
        newHandoverCode: newRawPin,
        expiresAt,
        status: claim.status,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "SERVER_ERROR", message: error.message || "Failed to reset PIN." } },
      { status: 500 }
    );
  }
}
