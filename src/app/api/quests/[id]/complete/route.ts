import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Quest, Investigation, User, Notification } from "@/models";
import { grantUserRewards, distributeSquadQuestRewards } from "@/lib/economy";
import { recordDailyQuestAction } from "@/lib/dailyQuests";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { success: false, code: "UNAUTHORIZED", error: { code: "UNAUTHORIZED", message: "Please sign in to complete quest." } },
        { status: 401 }
      );
    }

    const { id: questId } = await context.params;
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    await connectDB();

    const quest = await Quest.findById(questId);
    if (!quest || quest.status !== "ACTIVE") {
      return NextResponse.json(
        { success: false, code: "QUEST_NOT_FOUND", error: { code: "QUEST_NOT_FOUND", message: "Quest is not active or found." } },
        { status: 404 }
      );
    }

    const userObjectId = new Types.ObjectId(user._id);
    const questObjectId = new Types.ObjectId(quest._id);
    const asSquad = Boolean(body?.asSquad && user.squadId);

    // 1. Check if user already completed this quest
    const alreadyCompleted = await Investigation.findOne({
      questId: questObjectId,
      status: "COMPLETED",
      $or: [
        { userId: userObjectId },
        { participatingUserIds: userObjectId },
      ],
    });

    if (alreadyCompleted) {
      return NextResponse.json(
        {
          success: false,
          code: "ALREADY_COMPLETED",
          error: { code: "ALREADY_COMPLETED", message: "This quest has already been completed." },
        },
        { status: 400 }
      );
    }

    // 2. Find existing active investigation

    const investigation = await Investigation.findOne({
      questId: questObjectId,
      $or: [
        { userId: userObjectId },
        { participatingUserIds: userObjectId },
        ...(user.squadId ? [{ squadId: new Types.ObjectId(user.squadId) }] : []),
      ],
    }).sort({ updatedAt: -1 });

    if (!investigation) {
      return NextResponse.json(
        {
          success: false,
          code: "NOT_ACCEPTED",
          error: { code: "NOT_ACCEPTED", message: "You must accept and start this quest before completing it." },
        },
        { status: 400 }
      );
    }

    if (investigation.status === "COMPLETED") {
      return NextResponse.json(
        {
          success: false,
          code: "ALREADY_COMPLETED",
          error: { code: "ALREADY_COMPLETED", message: "This quest has already been completed." },
        },
        { status: 400 }
      );
    }

    // Atomic update to mark investigation as COMPLETED
    const completedInv = await Investigation.findOneAndUpdate(
      {
        _id: investigation._id,
        status: { $ne: "COMPLETED" },
      },
      {
        $set: {
          status: "COMPLETED",
          progressPct: 100,
        },
      },
      { new: true }
    );

    if (!completedInv) {
      return NextResponse.json(
        {
          success: false,
          code: "ALREADY_COMPLETED",
          error: { code: "ALREADY_COMPLETED", message: "This quest has already been completed." },
        },
        { status: 400 }
      );
    }

    await Quest.findByIdAndUpdate(quest._id, { $inc: { currentCompletions: 1 } });

    // Calculate rewards
    const coinsToAward = quest.coinReward ?? 50;
    const xpToAward = quest.xpReward ?? 100;
    const trophiesToAward = quest.trophyReward ?? (quest.difficulty ? quest.difficulty * 15 : 25);

    let finalRewards = {
      xp: xpToAward,
      coins: coinsToAward,
      trophies: trophiesToAward,
      newCoins: user.coins + coinsToAward,
      newTrophies: (user.trophies || 0) + trophiesToAward,
      newLevel: user.level,
    };

    if (asSquad && user.squadId) {
      await distributeSquadQuestRewards({
        squadId: user.squadId,
        participatingUserIds: completedInv.participatingUserIds?.length
          ? completedInv.participatingUserIds
          : [userObjectId],
        finderUserId: userObjectId,
        baseXp: xpToAward,
        baseCoins: coinsToAward,
        trophyReward: trophiesToAward,
        squadXpReward: quest.squadXpReward || 50,
        questId: questObjectId,
        questTitle: quest.title,
        investigationId: completedInv._id as Types.ObjectId,
      });

      const refreshed = await User.findById(user._id);
      if (refreshed) {
        finalRewards.newCoins = refreshed.coins;
        finalRewards.newTrophies = refreshed.trophies || 0;
        finalRewards.newLevel = refreshed.level;
      }
    } else {
      const grant = await grantUserRewards({
        userId: userObjectId,
        baseXp: xpToAward,
        baseCoins: coinsToAward,
        trophyReward: trophiesToAward,
        deltaTrust: 20,
        reason: `Quest Completed: ${quest.title}`,
        referenceType: "QUEST",
        referenceId: questObjectId,
      });

      await User.findByIdAndUpdate(user._id, {
        $inc: {
          "stats.questsCompleted": 1,
          "stats.treasuresFound": 1,
        },
      });

      if (grant) {
        finalRewards.xp = grant.finalXp;
        finalRewards.coins = grant.finalCoins;
        finalRewards.trophies = grant.finalTrophies;
        finalRewards.newLevel = grant.user?.level ?? user.level;
        finalRewards.newCoins = grant.user?.coins ?? (user.coins + coinsToAward);
        finalRewards.newTrophies = grant.user?.trophies ?? ((user.trophies || 0) + trophiesToAward);
      }
    }

    // Trigger daily quest hook
    await recordDailyQuestAction(user._id.toString(), "COMPLETE_QUEST").catch((err) => {
      console.error("[DailyQuest] Failed to record complete quest action:", err);
    });

    // Create Notification
    await Notification.create({
      userId: user._id,
      category: "QUEST_SQUAD",
      title: `🏆 Quest Completed: ${quest.title}!`,
      message: `You earned +${finalRewards.xp} XP, +${finalRewards.coins} Coins, and +${finalRewards.trophies} 🏆 Trophies!`,
      linkUrl: `/dashboard`,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        status: "COMPLETED",
        questId: quest._id,
        questTitle: quest.title,
        rewards: {
          xp: finalRewards.xp,
          coins: finalRewards.coins,
          trophies: finalRewards.trophies,
        },
        trophiesAwarded: finalRewards.trophies,
        coinsAwarded: finalRewards.coins,
        xpAwarded: finalRewards.xp,
        newCoins: finalRewards.newCoins,
        newTrophies: finalRewards.newTrophies,
        newLevel: finalRewards.newLevel,
        message: "Quest completed! Trophies and Coins credited to your ledger.",
      },
    });
  } catch (error: any) {
    console.error("[POST /api/quests/[id]/complete] Error:", error);
    return NextResponse.json(
      { success: false, code: "SERVER_ERROR", error: { code: "SERVER_ERROR", message: error.message || "Failed to complete quest." } },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id: questId } = await context.params;
    await connectDB();

    const quest = await Quest.findById(questId);
    if (!quest) {
      return NextResponse.json(
        { success: false, code: "NOT_FOUND", error: { code: "NOT_FOUND", message: "Quest not found." } },
        { status: 404 }
      );
    }

    let isCompletedByUser = false;
    let isCompletedBySquad = false;

    if (user) {
      const userObjectId = new Types.ObjectId(user._id);
      const questObjectId = new Types.ObjectId(quest._id);

      const soloCompleted = await Investigation.findOne({
        questId: questObjectId,
        userId: userObjectId,
        status: "COMPLETED",
      });
      isCompletedByUser = Boolean(soloCompleted);

      if (user.squadId) {
        const squadCompleted = await Investigation.findOne({
          questId: questObjectId,
          squadId: new Types.ObjectId(user.squadId),
          status: "COMPLETED",
        });
        isCompletedBySquad = Boolean(squadCompleted);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        questId: quest._id,
        isCompletedByUser,
        isCompletedBySquad,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, code: "SERVER_ERROR", error: { code: "SERVER_ERROR", message: error.message } },
      { status: 500 }
    );
  }
}
