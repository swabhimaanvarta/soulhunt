import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  Investigation,
  Quest,
  Clue,
  LostItem,
  FoundItem,
  ClaimRequest,
  User,
  Notification,
} from "@/models";
import {
  grantUserRewards,
  distributeSquadQuestRewards,
  checkPairCollusion,
} from "@/lib/economy";

const RecoverSchema = z.object({
  handoverCode: z.string().length(6).optional(),
  recoveryNotes: z.string().max(1000).optional(),
  photoUrl: z.string().url().or(z.string().startsWith("/api/evidence/")).or(z.string().startsWith("/uploads/")).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: "Please sign in." } },
        { status: 401 }
      );
    }

    const { id: investigationId } = await params;
    await connectDB();

    const investigation = await Investigation.findById(investigationId);
    if (!investigation) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Investigation not found." } },
        { status: 404 }
      );
    }

    // Authorize caller: must be owner, registered participant, squad mate, or staff
    const callerId = user._id.toString();
    const isOwner = investigation.userId?.toString() === callerId;
    const isParticipant =
      isOwner ||
      investigation.participatingUserIds?.some((p: any) => p.toString() === callerId) ||
      (investigation.squadId && user.squadId && investigation.squadId.toString() === user.squadId.toString()) ||
      user.role === "ADMIN" ||
      user.role === "MODERATOR";

    if (!isParticipant) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "You are not authorized to claim recovery for this investigation.",
          },
        },
        { status: 403 }
      );
    }

    if (investigation.status === "COMPLETED") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "ALREADY_COMPLETED",
            message: "This investigation has already been verified and rewards credited.",
          },
        },
        { status: 400 }
      );
    }

    const quest = await Quest.findById(investigation.questId);
    if (!quest) {
      return NextResponse.json(
        { success: false, error: { code: "QUEST_NOT_FOUND", message: "Linked quest not found." } },
        { status: 404 }
      );
    }

    // Verify all clues solved or investigation is READY_FOR_RECOVERY
    const totalClues = await Clue.countDocuments({ questId: quest._id });
    const solvedCount = investigation.solvedClues?.length || 0;

    if (solvedCount < totalClues && investigation.status !== "READY_FOR_RECOVERY") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CLUES_INCOMPLETE",
            message: `You must solve all ${totalClues} clues before claiming recovery. (${solvedCount}/${totalClues} solved)`,
          },
        },
        { status: 400 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is allowed for campus treasure hunts
    }
    const parsed = RecoverSchema.safeParse(body);
    const { handoverCode, recoveryNotes, photoUrl } = parsed.success
      ? parsed.data
      : { handoverCode: undefined, recoveryNotes: undefined, photoUrl: undefined };

    // CASE 1: Real-World Lost Item Investigation
    if (quest.linkedLostItemId) {
      const lostItem = await LostItem.findById(quest.linkedLostItemId);

      // If physical 6-digit handover code provided
      if (handoverCode) {
        const claim = await ClaimRequest.findOne({
          itemId: lostItem?._id,
          status: "APPROVED",
        }).select("+handoverCode +handoverCodeHash");

        let isMatch = false;
        if (claim?.handoverCodeHash) {
          isMatch = await bcrypt.compare(handoverCode.trim(), claim.handoverCodeHash);
        } else if (claim?.handoverCode) {
          isMatch = claim.handoverCode === handoverCode.trim();
        }

        if (!claim || !isMatch) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: "INVALID_CODE",
                message: "Handover code does not match the active claim ticket.",
              },
            },
            { status: 403 }
          );
        }

        // Run pair collusion check
        const collusion = await checkPairCollusion(
          claim.claimantId,
          claim.counterpartyUserId,
          claim._id as Types.ObjectId
        );

        claim.status = "HANDOVER_COMPLETE";
        claim.reviewedAt = new Date();
        await claim.save();

        if (lostItem) {
          lostItem.status = "COMPLETED";
          lostItem.stateHistory.push({
            state: "COMPLETED",
            actorId: user._id as Types.ObjectId,
            note: "Verified via investigation handover code",
            timestamp: new Date(),
          });
          await lostItem.save();
        }

        investigation.status = "COMPLETED";
        investigation.progressPct = 100;
        await investigation.save();

        if (collusion.isCollusion) {
          return NextResponse.json({
            success: true,
            data: {
              status: "COMPLETED_REWARDS_HELD",
              message: "Handover recorded! Rewards held for standard moderator verification.",
            },
          });
        }

        // Payout rewards
        if (investigation.isSquadInvestigation && investigation.squadId) {
          await distributeSquadQuestRewards({
            squadId: investigation.squadId,
            participatingUserIds: investigation.participatingUserIds,
            finderUserId: user._id as Types.ObjectId,
            baseXp: quest.xpReward,
            baseCoins: quest.coinReward,
            squadXpReward: quest.squadXpReward,
            questId: quest._id as Types.ObjectId,
            questTitle: quest.title,
          });
        } else {
          await grantUserRewards({
            userId: user._id as Types.ObjectId,
            baseXp: quest.xpReward,
            baseCoins: quest.coinReward,
            deltaTrust: 30,
            reason: `Item Recovered: ${quest.title}`,
            referenceType: "RECOVERY",
            referenceId: claim._id as Types.ObjectId,
            counterpartyUserId: claim.counterpartyUserId,
          });
        }

        return NextResponse.json({
          success: true,
          data: {
            status: "COMPLETED",
            message: "Item recovery verified via Handover Code! Rewards distributed.",
            xpAwarded: quest.xpReward,
            coinsAwarded: quest.coinReward,
          },
        });
      }

      // No handover code, but photo/notes submitted: Move to SUBMITTED_FOR_VERIFICATION
      investigation.status = "SUBMITTED_FOR_VERIFICATION";
      investigation.progressPct = 95;

      if (recoveryNotes || photoUrl) {
        investigation.evidenceNodes.push({
          authorId: user._id as Types.ObjectId,
          authorName: user.displayName,
          type: photoUrl ? "PHOTO" : "THEORY",
          title: "Recovery Submission Evidence",
          content: recoveryNotes || "Recovery submitted at target location",
          mediaUrl: photoUrl || "",
          linkedStageOrder: totalClues,
          upvotes: [],
          createdAt: new Date(),
        });
      }
      await investigation.save();

      if (lostItem) {
        lostItem.status = "VERIFICATION";
        lostItem.stateHistory.push({
          state: "VERIFICATION",
          actorId: user._id as Types.ObjectId,
          note: `Investigation recovery submitted by ${user.displayName}`,
          timestamp: new Date(),
        });
        await lostItem.save();
      }

      return NextResponse.json({
        success: true,
        data: {
          status: "SUBMITTED_FOR_VERIFICATION",
          message:
            "Recovery evidence submitted! Awaiting owner or safe-desk physical verification to disburse rewards.",
        },
      });
    }

    // CASE 2: Campus Treasure Hunt / Daily Mystery / Seasonal Event Hunt
    // Safe digital / riddle-based completion
    investigation.status = "COMPLETED";
    investigation.progressPct = 100;
    await investigation.save();

    quest.currentCompletions = (quest.currentCompletions || 0) + 1;
    await quest.save();

    let rewardResult: any = null;

    if (investigation.isSquadInvestigation && investigation.squadId) {
      await distributeSquadQuestRewards({
        squadId: investigation.squadId,
        participatingUserIds: investigation.participatingUserIds,
        finderUserId: user._id as Types.ObjectId,
        baseXp: quest.xpReward,
        baseCoins: quest.coinReward,
        squadXpReward: quest.squadXpReward,
        questId: quest._id as Types.ObjectId,
        questTitle: quest.title,
      });

      rewardResult = {
        xp: quest.xpReward,
        coins: quest.coinReward,
        squadXp: quest.squadXpReward,
        isSquad: true,
      };
    } else {
      const grant = await grantUserRewards({
        userId: user._id as Types.ObjectId,
        baseXp: quest.xpReward,
        baseCoins: quest.coinReward,
        deltaTrust: 20,
        reason: `Campus Treasure Hunt Completed: ${quest.title}`,
        referenceType: "QUEST",
        referenceId: quest._id as Types.ObjectId,
      });

      await User.findByIdAndUpdate(user._id, {
        $inc: {
          "stats.questsCompleted": 1,
          "stats.treasuresFound": 1,
        },
      });

      rewardResult = {
        xp: grant?.finalXp ?? quest.xpReward,
        coins: grant?.finalCoins ?? quest.coinReward,
        isSquad: false,
      };
    }

    // Create completion notification
    await Notification.create({
      userId: user._id,
      category: "QUEST_SQUAD",
      title: `🏆 Treasure Found: ${quest.title}!`,
      message: `You earned +${rewardResult.xp} XP and +${rewardResult.coins} Coins. Check your ledger!`,
      linkUrl: `/dashboard`,
    });

    return NextResponse.json({
      success: true,
      data: {
        status: "COMPLETED",
        message: "Campus hunt verified! Rewards credited to your ledger.",
        rewards: rewardResult,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Failed to recover." } },
      { status: 500 }
    );
  }
}

