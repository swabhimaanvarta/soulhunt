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
  const questCode = `Quest #${String(totalCount + 1).padStart(3, "0")}`;

  // 5. Create Quest in DB
  const quest = await Quest.create({
    questCode,
    title: template.title,
    description: template.description,
    questType: template.questType || options.questType || "CAMPUS_TREASURE",
    difficulty: template.difficulty || options.difficulty || 3,
    targetLocationId: targetLocation._id,
    xpReward: template.xpReward || 200,
    coinReward: template.coinReward || 40,
    squadXpReward: template.squadXpReward || 60,
    finderBonusXp: Math.round((template.xpReward || 200) * 0.15),
    generationSource: source === "TEMPLATE" ? "TEMPLATE" : "AI",
    theme: template.theme || options.theme || "CAMPUS_MYSTERY",
    status: "ACTIVE",
    dailyDate: options.questType === "DAILY_HUNT" ? new Date().toISOString().split("T")[0] : null,
  });

  // 6. Insert Clues
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
  }

  return {
    quest,
    source,
    modelName,
    cluesCount: template.clues?.length || 0,
  };
}

