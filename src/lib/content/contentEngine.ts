/**
 * AIEM Hunt — Always-On Living Campus & Content Engine
 * 
 * Ensures continuous fresh campus activity:
 * - Daily Hunt auto-rotation (never leaves students with empty boards)
 * - Living Campus live activity feed
 * - Flagship Campus Event lifecycle management
 */

import { connectDB } from "@/lib/db";
import { Quest, Clue, Event, Investigation, Transaction, User, Squad, CampusLocation } from "@/models";
import { getCampusDateKey } from "@/lib/dailyQuests";
import { CAMPUS_QUEST_TEMPLATES } from "@/lib/content/challengeTemplates";

export async function getOrRotateDailyQuest() {
  await connectDB();

  const today = getCampusDateKey();

  // Check if today's daily quest already exists
  let dailyQuest = await Quest.findOne({
    questType: "DAILY_HUNT",
    dailyDate: today,
    status: "ACTIVE",
  })
    .populate("targetLocationId", "name code zoneType coordinates")
    .lean();

  // If not found, check if ANY active daily hunt exists for today's dateKey
  if (!dailyQuest) {
    dailyQuest = await Quest.findOne({
      questType: "DAILY_HUNT",
      dailyDate: today,
    })
      .populate("targetLocationId", "name code zoneType coordinates")
      .lean();
  }

  // If still none, automatically spawn a fresh Daily Mystery via pre-seeded template!
  if (!dailyQuest) {
    const dailyTemplates = CAMPUS_QUEST_TEMPLATES.filter((t) => t.questType === "DAILY_HUNT");
    const template = dailyTemplates.length > 0 ? dailyTemplates[0] : CAMPUS_QUEST_TEMPLATES[0];

    const location = await CampusLocation.findOne({
      $or: [{ code: template.locationCode }, { isActive: true }],
    }).lean();

    const questCode = `DAILY-${today.replace(/-/g, "")}`;
    const createdQuest = await Quest.create({
      questCode,
      title: template.title,
      description: template.description,
      questType: "DAILY_HUNT",
      difficulty: template.difficulty || 2,
      targetLocationId: location?._id || null,
      xpReward: template.xpReward || 180,
      coinReward: template.coinReward || 35,
      squadXpReward: template.squadXpReward || 60,
      dailyDate: today,
      status: "ACTIVE",
    });

    for (const clueTmpl of template.clues) {
      await Clue.create({
        questId: createdQuest._id,
        stageOrder: clueTmpl.stageOrder,
        title: clueTmpl.title,
        clueText: clueTmpl.clueText,
        verificationType: clueTmpl.verificationType,
        expectedAnswer: clueTmpl.expectedAnswer,
        expectedAnswerNormalized: (clueTmpl.expectedAnswer || "").trim().toLowerCase(),
        hintText: clueTmpl.hintText,
        hintCoinCost: clueTmpl.hintCoinCost,
        unlockedBreadcrumbText: clueTmpl.unlockedBreadcrumbText,
      });
    }

    dailyQuest = await Quest.findById(createdQuest._id)
      .populate("targetLocationId", "name code zoneType coordinates")
      .lean();
  }

  // Fetch clues for this daily quest
  const clues = dailyQuest
    ? await Clue.find({ questId: dailyQuest._id })
        .select("-expectedAnswerNormalized")
        .sort({ stageOrder: 1 })
        .lean()
    : [];

  return {
    quest: dailyQuest,
    clues,
    today,
  };
}

export async function getActiveCampusEvents() {
  await connectDB();

  const now = new Date();
  let events = await Event.find({
    status: { $in: ["LIVE", "UPCOMING"] },
    endTime: { $gte: now },
  })
    .sort({ startTime: 1 })
    .lean();

  // If no events exist, automatically seed the flagship Campus Event
  if (events.length === 0) {
    const startTime = new Date();
    const endTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days long

    const flagshipEvent = await Event.create({
      title: "The Seven Seals of AIEM: Inter-Departmental Sprint",
      slug: "seven-seals-aiem-sprint",
      eventType: "INTER_DEPT",
      description:
        "A campus-wide cooperative and competitive mystery hunt spanning all academic blocks, labs, and the Central Library. Squads and solo investigators solve sequential puzzles to claim prestige for their department.",
      rules: [
        "1. Discover and solve sequential clue nodes across Academic Blocks A, B, and C.",
        "2. Zero physical item tampering — Safe-Desks hold all physical custody checkpoints.",
        "3. First squad to unlock all checkpoints earns the exclusive AIEM Vanguard title and +250 Coins.",
        "4. Hints consume squad coins; coordinate clues wisely.",
      ],
      bannerGradient: "from-violet-900/80 via-slate-900 to-emerald-900/70",
      startTime,
      endTime,
      eligibleDepartments: ["ALL", "CSE", "ECE", "MECH"],
      isSquadEvent: true,
      rewardPool: {
        firstPlaceCoins: 300,
        secondPlaceCoins: 175,
        thirdPlaceCoins: 100,
        exclusiveTitle: "AIEM Vanguard Grandmaster",
      },
      status: "LIVE",
    });

    const createdLean = await Event.findById(flagshipEvent._id).lean();
    if (createdLean) events = [createdLean];
  }

  return events;
}

export interface ActivityFeedItem {
  id: string;
  type: "RECOVERY" | "CLUE_SOLVED" | "QUEST_COMPLETE" | "SQUAD_LEVEL_UP" | "DAILY_RELEASE";
  title: string;
  description: string;
  timestamp: string;
  badgeColor: string;
}

export async function getLivingCampusFeed(): Promise<ActivityFeedItem[]> {
  await connectDB();

  const feed: ActivityFeedItem[] = [];

  // 1. Recent completed transactions / recoveries
  const recentTx = await Transaction.find({
    referenceType: { $in: ["RECOVERY", "QUEST"] },
  })
    .sort({ createdAt: -1 })
    .limit(8)
    .populate("userId", "displayName username")
    .lean();

  for (const tx of recentTx) {
    const userName = (tx.userId as any)?.displayName || "An investigator";
    if (tx.referenceType === "RECOVERY") {
      feed.push({
        id: tx._id.toString(),
        type: "RECOVERY",
        title: "Lost Item Handover Verified",
        description: `${userName} completed a Safe-Desk item recovery (+${tx.deltaXp} XP)`,
        timestamp: tx.createdAt.toISOString(),
        badgeColor: "emerald",
      });
    } else {
      feed.push({
        id: tx._id.toString(),
        type: "QUEST_COMPLETE",
        title: "Campus Mystery Solved",
        description: `${userName}: ${tx.reason}`,
        timestamp: tx.createdAt.toISOString(),
        badgeColor: "cyan",
      });
    }
  }

  // 2. Recent squad accomplishments
  const squads = await Squad.find()
    .sort({ updatedAt: -1 })
    .limit(4)
    .lean();

  for (const sq of squads) {
    if (sq.completedHuntsCount > 0) {
      feed.push({
        id: sq._id.toString(),
        type: "SQUAD_LEVEL_UP",
        title: `Squad [${sq.tag}] On The Move`,
        description: `${sq.name} completed ${sq.completedHuntsCount} missions (Level ${sq.squadLevel})`,
        timestamp: (sq as any).updatedAt?.toISOString() || new Date().toISOString(),
        badgeColor: "amber",
      });
    }
  }

  // Sort feed descending by timestamp
  feed.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return feed.slice(0, 10);
}
