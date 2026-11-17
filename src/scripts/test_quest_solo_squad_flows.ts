/**
 * AIEM Hunt — Quest Solo Recon and Squad Raids Integration Test Suite
 * 
 * Verifies:
 * 1. Strict Decoupling of Solo Recon vs Squad Raid:
 *    - Squad raid completion never blocks individual solo recon.
 *    - User briefing and board queries expose distinct soloInvestigation and squadInvestigation states.
 * 2. Squad Membership Enforcement:
 *    - Unaffiliated users attempting squad raid are strictly rejected with HTTP 400 SQUAD_MEMBERSHIP_REQUIRED.
 *    - Users with invalid squad membership are rejected.
 * 3. Raid Re-Entry & Participant Registration:
 *    - Teammates joining an active squad raid are atomically registered into participatingUserIds.
 * 4. Atomic Concurrency on Clue Solving:
 *    - Concurrent clue solutions use optimistic locking on currentStage, preventing race condition duplicates.
 * 5. Atomic Concurrency on Recovery Claim:
 *    - Concurrent recovery claims transition status atomically, preventing duplicate rewards or double XP payouts.
 */

import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import { NextRequest } from "next/server";
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
import { GET as listQuests } from "../app/api/quests/route";
import { POST as solveClue } from "../app/api/quests/[id]/solve-clue/route";
import { POST as recoverInvestigation } from "../app/api/investigations/[id]/recover/route";

const RUN_ID = `aiem_hunt_test_quests_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
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

async function run() {
  console.log("========================================================");
  console.log("🚀 STARTING QUEST SOLO RECON & SQUAD RAIDS TEST SUITE");
  console.log(`   Database: ${RUN_ID}`);
  console.log("========================================================\n");

  await connectDB();

  try {
    // ------------------------------------------------------------------
    // STEP 0: SEED BASELINE DATA (Locations, SystemConfig, Squad, Users, Quest)
    // ------------------------------------------------------------------
    console.log("─── Step 0: Seed Baseline Configuration, Locations, and Users ───");

    await SystemConfig.findOneAndUpdate(
      { key: "GLOBAL_CONFIG" },
      { $setOnInsert: { key: "GLOBAL_CONFIG", clueCooldownSeconds: [5, 10, 15] } },
      { upsert: true }
    );

    const testLocation = await CampusLocation.create({
      code: `LOC_MAIN_${Date.now()}`,
      name: "Campus Quad & Fountain",
      zoneType: "ACADEMIC_BLOCK",
      building: "Main Quad",
      floors: ["Ground"],
      coordinates: { lat: 15.421, lng: 73.981, mapX: 20, mapY: 25 },
      isSafeDesk: false,
      isActive: true,
    });

    const user1 = await User.create({
      username: `hunter_alpha_${Date.now()}`,
      email: `alpha_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "mock_hash",
      displayName: "Hunter Alpha",
      role: "STUDENT",
      coins: 100,
      xp: 0,
      level: 1,
    });

    const user2 = await User.create({
      username: `hunter_beta_${Date.now()}`,
      email: `beta_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "mock_hash",
      displayName: "Hunter Beta",
      role: "STUDENT",
      coins: 100,
      xp: 0,
      level: 1,
    });

    const unaffiliatedUser = await User.create({
      username: `solo_scout_${Date.now()}`,
      email: `scout_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "mock_hash",
      displayName: "Solo Scout",
      role: "STUDENT",
      coins: 100,
      xp: 0,
      level: 1,
      squadId: null,
    });

    const squad = await Squad.create({
      name: `Shadow Syndicate ${Date.now()}`,
      tag: `SHAD`,
      description: "Elite squad operatives",
      leaderId: user1._id,
      squadXp: 0,
      squadLevel: 1,
      trophies: 0,
    });

    // Update squad members' squadId
    user1.squadId = squad._id as any;
    await user1.save();
    user2.squadId = squad._id as any;
    await user2.save();

    await SquadMember.create({
      squadId: squad._id,
      userId: user1._id,
      role: "LEADER",
    });

    await SquadMember.create({
      squadId: squad._id,
      userId: user2._id,
      role: "MEMBER",
    });

    // Create a 2-stage Campus Treasure Hunt Quest
    const quest = await Quest.create({
      questCode: `Q-TEST-${Date.now().toString(36).toUpperCase()}`,
      title: "The Cryptographic Beacon",
      description: "Decipher the campus broadcast signals and locate the hidden node.",
      questType: "CAMPUS_TREASURE",
      difficulty: 2,
      targetLocationId: testLocation._id,
      xpReward: 150,
      coinReward: 50,
      squadXpReward: 75,
      finderBonusXp: 30,
      status: "ACTIVE",
    });

    const clue1 = await Clue.create({
      questId: quest._id,
      stageOrder: 1,
      title: "Signal Frequency Deduction",
      clueText: "Calculate the base carrier harmonic: What is 21 * 2?",
      verificationType: "NUMERIC_CALCULATION",
      expectedAnswerNormalized: "42",
      acceptableAnswers: ["42"],
      hintText: "Multiply twenty-one by two.",
      unlockedBreadcrumbText: "First beacon frequency unlocked.",
    });

    const clue2 = await Clue.create({
      questId: quest._id,
      stageOrder: 2,
      title: "Parity Check Sum",
      clueText: "Input the two-digit terminal prime code: 90 + 9?",
      verificationType: "NUMERIC_CALCULATION",
      expectedAnswerNormalized: "99",
      acceptableAnswers: ["99"],
      hintText: "Sum ninety and nine.",
      unlockedBreadcrumbText: "Beacon coordinates secured.",
    });

    assert(Boolean(quest._id), "Test quest initialized with 2 clue stages");
    assert(Boolean(squad._id), "Test squad initialized with leader and member");

    // ------------------------------------------------------------------
    // STEP 1: SQUAD MEMBERSHIP ENFORCEMENT
    // ------------------------------------------------------------------
    console.log("\n─── Step 1: Squad Membership Enforcement on Squad Raid Launch ───");

    // 1.1 Unaffiliated user without squadId clicks "Squad Raid"
    {
      (globalThis as any).__TEST_CURRENT_USER__ = unaffiliatedUser;
      const req = new NextRequest(`http://localhost:3000/api/quests/${quest._id}/start`, {
        method: "POST",
        body: JSON.stringify({ asSquad: true }),
      });
      const res = await startQuest(req, { params: Promise.resolve({ id: quest._id.toString() }) });
      const json = await res.json();

      assert(res.status === 400, "Unaffiliated user attempting Squad Raid receives HTTP 400");
      assert(json.code === "SQUAD_MEMBERSHIP_REQUIRED", "Error code is SQUAD_MEMBERSHIP_REQUIRED");
      assert(
        json.error.includes("You must belong to a squad"),
        "Descriptive squad membership error message returned"
      );
    }

    // 1.2 User has squadId on user document but no active SquadMember record
    {
      const orphanSquadUser = await User.create({
        username: `orphan_${Date.now()}`,
        email: `orphan_${Date.now()}@aiemgoa.ac.in`,
        passwordHash: "mock_hash",
        displayName: "Orphan Hunter",
        role: "STUDENT",
        squadId: new Types.ObjectId(), // Dangler squadId without SquadMember record
      });

      (globalThis as any).__TEST_CURRENT_USER__ = orphanSquadUser;
      const req = new NextRequest(`http://localhost:3000/api/quests/${quest._id}/start`, {
        method: "POST",
        body: JSON.stringify({ asSquad: true }),
      });
      const res = await startQuest(req, { params: Promise.resolve({ id: quest._id.toString() }) });
      const json = await res.json();

      assert(res.status === 400, "User without active SquadMember record is rejected with HTTP 400");
      assert(json.code === "SQUAD_MEMBERSHIP_REQUIRED", "Rejection code is SQUAD_MEMBERSHIP_REQUIRED");
    }

    // ------------------------------------------------------------------
    // STEP 2: SQUAD RAID LAUNCH & ATOMIC PARTICIPANT REGISTRATION ON RE-ENTRY
    // ------------------------------------------------------------------
    console.log("\n─── Step 2: Squad Raid Initiation & Joining Member Atomic Registration ───");

    let squadInvestigationId: string = "";

    // 2.1 User 1 (Squad Leader) launches Squad Raid
    {
      (globalThis as any).__TEST_CURRENT_USER__ = user1;
      const req = new NextRequest(`http://localhost:3000/api/quests/${quest._id}/start`, {
        method: "POST",
        body: JSON.stringify({ asSquad: true }),
      });
      const res = await startQuest(req, { params: Promise.resolve({ id: quest._id.toString() }) });
      const json = await res.json();

      assert(res.status === 201, "Squad Leader successfully launches Squad Raid (HTTP 201)");
      assert(Boolean(json.data?.investigationId), "Investigation room ID returned");
      squadInvestigationId = json.data.investigationId;

      const invInDb = await Investigation.findById(squadInvestigationId);
      assert(Boolean(invInDb?.isSquadInvestigation), "Investigation flagged as isSquadInvestigation=true");
      assert(invInDb?.userId === null, "userId is null for squad raid investigations");
      assert(invInDb?.squadId?.toString() === squad._id.toString(), "squadId matches syndicate ID");
      assert(invInDb?.participatingUserIds?.some((id) => id.toString() === user1._id.toString()) === true, "User 1 registered in participatingUserIds");
    }

    // 2.2 User 2 (Squad Mate) joins the active Squad Raid
    {
      (globalThis as any).__TEST_CURRENT_USER__ = user2;
      const req = new NextRequest(`http://localhost:3000/api/quests/${quest._id}/start`, {
        method: "POST",
        body: JSON.stringify({ asSquad: true }),
      });
      const res = await startQuest(req, { params: Promise.resolve({ id: quest._id.toString() }) });
      const json = await res.json();

      assert(res.status === 200, "Squad Mate joining active raid receives HTTP 200");
      assert(json.data?.investigationId === squadInvestigationId, "Returns existing squad raid investigationId");

      // Verify User 2 was atomically added to participatingUserIds on entry
      const invInDb = await Investigation.findById(squadInvestigationId);
      const participants = invInDb?.participatingUserIds.map((id) => id.toString()) || [];
      assert(participants.includes(user2._id.toString()), "User 2 atomically registered in participatingUserIds on room entry");
      assert(participants.length === 2, "Both squad mates present in participatingUserIds");
    }

    // ------------------------------------------------------------------
    // STEP 3: ATOMIC CONCURRENCY ON CLUE SOLVING
    // ------------------------------------------------------------------
    console.log("\n─── Step 3: Concurrency Hardening in Clue Solving ───");

    // Both User 1 and User 2 concurrently submit the Stage 1 answer
    {
      (globalThis as any).__TEST_CURRENT_USER__ = user1;
      const req1 = new NextRequest(`http://localhost:3000/api/quests/${quest._id}/solve-clue`, {
        method: "POST",
        body: JSON.stringify({
          stageOrder: 1,
          submittedAnswer: "42",
          investigationId: squadInvestigationId,
        }),
      });

      (globalThis as any).__TEST_CURRENT_USER__ = user2;
      const req2 = new NextRequest(`http://localhost:3000/api/quests/${quest._id}/solve-clue`, {
        method: "POST",
        body: JSON.stringify({
          stageOrder: 1,
          submittedAnswer: "42",
          investigationId: squadInvestigationId,
        }),
      });

      // Execute concurrently
      const [res1, res2] = await Promise.all([
        (async () => {
          (globalThis as any).__TEST_CURRENT_USER__ = user1;
          return solveClue(req1, { params: Promise.resolve({ id: quest._id.toString() }) });
        })(),
        (async () => {
          (globalThis as any).__TEST_CURRENT_USER__ = user2;
          return solveClue(req2, { params: Promise.resolve({ id: quest._id.toString() }) });
        })(),
      ]);

      const [json1, json2] = await Promise.all([res1.json(), res2.json()]);

      // Both requests should return success=true, but exactly one advanced the stage and the other handled alreadySolved
      assert(json1.success === true, "Request 1 returns success=true");
      assert(json2.success === true, "Request 2 returns success=true");

      const oneIsAlreadySolved = json1.data?.alreadySolved === true || json2.data?.alreadySolved === true;
      assert(oneIsAlreadySolved, "Optimistic lock detected concurrent solve and gracefully handled alreadySolved");

      const invInDb = await Investigation.findById(squadInvestigationId);
      assert(invInDb?.currentStage === 2, "Investigation stage advanced exactly once to Stage 2");
      assert(invInDb?.solvedClues.filter((sc) => sc.stageOrder === 1).length === 1, "Exactly one solvedClues entry recorded for Stage 1 (no duplicate push)");
    }

    // Solve Stage 2 to bring squad raid into READY_FOR_RECOVERY
    {
      (globalThis as any).__TEST_CURRENT_USER__ = user2;
      const req = new NextRequest(`http://localhost:3000/api/quests/${quest._id}/solve-clue`, {
        method: "POST",
        body: JSON.stringify({
          stageOrder: 2,
          submittedAnswer: "99",
          investigationId: squadInvestigationId,
        }),
      });
      const res = await solveClue(req, { params: Promise.resolve({ id: quest._id.toString() }) });
      const json = await res.json();

      assert(res.status === 200, "Stage 2 clue solved successfully");
      assert(json.data?.status === "READY_FOR_RECOVERY", "Investigation status transitioned to READY_FOR_RECOVERY");
    }

    // ------------------------------------------------------------------
    // STEP 4: ATOMIC CONCURRENCY ON RECOVERY CLAIM (NO DOUBLE PAYOUTS)
    // ------------------------------------------------------------------
    console.log("\n─── Step 4: Concurrency Hardening on Recovery Claim & Rewards ───");

    {
      const initialSquad = await Squad.findById(squad._id);
      const initialSquadXp = initialSquad?.squadXp || 0;
      const initialTrophies = initialSquad?.trophies || 0;

      const req1 = new NextRequest(`http://localhost:3000/api/investigations/${squadInvestigationId}/recover`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const req2 = new NextRequest(`http://localhost:3000/api/investigations/${squadInvestigationId}/recover`, {
        method: "POST",
        body: JSON.stringify({}),
      });

      // Execute concurrent recovery claims
      const [res1, res2] = await Promise.all([
        (async () => {
          (globalThis as any).__TEST_CURRENT_USER__ = user1;
          return recoverInvestigation(req1, { params: Promise.resolve({ id: squadInvestigationId }) });
        })(),
        (async () => {
          (globalThis as any).__TEST_CURRENT_USER__ = user2;
          return recoverInvestigation(req2, { params: Promise.resolve({ id: squadInvestigationId }) });
        })(),
      ]);

      const [json1, json2] = await Promise.all([res1.json(), res2.json()]);

      const successCount = (json1.success ? 1 : 0) + (json2.success ? 1 : 0);
      assert(successCount === 1, "Exactly one concurrent recovery claim succeeded (atomic lock)");

      const failedJson = json1.success ? json2 : json1;
      assert(failedJson.error?.code === "ALREADY_COMPLETED", "Concurrent second claim rejected with ALREADY_COMPLETED");

      // Verify database state: trophies and squad XP credited exactly once
      const refreshedSquad = await Squad.findById(squad._id);
      const expectedSquadXp = initialSquadXp + quest.squadXpReward;
      assert(refreshedSquad?.squadXp === expectedSquadXp, `Squad XP credited exactly once (${expectedSquadXp}) without double payout`);

      const expectedTrophies = initialTrophies + (quest.trophyReward || 25);
      assert(refreshedSquad?.trophies === expectedTrophies, `Trophies credited exactly once (${expectedTrophies}) without double payout`);
    }

    // ------------------------------------------------------------------
    // STEP 5: SOLO RECON INDEPENDENCE & DECOUPLING
    // ------------------------------------------------------------------
    console.log("\n─── Step 5: Solo Recon Independence (Decoupled from Squad Raid) ───");

    // 5.1 Quest Board query exposes distinct states
    {
      (globalThis as any).__TEST_CURRENT_USER__ = user1;
      const req = new NextRequest("http://localhost:3000/api/quests");
      const res = await listQuests(req);
      const json = await res.json();

      const questItem = json.data?.find((q: any) => q._id.toString() === quest._id.toString());
      assert(Boolean(questItem), "Quest listed on Quest Board");
      assert(questItem.isCompletedByUser === false, "isCompletedByUser is FALSE because User 1 has not completed Solo Recon");
      assert(questItem.isCompletedBySquad === true, "isCompletedBySquad is TRUE reflecting squad raid completion");
      assert(questItem.userInvestigationStatus === "NOT_STARTED", "userInvestigationStatus allows Solo Recon start");
    }

    // 5.2 Quest Briefing query exposes both soloInvestigation and squadInvestigation
    {
      (globalThis as any).__TEST_CURRENT_USER__ = user1;
      const req = new NextRequest(`http://localhost:3000/api/quests/${quest._id}`);
      const res = await getQuest(req, { params: Promise.resolve({ id: quest._id.toString() }) });
      const json = await res.json();

      assert(res.status === 200, "Quest briefing fetched successfully");
      assert(json.data?.quest?.isCompletedByUser === false, "Briefing reports isCompletedByUser=false");
      assert(json.data?.investigation === null, "Briefing investigation is null (allowing Solo Recon start)");
      assert(json.data?.squadInvestigation?.status === "COMPLETED", "Distinct squadInvestigation exposed with status=COMPLETED");
      assert(json.data?.soloInvestigation === null, "Distinct soloInvestigation exposed with status=null");
    }

    // 5.3 User 1 starts Solo Recon on the same quest previously completed by squad
    let soloInvestigationId: string = "";
    {
      (globalThis as any).__TEST_CURRENT_USER__ = user1;
      const req = new NextRequest(`http://localhost:3000/api/quests/${quest._id}/start`, {
        method: "POST",
        body: JSON.stringify({ asSquad: false }), // Solo Recon
      });
      const res = await startQuest(req, { params: Promise.resolve({ id: quest._id.toString() }) });
      const json = await res.json();

      assert(res.status === 201, "User 1 successfully initiates Solo Recon (HTTP 201) despite squad completion!");
      assert(Boolean(json.data?.investigationId), "Solo Recon investigation room ID returned");
      soloInvestigationId = json.data.investigationId;
      assert(soloInvestigationId !== squadInvestigationId, "Solo Recon is a completely distinct investigation from squad raid");

      const soloInvInDb = await Investigation.findById(soloInvestigationId);
      assert(soloInvInDb?.isSquadInvestigation === false, "isSquadInvestigation is false for solo recon");
      assert(soloInvInDb?.userId?.toString() === user1._id.toString(), "userId points to User 1");
      assert(soloInvInDb?.squadId === null, "squadId is null for solo recon");
    }

    // 5.4 User 1 completes Solo Recon
    {
      // Solve Stage 1
      (globalThis as any).__TEST_CURRENT_USER__ = user1;
      const reqStage1 = new NextRequest(`http://localhost:3000/api/quests/${quest._id}/solve-clue`, {
        method: "POST",
        body: JSON.stringify({
          stageOrder: 1,
          submittedAnswer: "42",
          investigationId: soloInvestigationId,
        }),
      });
      const resStage1 = await solveClue(reqStage1, { params: Promise.resolve({ id: quest._id.toString() }) });
      assert(resStage1.status === 200, "Solo Recon Stage 1 solved");

      // Solve Stage 2
      const reqStage2 = new NextRequest(`http://localhost:3000/api/quests/${quest._id}/solve-clue`, {
        method: "POST",
        body: JSON.stringify({
          stageOrder: 2,
          submittedAnswer: "99",
          investigationId: soloInvestigationId,
        }),
      });
      const resStage2 = await solveClue(reqStage2, { params: Promise.resolve({ id: quest._id.toString() }) });
      assert(resStage2.status === 200, "Solo Recon Stage 2 solved");

      // Claim recovery
      const reqRecover = new NextRequest(`http://localhost:3000/api/investigations/${soloInvestigationId}/recover`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const resRecover = await recoverInvestigation(reqRecover, { params: Promise.resolve({ id: soloInvestigationId }) });
      const jsonRecover = await resRecover.json();
      assert(resRecover.status === 200, "Solo Recon recovery processed successfully");
      assert(jsonRecover.data?.status === "COMPLETED", "Solo Recon completed and rewards credited");
    }

    // 5.5 Multiple solo submissions blocked once User 1 personally completed Solo Recon
    {
      (globalThis as any).__TEST_CURRENT_USER__ = user1;
      const req = new NextRequest(`http://localhost:3000/api/quests/${quest._id}/start`, {
        method: "POST",
        body: JSON.stringify({ asSquad: false }),
      });
      const res = await startQuest(req, { params: Promise.resolve({ id: quest._id.toString() }) });
      const json = await res.json();

      assert(res.status === 400, "Repeated Solo Recon attempt is blocked after personal completion (HTTP 400)");
      assert(json.code === "ALREADY_COMPLETED", "Rejection code is ALREADY_COMPLETED");
    }

    console.log("\n========================================================");
    console.log(`🎉 ALL QUEST FLOW INTEGRATION TESTS PASSED: ${passedCount} passed | ${failedCount} failed`);
    console.log("========================================================\n");
  } finally {
    console.log(`🧹 Dropping ephemeral test database: ${RUN_ID}...`);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log("✨ Ephemeral database dropped and disconnected cleanly.\n");
  }
}

run().catch((err) => {
  console.error("❌ Test suite encountered an unhandled error:", err);
  process.exit(1);
});
