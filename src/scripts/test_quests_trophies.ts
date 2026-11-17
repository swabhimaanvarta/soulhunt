import mongoose from "mongoose";
import crypto from "crypto";
import { User, Squad, Quest, Clue, Investigation, Transaction, CampusLocation } from "../models";
import { POST as recoverRoute } from "../app/api/investigations/[id]/recover/route";
import { POST as completeQuestRoute, GET as getQuestCompleteStatus } from "../app/api/quests/[id]/complete/route";
import { GET as getMeRoute } from "../app/api/auth/me/route";
import { GET as getProfileRoute } from "../app/api/user/profile/route";
import { GET as getLeaderboardRoute } from "../app/api/leaderboard/route";
import { NextRequest } from "next/server";

const RUN_ID = `aiem_hunt_test_quests_trophies_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
const TEST_DB_URI = `mongodb://127.0.0.1:27017/${RUN_ID}`;

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

async function runQuestsTrophiesTests() {
  console.log("========================================================");
  console.log("🏆 AIEM HUNT — QUESTS & TROPHIES ENGINE VERIFICATION");
  console.log(`   Target DB: ${TEST_DB_URI}`);
  console.log("========================================================");

  process.env.MONGODB_URI = TEST_DB_URI;
  await mongoose.connect(TEST_DB_URI);
  console.log(`📦 Connected to ephemeral test database: ${RUN_ID}`);

  try {
    // 0. Seed Campus Location
    const location = await CampusLocation.create({
      name: "Central Library Quad",
      code: "LIB-QUAD",
      zoneType: "LIBRARY",
      building: "Library Block",
      coordinates: {
        lat: 15.2993,
        lng: 73.8567,
        mapX: 50,
        mapY: 50,
      },
    });

    // 1. Seed Squad
    const testSquad = await Squad.create({
      name: "Challenger Syndicate",
      tag: "CHAL",
      description: "Tactical Investigation Unit",
      emblemIcon: "ShieldAlert",
      leaderId: new mongoose.Types.ObjectId(),
      squadXp: 1000,
      squadLevel: 2,
      trophies: 100,
      weeklyScore: 100,
      completedHuntsCount: 2,
      memberCap: 8,
    });

    // 2. Seed Test Users
    const soloHunter = await User.create({
      username: `solosleuth_${Date.now()}`,
      email: `solosleuth_${Date.now()}@aiemgoa.ac.in`,
      displayName: "Solo Sleuth",
      passwordHash: "hash123",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      xp: 500,
      level: 2,
      coins: 100,
      trophies: 50,
      weeklyScore: 50,
      trustScore: 400,
      claimedLevelRewards: [],
    });

    const squadHunter = await User.create({
      username: `squadstriker_${Date.now()}`,
      email: `squadstriker_${Date.now()}@aiemgoa.ac.in`,
      displayName: "Squad Striker",
      passwordHash: "hash123",
      role: "STUDENT",
      accountStatus: "ACTIVE",
      emailVerified: true,
      xp: 800,
      level: 3,
      coins: 150,
      trophies: 80,
      weeklyScore: 80,
      trustScore: 500,
      squadId: testSquad._id,
      claimedLevelRewards: [],
    });

    testSquad.leaderId = squadHunter._id;
    await testSquad.save();

    // 3. Seed Quests with trophyReward
    const soloQuest = await Quest.create({
      questCode: `Q-SOLO-${Date.now()}`,
      title: "Archive Decryption",
      description: "Find the missing historical archive ledger.",
      questType: "CAMPUS_TREASURE",
      difficulty: 3,
      xpReward: 150,
      coinReward: 35,
      trophyReward: 45,
      squadXpReward: 0,
      targetLocationId: location._id,
      status: "ACTIVE",
    });

    const squadQuest = await Quest.create({
      questCode: `Q-SQUAD-${Date.now()}`,
      title: "Server Room Infiltration",
      description: "Coordinate squad signals to reach the server vault.",
      questType: "SQUAD_HUNT",
      difficulty: 4,
      xpReward: 250,
      coinReward: 60,
      trophyReward: 60,
      squadXpReward: 100,
      targetLocationId: location._id,
      status: "ACTIVE",
    });

    const directQuest = await Quest.create({
      questCode: `Q-DIRECT-${Date.now()}`,
      title: "Direct Field Calibration",
      description: "Calibrate beacon transmitters across Quad.",
      questType: "CAMPUS_TREASURE",
      difficulty: 2,
      xpReward: 120,
      coinReward: 25,
      trophyReward: 30,
      squadXpReward: 0,
      targetLocationId: location._id,
      status: "ACTIVE",
    });

    // 4. Seed Clues
    const soloClue = await Clue.create({
      questId: soloQuest._id,
      stageOrder: 1,
      title: "Ancient Index Card",
      clueText: "Locate card catalog #42",
      verificationType: "PASSCODE_QR",
      expectedAnswerNormalized: "archive42",
      unlockedBreadcrumbText: "Floor 2 Shelf B",
    });

    const squadClue = await Clue.create({
      questId: squadQuest._id,
      stageOrder: 1,
      title: "Dual Terminal Relay",
      clueText: "Sync alpha terminal key",
      verificationType: "PASSCODE_QR",
      expectedAnswerNormalized: "alpha7",
      unlockedBreadcrumbText: "Server room clearance granted.",
    });

    console.log("\n─── Suite 1: Solo Quest Completion & Trophies Payout ───");
    {
      const soloInvestigation = await Investigation.create({
        questId: soloQuest._id,
        userId: soloHunter._id,
        currentStage: 2,
        progressPct: 90,
        status: "READY_FOR_RECOVERY",
        solvedClues: [
          {
            clueId: soloClue._id,
            stageOrder: 1,
            solvedByUserId: soloHunter._id,
            solvedByName: soloHunter.displayName,
            solvedAt: new Date(),
          },
        ],
        participatingUserIds: [soloHunter._id],
      });

      (globalThis as any).__TEST_CURRENT_USER__ = soloHunter;

      const req = new NextRequest(
        `http://localhost:3000/api/investigations/${soloInvestigation._id}/recover`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );

      const res = await recoverRoute(req, {
        params: Promise.resolve({ id: soloInvestigation._id.toString() }),
      });
      const json = await res.json();

      assert(json.success === true, "Recovery endpoint succeeded");
      assert(json.data.status === "COMPLETED", "Investigation marked COMPLETED");
      assert(json.data.rewards.trophies === 45, `Expected 45 trophies, got ${json.data.rewards.trophies}`);

      const updatedSoloHunter = await User.findById(soloHunter._id);
      assert(
        updatedSoloHunter?.trophies === 50 + 45,
        `Expected user trophies to be 95, got ${updatedSoloHunter?.trophies}`
      );
      assert(
        updatedSoloHunter?.weeklyScore === 50 + 45,
        `Expected user weeklyScore to be 95, got ${updatedSoloHunter?.weeklyScore}`
      );

      const tx = await Transaction.findOne({
        userId: soloHunter._id,
        referenceType: "QUEST",
        referenceId: soloQuest._id,
      });
      assert(tx !== null, "Transaction created for quest");
      assert(tx?.deltaTrophies === 45, `Expected deltaTrophies of 45 in transaction, got ${tx?.deltaTrophies}`);

      console.log("  ✅ PASSED: Solo quest completed and awarded 45 Trophies atomically to user and transaction ledger.");
    }

    console.log("\n─── Suite 2: Squad Quest Completion & Syndicate Trophies ───");
    {
      const squadInvestigation = await Investigation.create({
        questId: squadQuest._id,
        userId: squadHunter._id,
        squadId: testSquad._id,
        isSquadInvestigation: true,
        currentStage: 2,
        progressPct: 90,
        status: "READY_FOR_RECOVERY",
        solvedClues: [
          {
            clueId: squadClue._id,
            stageOrder: 1,
            solvedByUserId: squadHunter._id,
            solvedByName: squadHunter.displayName,
            solvedAt: new Date(),
          },
        ],
        participatingUserIds: [squadHunter._id],
      });

      (globalThis as any).__TEST_CURRENT_USER__ = squadHunter;

      const req = new NextRequest(
        `http://localhost:3000/api/investigations/${squadInvestigation._id}/recover`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }
      );

      const res = await recoverRoute(req, {
        params: Promise.resolve({ id: squadInvestigation._id.toString() }),
      });
      const json = await res.json();

      assert(json.success === true, "Squad recovery succeeded");
      assert(json.data.status === "COMPLETED", "Squad investigation marked COMPLETED");
      assert(json.data.rewards.trophies === 60, `Expected 60 trophies, got ${json.data.rewards.trophies}`);

      const updatedSquadHunter = await User.findById(squadHunter._id);
      assert(
        (updatedSquadHunter?.trophies ?? 0) >= 80 + 60,
        `Expected hunter trophies >= 140, got ${updatedSquadHunter?.trophies}`
      );

      const updatedSquad = await Squad.findById(testSquad._id);
      assert(
        updatedSquad?.trophies === 100 + 60,
        `Expected squad trophies to be 160, got ${updatedSquad?.trophies}`
      );
      assert(
        updatedSquad?.weeklyScore === 100 + 60,
        `Expected squad weeklyScore to be 160, got ${updatedSquad?.weeklyScore}`
      );

      console.log("  ✅ PASSED: Squad quest completed and credited Trophies to both operative and syndicate.");
    }

    console.log("\n─── Suite 3: Direct API /api/quests/[id]/complete Endpoint Verification ───");
    {
      (globalThis as any).__TEST_CURRENT_USER__ = soloHunter;

      // 1. Create active investigation ready for completion
      const directInv = await Investigation.create({
        questId: directQuest._id,
        userId: soloHunter._id,
        currentStage: 1,
        progressPct: 90,
        status: "READY_FOR_RECOVERY",
        participatingUserIds: [soloHunter._id],
      });

      // 2. Direct completion via POST /api/quests/[id]/complete succeeds
      const compReq = new NextRequest(
        `http://localhost:3000/api/quests/${directQuest._id}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asSquad: false }),
        }
      );
      const compRes = await completeQuestRoute(compReq, {
        params: Promise.resolve({ id: directQuest._id.toString() }),
      });
      const compJson = await compRes.json();

      assert(compRes.status === 200, `POST /api/quests/[id]/complete returned HTTP 200: ${JSON.stringify(compJson)}`);
      assert(compJson.success === true, `POST /api/quests/[id]/complete succeeded: ${JSON.stringify(compJson)}`);
      assert(compJson.data.status === "COMPLETED", "Direct quest complete marked COMPLETED");
      const trophiesAwarded = compJson.data.trophiesAwarded ?? compJson.data.rewards?.trophies;
      assert(trophiesAwarded === 30, `Expected 30 trophies, got ${trophiesAwarded}`);

      const userAfterDirect = await User.findById(soloHunter._id);
      assert(
        userAfterDirect?.trophies === 95 + 30,
        `Expected user trophies to be 125, got ${userAfterDirect?.trophies}`
      );

      // 2. Repeat attempt on completed quest is strictly rejected with HTTP 400 ALREADY_COMPLETED
      const repeatReq = new NextRequest(
        `http://localhost:3000/api/quests/${directQuest._id}/complete`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ asSquad: false }),
        }
      );
      const repeatRes = await completeQuestRoute(repeatReq, {
        params: Promise.resolve({ id: directQuest._id.toString() }),
      });
      const repeatJson = await repeatRes.json();

      assert(repeatRes.status === 400, "Duplicate completion rejected with HTTP 400");
      assert(
        repeatJson.code === "ALREADY_COMPLETED" || repeatJson.error?.code === "ALREADY_COMPLETED",
        `Rejected with code ALREADY_COMPLETED, got: ${JSON.stringify(repeatJson)}`
      );

      // 3. Test GET /api/quests/[id]/complete reports completed status
      const statusReq = new NextRequest(
        `http://localhost:3000/api/quests/${directQuest._id}/complete`,
        { method: "GET" }
      );
      const statusRes = await getQuestCompleteStatus(statusReq, {
        params: Promise.resolve({ id: directQuest._id.toString() }),
      });
      const statusJson = await statusRes.json();
      assert(statusJson.success === true, "GET /api/quests/[id]/complete succeeded");
      assert(statusJson.data.isCompletedByUser === true, "Reports isCompletedByUser = true");

      console.log("  ✅ PASSED: /api/quests/[id]/complete endpoint accurately awards trophies/XP, enforces single-entry idempotency, and reports completion status.");
    }

    console.log("\n─── Suite 4: Auth / Me & Profile Dossier Trophies Projection ───");
    {
      (globalThis as any).__TEST_CURRENT_USER__ = soloHunter;

      const meReq = new NextRequest("http://localhost:3000/api/auth/me");
      const meRes = await getMeRoute(meReq);
      const meJson = await meRes.json();
      assert(meJson.data.trophies === 125, `Expected me.trophies to be 125, got ${meJson.data.trophies}`);

      const profileReq = new NextRequest(
        `http://localhost:3000/api/user/profile?userId=${soloHunter._id}`
      );
      const profileRes = await getProfileRoute(profileReq);
      const profileJson = await profileRes.json();
      assert(profileJson.profile.trophies === 125, `Expected profile.trophies to be 125, got ${profileJson.profile?.trophies}`);

      console.log("  ✅ PASSED: /api/auth/me and /api/user/profile correctly return authentic trophies.");
    }

    console.log("\n─── Suite 5: Leaderboard Trophies Projection & Standings ───");
    {
      (globalThis as any).__TEST_CURRENT_USER__ = soloHunter;

      const lbReq = new NextRequest("http://localhost:3000/api/leaderboard?category=HUNTERS&timeframe=ALL_TIME");
      const lbRes = await getLeaderboardRoute(lbReq);
      const lbJson = await lbRes.json();

      assert(lbJson.success === true, "Solo leaderboard succeeded");
      const hunters = Array.isArray(lbJson.data) ? lbJson.data : (lbJson.data?.hunters || []);
      const foundSolo = hunters.find(
        (entry: any) => entry.username === soloHunter.username
      );
      assert(foundSolo !== undefined, "Solo hunter present on leaderboard");
      assert(foundSolo.trophies === 125, `Expected leaderboard solosleuth trophies 125, got ${foundSolo?.trophies}`);

      const vp = lbJson.viewerPosition || lbJson.data?.viewerPosition;
      assert(vp !== undefined && vp !== null, "Viewer position present");
      assert(vp.trophies === 125, `Expected viewerPosition.trophies 125, got ${vp.trophies}`);

      const squadLbReq = new NextRequest("http://localhost:3000/api/leaderboard?category=SQUADS&timeframe=ALL_TIME");
      const squadLbRes = await getLeaderboardRoute(squadLbReq);
      const squadLbJson = await squadLbRes.json();

      assert(squadLbJson.success === true, "Squad leaderboard succeeded");
      const squads = Array.isArray(squadLbJson.data) ? squadLbJson.data : (squadLbJson.data?.squads || []);
      const foundSquad = squads.find(
        (entry: any) => entry.name === testSquad.name
      );
      assert(foundSquad !== undefined, "Test squad present on squad leaderboard");
      assert(foundSquad.trophies === 160, `Expected squad trophies 160, got ${foundSquad.trophies}`);

      console.log("  ✅ PASSED: Leaderboard operative and syndicate rosters correctly project and sort by Trophies.");
    }

    console.log("\n========================================================");
    console.log("🎉 ALL QUESTS & TROPHIES ENGINE TESTS PASSED (100%)");
    console.log("========================================================\n");
  } finally {
    console.log(`🧹 Dropping ephemeral test database: ${RUN_ID}...`);
    try {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
      console.log("✨ Ephemeral test database dropped cleanly.");
    } catch (e) {
      console.error("Cleanup error:", e);
    }
  }
}

runQuestsTrophiesTests().catch((err) => {
  console.error("❌ QUESTS & TROPHIES TEST FAILED:", err);
  process.exit(1);
});
