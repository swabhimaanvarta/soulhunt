/**
 * AIEM Hunt — Milestone 2 Adversarial Stress Harness & State Machine Verifier
 * 
 * Conducts strict empirical challenges on:
 * 1. Solo Recon Isolation when user's squad completed quest 10 times.
 * 2. Squad Raid blocking unaffiliated users without squadId and users with stale squadId.
 * 3. 10 simulated squad members concurrent clue submission (no duplicate solves or corrupted stage order).
 * 4. 10 simulated squad members concurrent recovery submission (atomic lock, zero duplicate trophies or coins).
 * 5. Adversarial security & state machine violations (outsider access, stage lock, incomplete recovery, cooldown).
 */

import crypto from "crypto";
import { AsyncLocalStorage } from "async_hooks";
import { NextRequest } from "next/server";
import mongoose, { Types } from "mongoose";
import {
  User,
  Quest,
  Clue,
  Investigation,
  Squad,
  SquadMember,
  CampusLocation,
  SystemConfig,
} from "../models";
import { connectDB } from "../lib/db";
import { POST as startQuest } from "../app/api/quests/[id]/start/route";
import { GET as getQuest } from "../app/api/quests/[id]/route";
import { POST as solveClue } from "../app/api/quests/[id]/solve-clue/route";
import { POST as recoverInvestigation } from "../app/api/investigations/[id]/recover/route";

const RUN_ID = `aiem_hunt_stress_m2_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

(process.env as Record<string, string>)["NODE_ENV"] = "test";
process.env.MONGODB_URI = TEST_DB_URI;
process.env.JWT_SECRET = "production_super_secret_key_minimum_32_characters_long";
process.env.VARIANT_SECRET = "variant_cryptographic_server_hmac_secret_2026";

// Setup AsyncLocalStorage for authentic per-request user context in concurrent runs
const userStorage = new AsyncLocalStorage<any>();
let fallbackTestUser: any = null;

Object.defineProperty(globalThis, "__TEST_CURRENT_USER__", {
  get() {
    return userStorage.getStore() || fallbackTestUser;
  },
  configurable: true,
});

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

async function run() {
  console.log("========================================================");
  console.log("⚡ MILESTONE 2 EMPIRICAL ADVERSARIAL STRESS SUITE");
  console.log(`   Isolated Test DB: ${RUN_ID}`);
  console.log("========================================================\n");

  await connectDB();

  try {
    // ------------------------------------------------------------------
    // STEP 0: SEED BASELINE INFRASTRUCTURE
    // ------------------------------------------------------------------
    console.log("─── Step 0: Seed Configuration & Campus Location ───");

    await SystemConfig.findOneAndUpdate(
      { key: "GLOBAL_CONFIG" },
      { $setOnInsert: { key: "GLOBAL_CONFIG", clueCooldownSeconds: [5, 10, 15] } },
      { upsert: true }
    );

    const testLocation = await CampusLocation.create({
      code: `LOC_STRESS_${Date.now()}`,
      name: "Cybernetics Research Lab",
      zoneType: "ACADEMIC_BLOCK",
      building: "Tech Block",
      floors: ["Level 2"],
      coordinates: { lat: 15.425, lng: 73.985, mapX: 45, mapY: 60 },
      isSafeDesk: false,
      isActive: true,
    });

    const quest = await Quest.create({
      questCode: `Q-STR-${Date.now().toString(36).toUpperCase()}`,
      title: "The Quantum Core Conundrum",
      description: "Recover the synchronized quantum core key.",
      questType: "CAMPUS_TREASURE",
      difficulty: 2,
      targetLocationId: testLocation._id,
      xpReward: 200,
      coinReward: 60,
      squadXpReward: 75,
      trophyReward: 25,
      finderBonusXp: 40,
      status: "ACTIVE",
    });

    const clue1 = await Clue.create({
      questId: quest._id,
      stageOrder: 1,
      title: "Stage 1: Frequency Calibration",
      clueText: "Input the baseline oscillator frequency: 50 * 2?",
      verificationType: "NUMERIC_CALCULATION",
      expectedAnswerNormalized: "100",
      acceptableAnswers: ["100"],
      hintText: "Multiply 50 by 2.",
      unlockedBreadcrumbText: "Frequency lock confirmed.",
    });

    const clue2 = await Clue.create({
      questId: quest._id,
      stageOrder: 2,
      title: "Stage 2: Core Matrix Stabilization",
      clueText: "Input the parity key: 300 + 14?",
      verificationType: "NUMERIC_CALCULATION",
      expectedAnswerNormalized: "314",
      acceptableAnswers: ["314"],
      hintText: "Sum 300 and 14.",
      unlockedBreadcrumbText: "Quantum core stabilized.",
    });

    assert(Boolean(quest._id), "Stress quest created with 2 stages");

    // ------------------------------------------------------------------
    // CHALLENGE 1: SOLO RECON AFTER SQUAD SOLVED 10 TIMES
    // ------------------------------------------------------------------
    console.log("\n─── Challenge 1: Solo Recon Start Seamlessness After Squad Solved 10 Times ───");

    const veteranSquad = await Squad.create({
      name: `Veteran Syndicate ${Date.now()}`,
      tag: `VET1`,
      description: "Squad with 10 historic quest completions",
      leaderId: new Types.ObjectId(),
      squadXp: 500,
      squadLevel: 2,
      trophies: 150,
    });

    const veteranSoloUser = await User.create({
      username: `veteran_scout_${Date.now()}`,
      email: `scout_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "mock_hash",
      displayName: "Veteran Solo Scout",
      role: "STUDENT",
      coins: 50,
      xp: 100,
      squadId: veteranSquad._id,
    });

    veteranSquad.leaderId = veteranSoloUser._id as any;
    await veteranSquad.save();

    await SquadMember.create({
      squadId: veteranSquad._id,
      userId: veteranSoloUser._id,
      role: "LEADER",
    });

    // Seed 10 COMPLETED squad investigations for this squad and quest
    for (let i = 1; i <= 10; i++) {
      await Investigation.create({
        questId: quest._id,
        userId: null,
        squadId: veteranSquad._id,
        isSquadInvestigation: true,
        currentStage: 3,
        progressPct: 100,
        status: "COMPLETED",
        participatingUserIds: [veteranSoloUser._id],
        startedAt: new Date(Date.now() - (11 - i) * 3600000),
        completedAt: new Date(Date.now() - (11 - i) * 3600000 + 1800000),
      });
    }

    const squadCompletionsCount = await Investigation.countDocuments({
      questId: quest._id,
      squadId: veteranSquad._id,
      isSquadInvestigation: true,
      status: "COMPLETED",
    });
    assert(squadCompletionsCount === 10, "Squad has exactly 10 historical COMPLETED investigations for this quest");

    // Check Quest Briefing for the user
    {
      fallbackTestUser = veteranSoloUser;
      const req = new NextRequest(`http://localhost:3000/api/quests/${quest._id}`);
      const res = await getQuest(req, { params: Promise.resolve({ id: quest._id.toString() }) });
      const json = await res.json();

      assert(res.status === 200, "Briefing fetched successfully");
      assert(json.data.quest.isCompletedBySquad === true, "Briefing reports isCompletedBySquad = true");
      assert(json.data.quest.isCompletedByUser === false, "Briefing reports isCompletedByUser = false (solo recon not done)");
      assert(json.data.investigation === null, "Briefing exposes investigation = null (allowing Start Solo Recon action)");
      assert(json.data.quest.soloInvestigationStatus === "NOT_STARTED", "Solo investigation status is NOT_STARTED");
    }

    // Launch Solo Recon (asSquad: false)
    let soloInvId: string = "";
    {
      const req = new NextRequest(`http://localhost:3000/api/quests/${quest._id}/start`, {
        method: "POST",
        body: JSON.stringify({ asSquad: false }),
      });
      const res = await startQuest(req, { params: Promise.resolve({ id: quest._id.toString() }) });
      const json = await res.json();

      assert(res.status === 201, "Solo Recon starts successfully (HTTP 201) despite 10 squad solves!");
      assert(Boolean(json.data?.investigationId), "Solo Recon investigation room ID returned");
      soloInvId = json.data.investigationId;

      const soloDoc = await Investigation.findById(soloInvId);
      assert(soloDoc?.isSquadInvestigation === false, "Investigation is marked isSquadInvestigation = false");
      assert(soloDoc?.userId?.toString() === veteranSoloUser._id.toString(), "Investigation userId belongs strictly to the solo user");
      assert(soloDoc?.squadId === null, "squadId is null on solo recon investigation");
      assert(soloDoc?.currentStage === 1, "Investigation initialized at Stage 1");
    }

    // Play through Solo Recon
    {
      // Stage 1
      const req1 = new NextRequest(`http://localhost:3000/api/quests/${quest._id}/solve-clue`, {
        method: "POST",
        body: JSON.stringify({ stageOrder: 1, submittedAnswer: "100", investigationId: soloInvId }),
      });
      const res1 = await solveClue(req1, { params: Promise.resolve({ id: quest._id.toString() }) });
      const json1 = await res1.json();
      assert(res1.status === 200 && json1.success, "Solo Recon Stage 1 solved");

      // Stage 2
      const req2 = new NextRequest(`http://localhost:3000/api/quests/${quest._id}/solve-clue`, {
        method: "POST",
        body: JSON.stringify({ stageOrder: 2, submittedAnswer: "314", investigationId: soloInvId }),
      });
      const res2 = await solveClue(req2, { params: Promise.resolve({ id: quest._id.toString() }) });
      const json2 = await res2.json();
      assert(res2.status === 200 && json2.data?.status === "READY_FOR_RECOVERY", "Solo Recon Stage 2 solved, ready for recovery");

      // Recover Solo Recon
      const initialCoins = veteranSoloUser.coins;
      const initialSquadTrophies = veteranSquad.trophies;

      const reqRec = new NextRequest(`http://localhost:3000/api/investigations/${soloInvId}/recover`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const resRec = await recoverInvestigation(reqRec, { params: Promise.resolve({ id: soloInvId }) });
      const jsonRec = await resRec.json();

      assert(resRec.status === 200 && jsonRec.data?.status === "COMPLETED", "Solo Recon recovery successfully completed");

      const updatedUser = await User.findById(veteranSoloUser._id);
      const updatedSquad = await Squad.findById(veteranSquad._id);

      // M1 Non-Linear Progression Curve: 100 XP + 200 XP = 300 XP triggers Level 2 level-up (200 XP threshold)
      // Level 2 grants authoritative milestone bonus: 25 * 2 = 50 coins in addition to quest.coinReward (60)
      const expectedMilestoneBonus = 50;
      assert((updatedUser?.coins || 0) === initialCoins + quest.coinReward + expectedMilestoneBonus, "Solo user coins credited (+60 quest + 50 Lvl 2 milestone)");
      assert(updatedSquad?.trophies === initialSquadTrophies, "Squad trophies unchanged by Solo Recon completion");
    }

    // Verify subsequent Solo Recon attempt is blocked
    {
      const req = new NextRequest(`http://localhost:3000/api/quests/${quest._id}/start`, {
        method: "POST",
        body: JSON.stringify({ asSquad: false }),
      });
      const res = await startQuest(req, { params: Promise.resolve({ id: quest._id.toString() }) });
      const json = await res.json();

      assert(res.status === 400, "Subsequent Solo Recon attempt strictly blocked (HTTP 400)");
      assert(json.code === "ALREADY_COMPLETED", "Rejection error code is ALREADY_COMPLETED");
    }

    // ------------------------------------------------------------------
    // CHALLENGE 2: SQUAD RAID MEMBERSHIP ENFORCEMENT & STALE MEMBERSHIP
    // ------------------------------------------------------------------
    console.log("\n─── Challenge 2: Squad Raid Membership Enforcement (Unaffiliated & Stale) ───");

    // 2.1 Unaffiliated user without squadId
    {
      const unaffiliated = await User.create({
        username: `unaffiliated_${Date.now()}`,
        email: `unaff_${Date.now()}@aiemgoa.ac.in`,
        passwordHash: "mock_hash",
        displayName: "No Squad User",
        role: "STUDENT",
        squadId: null,
      });

      fallbackTestUser = unaffiliated;
      const req = new NextRequest(`http://localhost:3000/api/quests/${quest._id}/start`, {
        method: "POST",
        body: JSON.stringify({ asSquad: true }),
      });
      const res = await startQuest(req, { params: Promise.resolve({ id: quest._id.toString() }) });
      const json = await res.json();

      assert(res.status === 400, "Unaffiliated user rejected with HTTP 400");
      assert(json.code === "SQUAD_MEMBERSHIP_REQUIRED", "Error code is SQUAD_MEMBERSHIP_REQUIRED");
    }

    // 2.2 Stale squadId on user document (no SquadMember record)
    {
      const staleUser = await User.create({
        username: `stale_user_${Date.now()}`,
        email: `stale_${Date.now()}@aiemgoa.ac.in`,
        passwordHash: "mock_hash",
        displayName: "Stale SquadId User",
        role: "STUDENT",
        squadId: new Types.ObjectId(), // Dangler squadId without SquadMember record
      });

      fallbackTestUser = staleUser;
      const req = new NextRequest(`http://localhost:3000/api/quests/${quest._id}/start`, {
        method: "POST",
        body: JSON.stringify({ asSquad: true }),
      });
      const res = await startQuest(req, { params: Promise.resolve({ id: quest._id.toString() }) });
      const json = await res.json();

      assert(res.status === 400, "Stale squadId user rejected with HTTP 400");
      assert(json.code === "SQUAD_MEMBERSHIP_REQUIRED", "Rejection code is SQUAD_MEMBERSHIP_REQUIRED");
    }

    // 2.3 Mismatched squadId (user has squadId X, but SquadMember record is for squad Y)
    {
      const squadX = new Types.ObjectId();
      const squadY = new Types.ObjectId();

      const mismatchedUser = await User.create({
        username: `mismatched_${Date.now()}`,
        email: `mismatched_${Date.now()}@aiemgoa.ac.in`,
        passwordHash: "mock_hash",
        displayName: "Mismatched Squad Member",
        role: "STUDENT",
        squadId: squadX,
      });

      await SquadMember.create({
        squadId: squadY,
        userId: mismatchedUser._id,
        role: "MEMBER",
      });

      fallbackTestUser = mismatchedUser;
      const req = new NextRequest(`http://localhost:3000/api/quests/${quest._id}/start`, {
        method: "POST",
        body: JSON.stringify({ asSquad: true }),
      });
      const res = await startQuest(req, { params: Promise.resolve({ id: quest._id.toString() }) });
      const json = await res.json();

      assert(res.status === 400, "Mismatched squad membership rejected with HTTP 400");
      assert(json.code === "SQUAD_MEMBERSHIP_REQUIRED", "Error code is SQUAD_MEMBERSHIP_REQUIRED");
    }

    // ------------------------------------------------------------------
    // CHALLENGE 3: 10 SIMULATED SQUAD MEMBERS CONCURRENT CLUE SUBMISSION
    // ------------------------------------------------------------------
    console.log("\n─── Challenge 3: 10 Simulated Squad Members Concurrent Clue Submission ───");

    // Create fresh raid quest
    const raidQuest = await Quest.create({
      questCode: `Q-RAID-${Date.now().toString(36).toUpperCase()}`,
      title: "Raid Protocol Synchronization",
      description: "Synchronize all operatives on the neural network.",
      questType: "CAMPUS_TREASURE",
      difficulty: 3,
      targetLocationId: testLocation._id,
      xpReward: 300,
      coinReward: 100,
      squadXpReward: 120,
      trophyReward: 35,
      finderBonusXp: 50,
      status: "ACTIVE",
    });

    const raidClue1 = await Clue.create({
      questId: raidQuest._id,
      stageOrder: 1,
      title: "Raid Clue 1: Subnet Mask",
      clueText: "Input subnet prefix for /24: 250 + 5?",
      verificationType: "NUMERIC_CALCULATION",
      expectedAnswerNormalized: "255",
      acceptableAnswers: ["255"],
      hintText: "Add 250 and 5",
      unlockedBreadcrumbText: "Subnet mask synchronized.",
    });

    const raidClue2 = await Clue.create({
      questId: raidQuest._id,
      stageOrder: 2,
      title: "Raid Clue 2: Gateway Gateway",
      clueText: "Input gateway terminal: 1000 + 24?",
      verificationType: "NUMERIC_CALCULATION",
      expectedAnswerNormalized: "1024",
      acceptableAnswers: ["1024"],
      hintText: "Add 1000 and 24",
      unlockedBreadcrumbText: "Gateway online.",
    });

    // Create a 10-member raid squad
    const raidSquad = await Squad.create({
      name: `Apex Deca-Syndicate ${Date.now()}`,
      tag: `APEX`,
      description: "Full 10-operative strike team",
      leaderId: new Types.ObjectId(),
      squadXp: 0,
      squadLevel: 1,
      trophies: 0,
      completedHuntsCount: 0,
    });

    const squadMembers: any[] = [];
    for (let i = 0; i < 10; i++) {
      const member = await User.create({
        username: `apex_operative_${i}_${Date.now()}`,
        email: `apex_${i}_${Date.now()}@aiemgoa.ac.in`,
        passwordHash: "mock_hash",
        displayName: `Operative ${i + 1}`,
        role: "STUDENT",
        coins: 100,
        xp: 0,
        squadId: raidSquad._id,
      });

      await SquadMember.create({
        squadId: raidSquad._id,
        userId: member._id,
        role: i === 0 ? "LEADER" : "MEMBER",
      });

      squadMembers.push(member);
    }

    raidSquad.leaderId = squadMembers[0]._id;
    await raidSquad.save();

    // Leader launches the Squad Raid room
    let raidInvestigationId: string = "";
    {
      fallbackTestUser = squadMembers[0];
      const req = new NextRequest(`http://localhost:3000/api/quests/${raidQuest._id}/start`, {
        method: "POST",
        body: JSON.stringify({ asSquad: true }),
      });
      const res = await startQuest(req, { params: Promise.resolve({ id: raidQuest._id.toString() }) });
      const json = await res.json();

      assert(res.status === 201, "Squad Leader launches raid room (HTTP 201)");
      raidInvestigationId = json.data.investigationId;
    }

    // Remaining 9 squad members join the raid room
    for (let i = 1; i < 10; i++) {
      fallbackTestUser = squadMembers[i];
      const req = new NextRequest(`http://localhost:3000/api/quests/${raidQuest._id}/start`, {
        method: "POST",
        body: JSON.stringify({ asSquad: true }),
      });
      const res = await startQuest(req, { params: Promise.resolve({ id: raidQuest._id.toString() }) });
      const json = await res.json();

      assert(res.status === 200, `Operative ${i + 1} joins existing raid room (HTTP 200)`);
      assert(json.data.investigationId === raidInvestigationId, `Operative ${i + 1} received existing raid ID`);
    }

    const raidRoomDoc = await Investigation.findById(raidInvestigationId);
    assert(
      raidRoomDoc?.participatingUserIds?.length === 10,
      "All 10 operatives atomically registered in participatingUserIds"
    );

    // 10 OPERATIVES CONCURRENTLY SUBMIT STAGE 1 ANSWER
    console.log("  >>> Firing 10 simultaneous concurrent clue submissions for Stage 1...");
    fallbackTestUser = null; // Ensure AsyncLocalStorage isolates each operative

    const stage1Promises = squadMembers.map((member) =>
      userStorage.run(member, async () => {
        const req = new NextRequest(`http://localhost:3000/api/quests/${raidQuest._id}/solve-clue`, {
          method: "POST",
          body: JSON.stringify({
            stageOrder: 1,
            submittedAnswer: "255",
            investigationId: raidInvestigationId,
          }),
        });
        const res = await solveClue(req, { params: Promise.resolve({ id: raidQuest._id.toString() }) });
        const json = await res.json();
        return { status: res.status, json, memberId: member._id.toString() };
      })
    );

    const stage1Results = await Promise.all(stage1Promises);

    const allStage1Success = stage1Results.every((r) => r.status === 200 && r.json.success === true);
    assert(allStage1Success, "All 10 concurrent Stage 1 submissions returned HTTP 200 & success=true");

    const primarySolvers1 = stage1Results.filter((r) => r.json.data?.alreadySolved !== true);
    const concurrentFollowers1 = stage1Results.filter((r) => r.json.data?.alreadySolved === true);

    assert(primarySolvers1.length === 1, `Exactly ONE primary solver updated Stage 1 (found ${primarySolvers1.length})`);
    assert(concurrentFollowers1.length === 9, `Exactly 9 concurrent solvers gracefully handled alreadySolved (found ${concurrentFollowers1.length})`);

    // Verify database state after Stage 1
    const invAfterStage1 = await Investigation.findById(raidInvestigationId);
    assert(invAfterStage1?.currentStage === 2, "Investigation currentStage atomically advanced to 2");
    assert(
      invAfterStage1?.solvedClues.filter((sc) => sc.stageOrder === 1).length === 1,
      "Exactly ONE solvedClues entry pushed for Stage 1 (zero duplicates under 10 concurrent requests)"
    );

    // 10 OPERATIVES CONCURRENTLY SUBMIT STAGE 2 ANSWER
    console.log("  >>> Firing 10 simultaneous concurrent clue submissions for Stage 2...");

    const stage2Promises = squadMembers.map((member) =>
      userStorage.run(member, async () => {
        const req = new NextRequest(`http://localhost:3000/api/quests/${raidQuest._id}/solve-clue`, {
          method: "POST",
          body: JSON.stringify({
            stageOrder: 2,
            submittedAnswer: "1024",
            investigationId: raidInvestigationId,
          }),
        });
        const res = await solveClue(req, { params: Promise.resolve({ id: raidQuest._id.toString() }) });
        const json = await res.json();
        return { status: res.status, json, memberId: member._id.toString() };
      })
    );

    const stage2Results = await Promise.all(stage2Promises);

    const allStage2Success = stage2Results.every((r) => r.status === 200 && r.json.success === true);
    assert(allStage2Success, "All 10 concurrent Stage 2 submissions returned HTTP 200 & success=true");

    const primarySolvers2 = stage2Results.filter((r) => r.json.data?.alreadySolved !== true);
    const concurrentFollowers2 = stage2Results.filter((r) => r.json.data?.alreadySolved === true);

    assert(primarySolvers2.length === 1, `Exactly ONE primary solver updated Stage 2 (found ${primarySolvers2.length})`);
    assert(concurrentFollowers2.length === 9, `Exactly 9 concurrent solvers gracefully handled alreadySolved for Stage 2 (found ${concurrentFollowers2.length})`);

    // Verify database state after Stage 2
    const invAfterStage2 = await Investigation.findById(raidInvestigationId);
    assert(invAfterStage2?.currentStage === 3, "Investigation currentStage advanced to 3 (beyond last stage)");
    assert(invAfterStage2?.status === "READY_FOR_RECOVERY", "Investigation status transitioned to READY_FOR_RECOVERY");
    assert(
      invAfterStage2?.solvedClues.length === 2,
      "solvedClues contains exactly 2 stages in total (Stage 1 and Stage 2)"
    );
    assert(
      invAfterStage2?.solvedClues[0].stageOrder === 1 && invAfterStage2?.solvedClues[1].stageOrder === 2,
      "solvedClues preserves clean monotonic stage order (1 -> 2)"
    );

    // ------------------------------------------------------------------
    // CHALLENGE 4: 10 SIMULATED SQUAD MEMBERS CONCURRENT RECOVERY SUBMISSION
    // ------------------------------------------------------------------
    console.log("\n─── Challenge 4: 10 Simulated Squad Members Concurrent Recovery Claim ───");

    // Capture exact pre-recovery ledger baseline
    const preSquad = await Squad.findById(raidSquad._id);
    const preSquadXp = preSquad?.squadXp || 0;
    const preSquadTrophies = preSquad?.trophies || 0;
    const preSquadCompletions = preSquad?.completedHuntsCount || 0;
    const preQuestCompletions = raidQuest.currentCompletions || 0;

    const preMemberBalances = await Promise.all(
      squadMembers.map(async (m) => {
        const u = await User.findById(m._id);
        return { userId: m._id.toString(), coins: u?.coins || 0, xp: u?.xp || 0, trophies: u?.trophies || 0 };
      })
    );

    console.log("  >>> Firing 10 simultaneous concurrent recovery claims for the raid investigation...");

    const recoveryPromises = squadMembers.map((member) =>
      userStorage.run(member, async () => {
        const req = new NextRequest(`http://localhost:3000/api/investigations/${raidInvestigationId}/recover`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        const res = await recoverInvestigation(req, { params: Promise.resolve({ id: raidInvestigationId }) });
        const json = await res.json();
        return { status: res.status, json, memberId: member._id.toString() };
      })
    );

    const recoveryResults = await Promise.all(recoveryPromises);

    const successfulClaims = recoveryResults.filter((r) => r.status === 200 && r.json.data?.status === "COMPLETED");
    const rejectedClaims = recoveryResults.filter((r) => r.status === 400 && r.json.error?.code === "ALREADY_COMPLETED");

    assert(successfulClaims.length === 1, `Exactly ONE recovery claim succeeded with HTTP 200 (found ${successfulClaims.length})`);
    assert(rejectedClaims.length === 9, `Exactly NINE concurrent recovery claims rejected with ALREADY_COMPLETED (found ${rejectedClaims.length})`);

    // Verify Squad Trophy & XP Ledger
    const postSquad = await Squad.findById(raidSquad._id);
    const postQuest = await Quest.findById(raidQuest._id);

    const expectedTrophies = preSquadTrophies + (raidQuest.trophyReward || 25);
    const expectedSquadXp = preSquadXp + raidQuest.squadXpReward;
    const expectedHuntsCount = preSquadCompletions + 1;
    const expectedQuestCompletions = preQuestCompletions + 1;

    assert(
      postSquad?.trophies === expectedTrophies,
      `Squad trophies increased by EXACTLY ${raidQuest.trophyReward || 25} (Pre: ${preSquadTrophies}, Post: ${postSquad?.trophies}) — ZERO duplicate trophy payouts!`
    );
    assert(
      postSquad?.squadXp === expectedSquadXp,
      `Squad XP increased by EXACTLY ${raidQuest.squadXpReward} (Pre: ${preSquadXp}, Post: ${postSquad?.squadXp}) — ZERO duplicate XP payouts!`
    );
    assert(
      postSquad?.completedHuntsCount === expectedHuntsCount,
      `Squad completedHuntsCount incremented by exactly 1 (Pre: ${preSquadCompletions}, Post: ${postSquad?.completedHuntsCount})`
    );
    assert(
      postQuest?.currentCompletions === expectedQuestCompletions,
      `Quest currentCompletions incremented by exactly 1 (Pre: ${preQuestCompletions}, Post: ${postQuest?.currentCompletions})`
    );

    // Verify Member Ledgers (Zero duplicate coins or XP awarded)
    for (let i = 0; i < squadMembers.length; i++) {
      const postUser = await User.findById(squadMembers[i]._id);
      const preBalance = preMemberBalances[i];
      const isFinder = successfulClaims[0].memberId === squadMembers[i]._id.toString();

      // Finder gets finder bonus (15% by default SystemConfig)
      const bonusPct = isFinder ? 0.15 : 0;
      // M1 Non-Linear Progression: Operatives level up from Level 1 (0 XP) to Level 2 (300 XP >= 200 XP threshold),
      // earning the authoritative Level 2 milestone bonus (+50 coins).
      const level2MilestoneCoins = 50;
      const expectedCoins = preBalance.coins + Math.round(raidQuest.coinReward * (1 + bonusPct)) + level2MilestoneCoins;

      assert(
        (postUser?.coins || 0) === expectedCoins,
        `Operative ${i + 1} coins credited exactly once (${postUser?.coins} vs expected ${expectedCoins})`
      );
    }

    // ------------------------------------------------------------------
    // CHALLENGE 5: ADVERSARIAL SECURITY & STATE MACHINE VIOLATIONS
    // ------------------------------------------------------------------
    console.log("\n─── Challenge 5: Adversarial Security & State Machine Violations ───");

    const outsiderStudent = await User.create({
      username: `hostile_outsider_${Date.now()}`,
      email: `outsider_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "mock_hash",
      displayName: "Hostile Outsider",
      role: "STUDENT",
      squadId: null,
    });

    // 5.1 Outsider attempts to solve clue on someone else's raid
    {
      fallbackTestUser = outsiderStudent;
      const req = new NextRequest(`http://localhost:3000/api/quests/${raidQuest._id}/solve-clue`, {
        method: "POST",
        body: JSON.stringify({
          stageOrder: 1,
          submittedAnswer: "255",
          investigationId: raidInvestigationId,
        }),
      });
      const res = await solveClue(req, { params: Promise.resolve({ id: raidQuest._id.toString() }) });
      const json = await res.json();

      assert(res.status === 403, "Outsider solving clue rejected with HTTP 403");
      assert(json.error?.code === "FORBIDDEN", "Rejection code is FORBIDDEN");
    }

    // 5.2 Outsider attempts to claim recovery on someone else's raid
    {
      fallbackTestUser = outsiderStudent;
      const req = new NextRequest(`http://localhost:3000/api/investigations/${raidInvestigationId}/recover`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const res = await recoverInvestigation(req, { params: Promise.resolve({ id: raidInvestigationId }) });
      const json = await res.json();

      assert(res.status === 403, "Outsider claiming recovery rejected with HTTP 403");
      assert(json.error?.code === "FORBIDDEN", "Rejection code is FORBIDDEN");
    }

    // 5.3 Stage skipped: submitting Stage 2 when currentStage is 1
    {
      const freshSolo = await Investigation.create({
        questId: raidQuest._id,
        userId: outsiderStudent._id,
        squadId: null,
        isSquadInvestigation: false,
        currentStage: 1,
        progressPct: 0,
        status: "IN_PROGRESS",
      });

      fallbackTestUser = outsiderStudent;
      const req = new NextRequest(`http://localhost:3000/api/quests/${raidQuest._id}/solve-clue`, {
        method: "POST",
        body: JSON.stringify({
          stageOrder: 2,
          submittedAnswer: "1024",
          investigationId: freshSolo._id.toString(),
        }),
      });
      const res = await solveClue(req, { params: Promise.resolve({ id: raidQuest._id.toString() }) });
      const json = await res.json();

      assert(res.status === 400, "Skipping to Stage 2 without solving Stage 1 rejected with HTTP 400");
      assert(json.error?.code === "STAGE_LOCKED", "Rejection code is STAGE_LOCKED");
    }

    // 5.4 Recovery attempted before clues solved
    {
      const incompleteInv = await Investigation.create({
        questId: raidQuest._id,
        userId: outsiderStudent._id,
        squadId: null,
        isSquadInvestigation: false,
        currentStage: 1,
        progressPct: 0,
        status: "IN_PROGRESS",
        solvedClues: [],
      });

      fallbackTestUser = outsiderStudent;
      const req = new NextRequest(`http://localhost:3000/api/investigations/${incompleteInv._id}/recover`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const res = await recoverInvestigation(req, { params: Promise.resolve({ id: incompleteInv._id.toString() }) });
      const json = await res.json();

      assert(res.status === 400, "Recovery before completing clues rejected with HTTP 400");
      assert(json.error?.code === "CLUES_INCOMPLETE", "Rejection code is CLUES_INCOMPLETE");
    }

    // 5.5 Inactive quest start attempt
    {
      const draftQuest = await Quest.create({
        questCode: `Q-DRAFT-${Date.now().toString(36).toUpperCase()}`,
        title: "Unapproved Draft Quest",
        description: "Draft quest.",
        questType: "CAMPUS_TREASURE",
        difficulty: 1,
        targetLocationId: testLocation._id,
        xpReward: 100,
        coinReward: 50,
        status: "DRAFT",
      });

      fallbackTestUser = outsiderStudent;
      const req = new NextRequest(`http://localhost:3000/api/quests/${draftQuest._id}/start`, {
        method: "POST",
        body: JSON.stringify({ asSquad: false }),
      });
      const res = await startQuest(req, { params: Promise.resolve({ id: draftQuest._id.toString() }) });
      const json = await res.json();

      assert(res.status === 400, "Starting DRAFT quest rejected with HTTP 400");
      assert(json.error.includes("not active"), "Rejection message explains quest is not active");
    }

    // 5.6 Wrong answer penalty and cooldown activation
    {
      const activeSolo = await Investigation.create({
        questId: raidQuest._id,
        userId: outsiderStudent._id,
        squadId: null,
        isSquadInvestigation: false,
        currentStage: 1,
        progressPct: 0,
        status: "IN_PROGRESS",
      });

      fallbackTestUser = outsiderStudent;
      // Wrong answer
      const reqWrong = new NextRequest(`http://localhost:3000/api/quests/${raidQuest._id}/solve-clue`, {
        method: "POST",
        body: JSON.stringify({
          stageOrder: 1,
          submittedAnswer: "WRONG_VALUE",
          investigationId: activeSolo._id.toString(),
        }),
      });
      const resWrong = await solveClue(reqWrong, { params: Promise.resolve({ id: raidQuest._id.toString() }) });
      const jsonWrong = await resWrong.json();

      assert(resWrong.status === 400, "Wrong answer rejected with HTTP 400");
      assert(jsonWrong.error?.code === "WRONG_ANSWER", "Rejection code is WRONG_ANSWER");

      // Immediate second attempt during cooldown
      const reqCooldown = new NextRequest(`http://localhost:3000/api/quests/${raidQuest._id}/solve-clue`, {
        method: "POST",
        body: JSON.stringify({
          stageOrder: 1,
          submittedAnswer: "255",
          investigationId: activeSolo._id.toString(),
        }),
      });
      const resCooldown = await solveClue(reqCooldown, { params: Promise.resolve({ id: raidQuest._id.toString() }) });
      const jsonCooldown = await resCooldown.json();

      assert(resCooldown.status === 429, "Submission during active cooldown rejected with HTTP 429");
      assert(jsonCooldown.error?.code === "COOLDOWN_ACTIVE", "Rejection code is COOLDOWN_ACTIVE");
    }

    console.log("\n========================================================");
    console.log(`🎉 EMPIRICAL ADVERSARIAL STRESS SUITE: ${passedCount} PASSED | ${failedCount} FAILED`);
    console.log("========================================================\n");

  } finally {
    console.log(`🧹 Dropping isolated test database: ${RUN_ID}...`);
    try {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
      console.log("✨ Test database dropped cleanly.");
    } catch (err: any) {
      console.warn("⚠️ Warning dropping test database:", err.message);
    }
  }

  if (failedCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("FATAL ERROR in stress suite:", err);
  process.exit(1);
});
