/**
 * AIEM Hunt — Game Master Orchestration Service
 * 
 * Creates and seeds AI/Template generated quests and clue chains into the database.
 */

import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Quest, Clue, CampusLocation } from "@/models";
import { generateCampusQuest, GenerateQuestOptions } from "./provider";

export async function createAIGameMasterQuest(options: GenerateQuestOptions = {}) {
  await connectDB();

  // 1. Fetch available campus locations
  const locations = await CampusLocation.find().lean();
  if (locations.length === 0) {
    throw new Error("No campus locations available to anchor the quest.");
  }

  // 2. Determine target location
  let targetLocation = options.locationCode
    ? locations.find((l) => l.code === options.locationCode)
    : null;

  if (!targetLocation) {
    const randomIndex = Math.floor(Math.random() * locations.length);
    targetLocation = locations[randomIndex];
  }

  // 3. Generate quest content via AI provider or template fallback
  const generated = await generateCampusQuest({
    ...options,
    locationCode: targetLocation.code,
    locationName: targetLocation.name,
  });

  const { template, source, modelName } = generated;

  // 4. Generate unique quest code
  const totalCount = await Quest.countDocuments();
  let questCode = `Quest #${String(totalCount + 1).padStart(3, "0")}`;
  const existingCode = await Quest.findOne({ questCode });
  if (existingCode) {
    questCode = `Quest #${String(totalCount + 1).padStart(3, "0")}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
  }

  const VALID_QUEST_TYPES = [
    "QUICK_FIND",
    "INVESTIGATION",
    "MYSTERY",
    "LEGENDARY",
    "DAILY_HUNT",
    "SQUAD_HUNT",
    "CAMPUS_TREASURE",
  ];
  let finalQuestType = "CAMPUS_TREASURE";
  if (template.questType && VALID_QUEST_TYPES.includes(template.questType)) {
    finalQuestType = template.questType;
  } else if (options.questType && VALID_QUEST_TYPES.includes(options.questType)) {
    finalQuestType = options.questType;
  }

  // 5. Create Quest in DB (Default DRAFT for admin review, or ACTIVE if requested)
  const initialStatus = options.status || "DRAFT";

  const quest = await Quest.create({
    questCode,
    title: template.title,
    description: template.description,
    questType: finalQuestType,
    difficulty: template.difficulty || options.difficulty || 3,
    targetLocationId: targetLocation._id,
    xpReward: template.xpReward || 200,
    coinReward: template.coinReward || 40,
    squadXpReward: template.squadXpReward || 60,
    finderBonusXp: Math.round((template.xpReward || 200) * 0.15),
    generationSource: source === "TEMPLATE" ? "TEMPLATE" : "AI",
    theme: template.theme || options.theme || "CAMPUS_MYSTERY",
    status: initialStatus,
    dailyDate: finalQuestType === "DAILY_HUNT" ? new Date().toISOString().split("T")[0] : null,
  });

  // 6. Insert Clues
  let preparedClues: any[] = [];
  if (Array.isArray(template.clues) && template.clues.length > 0) {
    const clueDocs = template.clues.map((c, idx) => ({
      questId: quest._id,
      stageOrder: c.stageOrder || idx + 1,
      title: c.title || `Stage ${idx + 1}`,
      clueText: c.clueText,
      verificationType: c.verificationType || "TEXT_RIDDLE",
      expectedAnswerNormalized: (c.expectedAnswer || "").toLowerCase().replace(/[^a-z0-9]/g, ""),
      targetLocationId: targetLocation._id,
      hintText: c.hintText || "Search your surroundings and examine the clue prompt closely.",
      hintCoinCost: c.hintCoinCost || 10,
      unlockedBreadcrumbText: c.unlockedBreadcrumbText || "Clue stage solved! Next coordinate unlocked.",
    }));

    await Clue.insertMany(clueDocs);

    preparedClues = template.clues.map((c, idx) => ({
      stageOrder: c.stageOrder || idx + 1,
      title: c.title || `Stage ${idx + 1}`,
      clueText: c.clueText,
      verificationType: c.verificationType || "TEXT_RIDDLE",
      expectedAnswer: c.expectedAnswer || "aiem",
      hintText: c.hintText || "Search your surroundings and examine the clue prompt closely.",
      hintCoinCost: c.hintCoinCost || 10,
      unlockedBreadcrumbText: c.unlockedBreadcrumbText || "Clue stage solved! Next coordinate unlocked.",
    }));
  }

  return {
    quest,
    clues: preparedClues,
    source,
    modelName,
    cluesCount: preparedClues.length,
  };
}

