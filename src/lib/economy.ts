import { AsyncLocalStorage } from "node:async_hooks";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
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
  Investigation,
  Quest,
  SquadHuntRecord,
  ISquadHuntParticipant,
} from "@/models";
import { applyLiveEventModifiers } from "./communityEvents";

const lockStorage = new AsyncLocalStorage<Set<string>>();
const userLockChains = new Map<string, Promise<any>>();

/**
 * Serializes concurrent operations per userId to eliminate race conditions,
 * lost updates, and duplicate array mutations, while supporting reentrant
 * nested calls in the same execution context.
 */
export async function withUserLock<T>(userId: string, task: () => Promise<T>): Promise<T> {
  const currentHeld = lockStorage.getStore();
  if (currentHeld && currentHeld.has(userId)) {
    return await task();
  }

  const prevPromise = userLockChains.get(userId) ?? Promise.resolve();
  let release: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });

  const nextPromise = prevPromise
    .catch(() => {})
    .then(() => gate);

  userLockChains.set(userId, nextPromise);

  try {
    await prevPromise.catch(() => {});
    const newHeld = new Set(currentHeld || []);
    newHeld.add(userId);
    return await lockStorage.run(newHeld, task);
  } finally {
    release!();
    if (userLockChains.get(userId) === nextPromise) {
      userLockChains.delete(userId);
    }
  }
}

export function computeTrustTier(score: number): TrustTier {
  if (score < 100) return "RESTRICTED";
  if (score < 250) return "NEW_HUNTER";
  if (score < 600) return "ACTIVE_HUNTER";
  if (score < 850) return "TRUSTED_HUNTER";
  return "ELITE_INVESTIGATOR";
}

// Re-export pure progression math functions for backward compatibility with existing server calls
import {
  calculateLevelFromXp,
  getCumulativeXpForLevel,
  getXpRequiredForLevel,
  getXpRequiredForNextLevel,
  getXpProgressInLevel,
} from "./progression";
export {
  calculateLevelFromXp,
  getCumulativeXpForLevel,
  getXpRequiredForLevel,
  getXpRequiredForNextLevel,
  getXpProgressInLevel,
};

export async function checkPairCollusion(
  userAId: Types.ObjectId,
  userBId: Types.ObjectId,
  referenceId: Types.ObjectId
): Promise<{ isCollusion: boolean; count: number }> {
  await connectDB();
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
  trophyReward?: number;
  deltaTrust?: number;
  reason: string;
  referenceType: "QUEST" | "RECOVERY" | "ACHIEVEMENT" | "ADMIN_ADJUST";
  referenceId?: Types.ObjectId;
  counterpartyUserId?: Types.ObjectId;
  approvedBy?: Types.ObjectId;
}) {
  return await withUserLock(params.userId.toString(), async () => {
    await connectDB();
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

    let finalXp = Math.round(params.baseXp * config.globalXpMultiplier);
    let finalCoins = Math.round(params.baseCoins * config.globalCoinMultiplier);

    const user = await User.findById(params.userId);
    if (!user) return null;

    // Apply Live Telemetry Modifiers (Rush Hour Recon 1.5x XP + 20 coins, Syndicate Weekend 2x Squad XP)
    if (params.referenceType === "QUEST") {
      const liveModifiers = applyLiveEventModifiers({
        baseXp: finalXp,
        baseCoins: finalCoins,
        isSquadQuest: Boolean(user.squadId),
      });
      finalXp = liveModifiers.effectiveXp;
      finalCoins = liveModifiers.effectiveCoins;
    }

    const finalTrophies =
      params.trophyReward !== undefined
        ? params.trophyReward
        : params.referenceType === "QUEST"
        ? 25
        : params.referenceType === "RECOVERY"
        ? 35
        : 0;
    const deltaTrust = params.deltaTrust ?? 0;

    // Sanitize pre-existing claimedLevelRewards immediately
    user.claimedLevelRewards = Array.from(
      new Set((user.claimedLevelRewards || []).map(Number))
    ).sort((a, b) => a - b);

    // Idempotency check: prevent double payout for the same Quest or Recovery
    if (params.referenceId && (params.referenceType === "QUEST" || params.referenceType === "RECOVERY")) {
      const existingTx = await Transaction.findOne({
        userId: params.userId,
        referenceType: params.referenceType,
        referenceId: params.referenceId,
      });
      if (existingTx) {
        return { user, finalXp: 0, finalCoins: 0, finalTrophies: 0, alreadyClaimed: true };
      }
    }

    // Pre-create transaction record to prevent race conditions and duplicate payouts under concurrency
    let createdTx: any = null;
    if (params.referenceId && (params.referenceType === "QUEST" || params.referenceType === "RECOVERY")) {
      try {
        createdTx = await Transaction.create({
          userId: user._id,
          squadId: user.squadId || null,
          deltaXp: finalXp,
          deltaCoins: finalCoins,
          deltaTrophies: finalTrophies,
          deltaTrust,
          reason: params.reason,
          referenceType: params.referenceType,
          referenceId: params.referenceId || null,
          counterpartyUserId: params.counterpartyUserId || null,
          approvedBy: params.approvedBy || null,
        });
      } catch (err: any) {
        if (err?.code === 11000 || (typeof err?.message === "string" && err.message.includes("E11000"))) {
          const freshUser = await User.findById(params.userId);
          return {
            user: freshUser || user,
            finalXp: 0,
            finalCoins: 0,
            finalTrophies: 0,
            alreadyClaimed: true,
          };
        }
        throw err;
      }
    }

    user.xp = Math.max(0, user.xp + finalXp);
    user.coins = Math.max(0, user.coins + finalCoins);
    if (finalTrophies > 0) {
      user.trophies = Math.max(0, (user.trophies || 0) + finalTrophies);
      user.weeklyScore = Math.max(0, (user.weeklyScore || 0) + finalTrophies);
    }
    user.trustScore = Math.min(1000, Math.max(0, user.trustScore + deltaTrust));
    user.trustTier = computeTrustTier(user.trustScore);

    const oldLevel = user.level || 1;
    const newLevel = calculateLevelFromXp(user.xp);
    const leveledUp = newLevel > oldLevel;
    user.level = newLevel;

    const awardedMilestones: { level: number; bonusCoins: number }[] = [];
    if (leveledUp) {
      for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
        if (!user.claimedLevelRewards.includes(lvl)) {
          user.claimedLevelRewards.push(lvl);
          const milestoneCoins = 25 * lvl;
          user.coins += milestoneCoins;
          awardedMilestones.push({ level: lvl, bonusCoins: milestoneCoins });
        }
      }
    }

    // Ensure claimedLevelRewards is strictly deduplicated and sorted
    user.claimedLevelRewards = Array.from(
      new Set(user.claimedLevelRewards.map(Number))
    ).sort((a, b) => a - b);
    user.markModified("claimedLevelRewards");

    const sortedRanks = [...config.rankThresholds].sort((a, b) => b.minLevel - a.minLevel);
    const matchedRank = sortedRanks.find((r) => newLevel >= r.minLevel);
    if (matchedRank) {
      user.rankTitle = matchedRank.title;
    }

    try {
      await user.save();
    } catch (saveErr) {
      if (createdTx) {
        await Transaction.findByIdAndDelete(createdTx._id).catch(() => {});
      }
      throw saveErr;
    }

    if (!createdTx) {
      try {
        await Transaction.create({
          userId: user._id,
          squadId: user.squadId || null,
          deltaXp: finalXp,
          deltaCoins: finalCoins,
          deltaTrophies: finalTrophies,
          deltaTrust,
          reason: params.reason,
          referenceType: params.referenceType,
          referenceId: params.referenceId || null,
          counterpartyUserId: params.counterpartyUserId || null,
          approvedBy: params.approvedBy || null,
        });
      } catch (err: any) {
        if (err?.code === 11000 || (typeof err?.message === "string" && err.message.includes("E11000"))) {
          const freshUser = await User.findById(params.userId);
          return {
            user: freshUser || user,
            finalXp: 0,
            finalCoins: 0,
            finalTrophies: 0,
            alreadyClaimed: true,
          };
        }
        throw err;
      }
    }

    if (leveledUp) {
      if (awardedMilestones.length > 0) {
        for (const milestone of awardedMilestones) {
          await Notification.create({
            userId: user._id,
            category: "SYSTEM_REWARD",
            title: `Level Up! You reached Level ${milestone.level}`,
            message: `Congratulations Hunter! You reached Level ${milestone.level} and earned +${milestone.bonusCoins} Bonus Coins! You are now ranked as ${user.rankTitle}.`,
            linkUrl: `/profile/${user.username}`,
          });
        }
      } else {
        await Notification.create({
          userId: user._id,
          category: "SYSTEM_REWARD",
          title: `Level Up! You reached Level ${newLevel}`,
          message: `Congratulations Hunter! You are now ranked as ${user.rankTitle}.`,
          linkUrl: `/profile/${user.username}`,
        });
      }
    }

    await evaluateUserAchievements(user._id as Types.ObjectId);
    return { user, finalXp, finalCoins, finalTrophies };
  });
}

export async function distributeSquadQuestRewards(params: {
  squadId: Types.ObjectId;
  participatingUserIds: Types.ObjectId[];
  finderUserId: Types.ObjectId;
  baseXp: number;
  baseCoins: number;
  trophyReward?: number;
  squadXpReward: number;
  questId: Types.ObjectId;
  questTitle: string;
  investigationId?: Types.ObjectId;
}) {
  await connectDB();
  const config = await SystemConfig.findOne({ key: "GLOBAL_CONFIG" });
  const bonusPct = Math.min(
    config?.maxFinderBonusPct ?? 25,
    config?.defaultFinderBonusPct ?? 15
  );

  const investigation = params.investigationId
    ? await Investigation.findById(params.investigationId)
    : await Investigation.findOne({
        squadId: params.squadId,
        questId: params.questId,
      }).sort({ updatedAt: -1 });

  const quest = await Quest.findById(params.questId);
  const questCode = quest?.questCode || "Q-SQUAD-HUNT";
  const questTitle = params.questTitle || quest?.title || "Squad Raid";
  const questType = quest?.questType || "SQUAD_HUNT";
  const difficulty = quest?.difficulty || 1;
  const squadTrophies =
    params.trophyReward ?? (quest?.trophyReward || (quest?.difficulty ? quest.difficulty * 15 : 25));

  const clueCountMap = new Map<string, number>();
  if (investigation?.solvedClues) {
    for (const sc of investigation.solvedClues) {
      if (sc.solvedByUserId) {
        const uidStr = sc.solvedByUserId.toString();
        clueCountMap.set(uidStr, (clueCountMap.get(uidStr) || 0) + 1);
      }
    }
  }

  const participantIdsSet = new Set<string>();
  if (Array.isArray(params.participatingUserIds)) {
    for (const id of params.participatingUserIds) {
      if (id) participantIdsSet.add(id.toString());
    }
  }
  if (params.finderUserId) {
    participantIdsSet.add(params.finderUserId.toString());
  }
  if (investigation?.participatingUserIds) {
    for (const id of investigation.participatingUserIds) {
      if (id) participantIdsSet.add(id.toString());
    }
  }
  if (investigation?.solvedClues) {
    for (const sc of investigation.solvedClues) {
      if (sc.solvedByUserId) participantIdsSet.add(sc.solvedByUserId.toString());
    }
  }
  const uniqueParticipants = Array.from(participantIdsSet);

  const participantUsers = await User.find({
    _id: { $in: uniqueParticipants.map((id) => new Types.ObjectId(id)) },
  });
  const userMap = new Map<string, (typeof participantUsers)[0]>();
  for (const u of participantUsers) {
    userMap.set(u._id.toString(), u);
  }

  const participatingMembers: ISquadHuntParticipant[] = [];

  for (const participantStr of uniqueParticipants) {
    const participantId = new Types.ObjectId(participantStr);
    const isFinder = participantStr === params.finderUserId.toString();

    const bonusXp = isFinder ? Math.round((params.baseXp * bonusPct) / 100) : 0;
    const bonusCoins = isFinder ? Math.round((params.baseCoins * bonusPct) / 100) : 0;
    const bonusTrophies = isFinder ? Math.round((squadTrophies * bonusPct) / 100) : 0;

    const finalXpAwarded = params.baseXp + bonusXp;
    const finalCoinsAwarded = params.baseCoins + bonusCoins;
    const finalTrophiesAwarded = squadTrophies + bonusTrophies;

    await User.findByIdAndUpdate(participantId, {
      $inc: {
        "stats.questsCompleted": 1,
        "stats.squadQuestsCompleted": 1,
      },
    });

    await grantUserRewards({
      userId: participantId,
      baseXp: finalXpAwarded,
      baseCoins: finalCoinsAwarded,
      trophyReward: finalTrophiesAwarded,
      deltaTrust: 15,
      reason: isFinder
        ? `Squad Quest Completed (${questTitle}) + ${bonusPct}% Finder Bonus`
        : `Squad Quest Completed (${questTitle})`,
      referenceType: "QUEST",
      referenceId: params.questId,
    });

    await SquadMember.findOneAndUpdate(
      { squadId: params.squadId, userId: participantId },
      { $inc: { contributedSquadXp: params.squadXpReward } }
    );

    const uDoc = userMap.get(participantStr);
    participatingMembers.push({
      userId: participantId,
      displayName: uDoc?.displayName || "Operative",
      username: uDoc?.username || `hunter_${participantStr.slice(-4)}`,
      avatarUrl: uDoc?.avatarUrl || "",
      cluesSolvedCount: clueCountMap.get(participantStr) || 0,
      isFinder,
      trophiesAwarded: finalTrophiesAwarded,
      xpAwarded: finalXpAwarded,
      coinsAwarded: finalCoinsAwarded,
    });
  }

  const squad = await Squad.findById(params.squadId);
  if (squad) {
    squad.squadXp += params.squadXpReward;
    squad.trophies = (squad.trophies || 0) + squadTrophies;
    squad.weeklyScore = (squad.weeklyScore || 0) + squadTrophies;
    squad.completedHuntsCount += 1;
    squad.squadLevel = Math.max(1, Math.floor(squad.squadXp / 300) + 1);
    await squad.save();
  }

  const finisherUser =
    userMap.get(params.finderUserId.toString()) || (await User.findById(params.finderUserId));
  const finisherName = finisherUser?.displayName || finisherUser?.username || "Operative";

  const completedAt = new Date();
  const startedAt = (investigation as any)?.createdAt
    ? new Date((investigation as any).createdAt)
    : null;
  const durationSeconds = startedAt
    ? Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 1000))
    : 0;

  const totalCluesCount = Math.max(
    investigation?.solvedClues?.length || 0,
    investigation?.stageVariants?.length || 0,
    1
  );
  const evidencePinsCount = investigation?.evidenceNodes?.length || 0;

  const resolvedInvestigationId =
    params.investigationId || investigation?._id || new Types.ObjectId();

  let huntRecord = null;
  try {
    huntRecord = await SquadHuntRecord.findOneAndUpdate(
      { squadId: params.squadId, investigationId: resolvedInvestigationId },
      {
        $setOnInsert: {
          squadId: params.squadId,
          questId: params.questId,
          investigationId: resolvedInvestigationId,
          questCode,
          questTitle,
          questType,
          difficulty,
          status: "COMPLETED",
          completedAt,
          startedAt,
          durationSeconds,
          finisherUserId: params.finderUserId,
          finisherName,
          participatingMembers,
          squadRewards: {
            squadXp: params.squadXpReward,
            squadTrophies,
          },
          totalCluesCount,
          evidencePinsCount,
        },
      },
      { upsert: true, new: true }
    );
  } catch (err: any) {
    if (err.code === 11000) {
      huntRecord = await SquadHuntRecord.findOne({
        squadId: params.squadId,
        investigationId: resolvedInvestigationId,
      });
    } else {
      console.error("Error creating SquadHuntRecord:", err);
    }
  }

  return {
    squad,
    huntRecord,
    squadTrophies,
    participatingMembers,
  };
}

export async function evaluateUserAchievements(userId: Types.ObjectId) {
  return await withUserLock(userId.toString(), async () => {
    await connectDB();
    const user = await User.findById(userId);
    if (!user) return;

    user.claimedLevelRewards = Array.from(
      new Set((user.claimedLevelRewards || []).map(Number))
    ).sort((a, b) => a - b);

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
        const u = await User.findById(user._id);
        if (u) {
          u.xp = Math.max(0, u.xp + ach.xpReward);
          u.coins = Math.max(0, u.coins + ach.coinReward);

          const oldLevel = u.level || 1;
          const newLevel = calculateLevelFromXp(u.xp);
          u.level = newLevel;

          u.claimedLevelRewards = Array.from(
            new Set((u.claimedLevelRewards || []).map(Number))
          ).sort((a, b) => a - b);

          const awardedMilestones: { level: number; bonusCoins: number }[] = [];
          if (newLevel > oldLevel) {
            for (let lvl = oldLevel + 1; lvl <= newLevel; lvl++) {
              if (!u.claimedLevelRewards.includes(lvl)) {
                u.claimedLevelRewards.push(lvl);
                const milestoneCoins = 25 * lvl;
                u.coins += milestoneCoins;
                awardedMilestones.push({ level: lvl, bonusCoins: milestoneCoins });
              }
            }
          }

          u.claimedLevelRewards = Array.from(
            new Set(u.claimedLevelRewards.map(Number))
          ).sort((a, b) => a - b);
          u.markModified("claimedLevelRewards");

          const config = await SystemConfig.findOne({ key: "GLOBAL_CONFIG" });
          const rankThresholds = config?.rankThresholds || [
            { minLevel: 1, title: "Rookie Scout" },
            { minLevel: 3, title: "Campus Tracker" },
            { minLevel: 6, title: "Field Investigator" },
            { minLevel: 10, title: "Senior Detective" },
            { minLevel: 15, title: "Master Hunter" },
          ];
          const sortedRanks = [...rankThresholds].sort((a, b) => b.minLevel - a.minLevel);
          const matchedRank = sortedRanks.find((r) => newLevel >= r.minLevel);
          if (matchedRank) {
            u.rankTitle = matchedRank.title;
          }

          await u.save();

          user.level = u.level;
          user.xp = u.xp;
          user.coins = u.coins;
          user.claimedLevelRewards = u.claimedLevelRewards;

          for (const milestone of awardedMilestones) {
            await Notification.create({
              userId: u._id,
              category: "SYSTEM_REWARD",
              title: `Level Up! You reached Level ${milestone.level}`,
              message: `Congratulations Hunter! You reached Level ${milestone.level} and earned +${milestone.bonusCoins} Bonus Coins!`,
              linkUrl: `/profile/${u.username}`,
            });
          }
        }

        try {
          await Transaction.create({
            userId: user._id,
            deltaXp: ach.xpReward,
            deltaCoins: ach.coinReward,
            deltaTrust: 5,
            reason: `Achievement Unlocked: ${ach.title}`,
            referenceType: "ACHIEVEMENT",
            referenceId: ach._id,
          });
        } catch (txErr: any) {
          if (txErr?.code !== 11000 && !(typeof txErr?.message === "string" && txErr.message.includes("E11000"))) {
            throw txErr;
          }
        }

        await Notification.create({
          userId: user._id,
          category: "SYSTEM_REWARD",
          title: `🏅 Achievement Unlocked: ${ach.title}`,
          message: `You earned +${ach.xpReward} XP and +${ach.coinReward} Coins!`,
          linkUrl: "/achievements",
        });
      }
    }
  });
}
