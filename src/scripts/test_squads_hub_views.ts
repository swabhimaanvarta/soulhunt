/**
 * AIEM Hunt — Milestone 4: Squads Hub & Distinct Membership Views QA Test Suite
 * 
 * Verifies:
 * 1. Distinct Membership State Logic:
 *    - User A (member of Squad Alpha): "My Squad" syndicate view data, active raids, and past hunt history log entries.
 *    - User B (unaffiliated): full squad directory without membership lock.
 * 2. Active Raid & Persistent Hunt History Integration:
 *    - Live in-progress raid verification (stage, progress %, participating operatives).
 *    - Persistent completed hunt history records (clue attribution, finder bonus, trophies, rewards).
 * 3. Empty State Handling:
 *    - Squad with 0 completed raids returns empty active and past arrays cleanly.
 * 4. Campus Scouting & Clean Separation:
 *    - Directory browsing cleanly separates user's active syndicate from other campus squads.
 *    - Search and recruitment filters work reliably.
 * 5. Dynamic Membership Lifecycle:
 *    - Unaffiliated User B enlists in Squad Bravo, transitioning to member view.
 *    - Resignation unlinks user, reverting to directory view.
 */

import mongoose, { Types } from "mongoose";
import crypto from "crypto";
import { NextRequest } from "next/server";
import {
  User,
  Squad,
  SquadMember,
  Investigation,
  SquadHuntRecord,
  Quest,
  CampusLocation,
  SystemConfig,
} from "../models";
import { connectDB } from "../lib/db";
import { GET as getSquadsDirectory } from "../app/api/squads/route";
import { GET as getSquadDetail } from "../app/api/squads/[id]/route";
import { GET as getSquadHunts } from "../app/api/squads/[id]/hunts/route";
import { POST as joinSquad } from "../app/api/squads/[id]/join/route";
import { POST as leaveSquad } from "../app/api/squads/[id]/leave/route";

const RUN_ID = `aiem_hunt_test_squads_hub_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
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
  console.log("⭐ STARTING SQUADS HUB & DISTINCT MEMBERSHIP VIEWS TEST");
  console.log(`   Isolated Database: ${RUN_ID}`);
  console.log("========================================================\n");

  await connectDB();

  try {
    // ------------------------------------------------------------------
    // STEP 0: SEED BASELINE CONFIG, LOCATIONS, SQUADS & OPERATIVES
    // ------------------------------------------------------------------
    console.log("─── Step 0: Seed Baseline Config, Squads & Operatives ───");

    await SystemConfig.findOneAndUpdate(
      { key: "GLOBAL_CONFIG" },
      {
        $setOnInsert: {
          key: "GLOBAL_CONFIG",
          maxFinderBonusPct: 25,
          defaultFinderBonusPct: 15,
        },
      },
      { upsert: true }
    );

    const campusLoc = await CampusLocation.create({
      code: `LOC_HUB_${Date.now()}`,
      name: "Central Tech Core & Syndicate Room",
      zoneType: "LIBRARY",
      building: "Science Wing A",
      floors: ["Ground Floor"],
      coordinates: { lat: 15.4215, lng: 73.9815, mapX: 50, mapY: 50 },
      isSafeDesk: true,
      isActive: true,
    });
    assert(Boolean(campusLoc), "Campus location seeded successfully");

    // Founder / Leader for Squad Bravo
    const founderBravo = await User.create({
      username: `founder_bravo_${Date.now()}`,
      email: `founder_bravo_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "mock_hash",
      displayName: "Commander Bravo",
      role: "STUDENT",
      coins: 200,
      xp: 800,
      level: 7,
      trophies: 60,
      accountStatus: "ACTIVE",
    });

    // User A: Active Member & Leader of Squad Alpha
    const userA = await User.create({
      username: `user_a_alpha_${Date.now()}`,
      email: `user_a_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "mock_hash",
      displayName: "Agent Alpha",
      role: "STUDENT",
      coins: 150,
      xp: 600,
      level: 6,
      trophies: 45,
      weeklyScore: 45,
      accountStatus: "ACTIVE",
    });

    // User B: Unaffiliated Student (No Squad)
    const userB = await User.create({
      username: `user_b_solo_${Date.now()}`,
      email: `user_b_${Date.now()}@aiemgoa.ac.in`,
      passwordHash: "mock_hash",
      displayName: "Agent Beta",
      role: "STUDENT",
      coins: 120,
      xp: 400,
      level: 6,
      trophies: 20,
      weeklyScore: 20,
      squadId: null,
      accountStatus: "ACTIVE",
    });

    // Seed Squad Alpha (User A's squad with active raid & past history)
    const squadAlpha = await Squad.create({
      name: "Alpha Syndicate",
      tag: "ALPH",
      description: "Premier AIEM deduction unit specializing in cyber puzzles.",
      emblemIcon: "ShieldAlert",
      privacy: "PUBLIC",
      joinType: "OPEN",
      minLevelRequired: 1,
      leaderId: userA._id,
      squadXp: 950,
      squadLevel: 4,
      trophies: 160,
      completedHuntsCount: 1,
      memberCap: 8,
      weeklyScore: 75,
    });

    // Link User A to Squad Alpha
    userA.squadId = squadAlpha._id as Types.ObjectId;
    await userA.save();

    await SquadMember.create({
      squadId: squadAlpha._id,
      userId: userA._id,
      role: "LEADER",
      squadRole: "LEADER",
      contributedSquadXp: 350,
      cluesSolvedForSquad: 2,
      joinedAt: new Date(),
    });

    // Seed Squad Bravo (Recruiting squad with 0 past hunts)
    const squadBravo = await Squad.create({
      name: "Bravo Collective",
      tag: "BRAV",
      description: "Open campus recon team scouting newcomers.",
      emblemIcon: "Compass",
      privacy: "PUBLIC",
      joinType: "OPEN",
      minLevelRequired: 1,
      leaderId: founderBravo._id,
      squadXp: 150,
      squadLevel: 1,
      trophies: 25,
      completedHuntsCount: 0,
      memberCap: 8,
      weeklyScore: 10,
    });

    founderBravo.squadId = squadBravo._id as Types.ObjectId;
    await founderBravo.save();

    await SquadMember.create({
      squadId: squadBravo._id,
      userId: founderBravo._id,
      role: "LEADER",
      squadRole: "LEADER",
      contributedSquadXp: 150,
      cluesSolvedForSquad: 0,
      joinedAt: new Date(),
    });

    // Seed Quest for Squad Alpha
    const raidQuest = await Quest.create({
      questCode: `RAID_HUB_${Date.now()}`,
      title: "Operation Cyber Vault Archive",
      description: "Infiltrate the secure server room and recover the cryptographic key shard.",
      questType: "SQUAD_HUNT",
      difficulty: 3,
      targetLocationId: campusLoc._id,
      xpReward: 300,
      coinReward: 80,
      trophyReward: 30,
      squadXpReward: 100,
      finderBonusXp: 45,
      status: "ACTIVE",
    });

    // Seed Active In-Progress Investigation for Squad Alpha
    const activeInv = await Investigation.create({
      questId: raidQuest._id,
      squadId: squadAlpha._id,
      isSquadInvestigation: true,
      currentStage: 2,
      progressPct: 66,
      participatingUserIds: [userA._id],
      status: "IN_PROGRESS",
      solvedClues: [
        {
          stageOrder: 1,
          solvedBy: userA._id,
          solvedByName: userA.displayName,
          solvedAt: new Date(),
        },
      ],
    });

    // Seed Persistent Completed Hunt Record for Squad Alpha
    const pastHunt = await SquadHuntRecord.create({
      squadId: squadAlpha._id,
      questId: raidQuest._id,
      investigationId: new Types.ObjectId(),
      questCode: raidQuest.questCode,
      questTitle: raidQuest.title,
      questType: "SQUAD_HUNT",
      difficulty: 3,
      status: "COMPLETED",
      completedAt: new Date(Date.now() - 3600000),
      durationSeconds: 840,
      finisherUserId: userA._id,
      finisherName: userA.displayName,
      totalCluesCount: 2,
      evidencePinsCount: 1,
      squadRewards: {
        squadXp: 100,
        squadTrophies: 30,
      },
      participatingMembers: [
        {
          userId: userA._id,
          displayName: userA.displayName,
          username: userA.username,
          cluesSolvedCount: 2,
          isFinder: true,
          trophiesAwarded: 35,
          xpAwarded: 345,
          coinsAwarded: 95,
        },
      ],
    });

    assert(Boolean(activeInv), "Active raid investigation seeded");
    assert(Boolean(pastHunt), "Persistent squad hunt record seeded");

    // ------------------------------------------------------------------
    // STEP 1: USER A (AFFILIATED MEMBER) — MY SQUAD VIEW DATA VERIFICATION
    // ------------------------------------------------------------------
    console.log("\n─── Step 1: User A (Affiliated Member) — My Squad View Verification ───");

    assert(Boolean(userA.squadId), "User A has valid squadId binding in database");
    assert(
      userA.squadId?.toString() === squadAlpha._id.toString(),
      "User A belongs to Squad Alpha"
    );

    // 1.1 Query Squad Alpha details with User A session
    (globalThis as any).__TEST_CURRENT_USER__ = userA;
    {
      const req = new NextRequest(`http://localhost:3000/api/squads/${squadAlpha._id}`);
      const res = await getSquadDetail(req, {
        params: Promise.resolve({ id: squadAlpha._id.toString() }),
      });
      const json = await res.json();

      assert(res.status === 200, "GET /api/squads/[id] succeeds for User A (HTTP 200)");
      assert(json.success === true, "Squad details response indicates success");
      assert(json.data.isMember === true, "User A is marked as active member (isMember = true)");
      assert(json.data.isLeader === true, "User A is recognized as syndicate leader");
      assert(json.data.viewerRole === "LEADER", "User A viewerRole is LEADER");
      assert(json.data.squad.name === "Alpha Syndicate", "Squad name is Alpha Syndicate");
      assert(json.data.squad.tag === "ALPH", "Squad tag is [ALPH]");
      assert(json.data.squad.squadLevel === 4, "Squad level is 4");
      assert(json.data.squad.trophies === 160, "Squad trophies is 160");
      assert(json.data.squad.completedHuntsCount === 1, "Completed hunts count is 1");
      assert(json.data.members.length === 1, "Members roster contains 1 operative");
      assert(
        json.data.members[0].contributedSquadXp === 350,
        "User A contributedSquadXp is 350"
      );
    }

    // 1.2 Query Dedicated Hunts API for User A's Squad (Active Raids + Persistent History)
    {
      const req = new NextRequest(`http://localhost:3000/api/squads/${squadAlpha._id}/hunts`);
      const res = await getSquadHunts(req, {
        params: Promise.resolve({ id: squadAlpha._id.toString() }),
      });
      const json = await res.json();

      assert(res.status === 200, "GET /api/squads/[id]/hunts succeeds for User A (HTTP 200)");
      assert(json.success === true, "Hunts API indicates success");

      // Verify Active Raids Section data
      assert(json.data.activeHunts.length === 1, "Active hunts contains exactly 1 in-progress raid");
      const liveRaid = json.data.activeHunts[0];
      assert(liveRaid.currentStage === 2, "Active raid is currently on Stage 2");
      assert(liveRaid.progressPct === 66, "Active raid live progress is 66%");
      assert(liveRaid.questId?.questCode === raidQuest.questCode, "Active raid matches questCode");
      assert(liveRaid.participatingUserIds.length === 1, "Active raid tracks participating operatives");

      // Verify Persistent Hunt History Log data
      assert(json.data.pastHunts.length === 1, "Past hunts history contains exactly 1 logged raid");
      const historyCard = json.data.pastHunts[0];
      assert(historyCard.questTitle === raidQuest.title, "History log stores questTitle");
      assert(historyCard.status === "COMPLETED", "History log status is COMPLETED");
      assert(historyCard.difficulty === 3, "History log difficulty is 3");
      assert(historyCard.finisherName === userA.displayName, "History log names Agent Alpha as finisher");
      assert(historyCard.squadRewards.squadXp === 100, "History log records +100 Squad XP");
      assert(historyCard.squadRewards.squadTrophies === 30, "History log records +30 Squad Trophies");

      // Verify Participant attribution & Finder badge
      assert(historyCard.participatingMembers.length === 1, "1 participating operative snapshot present");
      const participant = historyCard.participatingMembers[0];
      assert(participant.isFinder === true, "Agent Alpha has Finder badge enabled");
      assert(participant.cluesSolvedCount === 2, "Agent Alpha solved 2 clues in this raid");
      assert(participant.xpAwarded === 345, "Agent Alpha earned 345 XP with finder bonus");
      assert(participant.trophiesAwarded === 35, "Agent Alpha earned 35 Trophies");
    }

    // ------------------------------------------------------------------
    // STEP 2: USER B (UNAFFILIATED OPERATIVE) — NON-MEMBER DIRECTORY VIEW
    // ------------------------------------------------------------------
    console.log("\n─── Step 2: User B (Unaffiliated Operative) — Directory View Verification ───");

    assert(userB.squadId === null, "User B squadId is null (unaffiliated)");

    (globalThis as any).__TEST_CURRENT_USER__ = userB;
    {
      const req = new NextRequest("http://localhost:3000/api/squads");
      const res = await getSquadsDirectory(req);
      const json = await res.json();

      assert(res.status === 200, "GET /api/squads succeeds for User B (HTTP 200)");
      assert(json.success === true, "Squads directory query succeeds");
      assert(Array.isArray(json.data), "Directory returns array of campus squads");
      assert(json.data.length >= 2, "Both Alpha Syndicate and Bravo Collective are in directory");

      const alphaInDir = json.data.find((s: any) => s.tag === "ALPH");
      const bravoInDir = json.data.find((s: any) => s.tag === "BRAV");
      assert(Boolean(alphaInDir), "Squad Alpha is visible in campus directory");
      assert(Boolean(bravoInDir), "Squad Bravo is visible in campus directory");
      assert(alphaInDir.memberCount === 1, "Squad Alpha memberCount is 1");
      assert(bravoInDir.memberCount === 1, "Squad Bravo memberCount is 1");
    }

    // 2.2 Verify User B scouting Squad Alpha is NOT treated as a member
    {
      const req = new NextRequest(`http://localhost:3000/api/squads/${squadAlpha._id}`);
      const res = await getSquadDetail(req, {
        params: Promise.resolve({ id: squadAlpha._id.toString() }),
      });
      const json = await res.json();

      assert(res.status === 200, "User B can scout public Squad Alpha command details (HTTP 200)");
      assert(json.data.isMember === false, "User B is correctly flagged as NON-MEMBER (isMember = false)");
      assert(json.data.viewerRole === null, "User B viewerRole is null");
      assert(json.data.isLeader === false, "User B is not leader");
    }

    // ------------------------------------------------------------------
    // STEP 3: BROWSING TAB SEPARATION & CAMPUS SCOUTING
    // ------------------------------------------------------------------
    console.log("\n─── Step 3: Browsing Tab Separation & Campus Scouting ───");

    // 3.1 Directory Search by Tag
    {
      const req = new NextRequest("http://localhost:3000/api/squads?search=ALPH");
      const res = await getSquadsDirectory(req);
      const json = await res.json();

      assert(res.status === 200, "Search by tag ALPH succeeds");
      assert(json.data.length === 1, "Search returns exactly 1 squad matching ALPH");
      assert(json.data[0].tag === "ALPH", "Matched squad has tag ALPH");
    }

    // 3.2 Directory Search by Name
    {
      const req = new NextRequest("http://localhost:3000/api/squads?search=Bravo");
      const res = await getSquadsDirectory(req);
      const json = await res.json();

      assert(res.status === 200, "Search by name Bravo succeeds");
      assert(json.data.length === 1, "Search returns exactly 1 squad matching Bravo");
      assert(json.data[0].tag === "BRAV", "Matched squad has tag BRAV");
    }

    // ------------------------------------------------------------------
    // STEP 4: EMPTY STATE HANDLING (SQUAD WITH 0 HUNTS)
    // ------------------------------------------------------------------
    console.log("\n─── Step 4: Empty State Handling for Squad Bravo (0 Hunts) ───");

    (globalThis as any).__TEST_CURRENT_USER__ = founderBravo;
    {
      const req = new NextRequest(`http://localhost:3000/api/squads/${squadBravo._id}/hunts`);
      const res = await getSquadHunts(req, {
        params: Promise.resolve({ id: squadBravo._id.toString() }),
      });
      const json = await res.json();

      assert(res.status === 200, "GET /api/squads/[id]/hunts succeeds for Squad Bravo (HTTP 200)");
      assert(json.success === true, "Response payload indicates success");
      assert(json.data.activeHunts.length === 0, "activeHunts is empty array ([]) for fresh squad");
      assert(json.data.pastHunts.length === 0, "pastHunts is empty array ([]) for fresh squad");
      // This confirms front-end components will render:
      // "No completed squad raids logged yet. Launch your syndicate's first raid!"
    }

    // ------------------------------------------------------------------
    // STEP 5: UNAFFILIATED USER ENLISTMENT & VIEW TRANSITION LIFECYCLE
    // ------------------------------------------------------------------
    console.log("\n─── Step 5: Unaffiliated User Enlistment & View Transition ───");

    (globalThis as any).__TEST_CURRENT_USER__ = userB;
    {
      const req = new NextRequest(`http://localhost:3000/api/squads/${squadBravo._id}/join`, {
        method: "POST",
      });
      const res = await joinSquad(req, {
        params: Promise.resolve({ id: squadBravo._id.toString() }),
      });
      const json = await res.json();

      assert(res.status === 200, "User B enlists in Squad Bravo with HTTP 200");
      assert(json.success === true, "Join response indicates success");
      assert(json.message?.includes("Bravo"), "Response confirms joining Bravo");

      // Verify User B now has squadId bound in database
      const refreshedUserB = await User.findById(userB._id);
      assert(
        refreshedUserB?.squadId?.toString() === squadBravo._id.toString(),
        "User B database record updated with squadId = Squad Bravo"
      );

      // Verify User B is now recognized as active MEMBER of Squad Bravo
      (globalThis as any).__TEST_CURRENT_USER__ = refreshedUserB;
      const detailReq = new NextRequest(`http://localhost:3000/api/squads/${squadBravo._id}`);
      const detailRes = await getSquadDetail(detailReq, {
        params: Promise.resolve({ id: squadBravo._id.toString() }),
      });
      const detailJson = await detailRes.json();

      assert(detailJson.data.isMember === true, "User B transitioned to isMember = true");
      assert(detailJson.data.viewerRole === "MEMBER", "User B viewerRole is now MEMBER");
      assert(detailJson.data.members.length === 2, "Squad Bravo now has 2 operatives");
    }

    // ------------------------------------------------------------------
    // STEP 6: RESIGNATION LIFECYCLE & RETURN TO DIRECTORY VIEW
    // ------------------------------------------------------------------
    console.log("\n─── Step 6: Resignation Lifecycle & Reversion to Directory View ───");

    {
      const refreshedUserB = await User.findById(userB._id);
      (globalThis as any).__TEST_CURRENT_USER__ = refreshedUserB;

      const req = new NextRequest(`http://localhost:3000/api/squads/${squadBravo._id}/leave`, {
        method: "POST",
      });
      const res = await leaveSquad(req, {
        params: Promise.resolve({ id: squadBravo._id.toString() }),
      });
      const json = await res.json();

      assert(res.status === 200, "User B resigns from Squad Bravo with HTTP 200");
      assert(json.success === true, "Leave response indicates success");

      // Verify User B squadId is cleaned up in MongoDB
      const postLeaveUserB = await User.findById(userB._id);
      assert(
        postLeaveUserB?.squadId === null || postLeaveUserB?.squadId === undefined,
        "User B squadId is cleared after resignation"
      );

      // Verify User B is once again non-member
      (globalThis as any).__TEST_CURRENT_USER__ = postLeaveUserB;
      const detailReq = new NextRequest(`http://localhost:3000/api/squads/${squadBravo._id}`);
      const detailRes = await getSquadDetail(detailReq, {
        params: Promise.resolve({ id: squadBravo._id.toString() }),
      });
      const detailJson = await detailRes.json();

      assert(detailJson.data.isMember === false, "User B is now non-member (isMember = false)");
      assert(detailJson.data.viewerRole === null, "User B viewerRole reverted to null");
    }

    // ------------------------------------------------------------------
    // CLEANUP EPHEMERAL DATABASE
    // ------------------------------------------------------------------
    console.log("\n─── Cleanup: Dropping Ephemeral Database ───");
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    console.log(`✨ Ephemeral database ${RUN_ID} dropped cleanly.`);

    console.log("\n========================================================");
    console.log(`🎉 ALL SQUADS HUB & MEMBERSHIP VIEW TESTS PASSED!`);
    console.log(`   Passed: ${passedCount} | Failed: ${failedCount}`);
    console.log("========================================================");
  } catch (err) {
    console.error("Test execution aborted with error:", err);
    try {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    } catch {
      // ignore teardown errors
    }
    process.exit(1);
  }
}

run();
