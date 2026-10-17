import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { LostItem, FoundItem, ClaimRequest, Notification } from "@/models";

const ClaimSchema = z.object({
  answerProvided: z.string().optional(),
  proofText: z.string().min(5).max(500),
  proofPhotoUrl: z.string().optional(),
  handoverPreference: z.enum(["SAFE_DESK", "DIRECT"]).default("SAFE_DESK"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Please log in to claim an item." }, { status: 401 });
    }

    const body = await req.json();
    const parsed = ClaimSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await connectDB();
    const { answerProvided, proofText, proofPhotoUrl, handoverPreference } = parsed.data;

    let lostItem = await LostItem.findById(id);
    let foundItem = null;
    let itemType: "LOST" | "FOUND" = "LOST";
    let counterpartyUserId: Types.ObjectId;

    if (lostItem) {
      counterpartyUserId = lostItem.reporterId;
      if (lostItem.reporterId.toString() === user._id.toString()) {
        return NextResponse.json({ success: false, error: "You cannot claim your own reported item." }, { status: 400 });
      }
    } else {
      foundItem = await FoundItem.findById(id);
      if (!foundItem) {
        return NextResponse.json({ success: false, error: "Item not found" }, { status: 404 });
      }
      itemType = "FOUND";
      counterpartyUserId = foundItem.finderId;
      if (foundItem.finderId.toString() === user._id.toString()) {
        return NextResponse.json({ success: false, error: "You cannot claim an item you reported finding." }, { status: 400 });
      }
    }

    // Generate secure 6-digit random handover code
    const handoverCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Check if verification answer matches (if item had a verificationAnswerHash)
    let autoApproved = false;
    if (lostItem?.verificationAnswerHash && answerProvided) {
      const cleanAnswer = answerProvided.toLowerCase().trim();
      const isMatch = await bcrypt.compare(cleanAnswer, lostItem.verificationAnswerHash);
      if (isMatch) {
        autoApproved = true;
      }
    }

    const claim = await ClaimRequest.create({
      itemId: new Types.ObjectId(id),
      itemType,
      claimantId: user._id,
      counterpartyUserId,
      status: autoApproved ? "APPROVED" : "PENDING_REVIEW",
      handoverCode,
      proofDetails: {
        answerProvided: answerProvided || "",
        proofText,
        proofPhotoUrl: proofPhotoUrl || "",
      },
    });

    // Update item status
    const targetDoc: any = lostItem || foundItem;
    if (targetDoc) {
      targetDoc.status = autoApproved ? "VERIFICATION" : "CLAIMED";
      targetDoc.currentClaimId = claim._id as Types.ObjectId;
      targetDoc.stateHistory.push({
        state: autoApproved ? "VERIFICATION" : "CLAIMED",
        actorId: user._id,
        note: `Claim submitted by ${user.displayName} (Handover code generated)`,
        timestamp: new Date(),
      });
      await targetDoc.save();
    }

    // Send notification to the counterparty
    await Notification.create({
      userId: counterpartyUserId,
      category: "CLAIM_UPDATE",
      title: "New Claim Received!",
      message: `${user.displayName} has submitted a claim for "${targetDoc?.title || targetDoc?.shortTitle || "item"}". Verify details or complete handover.`,
      linkUrl: `/items/${id}`,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          claimId: claim._id,
          status: claim.status,
          handoverCode, // Show code to claimant for physical verification
          autoApproved,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
