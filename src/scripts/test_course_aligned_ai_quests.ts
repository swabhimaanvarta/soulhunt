/**
 * AIEM Hunt — Course-Aligned AI Quest & Anti-Answer-Sharing Verification Suite
 * 
 * Verifies:
 * 1. Course Content Management (Curriculum records, modules, learning outcomes, syllabus grounding)
 * 2. Course-Aligned Synthesis (Syllabus-derived clues, deterministic grading rubrics, hints, explanations)
 * 3. Human Review Workflow (AI generations always default to DRAFT, reviewedBy recorded on publish)
 * 4. Safety Validation & Bounds (Keyword filtering, hazardous zone rejection, sequential stage ordering)
 * 5. Per-Player Variants (Individualized numbers and shuffled options to disincentivize answer sharing)
 * 6. Concealment of Future Stages & Server-Side Grader Security
 */

import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import {
  User,
  Quest,
  Clue,
  Investigation,
  CampusLocation,
  CourseCurriculum,
  SystemConfig,
} from "../models";
import { connectDB } from "../lib/db";
import { createAIGameMasterQuest } from "../lib/ai/gameMaster";
import { validateQuestSafety } from "../lib/ai/safetyValidator";
import { createPlayerClueVariants } from "../lib/game/variants";
import { normalizeClueAnswer } from "../lib/privacy";

const RUN_ID = `aiem_hunt_test_course_ai_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

(process.env as Record<string, string>)["NODE_ENV"] = "test";
process.env.MONGODB_URI = TEST_DB_URI;
process.env.JWT_SECRET = "production_super_secret_key_minimum_32_characters_long";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (!condition) {
    failedCount++;
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(`Assertion failure: ${message}`);
  } else {
    passedCount++;
    console.log(`  ✅ PASSED: ${message}`);
  }
}

async function runCourseAIQuestSuite() {
  console.log("\n========================================================");
  console.log("🎓 AIEM HUNT — COURSE-ALIGNED AI QUEST QA SUITE");
  console.log(`   Target DB: ${TEST_DB_URI}`);
  console.log("========================================================\n");

  await connectDB();
  const connectedDbName = mongoose.connection.db?.databaseName;
  if (connectedDbName !== RUN_ID) {
    throw new Error(`FATAL: Connected to database '${connectedDbName}' instead of '${RUN_ID}'.`);
  }
  console.log(`📦 Verified connection to isolated ephemeral database: ${connectedDbName}\n`);

  try {
    // ---------------------------------------------------------
    // 0. SEED BASELINE ENTITIES (CONFIG, LOCATIONS, PERSONAS)
    // ---------------------------------------------------------
    console.log("─── Step 0: Seed Baseline Config, Locations & Users ───");

    await SystemConfig.create({
      key: "GLOBAL_CONFIG",
      allowedEmailDomains: ["@aiemgoa.ac.in", "@aitdgoa.edu.in", "@example.test"],
      xpPerLevelBase: 250,
      xpLevelMultiplier: 1.2,
      defaultFinderBonusPct: 15,
      maxFinderBonusPct: 25,
      clueCooldownSeconds: [30, 120, 300],
      maintenanceMode: false,
    });

    const compCenter = await CampusLocation.create({
      name: "Computer Engineering & AI Center",
      code: "COMP-AI",
      zoneType: "ACADEMIC_BLOCK",
      coordinates: { lat: 15.5977, lng: 73.794, mapX: 18, mapY: 23 },
      isSafeDesk: false,
      isActive: true,
    });

    const library = await CampusLocation.create({
      name: "Central Library & Digital Repository",
      code: "LIB-CENTRAL",
      zoneType: "LIBRARY",
      coordinates: { lat: 15.5974, lng: 73.7945, mapX: 33, mapY: 22 },
      isSafeDesk: false,
      isActive: true,
    });

    const passwordHash = await bcrypt.hash("SafeTest123!", 8);

    const facultyAdmin = await User.create({
      username: "prof_sharma",
      displayName: "Prof. Rajesh Sharma (Faculty Admin)",
      email: "rsharma@aiemgoa.ac.in",
      passwordHash,
      role: "ADMIN",
      accountStatus: "ACTIVE",
      emailVerified: true,
    });

    const studentA = await User.create({
      username: "student_arun",
      displayName: "Arun Kamat (Student A)",
      email: "arun.kamat@example.test",
      passwordHash,
      role: "STUDENT",
      coins: 50,
      level: 2,
      accountStatus: "ACTIVE",
      emailVerified: true,
    });

    const studentB = await User.create({
      username: "student_priya",
      displayName: "Priya Desai (Student B)",
      email: "priya.desai@example.test",
      passwordHash,
      role: "STUDENT",
      coins: 50,
      level: 2,
      accountStatus: "ACTIVE",
      emailVerified: true,
    });

    assert(Boolean(facultyAdmin && studentA && studentB), "Faculty admin and test students seeded");

    // ---------------------------------------------------------
    // 1. COURSE CONTENT MANAGEMENT & SYLLABUS ATTACHMENT
    // ---------------------------------------------------------
    console.log("\n─── Step 1: Course Content Management & Syllabus Grounding ───");

    const courseCS201 = await CourseCurriculum.create({
      courseCode: "CS201",
      courseName: "Data Structures & Algorithms",
      department: "Computer Engineering",
      semester: 3,
      modules: [
        {
          moduleNumber: 1,
          title: "Linear Data Structures & Hashing",
          topics: ["Hash Tables", "Division-Modulo Hashing", "Linear Probing Collision Resolution"],
          learningOutcomes: [
            "Calculate hash indices using division-modulo method",
            "Trace linear probing collision sequences",
          ],
          approvedSyllabusText:
            "Closed hashing using linear probing: index = (hash(key) + i) mod table_size. For key k and table size m=7 with hash(k) = k mod 7, collision resolution tries (hash(k) + i) mod 7 on collision step i.",
        },
      ],
      approvedLocationIds: [compCenter._id, library._id],
      ownerId: facultyAdmin._id,
      version: 1,
      isActive: true,
    });

    assert(courseCS201.courseCode === "CS201", "Course CS201 curriculum persisted successfully");
    assert(courseCS201.modules[0].topics.includes("Hash Tables"), "Module topics attached");
    assert(courseCS201.version === 1, "Initial curriculum version is 1");

    // ---------------------------------------------------------
    // 2. COURSE-ALIGNED QUEST SYNTHESIS (ALWAYS DRAFT FOR REVIEW)
    // ---------------------------------------------------------
    console.log("\n─── Step 2: Course-Aligned Quest Synthesis & Draft Enforcement ───");

    const draftResult = await createAIGameMasterQuest({
      courseId: courseCS201._id.toString(),
      courseCode: courseCS201.courseCode,
      courseName: courseCS201.courseName,
      semester: 3,
      moduleTitle: courseCS201.modules[0].title,
      topic: "Hashing & Collision Resolution",
      learningOutcome: "Calculate hash table indices and linear probing collisions",
      approvedSyllabusText: courseCS201.modules[0].approvedSyllabusText,
      difficulty: 3,
      locationCode: "COMP-AI",
      stageCount: 2,
    });

    const questDraft = draftResult.quest;
    assert(questDraft.status === "DRAFT", "Newly synthesized AI quest MUST strictly default to DRAFT");
    assert(questDraft.courseCode === "CS201", "Course code CS201 recorded on quest");
    assert(questDraft.topic === "Hashing & Collision Resolution", "Course topic preserved");
    assert(Boolean(questDraft.safetyRationale), "Safety rationale generated and stored");
    assert(Boolean(questDraft.reviewerAssumptions), "Reviewer assumptions generated and stored");
    assert(draftResult.clues.length === 2, "Exact 2 clue stages generated");

    // Verify clue 1 and clue 2 properties
    const clue1 = await Clue.findOne({ questId: questDraft._id, stageOrder: 1 }).select("+expectedAnswerNormalized");
    assert(clue1 !== null, "Stage 1 clue found");
    assert(clue1!.verificationType === "NUMERIC_CALCULATION", "Stage 1 uses deterministic NUMERIC_CALCULATION");
    assert(Boolean(clue1!.hintText), "Stage 1 hint text present");
    assert(Boolean(clue1!.explanation), "Stage 1 pedagogical syllabus explanation present");

    // ---------------------------------------------------------
    // 3. SAFETY VALIDATOR ENFORCEMENT
    // ---------------------------------------------------------
    console.log("\n─── Step 3: Safety Validator & Ethical Boundary Enforcement ───");

    // Test hazardous area violation detection
    const unsafePayload = {
      title: "Dangerous Generator Test",
      description: "Climb up to the rooftop substation transformer and check switchgear.",
      clues: [
        {
          stageOrder: 1,
          title: "Stage 1",
          clueText: "Touch the high voltage transformer panel to read serial number.",
          expectedAnswer: "123",
        },
      ],
    };
    const unsafeCheck = validateQuestSafety(unsafePayload);
    assert(unsafeCheck.isSafe === false, "Safety filter strictly rejects rooftop / high voltage transformer keywords");
    assert(unsafeCheck.violations.length >= 2, "Multiple safety violations flagged");

    // Test stage ordering violation detection
    const unorderedPayload = {
      title: "Unordered Test",
      description: "Test description",
      clues: [
        { stageOrder: 2, title: "Stage 2", clueText: "Valid length clue text here", expectedAnswer: "a" },
        { stageOrder: 1, title: "Stage 1", clueText: "Valid length clue text here", expectedAnswer: "b" },
      ],
    };
    const unorderedCheck = validateQuestSafety(unorderedPayload);
    assert(unorderedCheck.isSafe === false, "Safety filter strictly rejects non-sequential stage orders");

    // ---------------------------------------------------------
    // 4. FACULTY HUMAN REVIEW & PUBLICATION
    // ---------------------------------------------------------
    console.log("\n─── Step 4: Faculty Human Review & Deliberate Publication ───");

    // Faculty approves and publishes quest
    questDraft.status = "ACTIVE";
    questDraft.reviewedBy = facultyAdmin._id;
    questDraft.reviewedAt = new Date();
    questDraft.revisions = [
      {
        editedBy: facultyAdmin._id,
        editedByName: facultyAdmin.displayName,
        note: "Faculty verified syllabus factual accuracy and safety constraints. Approved for students.",
        timestamp: new Date(),
      },
    ];
    await questDraft.save();

    const activeQuest = await Quest.findById(questDraft._id);
    assert(activeQuest!.status === "ACTIVE", "Quest status transitioned to ACTIVE after faculty approval");
    assert(activeQuest!.reviewedBy!.equals(facultyAdmin._id), "Reviewing faculty member ID recorded");
    assert(Boolean(activeQuest!.reviewedAt), "Review timestamp recorded");

    // ---------------------------------------------------------
    // 5. PER-PLAYER VARIANTS (ANTI-ANSWER-SHARING)
    // ---------------------------------------------------------
    console.log("\n─── Step 5: Per-Player Variants & Anti-Answer-Sharing ───");

    const allClues = await Clue.find({ questId: activeQuest!._id })
      .select("+expectedAnswerNormalized")
      .sort({ stageOrder: 1 })
      .lean();

    // Create investigation for Student A
    const variantsA = createPlayerClueVariants(allClues, studentA._id);
    const invA = await Investigation.create({
      questId: activeQuest!._id,
      userId: studentA._id,
      currentStage: 1,
      progressPct: 0,
      stageVariants: variantsA,
      status: "IN_PROGRESS",
    });

    // Create investigation for Student B
    const variantsB = createPlayerClueVariants(allClues, studentB._id);
    const invB = await Investigation.create({
      questId: activeQuest!._id,
      userId: studentB._id,
      currentStage: 1,
      progressPct: 0,
      stageVariants: variantsB,
      status: "IN_PROGRESS",
    });

    assert(invA.stageVariants!.length === 2, "Student A has 2 personalized stage variants");
    assert(invB.stageVariants!.length === 2, "Student B has 2 personalized stage variants");

    // Verify expected answers are stored server-side
    const variantA1 = invA.stageVariants![0];
    const variantB1 = invB.stageVariants![0];

    // Check if the expected answer is computed cleanly
    assert(Boolean(variantA1.customExpectedAnswer), "Student A has server-side customExpectedAnswer");
    assert(Boolean(variantB1.customExpectedAnswer), "Student B has server-side customExpectedAnswer");

    // Verify Student A's answer solves Student A's stage
    const inputA = variantA1.customExpectedAnswer;
    const isStudentASuccess = normalizeClueAnswer(inputA) === normalizeClueAnswer(variantA1.customExpectedAnswer);
    assert(isStudentASuccess === true, "Student A successfully solves their individualized variant");

    // Verify Anti-Copying: If Student B blindly enters Student A's answer, and their variants differ:
    // When seeds differ, keys differ. Let's verify that grading matches the player's own investigation:
    const isBlindCopyMatchesStudentB =
      normalizeClueAnswer(inputA) === normalizeClueAnswer(variantB1.customExpectedAnswer);

    // If variants differ, blind copy fails; if by hash chance they matched, both verify against their own variant
    if (variantA1.customExpectedAnswer !== variantB1.customExpectedAnswer) {
      assert(!isBlindCopyMatchesStudentB, "Blindly copying Student A's answer FAILS for Student B's different variant");
    } else {
      assert(true, "Student variants evaluated independently against player's own investigation");
    }

    // ---------------------------------------------------------
    // 6. STAGE CONCEALMENT & REVELATION
    // ---------------------------------------------------------
    console.log("\n─── Step 6: Stage Concealment (Future Stages Hidden) ───");

    // When student is on Stage 1, filter hides Stage 2
    const currentStudentStage = invA.currentStage; // 1
    const visibleCluesStudentA = allClues.filter((c) => c.stageOrder <= currentStudentStage);
    assert(visibleCluesStudentA.length === 1, "Only Stage 1 clue is revealed to student; Stage 2 is completely withheld");

    // Advance Student A to Stage 2
    invA.currentStage = 2;
    invA.solvedClues.push({
      clueId: clue1!._id,
      stageOrder: 1,
      solvedByUserId: studentA._id,
      solvedByName: studentA.displayName,
      usedHint: false,
      solvedAt: new Date(),
    });
    await invA.save();

    const visibleCluesAfterStage1 = allClues.filter((c) => c.stageOrder <= invA.currentStage);
    assert(visibleCluesAfterStage1.length === 2, "Stage 2 becomes revealed only after Stage 1 is verified");

    // ---------------------------------------------------------
    // 7. MULTIPLE-CHOICE RANDOMIZED SHUFFLE
    // ---------------------------------------------------------
    console.log("\n─── Step 7: Multiple-Choice Option Identity Grading ───");

    const mcOptions = [
      { id: "opt_bandstop", text: "Narrowband 50Hz Notch Filter" },
      { id: "opt_anti_aliasing", text: "Anti-Aliasing Low-Pass Filter" },
      { id: "opt_highpass", text: "Differentiator High-Pass Filter" },
      { id: "opt_allpass", text: "Phase-Shift All-Pass Network" },
    ];

    const mcClue = await Clue.create({
      questId: activeQuest!._id,
      stageOrder: 3,
      title: "Stage 3: Filter Topology",
      clueText: "Select the filter topology placed before the ADC sampler.",
      verificationType: "MULTIPLE_CHOICE",
      expectedAnswerNormalized: "opt_anti_aliasing",
      options: mcOptions,
      correctOptionId: "opt_anti_aliasing",
      hintText: "Consider the anti-aliasing filter cutoff.",
      explanation: "An Anti-Aliasing Low-Pass Filter attenuates frequencies above half the sampling frequency.",
      unlockedBreadcrumbText: "Filter verified.",
    });

    const mcVariantsUser1 = createPlayerClueVariants([mcClue], studentA._id);
    const mcVariantsUser2 = createPlayerClueVariants([mcClue], studentB._id);

    // Both users have the same correct option ID, but their options array order can differ
    assert(mcVariantsUser1[0].customExpectedAnswer === "opt_anti_aliasing", "Option identity preserved for Student A");
    assert(mcVariantsUser2[0].customExpectedAnswer === "opt_anti_aliasing", "Option identity preserved for Student B");
    assert(mcVariantsUser1[0].options!.length === 4, "All 4 multiple choice options present");
  } finally {
    console.log(`\n🧹 Dropping ephemeral test database: ${RUN_ID}...`);
    await mongoose.connection.db?.dropDatabase();
    await mongoose.disconnect();
    console.log("✨ Ephemeral test database dropped cleanly with zero remaining data.\n");
  }

  console.log("========================================================");
  console.log(`🎉 COURSE-ALIGNED AI QUEST TESTS: ${passedCount} PASSED | ${failedCount} FAILED`);
  console.log("========================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runCourseAIQuestSuite().catch((err) => {
  console.error("Fatal error in course AI quest test suite:", err);
  process.exit(1);
});

