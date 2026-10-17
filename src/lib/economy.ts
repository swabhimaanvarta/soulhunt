import { Types } from "mongoose";
import {
  SystemConfig,
  User,
  Squad,
  SquadMember,
  Transaction,
  FraudAlert,
  Achievement,
  UserAchievement,
  Notification,
  TrustTier,
} from "@/models";

export function computeTrustTier(score: number): TrustTier {
  if (score < 100) return "RESTRICTED";
  if (score < 250) return "NEW_HUNTER";
  if (score < 600) return "ACTIVE_HUNTER";
  if (score < 850) return "TRUSTED_HUNTER";
  return "ELITE_INVESTIGATOR";
}

export async function checkPairCollusion(
  userAId: Types.ObjectId,
  userBId: Types.ObjectId,
  referenceId: Types.ObjectId
): Promise<{ isCollusion: boolean; count: number }> {
  const config = await SystemConfig.findOne({ key: "GLOBAL_CONFIG" });
  const windowDays = config?.pairCollusionWindowDays ?? 30;
  const maxAllowed = config?.pairCollusionMaxCount ?? 2;

  const cutoffDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const pairCount = await Transaction.countDocuments({
    referenceType: "RECOVERY",
    createdAt: { $gte: cutoffDate },
    $or: [
      { userId: userAId, counterpartyUserId: userBId },
      { userId: userBId, counterpartyUserId: userAId },
    ],
  });

  if (pairCount >= maxAllowed) {
    await FraudAlert.create({
      involvedUserIds: [userAId, userBId],
      alertType: "PAIR_COLLUSION",
      severity: "HIGH",
      details: `Users verified each other's Lost/Found reports ${pairCount + 1} times within ${windowDays} days. Rewards held pending Moderator review.`,
      referenceId,
      status: "OPEN",
    });
    return { isCollusion: true, count: pairCount + 1 };
  }

  return { isCollusion: false, count: pairCount };
}

export async function grantUserRewards(params: {
  userId: Types.ObjectId;
  baseXp: number;
  baseCoins: number;
  deltaTrust?: number;
  reason: string;
  referenceType: "QUEST" | "RECOVERY" | "ACHIEVEMENT" | "ADMIN_ADJUST";
  referenceId?: Types.ObjectId;
  counterpartyUserId?: Types.ObjectId;
  approvedBy?: Types.ObjectId;
}) {
  const config = (await SystemConfig.findOne({ key: "GLOBAL_CONFIG" })) || {
    xpPerLevelBase: 250,
    globalXpMultiplier: 1,
    globalCoinMultiplier: 1,
    rankThresholds: [
      { minLevel: 1, title: "Rookie Scout" },
      { minLevel: 3, title: "Campus Tracker" },
      { minLevel: 6, title: "Field Investigator" },
      { minLevel: 10, title: "Senior Detective" },
      { minLevel: 15, title: "Master Hunter" },
    ],
  };

  const finalXp = Math.round(params.baseXp * config.globalXpMultiplier);
  const finalCoins = Math.round(params.baseCoins * config.globalCoinMultiplier);
  const deltaTrust = params.deltaTrust ?? 0;

  const user = await User.findById(params.userId);
  if (!user) return null;

  user.xp = Math.max(0, user.xp + finalXp);
  user.coins = Math.max(0, user.coins + finalCoins);
  user.trustScore = Math.min(1000, Math.max(0, user.trustScore + deltaTrust));
  user.trustTier = computeTrustTier(user.trustScore);

  const newLevel = Math.max(1, Math.floor(user.xp / config.xpPerLevelBase) + 1);
  const leveledUp = newLevel > user.level;
  user.level = newLevel;

  const sortedRanks = [...config.rankThresholds].sort((a, b) => b.minLevel - a.minLevel);
  const matchedRank = sortedRanks.find((r) => newLevel >= r.minLevel);
  if (matchedRank) {
    user.rankTitle = matchedRank.title;
  }

  await user.save();

  await Transaction.create({
    userId: user._id,
    squadId: user.squadId || null,
    deltaXp: finalXp,
    deltaCoins: finalCoins,
    deltaTrust,
    reason: params.reason,
    referenceType: params.referenceType,
    referenceId: params.referenceId || null,
    counterpartyUserId: params.counterpartyUserId || null,
    approvedBy: params.approvedBy || null,
  });

  if (leveledUp) {
    await Notification.create({
      userId: user._id,
      category: "SYSTEM_REWARD",
      title: `Level Up! You reached Level ${newLevel}`,
      message: `Congratulations Hunter! You are now ranked as ${user.rankTitle}.`,
      linkUrl: `/profile/${user.username}`,
    });
  }

  await evaluateUserAchievements(user._id as Types.ObjectId);
  return { user, finalXp, finalCoins };
}

export async function distributeSquadQuestRewards(params: {
  squadId: Types.ObjectId;
  participatingUserIds: Types.ObjectId[];
  finderUserId: Types.ObjectId;
  baseXp: number;
  baseCoins: number;
  squadXpReward: number;
  questId: Types.ObjectId;
  questTitle: string;
}) {
  const config = await SystemConfig.findOne({ key: "GLOBAL_CONFIG" });
  const bonusPct = Math.min(
    config?.maxFinderBonusPct ?? 25,
    config?.defaultFinderBonusPct ?? 15
  );

  const uniqueParticipants = Array.from(
    new Set([
      ...params.participatingUserIds.map((id) => id.toString()),
      params.finderUserId.toString(),
    ])
  );

  for (const participantStr of uniqueParticipants) {
    const participantId = new Types.ObjectId(participantStr);
    const isFinder = participantStr === params.finderUserId.toString();

    const bonusXp = isFinder ? Math.round((params.baseXp * bonusPct) / 100) : 0;
    const bonusCoins = isFinder ? Math.round((params.baseCoins * bonusPct) / 100) : 0;

    await User.findByIdAndUpdate(participantId, {
      $inc: {
        "stats.questsCompleted": 1,
        "stats.squadQuestsCompleted": 1,
      },
    });

    await grantUserRewards({
      userId: participantId,
      baseXp: params.baseXp + bonusXp,
      baseCoins: params.baseCoins + bonusCoins,
      deltaTrust: 15,
      reason: isFinder
        ? `Squad Quest Completed (${params.questTitle}) + ${bonusPct}% Finder Bonus`
        : `Squad Quest Completed (${params.questTitle})`,
      referenceType: "QUEST",
      referenceId: params.questId,
    });

    await SquadMember.findOneAndUpdate(
      { squadId: params.squadId, userId: participantId },
      { $inc: { contributedSquadXp: params.squadXpReward } }
    );
  }

  const squad = await Squad.findById(params.squadId);
  if (squad) {
    squad.squadXp += params.squadXpReward;
    squad.completedHuntsCount += 1;
    squad.squadLevel = Math.max(1, Math.floor(squad.squadXp / 300) + 1);
    await squad.save();
  }
}

export async function evaluateUserAchievements(userId: Types.ObjectId) {
  const user = await User.findById(userId);
  if (!user) return;

  const activeAchievements = await Achievement.find({ isActive: true });
  let squadLevel = 1;
  if (user.squadId) {
    const sq = await Squad.findById(user.squadId);
    if (sq) squadLevel = sq.squadLevel;
  }

  for (const ach of activeAchievements) {
    let currentValue = 0;
    switch (ach.metricKey) {
      case "QUESTS_COMPLETED":
        currentValue = user.stats.questsCompleted;
        break;
      case "RECOVERIES_COUNT":
        currentValue = user.stats.recoveriesCount;
        break;
      case "VISITED_BLOCKS_COUNT":
        currentValue = user.stats.visitedBlocks.length;
        break;
      case "INVESTIGATION_QUESTS":
        currentValue = user.stats.investigationQuestsCompleted;
        break;
      case "MYSTERY_NO_HINTS":
        currentValue = user.stats.mysteryQuestsNoHints;
        break;
      case "PLAYER_LEVEL":
        currentValue = user.level;
        break;
      case "SAFE_DESK_DEPOSITS":
        currentValue = user.stats.safeDeskDepositsCount;
        break;
      case "SQUAD_QUESTS":
        currentValue = user.stats.squadQuestsCompleted;
        break;
      case "SQUAD_LEVEL":
        currentValue = squadLevel;
        break;
      case "LEGENDARY_QUESTS":
        currentValue = user.stats.legendaryQuestsCompleted;
        break;
      case "TREASURES_FOUND":
        currentValue = user.stats.treasuresFound;
        break;
      default:
        currentValue = 0;
    }

    const existing = await UserAchievement.findOne({
      userId: user._id,
      achievementId: ach._id,
    });

    if (existing?.isUnlocked) continue;

    const shouldUnlock = currentValue >= ach.threshold;

    await UserAchievement.findOneAndUpdate(
      { userId: user._id, achievementId: ach._id },
      {
        $set: {
          progress: Math.min(currentValue, ach.threshold),
          isUnlocked: shouldUnlock,
          unlockedAt: shouldUnlock ? new Date() : null,
        },
      },
      { upsert: true }
    );

    if (shouldUnlock) {
      await User.findByIdAndUpdate(user._id, {
        $inc: { xp: ach.xpReward, coins: ach.coinReward },
      });

      await Transaction.create({
        userId: user._id,
        deltaXp: ach.xpReward,
        deltaCoins: ach.coinReward,
        deltaTrust: 5,
        reason: `Achievement Unlocked: ${ach.title}`,
        referenceType: "ACHIEVEMENT",
        referenceId: ach._id,
      });

      await Notification.create({
        userId: user._id,
        category: "SYSTEM_REWARD",
        title: `🏅 Achievement Unlocked: ${ach.title}`,
        message: `You earned +${ach.xpReward} XP and +${ach.coinReward} Coins!`,
        linkUrl: "/achievements",
      });
    }
  }
}
