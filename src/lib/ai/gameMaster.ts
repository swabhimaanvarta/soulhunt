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

  // 2. Fetch and strictly validate course curriculum details (Server-Authoritative Grounding)
  if (!options.courseId || !Types.ObjectId.isValid(options.courseId)) {
    throw new Error("A valid courseId is strictly required to anchor quest synthesis in an approved course curriculum.");
  }

  const courseDoc = await CourseCurriculum.findById(options.courseId).populate("approvedLocationIds").lean();
  if (!courseDoc) {
    throw new Error("Specified course curriculum not found in database.");
  }
  if (!courseDoc.isActive) {
    throw new Error(`Course curriculum ${courseDoc.courseCode} is not currently active.`);
  }
  if (!courseDoc.isFacultyApproved) {
    throw new Error(
      `Course curriculum ${courseDoc.courseCode} is not faculty-approved. Demo or draft curricula must be reviewed and approved by faculty before generating quests.`
    );
  }

  // Select module by moduleNumber or moduleId from the verified database record
  const targetModuleNumber = options.moduleNumber || 1;
  const targetModule =
    (courseDoc.modules &&
      courseDoc.modules.find(
        (m: any) =>
          m.moduleNumber === targetModuleNumber ||
          (options.moduleId && m._id?.toString() === options.moduleId)
      )) ||
    courseDoc.modules?.[0];

  if (!targetModule) {
    throw new Error(`Module ${targetModuleNumber} not found in course curriculum ${courseDoc.courseCode}.`);
  }

  // Authoritatively overwrite options from the stored database module to prevent client tampering
  options.courseCode = courseDoc.courseCode;
  options.courseName = courseDoc.courseName;
  options.semester = courseDoc.semester;
  options.moduleTitle = targetModule.title;
  options.approvedSyllabusText = targetModule.approvedSyllabusText;

  // Validate topic & learning outcome against the module's approved roster
  if (options.topic && targetModule.topics.includes(options.topic)) {
    // Valid topic in module
  } else {
    options.topic = targetModule.topics[0] || "Core Syllabus Concepts";
  }

  if (options.learningOutcome && targetModule.learningOutcomes.includes(options.learningOutcome)) {
    // Valid learning outcome in module
  } else {
    options.learningOutcome = targetModule.learningOutcomes[0] || "Analyze syllabus principles";
  }

  // Roster of approved campus location codes
  const approvedLocations = (courseDoc.approvedLocationIds || []) as any[];
  const approvedLocationCodes = approvedLocations
    .map((l: any) => l.code)
    .filter(Boolean);
  options.approvedLocationCodes = approvedLocationCodes;
  options.approvedLocations = approvedLocations.map((l: any) => ({ code: l.code, name: l.name }));

  // 3. Determine target location (MUST be in course's approved locations if specified)
  let targetLocation = null;
  if (options.locationCode) {
    targetLocation = locations.find((l) => l.code === options.locationCode) || null;
    if (targetLocation && approvedLocationCodes.length > 0 && !approvedLocationCodes.includes(targetLocation.code)) {
      throw new Error(
        `Selected location "${options.locationCode}" is not approved for course ${courseDoc.courseCode}. Approved facilities: ${approvedLocationCodes.join(", ")}.`
      );
    }
  }

  if (!targetLocation && approvedLocations.length > 0) {
    const firstApprovedId = approvedLocations[0]._id ? approvedLocations[0]._id.toString() : approvedLocations[0].toString();
    targetLocation = locations.find((l) => l._id.toString() === firstApprovedId) || locations[0];
  }

  if (!targetLocation) {
    targetLocation = locations.find((l) => l.code === "COMP-AI") || locations[0];
  }

  // 4. Generate quest content via AI provider or deterministic academic fallback
  const generated = await generateCampusQuest({
    ...options,
    locationCode: targetLocation.code,
    locationName: targetLocation.name,
    approvedLocationCodes,
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
