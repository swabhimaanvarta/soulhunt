import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ClaimRequest, FraudAlert } from "@/models";
import { isStaffOrModerator } from "@/lib/permissions";
import { logAuditEvent } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || !isStaffOrModerator(user)) {
      return NextResponse.json(
        { success: false, error: "Authorized staff or moderator credentials required." },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const { reason, notes, flagFraud } = body;

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: "A valid escalation reason is required (minimum 5 characters)." },
        { status: 400 }
      );
    }

    await connectDB();

    const claim = await ClaimRequest.findById(id);
    if (!claim) {
      return NextResponse.json({ success: false, error: "Claim request not found." }, { status: 404 });
    }

    const previousStatus = claim.status;
    claim.status = "DISPUTED";
    claim.notes = `${claim.notes ? claim.notes + "\n" : ""}[ESCALATED by ${user.displayName} (${user.role})]: ${reason}. Details: ${notes || "No extra notes"}`;
    claim.reviewedBy = user._id;
    claim.reviewedAt = new Date();
    await claim.save();

    // If flagged as suspicious, create a FraudAlert for security review
    if (flagFraud) {
      await FraudAlert.create({
        involvedUserIds: [claim.claimantId, claim.counterpartyUserId].filter(Boolean),
        alertType: "SUSPICIOUS_CLAIM",
        severity: "HIGH",
        details: `Claim ${claim._id} escalated to DISPUTED by ${user.displayName}. Reason: ${reason}. Notes: ${notes || ""}`,
        referenceId: claim._id,
        status: "OPEN",
      });
    }

    await logAuditEvent({
      actorId: user._id,
      actorName: user.displayName,
      actorRole: user.role,
      action: "CLAIM_ESCALATED_DISPUTED",
      targetType: "CLAIM",
      targetId: claim._id,
      targetLabel: `Claim for item ${claim.itemId}`,
      reason,
      beforeState: { status: previousStatus },
      afterState: { status: "DISPUTED", flaggedFraud: Boolean(flagFraud), notes },
    });

    return NextResponse.json({
      success: true,
      message: "Claim successfully escalated to DISPUTED status.",
      data: {
        claimId: claim._id,
        status: claim.status,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

