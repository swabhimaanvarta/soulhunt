import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ClaimRequest, LostItem, FoundItem, Quest, Investigation, User } from "@/models";
import {
  checkPairCollusion,
  grantUserRewards,
  distributeSquadQuestRewards,
} from "@/lib/economy";

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

    await connectDB();
    const { claimId, handoverCode } = parsed.data;

    const claim = await ClaimRequest.findById(claimId).select("+handoverCode");
    if (!claim || claim.status !== "APPROVED") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CLAIM_NOT_READY",
            message: "Claim is not in APPROVED handover state.",
          },
        },
        { status: 400 }
      );
    }

    if (claim.handoverCode !== handoverCode.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "CODE_MISMATCH", message: "Invalid 6-digit recovery handover code." },
        },
        { status: 403 }
      );
    }

    const collusionCheck = await checkPairCollusion(
      claim.claimantId,
      claim.counterpartyUserId,
      claim._id as Types.ObjectId
    );

    claim.status = "HANDOVER_COMPLETE";
    claim.reviewedAt = new Date();
    await claim.save();

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

    const finderId =
      claim.itemType === "LOST" ? claim.claimantId : claim.counterpartyUserId;
    const ownerId =
      claim.itemType === "LOST" ? claim.counterpartyUserId : claim.claimantId;

    await User.findByIdAndUpdate(finderId, {
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
          finderUserId: finderId,
          baseXp: quest.xpReward,
          baseCoins: quest.coinReward,
          squadXpReward: quest.squadXpReward,
          questId: quest._id as Types.ObjectId,
          questTitle: quest.title,
        });
      } else if (quest) {
        await grantUserRewards({
          userId: finderId,
          baseXp: quest.xpReward,
          baseCoins: quest.coinReward,
          deltaTrust: 25,
          reason: `Completed Recovery Quest: ${quest.title}`,
          referenceType: "RECOVERY",
          referenceId: claim._id as Types.ObjectId,
          counterpartyUserId: ownerId,
        });
      }
    } else {
      await grantUserRewards({
        userId: finderId,
        baseXp: 120,
        baseCoins: 25,
        deltaTrust: 20,
        reason: "Verified Campus Item Recovery",
        referenceType: "RECOVERY",
        referenceId: claim._id as Types.ObjectId,
        counterpartyUserId: ownerId,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        status: "COMPLETED",
        message:
          "Recovery verified! XP, Coins, Trust Score, and Achievement progress have been credited.",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: error.message || "Verification failed" },
      },
      { status: 500 }
    );
  }
}
