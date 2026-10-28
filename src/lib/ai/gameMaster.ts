/**
 * AIEM Hunt — Academic Game Master Orchestration Service
 * 
 * Creates and seeds AI/Template generated course-aligned quests and clue chains into the database.
 * Every AI/Template generation is saved as a DRAFT requiring faculty/staff review before publication.
 */

import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Quest, Clue, CampusLocation, CourseCurriculum } from "@/models";
import { generateCampusQuest, GenerateQuestOptions } from "./provider";

export async function createAIGameMasterQuest(options: GenerateQuestOptions = {}) {
  await connectDB();

  // 1. Fetch available campus locations
  const locations = await CampusLocation.find().lean();
  if (locations.length === 0) {
    throw new Error("No campus locations available to anchor the quest.");
  }

  // 2. Fetch course curriculum details if courseId is provided
  let courseDoc = null;
  if (options.courseId && Types.ObjectId.isValid(options.courseId)) {
    courseDoc = await CourseCurriculum.findById(options.courseId).lean();
    if (courseDoc) {
      options.courseCode = options.courseCode || courseDoc.courseCode;
      options.courseName = options.courseName || courseDoc.courseName;
      options.semester = options.semester || courseDoc.semester;
    }
  }

  // 3. Determine target location (prefer course's approved locations if set)
  let targetLocation = options.locationCode
    ? locations.find((l) => l.code === options.locationCode)
    : null;

  if (!targetLocation && courseDoc && Array.isArray(courseDoc.approvedLocationIds) && courseDoc.approvedLocationIds.length > 0) {
    const courseLocId = courseDoc.approvedLocationIds[0]?.toString();
    targetLocation = locations.find((l) => l._id.toString() === courseLocId) || null;
  }

  if (!targetLocation) {
    targetLocation = locations.find((l) => l.code === "COMP-AI") || locations[0];
  }

  // 4. Generate quest content via AI provider or deterministic academic fallback
  const generated = await generateCampusQuest({
    ...options,
    locationCode: targetLocation.code,
    locationName: targetLocation.name,
  });

  const { data, source, modelName, safetyCheck, fallbackTriggered, fallbackReason } = generated;

  // 5. Generate unique quest code
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
  let finalQuestType = "INVESTIGATION";
  if (options.questType && VALID_QUEST_TYPES.includes(options.questType)) {
    finalQuestType = options.questType;
  }

  // 6. Every AI/Synthesized quest MUST default to DRAFT for staff review
  const initialStatus = "DRAFT";

  const quest = await Quest.create({
    questCode,
    title: data.title,
    description: data.description,
    questType: finalQuestType,
    difficulty: data.difficulty || options.difficulty || 3,
    targetLocationId: targetLocation._id,
    xpReward: data.xpReward || 200,
    coinReward: data.coinReward || 40,
    squadXpReward: data.squadXpReward || 50,
    finderBonusXp: Math.round((data.xpReward || 200) * 0.15),
    generationSource: source === "TEMPLATE" ? "TEMPLATE" : "AI",
    theme: options.theme || "ACADEMIC_INVESTIGATION",
    courseId: courseDoc?._id || (options.courseId && Types.ObjectId.isValid(options.courseId) ? new Types.ObjectId(options.courseId) : null),
    courseCode: options.courseCode || (courseDoc ? courseDoc.courseCode : ""),
    courseName: options.courseName || (courseDoc ? courseDoc.courseName : ""),
    semester: options.semester || (courseDoc ? courseDoc.semester : undefined),
    moduleTitle: options.moduleTitle || "",
    topic: data.courseTopic || options.topic || "",
    learningOutcome: data.learningOutcome || options.learningOutcome || "",
    expectedDurationMinutes: data.expectedDurationMinutes || options.expectedDurationMinutes || 20,
    safetyRationale: data.safetyRationale || "Publicly accessible academic facility with safe student foot traffic.",
    reviewerAssumptions: data.reviewerAssumptions || "Standard prerequisite coursework assumed.",
    aiProvider: source,
    aiModel: modelName,
    status: initialStatus,
    dailyDate: finalQuestType === "DAILY_HUNT" ? new Date().toISOString().split("T")[0] : null,
  });

  // 7. Insert Clues with deterministic grading rules, explanations, and options
  let preparedClues: any[] = [];
  if (Array.isArray(data.clues) && data.clues.length > 0) {
    const clueDocs = data.clues.map((c, idx) => ({
      questId: quest._id,
      stageOrder: c.stageOrder || idx + 1,
      title: c.title || `Stage ${idx + 1}`,
      clueText: c.clueText,
      verificationType: c.verificationType || "TEXT_RIDDLE",
      expectedAnswerNormalized: (c.expectedAnswer || "").toLowerCase().trim(),
      acceptableAnswers: Array.isArray(c.acceptableAnswers)
        ? c.acceptableAnswers.map((a) => a.toLowerCase().trim())
        : [(c.expectedAnswer || "").toLowerCase().trim()],
      numericTolerance: c.numericTolerance || 0,
      hintText: c.hintText || "Examine the syllabus formula and problem statement closely.",
      explanation: c.explanation || "Deduction derived directly from approved course syllabus.",
      options: Array.isArray(c.options) ? c.options : [],
      correctOptionId: c.correctOptionId || "",
      variantTemplate: c.variantTemplate || undefined,
      targetLocationId: targetLocation._id,
      hintCoinCost: 10,
      unlockedBreadcrumbText: c.unlockedBreadcrumbText || `Stage ${idx + 1} solved. Pathway verified.`,
    }));

    await Clue.insertMany(clueDocs);

    preparedClues = data.clues.map((c, idx) => ({
      stageOrder: c.stageOrder || idx + 1,
      title: c.title || `Stage ${idx + 1}`,
      clueText: c.clueText,
      verificationType: c.verificationType || "TEXT_RIDDLE",
      expectedAnswer: c.expectedAnswer,
      acceptableAnswers: c.acceptableAnswers || [],
      numericTolerance: c.numericTolerance || 0,
      hintText: c.hintText,
      explanation: c.explanation,
      options: c.options || [],
      correctOptionId: c.correctOptionId || "",
      unlockedBreadcrumbText: c.unlockedBreadcrumbText,
    }));
  }

  return {
    quest,
    clues: preparedClues,
    source,
    modelName,
    cluesCount: preparedClues.length,
    safetyCheck,
    fallbackTriggered,
    fallbackReason,
  };
}
