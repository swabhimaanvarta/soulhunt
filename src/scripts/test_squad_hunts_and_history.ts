/**
 * AIEM Hunt — Squad Hunts, Raid Coordination & Hunt History Integration Test Suite
 * 
 * Verifies Milestone 3 Deliverables:
 * 1. ISquadHuntParticipant & ISquadHuntRecord Mongoose Models:
 *    - Compound unique index `{ squadId: 1, investigationId: 1 }`
 *    - Indexed completedAt, finisher snapshot, participated members array
 * 2. Squad Raid Recovery & Real-Time History Engine:
 *    - Accurate attribution of contributed clues, finder bonus, trophies, and XP
 *    - Squad XP, squad trophies, completed hunts count, and user stats increments
 * 3. Dedicated Squad Hunts API (`GET /api/squads/[id]/hunts`):
 *    - Live active raids query with populated quest & operatives
 *    - Persistent history logs query sorted by completedAt descending
 *    - Privacy boundary enforcement for private syndicates
 * 4. Idempotent Recovery Protection:
 *    - Repeated recovery attempts are blocked with HTTP 400 ALREADY_COMPLETED
 *    - Compound unique index guarantees zero duplicate history log records
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

const RUN_ID = `aiem_hunt_test_squad_hunts_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
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
  console.log("⚔️  STARTING SQUAD HUNTS & HUNT HISTORY QA TEST SUITE");
  console.log(`   Isolated Database: ${RUN_ID}`);
  console.log("========================================================\n");

  await connectDB();

  try {
    // ------------------------------------------------------------------
    // STEP 0: SEED BASELINE CONFIGURATION, LOCATIONS, SQUAD & USERS
    // ------------------------------------------------------------------
    console.log("─── Step 0: Seed Baseline Config, Locations, Squad & Operatives ───");

    await SystemConfig.findOneAndUpdate(
      { key: "GLOBAL_CONFIG" },
      {
        $setOnInsert: {
          key: "GLOBAL_CONFIG",
          maxFinderBonusPct: 25,
          defaultFinderBonusPct: 15,
          clueCooldownSeconds: [5, 10, 15],
        },
      },
      { upsert: true }
    );

    const campusLoc = await CampusLocation.create({
      code: `LOC_CENTRAL_${Date.now()}`,
      name: "Central Knowledge Repository & Library",
      zoneType: "LIBRARY",
      building: "Academic Core A",
      floors: ["Level 2"],
      coordinates: { lat: 15.4215, lng: 73.9815, mapX: 45, mapY: 60 },
      isSafeDesk: true,
      isActive: true,
    });

    // 1. Leader (Hunter Alpha)
    const leader = await User.create({
      username: `leader_alpha_${Date.now()}`,
      email: `alpha_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "mock_hash",
      displayName: "Agent Alpha (Leader)",
      role: "STUDENT",
      coins: 200,
      xp: 500,
      level: 3,
      trophies: 50,
      weeklyScore: 50,
      stats: { questsCompleted: 2, squadQuestsCompleted: 1, cluesSolved: 5 },
    });

    // 2. Co-Leader (Hunter Bravo)
    const coleader = await User.create({
      username: `coleader_bravo_${Date.now()}`,
      email: `bravo_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "mock_hash",
      displayName: "Agent Bravo (Co-Leader)",
      role: "STUDENT",
      coins: 150,
      xp: 300,
      level: 2,
      trophies: 30,
      weeklyScore: 30,
      stats: { questsCompleted: 1, squadQuestsCompleted: 1, cluesSolved: 2 },
    });

    // 3. Member (Hunter Charlie)
    const member = await User.create({
      username: `member_charlie_${Date.now()}`,
      email: `charlie_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "mock_hash",
      displayName: "Agent Charlie (Member)",
      role: "STUDENT",
      coins: 100,
      xp: 100,
      level: 1,
      trophies: 10,
      weeklyScore: 10,
      stats: { questsCompleted: 0, squadQuestsCompleted: 0, cluesSolved: 0 },
    });

    // 4. Unaffiliated outsider
    const outsider = await User.create({
      username: `outsider_scout_${Date.now()}`,
      email: `outsider_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "mock_hash",
      displayName: "Outsider Scout",
      role: "STUDENT",
      coins: 50,
      xp: 0,
      level: 1,
      trophies: 0,
      squadId: null,
    });

    // 5. Staff Admin
    const staffAdmin = await User.create({
      username: `admin_overseer_${Date.now()}`,
      email: `admin_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "mock_hash",
      displayName: "System Overseer",
      role: "ADMIN",
      coins: 999,
      xp: 9999,
      level: 20,
    });

    // Seed Squad
    const squad = await Squad.create({
      name: `Apex Syndicate ${Date.now()}`,
      tag: `APEX`,
      description: "Tactical squad hunt specialists",
      privacy: "PRIVATE",
      joinType: "INVITE_ONLY",
      leaderId: leader._id,
      squadXp: 450,
      squadLevel: 2,
      trophies: 100,
      weeklyScore: 100,
      completedHuntsCount: 2,
      memberCap: 8,
    });

    // Link users to squad
    leader.squadId = squad._id as any;
    await leader.save();
    coleader.squadId = squad._id as any;
    await coleader.save();
    member.squadId = squad._id as any;
    await member.save();

    await SquadMember.create({
      squadId: squad._id,
      userId: leader._id,
      role: "LEADER",
      squadRole: "LEADER",
      contributedSquadXp: 200,
    });

    await SquadMember.create({
      squadId: squad._id,
      userId: coleader._id,
      role: "COLEADER",
      squadRole: "COLEADER",
      contributedSquadXp: 150,
    });

    await SquadMember.create({
      squadId: squad._id,
      userId: member._id,
      role: "MEMBER",
      squadRole: "MEMBER",
      contributedSquadXp: 100,
    });

    // Seed Quest 1: 2-stage Squad Raid
    const quest1 = await Quest.create({
      questCode: `RAID-${Date.now().toString(36).toUpperCase()}`,
      title: "Operation Cryptic Ledger: Vault Breach",
      description: "Infiltrate the secure server room and recover the cryptographic key shard.",
      questType: "SQUAD_HUNT",
      difficulty: 3,
      targetLocationId: campusLoc._id,
      xpReward: 300,
      coinReward: 100,
      trophyReward: 40,
      squadXpReward: 120,
      finderBonusXp: 50,
      status: "ACTIVE",
    });

    const clue1 = await Clue.create({
      questId: quest1._id,
      stageOrder: 1,
      title: "Perimeter Bypass Calculation",
      clueText: "Input the primary handshake port: What is 25 * 4?",
      verificationType: "NUMERIC_CALCULATION",
      expectedAnswerNormalized: "100",
      acceptableAnswers: ["100"],
      hintText: "Multiply twenty-five by four.",
    });

    const clue2 = await Clue.create({
      questId: quest1._id,
      stageOrder: 2,
      title: "Core Cipher Validation",
      clueText: "Input the access PIN code: What is 500 + 77?",
      verificationType: "NUMERIC_CALCULATION",
      expectedAnswerNormalized: "577",
      acceptableAnswers: ["577"],
      hintText: "Sum five hundred and seventy seven.",
    });

    assert(Boolean(squad._id), "Apex Syndicate seeded with Leader, Co-Leader, and Member");
    assert(Boolean(quest1._id), "Quest 1 (Squad Raid) initialized with 2 clue stages");

    // ------------------------------------------------------------------
    // STEP 1: LAUNCH SQUAD RAID & VERIFY ACTIVE RAIDS QUERY
    // ------------------------------------------------------------------
    console.log("\n─── Step 1: Launch Squad Raid & Query Live In-Progress Hunts ───");

    (globalThis as any).__TEST_CURRENT_USER__ = leader;
    const startReq = new NextRequest(`http://localhost:3000/api/quests/${quest1._id}/start`, {
      method: "POST",
      body: JSON.stringify({ asSquad: true }),
    });
    const startRes = await startQuest(startReq, { params: Promise.resolve({ id: quest1._id.toString() }) });
    const startJson = await startRes.json();

    assert(startRes.status === 201 || startRes.status === 200, "Leader successfully launched Squad Raid (HTTP 201/200)");
    assert(startJson.success === true, "Start response indicates success");
    assert(Boolean(startJson.data.investigationId), "Investigation ID created for squad raid");

    const invId = startJson.data.investigationId;
    const inv = await Investigation.findById(invId);
    assert(Boolean(inv), "Investigation document exists in database");
    assert(inv?.isSquadInvestigation === true, "Investigation flagged as isSquadInvestigation");
    assert(inv?.squadId?.toString() === squad._id.toString(), "Investigation bound to squad._id");

    // Co-Leader and Member enter the room and join participatingUserIds
    await Investigation.findByIdAndUpdate(invId, {
      $addToSet: { participatingUserIds: { $each: [coleader._id, member._id] } },
    });

    // Query GET /api/squads/[id]/hunts while raid is active
    {
      const huntsReq = new NextRequest(`http://localhost:3000/api/squads/${squad._id}/hunts`);
      const huntsRes = await getSquadHunts(huntsReq, { params: Promise.resolve({ id: squad._id.toString() }) });
      const huntsJson = await huntsRes.json();

      assert(huntsRes.status === 200, "GET /api/squads/[id]/hunts succeeds for active raid (HTTP 200)");
      assert(Array.isArray(huntsJson.data.activeHunts), "data.activeHunts is an array");
      assert(huntsJson.data.activeHunts.length === 1, "Exactly 1 active raid found");
      assert(
        huntsJson.data.activeHunts[0].questId.questCode === quest1.questCode,
        "Active hunt populates quest details (questCode matches)"
      );
      assert(
        huntsJson.data.activeHunts[0].participatingUserIds.length >= 3,
        "Active hunt populates participating operatives (all 3 present)"
      );
      assert(Array.isArray(huntsJson.data.pastHunts), "data.pastHunts is an array");
      assert(huntsJson.data.pastHunts.length === 0, "No completed past hunts recorded yet");
    }

    // ------------------------------------------------------------------
    // STEP 2: COOPERATIVE RAID PROGRESSION (MULTI-OPERATIVE SOLVES)
    // ------------------------------------------------------------------
    console.log("\n─── Step 2: Multi-Operative Clue Solving & Evidence Pinning ───");

    // 2.1 Leader solves Stage 1
    (globalThis as any).__TEST_CURRENT_USER__ = leader;
    const solve1Req = new NextRequest(`http://localhost:3000/api/quests/${quest1._id}/solve-clue`, {
      method: "POST",
      body: JSON.stringify({
        investigationId: invId,
        stageOrder: 1,
        submittedAnswer: "100",
      }),
    });
    const solve1Res = await solveClue(solve1Req, { params: Promise.resolve({ id: quest1._id.toString() }) });
    const solve1Json = await solve1Res.json();
    assert(solve1Res.status === 200, "Leader solves Stage 1 clue (HTTP 200)");
    assert(solve1Json.data.nextStage === 2, "Investigation advances to Stage 2");

    // 2.2 Member solves Stage 2
    (globalThis as any).__TEST_CURRENT_USER__ = member;
    const solve2Req = new NextRequest(`http://localhost:3000/api/quests/${quest1._id}/solve-clue`, {
      method: "POST",
      body: JSON.stringify({
        investigationId: invId,
        stageOrder: 2,
        submittedAnswer: "577",
      }),
    });
    const solve2Res = await solveClue(solve2Req, { params: Promise.resolve({ id: quest1._id.toString() }) });
    const solve2Json = await solve2Res.json();
    assert(solve2Res.status === 200, "Member solves Stage 2 clue (HTTP 200)");
    assert(solve2Json.data.status === "READY_FOR_RECOVERY", "Raid marked READY_FOR_RECOVERY");

    // 2.3 Co-Leader pins evidence on corkboard
    await Investigation.findByIdAndUpdate(invId, {
      $push: {
        evidenceNodes: {
          authorId: coleader._id,
          authorName: coleader.displayName,
          type: "MAP_PIN",
          title: "Sub-level 2 Server Node Pinpoint",
          content: "Coordinates confirmed at rack enclosure 14B.",
          linkedStageOrder: 2,
          upvotes: [leader._id, member._id],
          createdAt: new Date(),
        },
      },
    });

    const invAfterSolves = await Investigation.findById(invId);
    assert(invAfterSolves?.solvedClues?.length === 2, "Investigation records 2 solved clues");
    assert(invAfterSolves?.evidenceNodes?.length === 1, "Investigation records 1 evidence node");

    // ------------------------------------------------------------------
    // STEP 3: RECOVER SQUAD RAID & RECORD PERSISTENT HUNT HISTORY
    // ------------------------------------------------------------------
    console.log("\n─── Step 3: Raid Recovery & SquadHuntRecord Generation ───");

    // Member submits the recovery claim as the Finder / Finisher
    (globalThis as any).__TEST_CURRENT_USER__ = member;
    const recoverReq = new NextRequest(`http://localhost:3000/api/investigations/${invId}/recover`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    const recoverRes = await recoverInvestigation(recoverReq, { params: Promise.resolve({ id: invId.toString() }) });
    const recoverJson = await recoverRes.json();

    assert(recoverRes.status === 200, "Raid recovery succeeds with HTTP 200");
    assert(recoverJson.success === true, "Recovery JSON indicates success");
    assert(recoverJson.data.status === "COMPLETED", "Investigation status transitioned to COMPLETED");

    // 3.1 Verify SquadHuntRecord in MongoDB
    const huntRecord = await SquadHuntRecord.findOne({ squadId: squad._id, investigationId: invId });
    assert(Boolean(huntRecord), "SquadHuntRecord document created in MongoDB");
    assert(huntRecord?.questId?.toString() === quest1._id.toString(), "Hunt record matches questId");
    assert(huntRecord?.questCode === quest1.questCode, "Hunt record stores questCode");
    assert(huntRecord?.questTitle === quest1.title, "Hunt record stores questTitle");
    assert(huntRecord?.questType === "SQUAD_HUNT", "Hunt record stores questType");
    assert(huntRecord?.difficulty === 3, "Hunt record stores difficulty");
    assert(huntRecord?.status === "COMPLETED", "Hunt record status is COMPLETED");
    assert(huntRecord?.finisherUserId?.toString() === member._id.toString(), "Finisher userId is Member");
    assert(huntRecord?.finisherName === member.displayName, "Finisher name matches Member's displayName");
    assert(huntRecord?.squadRewards.squadXp === 120, "Squad rewards squadXp is 120");
    assert(huntRecord?.squadRewards.squadTrophies === 40, "Squad rewards squadTrophies is 40");
    assert(huntRecord?.totalCluesCount === 2, "Total clues count is 2");
    assert(huntRecord?.evidencePinsCount === 1, "Evidence pins count is 1");
    assert(huntRecord?.completedAt instanceof Date, "completedAt is valid Date timestamp");
    assert(typeof huntRecord?.durationSeconds === "number", "durationSeconds is a number");

    // 3.2 Verify Participating Members Breakdown
    const parts = huntRecord?.participatingMembers || [];
    assert(parts.length === 3, "Exactly 3 participating operatives snapshotted in hunt record");

    // Leader breakdown
    const leaderPart = parts.find((p) => p.userId.toString() === leader._id.toString());
    assert(Boolean(leaderPart), "Leader present in participatingMembers");
    assert(leaderPart?.cluesSolvedCount === 1, "Leader contributed 1 clue solve");
    assert(leaderPart?.isFinder === false, "Leader is NOT finder");
    assert(leaderPart?.trophiesAwarded === 40, "Leader awarded base 40 trophies");
    assert(leaderPart?.xpAwarded === 300, "Leader awarded base 300 XP");
    assert(leaderPart?.coinsAwarded === 100, "Leader awarded base 100 coins");

    // Member breakdown (Finder: 15% bonus on 300 XP = 45 XP, 15% on 100 coins = 15 coins, 15% on 40 trophies = 6 trophies)
    const memberPart = parts.find((p) => p.userId.toString() === member._id.toString());
    assert(Boolean(memberPart), "Member present in participatingMembers");
    assert(memberPart?.cluesSolvedCount === 1, "Member contributed 1 clue solve");
    assert(memberPart?.isFinder === true, "Member is designated FINDER");
    assert(memberPart?.trophiesAwarded === 46, "Member awarded 46 trophies (40 base + 6 finder bonus)");
    assert(memberPart?.xpAwarded === 345, "Member awarded 345 XP (300 base + 45 finder bonus)");
    assert(memberPart?.coinsAwarded === 115, "Member awarded 115 coins (100 base + 15 finder bonus)");

    // Co-Leader breakdown
    const coleaderPart = parts.find((p) => p.userId.toString() === coleader._id.toString());
    assert(Boolean(coleaderPart), "Co-Leader present in participatingMembers");
    assert(coleaderPart?.cluesSolvedCount === 0, "Co-Leader contributed 0 clues (evidence contributor)");
    assert(coleaderPart?.isFinder === false, "Co-Leader is NOT finder");
    assert(coleaderPart?.trophiesAwarded === 40, "Co-Leader awarded base 40 trophies");

    // ------------------------------------------------------------------
    // STEP 4: PERSISTENT SQUAD & USER PROGRESSION CREDITING
    // ------------------------------------------------------------------
    console.log("\n─── Step 4: Verify Persistent Trophies, Squad XP & User Stats ───");

    const updatedSquad = await Squad.findById(squad._id);
    assert(updatedSquad?.completedHuntsCount === 3, "squad.completedHuntsCount incremented from 2 to 3");
    assert(updatedSquad?.trophies === 140, "squad.trophies incremented by 40 (100 -> 140)");
    assert(updatedSquad?.squadXp === 570, "squad.squadXp incremented by 120 (450 -> 570)");
    assert(updatedSquad?.squadLevel === 2, "squad.squadLevel evaluated correctly (floor(570/300)+1 = 2)");

    const updatedLeader = await User.findById(leader._id);
    assert(updatedLeader?.trophies === 90, "Leader trophies incremented by 40 (50 -> 90)");
    assert(updatedLeader?.stats.squadQuestsCompleted === 2, "Leader squadQuestsCompleted incremented (1 -> 2)");

    const updatedMember = await User.findById(member._id);
    assert(updatedMember?.trophies === 56, "Member trophies incremented by 46 (10 -> 56)");
    assert(updatedMember?.stats.squadQuestsCompleted === 1, "Member squadQuestsCompleted incremented (0 -> 1)");

    const updatedCoLeader = await User.findById(coleader._id);
    assert(updatedCoLeader?.trophies === 70, "Co-Leader trophies incremented by 40 (30 -> 70)");
    assert(updatedCoLeader?.stats.squadQuestsCompleted === 2, "Co-Leader squadQuestsCompleted incremented (1 -> 2)");

    // Verify Transaction ledgers exist
    const leaderTx = await Transaction.findOne({ userId: leader._id, referenceType: "QUEST", referenceId: quest1._id });
    assert(Boolean(leaderTx), "Transaction ledger recorded for Leader");
    assert(leaderTx?.deltaTrophies === 40, "Leader transaction records deltaTrophies: 40");

    const memberTx = await Transaction.findOne({ userId: member._id, referenceType: "QUEST", referenceId: quest1._id });
    assert(Boolean(memberTx), "Transaction ledger recorded for Member");
    assert(memberTx?.deltaTrophies === 46, "Member transaction records deltaTrophies: 46 (with bonus)");

    // ------------------------------------------------------------------
    // STEP 5: DEDICATED SQUAD HUNTS API (`GET /api/squads/[id]/hunts`)
    // ------------------------------------------------------------------
    console.log("\n─── Step 5: Verify Dedicated Squad Hunts API Returns Past Hunts ───");

    {
      (globalThis as any).__TEST_CURRENT_USER__ = leader;
      const req = new NextRequest(`http://localhost:3000/api/squads/${squad._id}/hunts`);
      const res = await getSquadHunts(req, { params: Promise.resolve({ id: squad._id.toString() }) });
      const json = await res.json();

      assert(res.status === 200, "GET /api/squads/[id]/hunts succeeds (HTTP 200)");
      assert(json.success === true, "Response payload indicates success");
      assert(json.data.activeHunts.length === 0, "No active hunts in progress (all completed)");
      assert(json.data.pastHunts.length === 1, "Exactly 1 past raid returned in history log");

      const pastLog = json.data.pastHunts[0];
      assert(pastLog.questCode === quest1.questCode, "Past hunt matches questCode");
      assert(pastLog.questTitle === quest1.title, "Past hunt matches questTitle");
      assert(pastLog.finisherName === member.displayName, "Past hunt identifies finisherName");
      assert(pastLog.participatingMembers.length === 3, "Past hunt returns all 3 participating operatives");
      assert(pastLog.squadRewards.squadTrophies === 40, "Past hunt reports squadTrophies earned");
    }

    // ------------------------------------------------------------------
    // STEP 6: PRIVACY BOUNDARY ON DEDICATED HUNTS API
    // ------------------------------------------------------------------
    console.log("\n─── Step 6: Squad Privacy Boundary Enforcement ───");

    // 6.1 Non-member attempting to view private squad hunt history -> 403 Forbidden
    {
      (globalThis as any).__TEST_CURRENT_USER__ = outsider;
      const req = new NextRequest(`http://localhost:3000/api/squads/${squad._id}/hunts`);
      const res = await getSquadHunts(req, { params: Promise.resolve({ id: squad._id.toString() }) });
      const json = await res.json();

      assert(res.status === 403, "Non-member blocked from private squad hunt logs (HTTP 403)");
      assert(json.error.code === "FORBIDDEN", "Error code is FORBIDDEN");
    }

    // 6.2 Administrator / Staff override -> 200 Authorized
    {
      (globalThis as any).__TEST_CURRENT_USER__ = staffAdmin;
      const req = new NextRequest(`http://localhost:3000/api/squads/${squad._id}/hunts`);
      const res = await getSquadHunts(req, { params: Promise.resolve({ id: squad._id.toString() }) });

      assert(res.status === 200, "Admin authorized to audit private squad hunt logs (HTTP 200)");
    }

    // 6.3 Public squad allows non-member viewing
    {
      await Squad.findByIdAndUpdate(squad._id, { privacy: "PUBLIC" });
      (globalThis as any).__TEST_CURRENT_USER__ = outsider;
      const req = new NextRequest(`http://localhost:3000/api/squads/${squad._id}/hunts`);
      const res = await getSquadHunts(req, { params: Promise.resolve({ id: squad._id.toString() }) });

      assert(res.status === 200, "Non-member authorized to view PUBLIC squad hunt logs (HTTP 200)");
      // Revert to private
      await Squad.findByIdAndUpdate(squad._id, { privacy: "PRIVATE" });
    }

    // ------------------------------------------------------------------
    // STEP 7: IDEMPOTENT RECOVERY & COMPOUND INDEX INTEGRITY
    // ------------------------------------------------------------------
    console.log("\n─── Step 7: Idempotency & Unique Compound Index Concurrency Guard ───");

    // 7.1 Repeat recovery on already completed investigation
    {
      (globalThis as any).__TEST_CURRENT_USER__ = leader;
      const req = new NextRequest(`http://localhost:3000/api/investigations/${invId}/recover`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const res = await recoverInvestigation(req, { params: Promise.resolve({ id: invId.toString() }) });
      const json = await res.json();

      assert(res.status === 400, "Duplicate recovery attempt strictly rejected (HTTP 400)");
      assert(json.error.code === "ALREADY_COMPLETED", "Error code is ALREADY_COMPLETED");
    }

    // 7.2 Direct invocation of distributeSquadQuestRewards does not duplicate SquadHuntRecord
    {
      await distributeSquadQuestRewards({
        squadId: squad._id as Types.ObjectId,
        participatingUserIds: [leader._id, member._id, coleader._id],
        finderUserId: member._id as Types.ObjectId,
        baseXp: quest1.xpReward,
        baseCoins: quest1.coinReward,
        trophyReward: 40,
        squadXpReward: 120,
        questId: quest1._id as Types.ObjectId,
        questTitle: quest1.title,
        investigationId: invId,
      });

      const recordsCount = await SquadHuntRecord.countDocuments({
        squadId: squad._id,
        investigationId: invId,
      });
      assert(recordsCount === 1, "Compound unique index `{ squadId: 1, investigationId: 1 }` strictly prevented duplicate record");
    }

    // ------------------------------------------------------------------
    // STEP 8: SIMULTANEOUS ACTIVE RAIDS AND HISTORICAL LOGS
    // ------------------------------------------------------------------
    console.log("\n─── Step 8: Simultaneous Active Raids & Historical Logs Coexistence ───");

    // Seed Quest 2
    const quest2 = await Quest.create({
      questCode: `RAID-BEACON-${Date.now().toString(36).toUpperCase()}`,
      title: "Operation Deep Signal: Beacon Recon",
      description: "Locate and calibrate the rogue microwave transmitter on campus.",
      questType: "CAMPUS_TREASURE",
      difficulty: 2,
      targetLocationId: campusLoc._id,
      xpReward: 200,
      coinReward: 80,
      trophyReward: 30,
      squadXpReward: 90,
      status: "ACTIVE",
    });

    // Start Quest 2 as Squad Raid
    (globalThis as any).__TEST_CURRENT_USER__ = leader;
    const start2Req = new NextRequest(`http://localhost:3000/api/quests/${quest2._id}/start`, {
      method: "POST",
      body: JSON.stringify({ asSquad: true }),
    });
    const start2Res = await startQuest(start2Req, { params: Promise.resolve({ id: quest2._id.toString() }) });
    assert(start2Res.status === 201 || start2Res.status === 200, "Started second Squad Raid (Quest 2)");

    // Query hunts API: should return Quest 2 in activeHunts AND Quest 1 in pastHunts
    {
      const req = new NextRequest(`http://localhost:3000/api/squads/${squad._id}/hunts`);
      const res = await getSquadHunts(req, { params: Promise.resolve({ id: squad._id.toString() }) });
      const json = await res.json();

      assert(res.status === 200, "GET /api/squads/[id]/hunts returns active and past raids together");
      assert(json.data.activeHunts.length === 1, "activeHunts contains exactly 1 in-progress raid (Quest 2)");
      assert(json.data.activeHunts[0].questId.questCode === quest2.questCode, "Active raid matches Quest 2");
      assert(json.data.pastHunts.length === 1, "pastHunts contains completed raid (Quest 1)");
      assert(json.data.pastHunts[0].questCode === quest1.questCode, "Past raid matches Quest 1");
    }

    console.log("\n========================================================");
    console.log(`🎉 ALL SQUAD HUNTS & HISTORY TESTS PASSED: ${passedCount} passed | ${failedCount} failed`);
    console.log("========================================================\n");
  } finally {
    console.log(`🧹 Dropping ephemeral test database: ${RUN_ID}...`);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log("✨ Ephemeral database dropped and disconnected cleanly.\n");
  }
}

run().catch((err) => {
  console.error("❌ Squad hunts test suite encountered an unhandled error:", err);
  process.exit(1);
});
