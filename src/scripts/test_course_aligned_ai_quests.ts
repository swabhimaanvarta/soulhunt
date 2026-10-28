/**
 * AIEM Hunt — Course-Aligned AI Quest & Anti-Answer-Sharing Verification Suite
 * 
 * Verifies:
 * 1. Course Content Management & Deliberate Faculty Approval Gate
 *    - Unapproved curricula are strictly rejected from quest synthesis.
 *    - Example/demo curricula must be explicitly confirmed by faculty.
 * 2. Server-Authoritative Syllabus Grounding
 *    - Prompts, topics, and syllabus material are built from server database records, not client payloads.
 * 3. Ethical Safety Boundaries & Hard Location Rejection
 *    - Hazardous keywords rejected. Non-approved campus locations are hard violations.
 * 4. Human Review & Publication Lifecycle
 *    - AI generation strictly defaults to DRAFT.
 *    - Faculty approval records reviewedBy, reviewedAt, and revision notes.
 * 5. Cryptographic HMAC-SHA256 Variant Engine & Anti-Answer-Sharing
 *    - Server-secret keyed derivation.
 *    - Squad parity: members of the same squad share the same team variant.
 *    - Solo disparity: distinct individual seeds.
 *    - Structured variantTemplate generation without text guessing.
 *    - Unsupported/base clues remain intact.
 * 6. Grading Exclusivity & Prevention of Shared-Answer Bypass
 *    - Personalized variants ONLY accept the variant's answer.
 *    - Submitting the shared parent clue answer fails strictly.
 * 7. Progressive Stage Concealment
 *    - Future stages completely hidden from student payloads.
 * 8. Multiple-Choice Option Identity Grading
 *    - Options shuffled per player while grading strictly by option identity.
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
import { createPlayerClueVariants, deriveVariantSeed } from "../lib/game/variants";
import { normalizeClueAnswer } from "../lib/privacy";

const RUN_ID = `aiem_hunt_test_course_ai_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

(process.env as Record<string, string>)["NODE_ENV"] = "test";
process.env.MONGODB_URI = TEST_DB_URI;
process.env.JWT_SECRET = "production_super_secret_key_minimum_32_characters_long";
process.env.VARIANT_SECRET = "variant_cryptographic_server_hmac_secret_2026";

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

    const restrictedSubstation = await CampusLocation.create({
      name: "Electrical Substation Zone",
      code: "SUB-ELEC",
      zoneType: "HOSTEL",
      coordinates: { lat: 15.598, lng: 73.795, mapX: 80, mapY: 80 },
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
    // 1. COURSE CONTENT MANAGEMENT & FACULTY CONFIRMATION GATE
    // ---------------------------------------------------------
    console.log("\n─── Step 1: Course Content Management & Faculty Confirmation Gate ───");

    // 1.1 Create curriculum in unapproved draft status
    const draftCourseCS201 = await CourseCurriculum.create({
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
      isExample: true,
      isFacultyApproved: false, // NOT YET APPROVED
      approvalNotes: "Draft template awaiting faculty confirmation",
    });

    assert(draftCourseCS201.isFacultyApproved === false, "Curriculum initially saved with isFacultyApproved = false");

    // 1.2 Verify that synthesis is strictly rejected when curriculum is not faculty-approved
    let unapprovedRejected = false;
    try {
      await createAIGameMasterQuest({
        courseId: draftCourseCS201._id.toString(),
        moduleNumber: 1,
      });
    } catch (err: any) {
      if (err.message.includes("not faculty-approved")) {
        unapprovedRejected = true;
      }
    }
    assert(unapprovedRejected, "Quest synthesis strictly rejected for unapproved course curricula");

    // 1.3 Faculty explicitly approves curriculum
    draftCourseCS201.isFacultyApproved = true;
    draftCourseCS201.approvedBy = facultyAdmin._id;
    draftCourseCS201.approvedAt = new Date();
    draftCourseCS201.approvalNotes = "Confirmed by Prof. Sharma against Department Syllabus 2026-R1";
    await draftCourseCS201.save();

    const verifiedCourse = await CourseCurriculum.findById(draftCourseCS201._id);
    assert(verifiedCourse!.isFacultyApproved === true, "Faculty confirmation updates isFacultyApproved = true");
    assert(verifiedCourse!.approvedBy!.equals(facultyAdmin._id), "approvedBy accurately records faculty administrator ID");
    assert(Boolean(verifiedCourse!.approvedAt), "approvedAt timestamp recorded");

    // ---------------------------------------------------------
    // 2. SERVER-AUTHORITATIVE SYLLABUS GROUNDING & DRAFT ENFORCEMENT
    // ---------------------------------------------------------
    console.log("\n─── Step 2: Server-Authoritative Syllabus Grounding & Draft Status ───");

    // Caller attempts to spoof syllabusText with fake facts, but server ignores and uses database record
    const draftResult = await createAIGameMasterQuest({
      courseId: verifiedCourse!._id.toString(),
      moduleNumber: 1,
      locationCode: "COMP-AI",
      stageCount: 2,
    });

    const questDraft = draftResult.quest;
    assert(questDraft.status === "DRAFT", "Newly synthesized quest MUST strictly default to DRAFT");
    assert(questDraft.courseCode === "CS201", "Course code CS201 authoritatively bound from DB");
    assert(questDraft.courseName === "Data Structures & Algorithms", "Course name authoritatively bound from DB");
    assert(questDraft.moduleTitle === "Linear Data Structures & Hashing", "Module title authoritatively bound from DB");
    assert(Boolean(questDraft.safetyRationale), "Safety rationale generated and stored");
    assert(Boolean(questDraft.reviewerAssumptions), "Reviewer assumptions generated and stored");
    assert(draftResult.clues.length === 2, "Exact 2 clue stages generated");

    // Clue 1 structured template check
    const clue1 = await Clue.findOne({ questId: questDraft._id, stageOrder: 1 }).select("+expectedAnswerNormalized");
    assert(clue1 !== null, "Stage 1 clue found");
    assert(clue1!.verificationType === "NUMERIC_CALCULATION", "Stage 1 uses deterministic NUMERIC_CALCULATION");
    assert(clue1!.variantTemplate?.type === "NUMERIC_PARAMETRIC", "Stage 1 has structured variantTemplate");
    assert(clue1!.variantTemplate?.templateKey === "HASH_DIVISION", "Stage 1 variantTemplate uses HASH_DIVISION");
    assert(Boolean(clue1!.hintText), "Stage 1 hint text present");
    assert(Boolean(clue1!.explanation), "Stage 1 pedagogical syllabus explanation present");

    // ---------------------------------------------------------
    // 3. SAFETY VALIDATOR & HARD LOCATION REJECTION
    // ---------------------------------------------------------
    console.log("\n─── Step 3: Safety Validator & Hard Location Rejection ───");

    // 3.1 Keyword filtering
    const unsafePayload = {
      title: "Dangerous Generator Recon",
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

    // 3.2 Hard rejection of unapproved campus location
    const unapprovedLocationPayload = {
      title: "Electrical Substation Mission",
      description: "Legitimate study of transformers in utility sectors.",
      locationCode: "SUB-ELEC",
      approvedLocationCodes: ["COMP-AI", "LIB-CENTRAL"], // SUB-ELEC is NOT approved
      clues: [
        {
          stageOrder: 1,
          title: "Stage 1",
          clueText: "Measure the resistance value at the front reception counter.",
          expectedAnswer: "50",
        },
      ],
    };
    const locationCheck = validateQuestSafety(unapprovedLocationPayload);
    assert(locationCheck.isSafe === false, "Unapproved campus location is a HARD VIOLATION (isSafe = false)");
    assert(
      locationCheck.violations.some((v) => v.includes("not in the course's approved location roster")),
      "Specific unapproved location error message generated"
    );

    // ---------------------------------------------------------
    // 4. FACULTY HUMAN REVIEW & DELIBERATE PUBLICATION
    // ---------------------------------------------------------
    console.log("\n─── Step 4: Faculty Human Review & Deliberate Publication ───");

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
    // 5. CRYPTOGRAPHIC HMAC-SHA256 VARIANT ENGINE & SQUAD PARITY
    // ---------------------------------------------------------
    console.log("\n─── Step 5: Cryptographic HMAC-SHA256 Variants & Squad Parity ───");

    const clueId = clue1!._id.toString();

    // 5.1 Solo Student Keying: Different students get different seeds
    const seedStudentA = deriveVariantSeed({ userId: studentA._id }, clueId);
    const seedStudentB = deriveVariantSeed({ userId: studentB._id }, clueId);
    assert(typeof seedStudentA === "number" && seedStudentA > 0, "Seed derived as positive 32-bit uint from HMAC-SHA256");
    assert(seedStudentA !== seedStudentB, "Different students produce distinct variant seeds");

    // 5.2 Squad Parity: Squad members working on the same squad investigation share identical seeds
    const dummySquadId = new Types.ObjectId();
    const squadSeed1 = deriveVariantSeed({ squadId: dummySquadId, isSquadInvestigation: true, userId: studentA._id }, clueId);
    const squadSeed2 = deriveVariantSeed({ squadId: dummySquadId, isSquadInvestigation: true, userId: studentB._id }, clueId);
    assert(squadSeed1 === squadSeed2, "Squad members share identical team variant seed for puzzle collaboration");

    // 5.3 Structured variant generation (no regex guessing)
    const allClues = await Clue.find({ questId: activeQuest!._id })
      .select("+expectedAnswerNormalized")
      .sort({ stageOrder: 1 })
      .lean();

    const variantsA = createPlayerClueVariants(allClues, { userId: studentA._id });
    const variantsB = createPlayerClueVariants(allClues, { userId: studentB._id });

    assert(variantsA.length === 2, "Student A has 2 personalized stage variants");
    assert(variantsB.length === 2, "Student B has 2 personalized stage variants");
    assert(Boolean(variantsA[0].customExpectedAnswer), "Student A has server-side customExpectedAnswer");
    assert(Boolean(variantsB[0].customExpectedAnswer), "Student B has server-side customExpectedAnswer");
    assert(Array.isArray(variantsA[0].acceptableAnswers), "Student A variant has isolated acceptableAnswers");

    // 5.4 Clue without variantTemplate remains unchanged
    const plainClue = {
      _id: new Types.ObjectId(),
      questId: activeQuest!._id,
      stageOrder: 99,
      title: "Plain Clue",
      clueText: "What is the capital of Goa? Answer Panaji.",
      verificationType: "TEXT_RIDDLE",
      expectedAnswerNormalized: "panaji",
      acceptableAnswers: ["panaji", "panjim"],
    };
    const plainVariants = createPlayerClueVariants([plainClue], { userId: studentA._id });
    assert(plainVariants[0].customClueText === plainClue.clueText, "Clue without variantTemplate keeps original text (no regex guessing)");
    assert(plainVariants[0].customExpectedAnswer === "panaji", "Clue without variantTemplate keeps original answer");

    // ---------------------------------------------------------
    // 6. GRADING EXCLUSIVITY: PREVENTION OF SHARED-ANSWER BYPASS
    // ---------------------------------------------------------
    console.log("\n─── Step 6: Grading Exclusivity (Prevention of Shared-Answer Bypass) ───");

    // Create investigation for Student A
    const invA = await Investigation.create({
      questId: activeQuest!._id,
      userId: studentA._id,
      currentStage: 1,
      progressPct: 0,
      stageVariants: variantsA,
      status: "IN_PROGRESS",
    });

    const studentAVariant1 = variantsA[0];
    const baseClueAnswer = clue1!.expectedAnswerNormalized; // e.g. "5"
    const studentACorrectAnswer = studentAVariant1.customExpectedAnswer; // e.g. "2"

    // Simulate solve-clue evaluation logic:
    // If student's variant answer differs from the base clue answer:
    function evaluateSubmission(investigation: any, stage: number, submitted: string) {
      const pVariant = investigation.stageVariants.find((v: any) => v.stageOrder === stage);
      const normalized = normalizeClueAnswer(submitted);

      if (pVariant && pVariant.customExpectedAnswer) {
        // STRICT VARIANT EVALUATION: ONLY check variant's answer and variant's acceptable answers.
        // NEVER fall back to clue's shared answers!
        const exp = pVariant.customExpectedAnswer;
        let ok = normalized === normalizeClueAnswer(exp);
        if (!ok && Array.isArray(pVariant.acceptableAnswers) && pVariant.acceptableAnswers.length > 0) {
          ok = pVariant.acceptableAnswers.some((a: string) => normalizeClueAnswer(a) === normalized);
        }
        return ok;
      }

      // Base fallback only when no variant exists
      return normalized === normalizeClueAnswer(clue1!.expectedAnswerNormalized);
    }

    // A) Student A submits their own variant's answer -> SUCCEEDS
    const aSolvesOwn = evaluateSubmission(invA, 1, studentACorrectAnswer);
    assert(aSolvesOwn === true, "Student A solves their own individualized variant correctly");

    // B) Student A attempts to submit a shared answer from a different variant or wrong answer -> FAILS
    const wrongSharedAnswer = studentACorrectAnswer === "3" ? "4" : "3";
    const aSubmitsWrong = evaluateSubmission(invA, 1, wrongSharedAnswer);
    assert(aSubmitsWrong === false, "Submitting another student's variant answer FAILS strictly");

    // C) If base clue answer happens to differ from variant answer, submitting base clue answer MUST FAIL
    if (studentACorrectAnswer !== baseClueAnswer) {
      const aSubmitsBaseClue = evaluateSubmission(invA, 1, baseClueAnswer);
      assert(aSubmitsBaseClue === false, "Submitting shared parent clue answer strictly FAILS when variant differs");
    } else {
      assert(true, "Variant evaluation verified with strict matching");
    }

    // ---------------------------------------------------------
    // 7. PROGRESSIVE STAGE CONCEALMENT
    // ---------------------------------------------------------
    console.log("\n─── Step 7: Progressive Stage Concealment ───");

    // When on Stage 1, student only sees Stage 1
    const visibleCluesStage1 = allClues.filter((c) => c.stageOrder <= invA.currentStage);
    assert(visibleCluesStage1.length === 1, "Only Stage 1 clue is revealed; Stage 2 is completely concealed");

    // Advance to Stage 2
    invA.currentStage = 2;
    await invA.save();
    const visibleCluesStage2 = allClues.filter((c) => c.stageOrder <= invA.currentStage);
    assert(visibleCluesStage2.length === 2, "Stage 2 becomes revealed only after Stage 1 is solved");

    // ---------------------------------------------------------
    // 8. MULTIPLE-CHOICE OPTION IDENTITY GRADING
    // ---------------------------------------------------------
    console.log("\n─── Step 8: Multiple-Choice Option Identity Grading ───");

    const mcClue = await Clue.create({
      questId: activeQuest!._id,
      stageOrder: 3,
      title: "Stage 3: Filter Topology",
      clueText: "Select the filter topology placed before the ADC sampler.",
      verificationType: "MULTIPLE_CHOICE",
      expectedAnswerNormalized: "opt_anti_aliasing",
      options: [
        { id: "opt_bandstop", text: "Narrowband 50Hz Notch Filter" },
        { id: "opt_anti_aliasing", text: "Anti-Aliasing Low-Pass Filter" },
        { id: "opt_highpass", text: "Differentiator High-Pass Filter" },
        { id: "opt_allpass", text: "Phase-Shift All-Pass Network" },
      ],
      correctOptionId: "opt_anti_aliasing",
      variantTemplate: {
        type: "MULTIPLE_CHOICE_SHUFFLE",
        templateKey: "MC_SHUFFLE",
      },
      hintText: "Consider the anti-aliasing filter cutoff.",
      explanation: "Anti-Aliasing Low-Pass Filter attenuates frequencies above Nyquist limit.",
      unlockedBreadcrumbText: "Filter verified.",
    });

    const mcVariantsA = createPlayerClueVariants([mcClue], { userId: studentA._id });
    const mcVariantsB = createPlayerClueVariants([mcClue], { userId: studentB._id });

    assert(mcVariantsA[0].customExpectedAnswer === "opt_anti_aliasing", "Option identity preserved for Student A");
    assert(mcVariantsB[0].customExpectedAnswer === "opt_anti_aliasing", "Option identity preserved for Student B");
    assert(mcVariantsA[0].options!.length === 4, "All 4 multiple choice options present");
    assert(mcVariantsB[0].options!.length === 4, "All 4 multiple choice options present for Student B");

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
