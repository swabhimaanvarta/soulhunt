import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { LostItem, FoundItem, ClaimRequest, Notification } from "@/models";

import crypto from "crypto";
import { checkRateLimit } from "@/lib/rateLimit";

const ClaimSchema = z.object({
  answerProvided: z.string().optional(),
  proofText: z.string().min(5).max(500),
  proofPhotoUrl: z.string().optional(),
  handoverPreference: z.enum(["SAFE_DESK", "DIRECT"]).default("SAFE_DESK"),
  requestId: z.string().max(64).optional(),
  clientRequestId: z.string().max(64).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please log in to claim an item." } },
        { status: 401 }
      );
    }

    if (user.accountStatus === "PENDING_VERIFICATION") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNVERIFIED_EMAIL",
            message: "Please verify your institutional email before submitting claims.",
          },
        },
        { status: 403 }
      );
    }

    // Rate limit claims: max 10 claim submissions per hour per user
    const rateLimitKey = `claim_${user._id}`;
    const rateLimit = await checkRateLimit(rateLimitKey, 10, 3600);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Too many claim submissions. Please wait before attempting another claim.",
          },
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = ClaimSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_FAILED",
            message: parsed.error.issues[0]?.message || "Validation failed",
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    await connectDB();
    const { answerProvided, proofText, proofPhotoUrl } = parsed.data;

    // Idempotency & duplicate claim prevention: check for existing active claim
    const existingActiveClaim = await ClaimRequest.findOne({
      itemId: new Types.ObjectId(id),
      claimantId: user._id,
      status: { $in: ["PENDING", "APPROVED"] },
    });

    if (existingActiveClaim) {
      return NextResponse.json(
        {
          success: true,
          replayed: true,
          message: "An active claim already exists for this item.",
          data: {
            claimId: existingActiveClaim._id,
            status: existingActiveClaim.status,
            autoApproved: existingActiveClaim.status === "APPROVED",
          },
        },
        { status: 200 }
      );
    }

    let lostItem = await LostItem.findById(id).select("+verificationAnswerHash");
    let foundItem = null;
    let itemType: "LOST" | "FOUND" = "LOST";
    let counterpartyUserId: Types.ObjectId;

    if (lostItem) {
      counterpartyUserId = lostItem.reporterId;
      if (lostItem.reporterId.toString() === user._id.toString()) {
        return NextResponse.json(
          { success: false, error: { code: "SELF_CLAIM_PROHIBITED", message: "You cannot claim your own reported item." } },
          { status: 400 }
        );
      }
      if (["COMPLETED", "RECOVERED", "ARCHIVED", "REJECTED"].includes(lostItem.status)) {
        return NextResponse.json(
          { success: false, error: { code: "ITEM_UNAVAILABLE", message: "This item is no longer available for claims." } },
          { status: 400 }
        );
      }
    } else {
      foundItem = await FoundItem.findById(id);
      if (!foundItem) {
        return NextResponse.json(
          { success: false, error: { code: "ITEM_NOT_FOUND", message: "Item not found" } },
          { status: 404 }
        );
      }
      itemType = "FOUND";
      counterpartyUserId = foundItem.finderId;
      if (foundItem.finderId.toString() === user._id.toString()) {
        return NextResponse.json(
          { success: false, error: { code: "SELF_CLAIM_PROHIBITED", message: "You cannot claim an item you reported finding." } },
          { status: 400 }
        );
      }
      if (["COMPLETED", "RECOVERED", "ARCHIVED", "REJECTED"].includes(foundItem.status)) {
        return NextResponse.json(
          { success: false, error: { code: "ITEM_UNAVAILABLE", message: "This item is no longer available for claims." } },
          { status: 400 }
        );
      }
    }

    // Check if verification answer matches (if item had a verificationAnswerHash)
    let autoApproved = false;
    if (lostItem?.verificationAnswerHash && answerProvided) {
      const cleanAnswer = answerProvided.toLowerCase().trim();
      const isMatch = await bcrypt.compare(cleanAnswer, lostItem.verificationAnswerHash);
      if (isMatch) {
        autoApproved = true;
      }
    }

    // Generate cryptographic 6-digit random handover PIN if autoApproved
    let handoverCode: string | undefined = undefined;
    let handoverCodeHash: string | undefined = undefined;
    let handoverCodeExpiresAt: Date | undefined = undefined;

    if (autoApproved) {
      handoverCode = crypto.randomInt(100000, 1000000).toString();
      handoverCodeHash = await bcrypt.hash(handoverCode, 10);
      handoverCodeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24-hour validity policy
    }

    const claim = await ClaimRequest.create({
      itemId: new Types.ObjectId(id),
      itemType,
      claimantId: user._id,
      counterpartyUserId,
      submittedAnswer: answerProvided || "",
      proofPhotoUrl: proofPhotoUrl || "",
      notes: proofText,
      status: autoApproved ? "APPROVED" : "PENDING",
      ...(autoApproved
        ? {
            handoverCode,
            handoverCodeHash,
            handoverCodeExpiresAt,
            handoverAttempts: 0,
            handoverLocked: false,
          }
        : {}),
    });

    // Update item status
    const targetDoc: any = lostItem || foundItem;
    if (targetDoc) {
      targetDoc.status = autoApproved ? "VERIFICATION" : "CLAIMED";
      targetDoc.currentClaimId = claim._id as Types.ObjectId;
      targetDoc.stateHistory.push({
        state: autoApproved ? "VERIFICATION" : "CLAIMED",
        actorId: user._id,
        note: autoApproved
          ? `Claim auto-approved by secret verification match.`
          : `Claim submitted by ${user.displayName}. Pending review.`,
        timestamp: new Date(),
      });
      await targetDoc.save();
    }

    // Send notification to the counterparty
    await Notification.create({
      userId: counterpartyUserId,
      category: "CLAIM_UPDATE",
      title: autoApproved ? "Claim Verified & Approved!" : "New Claim Received!",
      message: autoApproved
        ? (itemType === "LOST"
            ? `Your lost item has been located! Your 6-digit recovery PIN is ${handoverCode}. Give this PIN to the finder when you receive your item.`
            : `${user.displayName} verified ownership of "${targetDoc?.title || targetDoc?.shortTitle || "item"}". They will present their 6-digit PIN upon handover.`)
        : `${user.displayName} has submitted a claim for "${targetDoc?.title || targetDoc?.shortTitle || "item"}". Please review their evidence.`,
      linkUrl: `/items/${id}`,
    });

    // Determine if claimant is the receiving party (FOUND item -> claimant receives item and holds code)
    const claimantIsReceiver = itemType === "FOUND";

    return NextResponse.json(
      {
        success: true,
        data: {
          claimId: claim._id,
          status: claim.status,
          // Only disclose handoverCode directly in response if claimant is the verified receiving party
          ...(autoApproved && claimantIsReceiver ? { handoverCode } : {}),
          autoApproved,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
