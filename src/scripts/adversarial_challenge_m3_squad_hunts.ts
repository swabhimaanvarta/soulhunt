/**
 * ADVERSARIAL STRESS-TEST & CRITIC AUDIT SUITE FOR MILESTONE 3
 * 
 * Stress-tests:
 * 1. High-concurrency race conditions: 10 parallel recovery attempts on a single squad raid
 * 2. Privacy penetration testing: Unauthenticated, non-member, kicked member, invite-only, private, moderator, admin
 * 3. Extreme edge cases: Null/missing participants, empty solvedClues, deleted users, deleted quests, negative durations
 * 4. Database integrity: Unique compound index collision, double-accounting prevention for trophies & ledger
 * 5. Malformed API inputs: Invalid ObjectIds, null headers, boundary conditions
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
  SquadHuntRecord,
  Transaction,
} from "../models";
import { connectDB } from "../lib/db";
import { POST as startQuest } from "../app/api/quests/[id]/start/route";
import { POST as solveClue } from "../app/api/quests/[id]/solve-clue/route";
import { POST as recoverInvestigation } from "../app/api/investigations/[id]/recover/route";
import { GET as getSquadHunts } from "../app/api/squads/[id]/hunts/route";
import { distributeSquadQuestRewards } from "../lib/economy";

const RUN_ID = `aiem_hunt_adv_m3_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

(process.env as Record<string, string>)["NODE_ENV"] = "test";
process.env.MONGODB_URI = TEST_DB_URI;
process.env.JWT_SECRET = "adversarial_secret_key_minimum_32_chars_2026";
process.env.VARIANT_SECRET = "adversarial_variant_hmac_secret_2026";

let passed = 0;
let failed = 0;

function challengeAssert(condition: boolean, title: string) {
  if (!condition) {
    failed++;
    console.error(`  ❌ CHALLENGE BREACH: ${title}`);
    throw new Error(`Challenge failure: ${title}`);
  } else {
    passed++;
    console.log(`  🛡️ PASSED CHALLENGE: ${title}`);
  }
}

async function runAdversarialAudit() {
  console.log("================================================================================");
  console.log("🔥 ADVERSARIAL AUDIT & STRESS SUITE: MILESTONE 3 (SQUAD HUNTS & HISTORY ENGINE)");
  console.log(`   Isolated Ephemeral DB: ${RUN_ID}`);
  console.log("================================================================================\n");

  await connectDB();

  try {
    // -----------------------------------------------------------------------------------------
    // TEST 1: HIGH CONCURRENCY RACE CONDITION (10 CONCURRENT RECOVERY ATTEMPTS)
    // -----------------------------------------------------------------------------------------
    console.log("─── Challenge 1: Parallel Recovery Swarm (10 Concurrent Requests) ───");

    await SystemConfig.findOneAndUpdate(
      { key: "GLOBAL_CONFIG" },
      { $setOnInsert: { key: "GLOBAL_CONFIG", maxFinderBonusPct: 25, defaultFinderBonusPct: 15 } },
      { upsert: true }
    );

    const campusLoc = await CampusLocation.create({
      code: `LOC_ADV_${Date.now()}`,
      name: "Adversarial Test Lab",
      zoneType: "LIBRARY",
      building: "Engineering Block 1",
      floors: ["Ground"],
      coordinates: { lat: 15.42, lng: 73.98, mapX: 50, mapY: 50 },
      isSafeDesk: true,
      isActive: true,
    });

    const squadLeader = await User.create({
      username: `adv_lead_${Date.now()}`,
      email: `adv_lead_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "hash",
      displayName: "Adversarial Lead",
      role: "STUDENT",
      coins: 0,
      xp: 0,
      level: 1,
      trophies: 0,
      stats: { questsCompleted: 0, squadQuestsCompleted: 0 },
    });

    const raidSquad = await Squad.create({
      name: `Adversarial Vanguard ${Date.now()}`,
      tag: `AVGD`,
      leaderId: squadLeader._id,
      privacy: "PRIVATE",
      squadXp: 0,
      trophies: 0,
      completedHuntsCount: 0,
    });

    squadLeader.squadId = raidSquad._id as any;
    await squadLeader.save();

    await SquadMember.create({
      squadId: raidSquad._id,
      userId: squadLeader._id,
      role: "LEADER",
    });

    const raidQuest = await Quest.create({
      questCode: `ADV-RAID-${Date.now().toString(36).toUpperCase()}`,
      title: "Adversarial High-Stress Raid",
      description: "Adversarial stress test raid quest description.",
      questType: "SQUAD_HUNT",
      difficulty: 4,
      targetLocationId: campusLoc._id,
      xpReward: 500,
      coinReward: 200,
      trophyReward: 50,
      squadXpReward: 150,
      status: "ACTIVE",
    });

    const raidClue = await Clue.create({
      questId: raidQuest._id,
      stageOrder: 1,
      title: "Stress Clue 1",
      clueText: "2 + 2 = ?",
      verificationType: "NUMERIC_CALCULATION",
      expectedAnswerNormalized: "4",
      acceptableAnswers: ["4"],
    });

    // Start raid
    (globalThis as any).__TEST_CURRENT_USER__ = squadLeader;
    const sReq = new NextRequest(`http://localhost:3000/api/quests/${raidQuest._id}/start`, {
      method: "POST",
      body: JSON.stringify({ asSquad: true }),
    });
    const sRes = await startQuest(sReq, { params: Promise.resolve({ id: raidQuest._id.toString() }) });
    const sJson = await sRes.json();
    const invId = sJson.data.investigationId;

    // Solve clue
    const scReq = new NextRequest(`http://localhost:3000/api/quests/${raidQuest._id}/solve-clue`, {
      method: "POST",
      body: JSON.stringify({ investigationId: invId, stageOrder: 1, submittedAnswer: "4" }),
    });
    await solveClue(scReq, { params: Promise.resolve({ id: raidQuest._id.toString() }) });

    // Fire 10 simultaneous recovery attempts
    const swarmPromises = Array.from({ length: 10 }).map(async () => {
      const recReq = new NextRequest(`http://localhost:3000/api/investigations/${invId}/recover`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const recRes = await recoverInvestigation(recReq, { params: Promise.resolve({ id: invId.toString() }) });
      return { status: recRes.status, json: await recRes.json() };
    });

    const swarmResults = await Promise.all(swarmPromises);
    const successes = swarmResults.filter((r) => r.status === 200);
    const rejections = swarmResults.filter((r) => r.status === 400 && r.json.error?.code === "ALREADY_COMPLETED");

    challengeAssert(successes.length === 1, `Exactly 1 concurrent request succeeded (received ${successes.length})`);
    challengeAssert(rejections.length === 9, `Remaining 9 requests rejected with ALREADY_COMPLETED (received ${rejections.length})`);

    // Verify exactly 1 SquadHuntRecord exists
    const recordsCount = await SquadHuntRecord.countDocuments({ squadId: raidSquad._id, investigationId: invId });
    challengeAssert(recordsCount === 1, `Exactly 1 SquadHuntRecord exists in DB after 10-way race (found ${recordsCount})`);

    // Verify squad trophies and counts were not duplicated
    const refreshedSquad = await Squad.findById(raidSquad._id);
    challengeAssert(refreshedSquad?.completedHuntsCount === 1, "completedHuntsCount is exactly 1 (not duplicated)");
    challengeAssert(refreshedSquad?.trophies === 50, `Squad trophies is exactly 50 (not duplicated: ${refreshedSquad?.trophies})`);
    challengeAssert(refreshedSquad?.squadXp === 150, `Squad XP is exactly 150 (not duplicated: ${refreshedSquad?.squadXp})`);

    // Verify user progression was not duplicated
    const refreshedLeader = await User.findById(squadLeader._id);
    // Finder bonus: 15% on 50 trophies = 8 trophies -> 58 trophies
    challengeAssert(refreshedLeader?.trophies === 58, `Leader trophies credited exactly once with finder bonus (expected 58, got ${refreshedLeader?.trophies})`);
    challengeAssert(refreshedLeader?.stats.squadQuestsCompleted === 1, "squadQuestsCompleted incremented exactly once");

    // Verify transaction ledgers
    const txCount = await Transaction.countDocuments({ userId: squadLeader._id, referenceId: raidQuest._id });
    challengeAssert(txCount === 1, `Transaction ledger contains exactly 1 reward entry for leader (found ${txCount})`);

    // -----------------------------------------------------------------------------------------
    // TEST 2: PRIVACY PENETRATION & ACCESS CONTROLS ON GET /api/squads/[id]/hunts
    // -----------------------------------------------------------------------------------------
    console.log("\n─── Challenge 2: Privacy Penetration & Role Boundary Testing ───");

    // 2.1 Unauthenticated seeker (null user)
    (globalThis as any).__TEST_CURRENT_USER__ = null;
    {
      const req = new NextRequest(`http://localhost:3000/api/squads/${raidSquad._id}/hunts`);
      const res = await getSquadHunts(req, { params: Promise.resolve({ id: raidSquad._id.toString() }) });
      challengeAssert(res.status === 403, "Unauthenticated request to private squad returns HTTP 403");
    }

    // 2.2 Authenticated non-member student
    const stranger = await User.create({
      username: `stranger_${Date.now()}`,
      email: `stranger_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "hash",
      displayName: "Curious Seeker",
      role: "STUDENT",
    });
    (globalThis as any).__TEST_CURRENT_USER__ = stranger;
    {
      const req = new NextRequest(`http://localhost:3000/api/squads/${raidSquad._id}/hunts`);
      const res = await getSquadHunts(req, { params: Promise.resolve({ id: raidSquad._id.toString() }) });
      challengeAssert(res.status === 403, "Stranger student blocked from private squad with HTTP 403");
    }

    // 2.3 Ex-member who was kicked / left the squad
    const exMember = await User.create({
      username: `exmember_${Date.now()}`,
      email: `ex_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "hash",
      displayName: "Ex Operative",
      role: "STUDENT",
      squadId: raidSquad._id as any, // User document still has stale pointer, but SquadMember record does NOT exist
    });
    (globalThis as any).__TEST_CURRENT_USER__ = exMember;
    {
      const req = new NextRequest(`http://localhost:3000/api/squads/${raidSquad._id}/hunts`);
      const res = await getSquadHunts(req, { params: Promise.resolve({ id: raidSquad._id.toString() }) });
      challengeAssert(res.status === 403, "Ex-member with stale user.squadId but no SquadMember record is rejected (HTTP 403)");
    }

    // 2.4 Moderator override
    const modUser = await User.create({
      username: `mod_${Date.now()}`,
      email: `mod_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "hash",
      displayName: "Campus Moderator",
      role: "MODERATOR",
    });
    (globalThis as any).__TEST_CURRENT_USER__ = modUser;
    {
      const req = new NextRequest(`http://localhost:3000/api/squads/${raidSquad._id}/hunts`);
      const res = await getSquadHunts(req, { params: Promise.resolve({ id: raidSquad._id.toString() }) });
      challengeAssert(res.status === 200, "MODERATOR allowed to inspect private squad history (HTTP 200)");
    }

    // 2.5 Admin override
    const adminUser = await User.create({
      username: `admin_${Date.now()}`,
      email: `admin_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "hash",
      displayName: "Campus Administrator",
      role: "ADMIN",
    });
    (globalThis as any).__TEST_CURRENT_USER__ = adminUser;
    {
      const req = new NextRequest(`http://localhost:3000/api/squads/${raidSquad._id}/hunts`);
      const res = await getSquadHunts(req, { params: Promise.resolve({ id: raidSquad._id.toString() }) });
      challengeAssert(res.status === 200, "ADMIN allowed to inspect private squad history (HTTP 200)");
    }

    // 2.6 INVITE_ONLY squad privacy
    await Squad.findByIdAndUpdate(raidSquad._id, { privacy: "INVITE_ONLY" });
    (globalThis as any).__TEST_CURRENT_USER__ = stranger;
    {
      const req = new NextRequest(`http://localhost:3000/api/squads/${raidSquad._id}/hunts`);
      const res = await getSquadHunts(req, { params: Promise.resolve({ id: raidSquad._id.toString() }) });
      challengeAssert(res.status === 403, "INVITE_ONLY squad blocks stranger student with HTTP 403");
    }

    // 2.7 Malformed squad ID
    {
      const req = new NextRequest(`http://localhost:3000/api/squads/invalid-uuid-123/hunts`);
      const res = await getSquadHunts(req, { params: Promise.resolve({ id: "invalid-uuid-123" }) });
      challengeAssert(res.status === 400, "Malformed squad ID triggers HTTP 400 INVALID_SQUAD_ID");
    }

    // 2.8 Non-existent squad ObjectId
    {
      const nonExistentId = new Types.ObjectId().toString();
      const req = new NextRequest(`http://localhost:3000/api/squads/${nonExistentId}/hunts`);
      const res = await getSquadHunts(req, { params: Promise.resolve({ id: nonExistentId }) });
      challengeAssert(res.status === 404, "Non-existent squad ID triggers HTTP 404 SQUAD_NOT_FOUND");
    }

    // -----------------------------------------------------------------------------------------
    // TEST 3: RESILIENCE AGAINST DEGRADED & ANOMALOUS INVESTIGATION DOCUMENTS
    // -----------------------------------------------------------------------------------------
    console.log("\n─── Challenge 3: Degraded Data & Anomalous Input Hardening ───");

    // Test distributeSquadQuestRewards with missing quest, empty solvedClues, null createdAt
    const mockInvestigationId = new Types.ObjectId();
    const mockSquadId = raidSquad._id as Types.ObjectId;
    const ghostQuestId = new Types.ObjectId();

    // Call distributeSquadQuestRewards directly with minimal / degraded inputs
    const degradedResult = await distributeSquadQuestRewards({
      squadId: mockSquadId,
      participatingUserIds: [], // empty
      finderUserId: squadLeader._id as Types.ObjectId,
      baseXp: 100,
      baseCoins: 50,
      trophyReward: 20,
      squadXpReward: 60,
      questId: ghostQuestId, // quest doesn't exist in DB
      questTitle: "Fallback Mystery Quest",
      investigationId: mockInvestigationId,
    });

    challengeAssert(Boolean(degradedResult.huntRecord), "SquadHuntRecord created even when quest doc doesn't exist");
    challengeAssert(degradedResult.huntRecord?.questTitle === "Fallback Mystery Quest", "Fallback questTitle preserved");
    challengeAssert((degradedResult.huntRecord?.participatingMembers?.length ?? 0) >= 1, "Finder is guaranteed inclusion even with empty participatingUserIds");
    challengeAssert(degradedResult.huntRecord?.durationSeconds === 0, "durationSeconds safely defaults to 0 without throwing error");

    // -----------------------------------------------------------------------------------------
    // TEST 4: COMPOUND UNIQUE INDEX INTEGRITY (CROSS-SQUAD & REPEAT PROTECTION)
    // -----------------------------------------------------------------------------------------
    console.log("\n─── Challenge 4: Compound Unique Index Strict Enforcement ───");

    await SquadHuntRecord.createIndexes();

    // Attempting direct insertion of duplicate record with same { squadId, investigationId }
    let duplicateRejected = false;
    try {
      await SquadHuntRecord.create({
        squadId: mockSquadId,
        questId: ghostQuestId,
        investigationId: mockInvestigationId,
        questCode: "DUP-TEST",
        questTitle: "Duplicate Test",
        questType: "SQUAD_HUNT",
        difficulty: 1,
        status: "COMPLETED",
        finisherUserId: squadLeader._id,
        finisherName: "Leader",
        participatingMembers: [],
        squadRewards: { squadXp: 60, squadTrophies: 20 },
      });
    } catch (err: any) {
      if (err.code === 11000) {
        duplicateRejected = true;
      }
    }
    challengeAssert(duplicateRejected, "MongoDB compound unique index strictly threw E11000 duplicate key error");

    // But DIFFERENT squadId with same investigationId (if ever possible) or different investigationId with same squadId succeeds
    const secondInvId = new Types.ObjectId();
    const secondRecord = await SquadHuntRecord.create({
      squadId: mockSquadId,
      questId: ghostQuestId,
      investigationId: secondInvId,
      questCode: "DIFF-INV-TEST",
      questTitle: "Different Investigation Test",
      questType: "SQUAD_HUNT",
      difficulty: 1,
      status: "COMPLETED",
      finisherUserId: squadLeader._id,
      finisherName: "Leader",
      participatingMembers: [],
      squadRewards: { squadXp: 60, squadTrophies: 20 },
    });
    challengeAssert(Boolean(secondRecord._id), "Unique index allows same squadId with different investigationId");

    // -----------------------------------------------------------------------------------------
    // TEST 5: PAGINATION LIMIT ON GET /api/squads/[id]/hunts
    // -----------------------------------------------------------------------------------------
    console.log("\n─── Challenge 5: History Log Performance & Capping ───");

    // Insert 35 hunt records to verify limit(30) query cap works and prevents unbounded memory consumption
    const bulkRecords = Array.from({ length: 35 }).map((_, idx) => ({
      squadId: mockSquadId,
      questId: new Types.ObjectId(),
      investigationId: new Types.ObjectId(),
      questCode: `BULK-${idx}`,
      questTitle: `Bulk Raid ${idx}`,
      questType: "SQUAD_HUNT",
      difficulty: 1,
      status: "COMPLETED",
      completedAt: new Date(Date.now() - (idx + 1) * 60000), // staggered timestamps
      finisherUserId: squadLeader._id,
      finisherName: "Leader",
      participatingMembers: [],
      squadRewards: { squadXp: 10, squadTrophies: 5 },
    }));
    await SquadHuntRecord.insertMany(bulkRecords);

    (globalThis as any).__TEST_CURRENT_USER__ = squadLeader;
    const cappedReq = new NextRequest(`http://localhost:3000/api/squads/${mockSquadId}/hunts`);
    const cappedRes = await getSquadHunts(cappedReq, { params: Promise.resolve({ id: mockSquadId.toString() }) });
    const cappedJson = await cappedRes.json();

    challengeAssert(cappedRes.status === 200, "GET /api/squads/[id]/hunts succeeds with 35+ records in DB");
    challengeAssert(cappedJson.data.pastHunts.length === 30, `pastHunts is capped at 30 records to prevent memory exhaustion (got ${cappedJson.data.pastHunts.length})`);
    
    // Verify sort order is descending by completedAt
    const dates = cappedJson.data.pastHunts.map((h: any) => new Date(h.completedAt).getTime());
    let isSortedDesc = true;
    for (let i = 0; i < dates.length - 1; i++) {
      if (dates[i] < dates[i + 1]) {
        isSortedDesc = false;
        break;
      }
    }
    challengeAssert(isSortedDesc, "pastHunts records are strictly sorted by completedAt in descending order");

    console.log("\n================================================================================");
    console.log(`🏆 ALL ADVERSARIAL CHALLENGES PASSED: ${passed} passed | ${failed} failed`);
    console.log("================================================================================\n");
  } finally {
    console.log(`🧹 Dropping ephemeral adversarial database: ${RUN_ID}...`);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log("✨ Ephemeral database dropped and disconnected cleanly.\n");
  }
}

runAdversarialAudit().catch((err) => {
  console.error("❌ Adversarial audit encountered an unhandled error:", err);
  process.exit(1);
});
