/**
 * AIEM Hunt — Authoritative Campus Daily Quests & Retention Engine
 * Anchored to Campus Timezone: Asia/Kolkata (IST, UTC+05:30)
 */

import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { User, UserDailyQuest } from "@/models";
import { grantUserRewards } from "@/lib/economy";

export type DailyActionType = "SOLVE_CLUE" | "REPORT_LOST" | "DEPOSIT_FOUND" | "COMPLETE_QUEST";

export interface DailyQuestTemplate {
  questKey: string;
  title: string;
  description: string;
  actionType: DailyActionType;
  acceptedActionTypes?: DailyActionType[];
  targetCount: number;
  rewardXp: number;
  rewardCoins: number;
  rewardTrophies?: number;
  category: "CLUES" | "VIGILANCE" | "RECOVERY" | "CAMPUS";
}

export interface DailyQuestItem extends DailyQuestTemplate {
  currentProgress: number;
  isCompleted: boolean;
  isClaimed: boolean;
  completedAt?: Date | null;
  claimedAt?: Date | null;
}

export interface CampusResetInfo {
  dateKey: string;
  resetAt: Date;
  secondsRemaining: number;
}

/**
 * Returns authoritative campus date key formatted as YYYY-MM-DD in Asia/Kolkata (IST, UTC+05:30).
 */
export function getCampusDateKey(now: Date = new Date()): string {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value || "1970";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

/**
 * Computes the campus dateKey, the next midnight reset Date in IST, and seconds remaining.
 */
export function getCampusResetInfo(now: Date = new Date()): CampusResetInfo {
  const dateKey = getCampusDateKey(now);
  const [yearStr, monthStr, dayStr] = dateKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // In Asia/Kolkata (UTC+5:30), next day 00:00:00 IST is:
  // Date.UTC(year, month - 1, day + 1, 0, 0, 0) minus 5 hours 30 mins (19,800,000 ms)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const nextMidnightUtcTimestamp = Date.UTC(year, month - 1, day + 1, 0, 0, 0) - istOffsetMs;
  const resetAt = new Date(nextMidnightUtcTimestamp);

  const diffMs = resetAt.getTime() - now.getTime();
  const secondsRemaining = Math.max(0, Math.floor(diffMs / 1000));

  return {
    dateKey,
    resetAt,
    secondsRemaining,
  };
}

/**
 * Checks whether currDateKey is strictly the day directly following prevDateKey in calendar days.
 */
export function isConsecutiveDay(prevDateKey: string, currDateKey: string): boolean {
  if (!prevDateKey || !currDateKey) return false;
  const [py, pm, pd] = prevDateKey.split("-").map((v) => parseInt(v, 10));
  const [cy, cm, cd] = currDateKey.split("-").map((v) => parseInt(v, 10));
  const prevUtc = Date.UTC(py, pm - 1, pd);
  const currUtc = Date.UTC(cy, cm - 1, cd);
  const diffDays = Math.round((currUtc - prevUtc) / (24 * 60 * 60 * 1000));
  return diffDays === 1;
}

/**
 * Catalog of daily quest templates.
 */
export const CAMPUS_DAILY_TEMPLATES: DailyQuestTemplate[] = [
  {
    questKey: "daily-clues-1",
    title: "Cryptic Trail",
    description: "Solve 2 investigation or treasure clues across campus sectors.",
    actionType: "SOLVE_CLUE",
    acceptedActionTypes: ["SOLVE_CLUE"],
    targetCount: 2,
    rewardXp: 150,
    rewardCoins: 40,
    rewardTrophies: 15,
    category: "CLUES",
  },
  {
    questKey: "daily-vigilance-1",
    title: "Campus Vigilance",
    description: "Report a lost property or deposit a found item at the Safe Desk.",
    actionType: "REPORT_LOST",
    acceptedActionTypes: ["REPORT_LOST", "DEPOSIT_FOUND"],
    targetCount: 1,
    rewardXp: 100,
    rewardCoins: 30,
    rewardTrophies: 20,
    category: "VIGILANCE",
  },
  {
    questKey: "daily-resolve-1",
    title: "Case Resolution",
    description: "Successfully complete an investigation, recovery, or campus quest.",
    actionType: "COMPLETE_QUEST",
    acceptedActionTypes: ["COMPLETE_QUEST"],
    targetCount: 1,
    rewardXp: 250,
    rewardCoins: 60,
    rewardTrophies: 30,
    category: "RECOVERY",
  },
];

/**
 * Deterministically retrieves daily quest templates for a given dateKey.
 */
export function getDailyQuestTemplates(dateKey: string): DailyQuestTemplate[] {
  // Always returns the 3 core daily objectives
  return CAMPUS_DAILY_TEMPLATES;
}

/**
 * Retrieves daily quest templates and merges user's active progress from UserDailyQuest.
 */
export async function getDailyQuestSet(dateKey: string, userId?: string) {
  await connectDB();
  const templates = getDailyQuestTemplates(dateKey);

  let userQuests: Record<string, any> = {};
  let userStreak = 0;
  let longestStreak = 0;

  if (userId && Types.ObjectId.isValid(userId)) {
    const userObjId = new Types.ObjectId(userId);
    const [docs, userDoc] = await Promise.all([
      UserDailyQuest.find({ userId: userObjId, dateKey }).lean(),
      User.findById(userObjId).select("dailyStreak longestDailyStreak lastDailyCompletionDate").lean(),
    ]);

    for (const doc of docs) {
      userQuests[doc.questKey] = doc;
    }

    if (userDoc) {
      userStreak = userDoc.dailyStreak || 0;
      longestStreak = userDoc.longestDailyStreak || 0;
    }
  }

  const quests: DailyQuestItem[] = templates.map((t) => {
    const userDoc = userQuests[t.questKey];
    return {
      ...t,
      currentProgress: userDoc ? userDoc.currentProgress : 0,
      isCompleted: userDoc ? userDoc.isCompleted : false,
      isClaimed: userDoc ? userDoc.isClaimed : false,
      completedAt: userDoc?.completedAt || null,
      claimedAt: userDoc?.claimedAt || null,
    };
  });

  return {
    dateKey,
    quests,
    dailyStreak: userStreak,
    longestDailyStreak: longestStreak,
  };
}

/**
 * Atomically records user action towards active daily quests for today's IST dateKey.
 */
export async function recordDailyQuestAction(
  userId: string,
  actionType: DailyActionType,
  count: number = 1
): Promise<void> {
  if (!userId || !Types.ObjectId.isValid(userId)) return;
  const userObjId = new Types.ObjectId(userId);

  await connectDB();
  const dateKey = getCampusDateKey();
  const templates = getDailyQuestTemplates(dateKey);

  // Find all templates matching the given actionType
  const matchingTemplates = templates.filter(
    (t) => t.actionType === actionType || (t.acceptedActionTypes && t.acceptedActionTypes.includes(actionType))
  );

  if (matchingTemplates.length === 0) return;

  for (const template of matchingTemplates) {
    // Upsert or retrieve existing record
    let userQuest = await UserDailyQuest.findOne({
      userId: userObjId,
      dateKey,
      questKey: template.questKey,
    });

    if (!userQuest) {
      try {
        userQuest = await UserDailyQuest.create({
          userId: userObjId,
          dateKey,
          questKey: template.questKey,
          targetCount: template.targetCount,
          currentProgress: 0,
          isCompleted: false,
          isClaimed: false,
        });
      } catch (err: any) {
        // Handle race condition on unique index
        userQuest = await UserDailyQuest.findOne({
          userId: userObjId,
          dateKey,
          questKey: template.questKey,
        });
      }
    }

    if (!userQuest || userQuest.isCompleted) {
      continue; // Already completed for today
    }

    const nextProgress = Math.min(template.targetCount, userQuest.currentProgress + count);
    const isCompleted = nextProgress >= template.targetCount;

    await UserDailyQuest.updateOne(
      { _id: userQuest._id, isCompleted: false },
      {
        $set: {
          currentProgress: nextProgress,
          ...(isCompleted ? { isCompleted: true, completedAt: new Date() } : {}),
        },
      }
    );
  }

  // Check if all daily quests are now completed, update user daily streak if eligible
  await checkAndUpdateDailyStreak(userObjId, dateKey);
}

/**
 * Helper to update user's daily streak when all daily quests for the dateKey are completed.
 */
async function checkAndUpdateDailyStreak(userId: Types.ObjectId, dateKey: string): Promise<boolean> {
  const templates = getDailyQuestTemplates(dateKey);
  const docs = await UserDailyQuest.find({ userId, dateKey }).lean();

  const allCompleted =
    templates.length > 0 &&
    templates.every((t) => {
      const match = docs.find((d) => d.questKey === t.questKey);
      return match && match.isCompleted;
    });

  if (!allCompleted) return false;

  const user = await User.findById(userId);
  if (!user) return false;

  // If already credited for today, do not increment streak again
  if (user.lastDailyCompletionDate === dateKey) {
    return false;
  }

  const isConsecutive = user.lastDailyCompletionDate
    ? isConsecutiveDay(user.lastDailyCompletionDate, dateKey)
    : false;

  const newStreak = isConsecutive ? (user.dailyStreak || 0) + 1 : 1;
  const longestStreak = Math.max(user.longestDailyStreak || 0, newStreak);

  await User.findByIdAndUpdate(userId, {
    $set: {
      dailyStreak: newStreak,
      longestDailyStreak: longestStreak,
      lastDailyCompletionDate: dateKey,
    },
  });

  return true;
}

export interface ClaimRewardResult {
  success: boolean;
  xpAwarded?: number;
  coinsAwarded?: number;
  trophiesAwarded?: number;
  newLevel?: number;
  newCoins?: number;
  newTrophies?: number;
  streakUpdated?: boolean;
  alreadyClaimed?: boolean;
  notCompleted?: boolean;
  error?: string;
  message?: string;
}

/**
 * Idempotently claims reward for a completed daily quest.
 */
export async function claimDailyQuestReward(
  userId: string,
  questKey: string,
  dateKey: string
): Promise<ClaimRewardResult> {
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return { success: false, error: "INVALID_USER", message: "Invalid user identifier." };
  }
  const userObjId = new Types.ObjectId(userId);

  await connectDB();
  const templates = getDailyQuestTemplates(dateKey);
  const template = templates.find((t) => t.questKey === questKey);

  if (!template) {
    return { success: false, error: "QUEST_NOT_FOUND", message: "Daily quest template not found." };
  }

  // Atomic claim update: only succeeds if isCompleted is true and isClaimed is false
  const updatedDoc = await UserDailyQuest.findOneAndUpdate(
    {
      userId: userObjId,
      dateKey,
      questKey,
      isCompleted: true,
      isClaimed: false,
    },
    {
      $set: {
        isClaimed: true,
        claimedAt: new Date(),
      },
    },
    { new: true }
  );

  if (!updatedDoc) {
    // Check why findOneAndUpdate did not match
    const existing = await UserDailyQuest.findOne({ userId: userObjId, dateKey, questKey }).lean();
    if (existing?.isClaimed) {
      return {
        success: false,
        alreadyClaimed: true,
        error: "ALREADY_CLAIMED",
        message: "Reward for this daily quest has already been claimed.",
      };
    }
    if (existing && !existing.isCompleted) {
      return {
        success: false,
        notCompleted: true,
        error: "NOT_COMPLETED",
        message: "Objective has not been completed yet.",
      };
    }
    return {
      success: false,
      notCompleted: true,
      error: "QUEST_NOT_STARTED",
      message: "Daily quest has not been started yet.",
    };
  }

  // Grant rewards safely through centralized economy engine with audit transaction
  const trophyReward = template.rewardTrophies ?? 15;
  const rewardResult = await grantUserRewards({
    userId: userObjId,
    baseXp: template.rewardXp,
    baseCoins: template.rewardCoins,
    trophyReward: trophyReward,
    reason: `Daily Quest Reward: ${template.title} (${dateKey})`,
    referenceType: "DAILY_QUEST" as any,
    referenceId: `${dateKey}:${questKey}` as any,
  });

  // Verify and update streak if all daily quests for the day are finished
  const streakUpdated = await checkAndUpdateDailyStreak(userObjId, dateKey);

  return {
    success: true,
    xpAwarded: rewardResult?.finalXp ?? template.rewardXp,
    coinsAwarded: rewardResult?.finalCoins ?? template.rewardCoins,
    trophiesAwarded: rewardResult?.finalTrophies ?? trophyReward,
    newLevel: rewardResult?.user?.level,
    newCoins: rewardResult?.user?.coins,
    newTrophies: rewardResult?.user?.trophies,
    streakUpdated,
  };
}

