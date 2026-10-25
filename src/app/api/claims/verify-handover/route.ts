import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ClaimRequest, LostItem, FoundItem, Quest, Investigation, User, Notification } from "@/models";
import {
  checkPairCollusion,
  grantUserRewards,
  distributeSquadQuestRewards,
} from "@/lib/economy";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const HandoverVerifySchema = z.object({
  claimId: z.string(),
  handoverCode: z.string().length(6),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please sign in." } },
        { status: 401 }
      );
    }

    if (user.accountStatus === "PENDING_VERIFICATION") {
      return NextResponse.json(
        { success: false, error: { code: "UNVERIFIED", message: "Please verify your email before verifying handovers." } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = HandoverVerifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_CODE", message: "Enter a valid 6-digit handover code." },
        },
        { status: 400 }
      );
    }

    const { claimId, handoverCode } = parsed.data;

    // Rate limit: 10 handover verification attempts per 15 minutes per IP
    const clientIp = getClientIp(req);
    const ipRate = await checkRateLimit(`handover_ip_${clientIp}`, 10, 900);
    if (!ipRate.allowed) {
      return NextResponse.json(
        { success: false, error: { code: "RATE_LIMITED", message: "Too many verification attempts from this IP. Please wait." } },
        { status: 429 }
      );
    }

    // Rate limit: 5 attempts per claim
    const claimRate = await checkRateLimit(`handover_claim_${claimId}`, 5, 900);
    if (!claimRate.allowed) {
      return NextResponse.json(
        { success: false, error: { code: "RATE_LIMITED", message: "Too many attempts on this claim ticket. Please wait 15 minutes." } },
        { status: 429 }
      );
    }

    await connectDB();

    const claim = await ClaimRequest.findById(claimId).select("+handoverCode +handoverCodeHash");
    if (!claim || claim.status !== "APPROVED") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CLAIM_NOT_READY",
            message: "Claim is not in an APPROVED handover state.",
          },
        },
        { status: 400 }
      );
    }

    // Check if claim is locked
    if (claim.handoverLocked || (claim.handoverAttempts && claim.handoverAttempts >= 5)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CLAIM_LOCKED",
            message: "Handover verification locked due to excessive failed attempts. Contact a Campus Moderator.",
          },
        },
        { status: 423 }
      );
    }

    // Check code expiration (24 hour validity policy)
    if (claim.handoverCodeExpiresAt && new Date() > claim.handoverCodeExpiresAt) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CODE_EXPIRED",
            message: "This handover code has expired. Please request a new verification code from the item owner.",
          },
        },
        { status: 400 }
      );
    }

    // Dynamic Custodian Verification:
    // In LOST items: claimant is finder (custodian surrendering item); counterparty is owner (receiving item).
    // In FOUND items: counterparty is finder (custodian surrendering item); claimant is owner (receiving item).
    const finderUserId: Types.ObjectId =
      claim.itemType === "LOST" ? claim.claimantId : claim.counterpartyUserId;
    const ownerUserId: Types.ObjectId =
      claim.itemType === "LOST" ? claim.counterpartyUserId : claim.claimantId;

    const finderIdStr = finderUserId.toString();
    const ownerIdStr = ownerUserId.toString();

    const callerId = user._id.toString();
    const isStaff = user.role === "ADMIN" || user.role === "MODERATOR" || user.role === "SAFE_DESK_STAFF";

    // Safe-Desk Staff Station Authorization Guard
    if (user.role === "SAFE_DESK_STAFF") {
      const staffStationId = user.assignedStationId?.toString();
      const staffStationIds = Array.isArray(user.assignedStationIds)
        ? user.assignedStationIds.map((id: any) => id.toString())
        : [];

      if (!staffStationId && staffStationIds.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "STAFF_UNASSIGNED",
              message: "Safe-Desk staff account has no active campus station assignment.",
            },
          },
          { status: 403 }
        );
      }

      // Load item to check its custody location
      let itemStation: string | null = null;
      if (claim.itemType === "FOUND") {
        const found = await FoundItem.findById(claim.itemId).select("safeDeskLocationId currentCustodyLocationId custodyStatus");
        if (!found || !["DEPOSITED_AT_SAFE_DESK", "SAFE_DESK"].includes(found.custodyStatus)) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "CUSTODY_NOT_AT_STATION",
                message: "Item is not currently in physical custody at a registered Safe-Desk counter.",
              },
            },
            { status: 403 }
          );
        }
        itemStation = (found.safeDeskLocationId || found.currentCustodyLocationId)?.toString() || null;
      } else if (claim.itemType === "LOST") {
        const lost = await LostItem.findById(claim.itemId).select("lastKnownLocationId");
        itemStation = (lost?.lastKnownLocationId?.toString() || staffStationId) ?? null;
      }

      const isAssigned = itemStation && (itemStation === staffStationId || staffStationIds.includes(itemStation));
      if (!isAssigned) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "STATION_MISMATCH",
              message: "You are only authorized to certify handovers for items physically held at your assigned Safe-Desk station.",
            },
          },
          { status: 403 }
        );
      }
    }

    // Receiving party is strictly forbidden from certifying their own handover
    if (callerId === ownerIdStr && !isStaff) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RECEIVER_CANNOT_CERTIFY",
            message: "The receiving party cannot certify handover. Only the item custodian or Campus Staff can verify.",
          },
        },
        { status: 403 }
      );
    }

    // Caller must be the surrendering custodian or campus staff
    if (callerId !== finderIdStr && !isStaff) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED_CUSTODIAN",
            message: "Only the verified item custodian or Campus Staff can verify physical handover.",
          },
        },
        { status: 403 }
      );
    }

    // Strict cryptographic hash verification (No plaintext fallbacks)
    if (!claim.handoverCodeHash) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_STATE", message: "Handover PIN hash not found. Please re-issue code." },
        },
        { status: 400 }
      );
    }

    const isMatch = await bcrypt.compare(handoverCode.trim(), claim.handoverCodeHash);

    if (!isMatch) {
      const updatedClaim = await ClaimRequest.findOneAndUpdate(
        { _id: claim._id, status: "APPROVED" },
        { $inc: { handoverAttempts: 1 } },
        { new: true }
      );

      const attempts = updatedClaim?.handoverAttempts || (claim.handoverAttempts || 0) + 1;
      const shouldLock = attempts >= 5;

      if (shouldLock) {
        await ClaimRequest.findByIdAndUpdate(claim._id, {
          handoverLocked: true,
          status: "LOCKED",
        });
      }

      const remaining = Math.max(0, 5 - attempts);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CODE_MISMATCH",
            message: shouldLock
              ? "Maximum verification attempts exceeded. Claim ticket has been locked for security."
              : `Invalid 6-digit recovery code. ${remaining} attempt(s) remaining before lock.`,
          },
        },
        { status: 403 }
      );
    }

    const collusionCheck = await checkPairCollusion(
      claim.claimantId,
      claim.counterpartyUserId,
      claim._id as Types.ObjectId
    );

    // Idempotent atomic state transition with settlementStatus tracking
    const settlementKey = `claim_${claim._id}_settle`;
    const settledClaim = await ClaimRequest.findOneAndUpdate(
      {
        _id: claim._id,
        status: "APPROVED",
      },
      {
        $set: {
          status: "HANDOVER_COMPLETE",
          settlementStatus: "PENDING",
          reviewedAt: new Date(),
          reviewedBy: user._id,
          settlementIdempotencyKey: settlementKey,
        },
      },
      { new: true }
    );

    if (!settledClaim) {
      const existingSettled = await ClaimRequest.findById(claim._id);
      if (existingSettled?.settlementStatus === "COMPLETED") {
        return NextResponse.json({
          success: true,
          data: {
            status: "COMPLETED",
            message: "Item handover has already been verified and processed.",
          },
        });
      }
    }

    const now = new Date();
    let linkedQuestId: Types.ObjectId | null = null;

    if (claim.itemType === "LOST") {
      const lostItem = await LostItem.findById(claim.itemId);
      if (lostItem) {
        lostItem.status = "COMPLETED";
        lostItem.stateHistory.push(
          {
            state: "RECOVERED",
            actorId: user._id as Types.ObjectId,
            note: "Physical handover code verified",
            timestamp: now,
          },
          {
            state: "COMPLETED",
            actorId: user._id as Types.ObjectId,
            note: "Lifecycle complete",
            timestamp: now,
          }
        );
        await lostItem.save();
        linkedQuestId = lostItem.linkedQuestId || null;
      }
    } else {
      const foundItem = await FoundItem.findById(claim.itemId);
      if (foundItem) {
        foundItem.status = "COMPLETED";
        foundItem.stateHistory.push(
          {
            state: "RECOVERED",
            actorId: user._id as Types.ObjectId,
            note: "Physical handover code verified",
            timestamp: now,
          },
          {
            state: "COMPLETED",
            actorId: user._id as Types.ObjectId,
            note: "Lifecycle complete",
            timestamp: now,
          }
        );
        await foundItem.save();
        linkedQuestId = foundItem.linkedQuestId || null;
      }
    }

    if (collusionCheck.isCollusion) {
      return NextResponse.json({
        success: true,
        data: {
          status: "COMPLETED_REWARDS_HELD",
          message:
            "Item handover recorded! Rewards are temporarily held for standard pair-frequency verification by a Moderator.",
        },
      });
    }

    await User.findByIdAndUpdate(finderUserId, {
      $inc: { "stats.recoveriesCount": 1 },
    });

    if (linkedQuestId) {
      const quest = await Quest.findById(linkedQuestId);
      const squadInv = await Investigation.findOne({
        questId: linkedQuestId,
        isSquadInvestigation: true,
      });

      if (quest && squadInv && squadInv.squadId) {
        squadInv.progressPct = 100;
        squadInv.status = "COMPLETED";
        await squadInv.save();

        await distributeSquadQuestRewards({
          squadId: squadInv.squadId,
          participatingUserIds: squadInv.participatingUserIds,
          finderUserId: finderUserId,
          baseXp: quest.xpReward,
          baseCoins: quest.coinReward,
          squadXpReward: quest.squadXpReward,
          questId: quest._id as Types.ObjectId,
          questTitle: quest.title,
        });
      } else if (quest) {
        await grantUserRewards({
          userId: finderUserId,
          baseXp: quest.xpReward,
          baseCoins: quest.coinReward,
          deltaTrust: 25,
          reason: `Completed Recovery Quest: ${quest.title}`,
          referenceType: "RECOVERY",
          referenceId: claim._id as Types.ObjectId,
          counterpartyUserId: ownerUserId,
        });
      }
    } else {
      await grantUserRewards({
        userId: finderUserId,
        baseXp: 120,
        baseCoins: 25,
        deltaTrust: 20,
        reason: "Verified Campus Item Recovery",
        referenceType: "RECOVERY",
        referenceId: claim._id as Types.ObjectId,
        counterpartyUserId: ownerUserId,
      });
    }

    // Send notifications to both parties
    await Notification.create({
      userId: ownerUserId,
      category: "CLAIM_UPDATE",
      title: "Handover Verified!",
      message: "Your item recovery has been verified in person. Glad AIEM Hunt could help!",
      linkUrl: `/items/${claim.itemId}`,
    });

    await Notification.create({
      userId: finderUserId,
      category: "SYSTEM_REWARD",
      title: "Recovery Rewards Credited!",
      message: "Physical handover was successfully certified. XP, Coins, and Trust have been awarded.",
      linkUrl: `/items/${claim.itemId}`,
    });

    // Mark settlement as fully completed
    await ClaimRequest.findByIdAndUpdate(claim._id, {
      $set: { settlementStatus: "COMPLETED" },
    });

    return NextResponse.json({
      success: true,
      data: {
        status: "COMPLETED",
        message:
          "Recovery verified! XP, Coins, Trust Score, and Achievement progress have been credited.",
      },
    });
  } catch (error: any) {
    console.error("[Handover Verification Error]:", error);
    return NextResponse.json(
      {
        success: false,
        error: { code: "VERIFICATION_FAILED", message: "Handover verification failed. Please try again." },
      },
      { status: 500 }
    );
  }
}
